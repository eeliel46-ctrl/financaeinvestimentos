import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Bell, BellOff, TrendingUp, TrendingDown, Trash2, RefreshCcw, Bot, Send, Star } from "lucide-react";
import { getStockChatResponse, getMarketAnalysis, getMarketNewsAI, AIAnalysisResult } from "@/services/groq";
import { searchStock, searchStockFromList, getStockHistory, getTopMovers, StockData, StockListItem, HistoricalPrice, MarketMovers } from "@/services/brapi";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StockAlert {
  id: string;
  ticker: string;
  target_price: number;
  alert_type: string;
  notify_email: boolean;
  notify_system: boolean;
  is_active: boolean;
  created_at: string;
}

export const AnalyticsInterface = () => {
  const [ticker, setTicker] = useState("");
  const [searching, setSearching] = useState(false);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalPrice[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [suggestions, setSuggestions] = useState<StockListItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [selectedRange, setSelectedRange] = useState<'1d' | '5d' | '30d' | '60d' | '1y'>('30d');

  // Alert form state
  const [targetPrice, setTargetPrice] = useState("");
  const [alertType, setAlertType] = useState<'buy' | 'sell'>('buy');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySystem, setNotifySystem] = useState(true);
  const [savingAlert, setSavingAlert] = useState(false);

  // Market Overview State
  const [marketMovers, setMarketMovers] = useState<MarketMovers | null>(null);
  const [marketNews, setMarketNews] = useState<string[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(true);

  // Favorites state
  const [isFavorite, setIsFavorite] = useState(false);
  const [loadingFavorite, setLoadingFavorite] = useState(false);
  const [favorites, setFavorites] = useState<Array<{ id: string; ticker: string; stock_name: string; price?: number; change?: number }>>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  // AI Analysis state
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !stockData) return;

    const userMessage = chatInput;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await getStockChatResponse(
        stockData.symbol,
        userMessage,
        {
          price: stockData.regularMarketPrice,
          change: stockData.regularMarketChangePercent
        }
      );

      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      toast.error("Erro ao processar mensagem");
    } finally {
      setChatLoading(false);
    }
  };

  // Clear chat when stock changes
  useEffect(() => {
    setChatMessages([]);
    checkIfFavorite();
  }, [stockData?.symbol]);

  // Check if current stock is favorited
  const checkIfFavorite = async () => {
    if (!stockData) {
      setIsFavorite(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('stock_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('ticker', stockData.symbol)
        .maybeSingle();

      if (error) throw error;
      setIsFavorite(!!data);
    } catch (error) {
      console.error('Error checking favorite:', error);
    }
  };

  // Toggle favorite status
  const toggleFavorite = async () => {
    if (!stockData) return;

    setLoadingFavorite(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

      if (isFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from('stock_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('ticker', stockData.symbol);

        if (error) throw error;
        setIsFavorite(false);
        toast.success(`${stockData.symbol} removido dos favoritos`);
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('stock_favorites')
          .insert({
            user_id: user.id,
            ticker: stockData.symbol,
            stock_name: stockData.longName
          });

        if (error) throw error;
        setIsFavorite(true);
        toast.success(`${stockData.symbol} adicionado aos favoritos`);
      }
    } catch (error: any) {
      console.error('Error toggling favorite:', error);
      toast.error(error.message || "Erro ao atualizar favorito");
    } finally {
      setLoadingFavorite(false);
      fetchFavorites(); // Refresh favorites list
    }
  };

  // Fetch user's favorites with current prices
  const fetchFavorites = async () => {
    setLoadingFavorites(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFavorites([]);
        return;
      }

      const { data, error } = await supabase
        .from('stock_favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch current prices for all favorites
        const tickers = data.map(f => f.ticker);
        const { getStocksBatch } = await import('@/services/brapi');
        const stocksData = await getStocksBatch(tickers);

        const favoritesWithPrices = data.map(fav => {
          const stockInfo = stocksData.find(s => s.symbol === fav.ticker);
          return {
            ...fav,
            price: stockInfo?.regularMarketPrice,
            change: stockInfo?.regularMarketChangePercent
          };
        });

        setFavorites(favoritesWithPrices);
      } else {
        setFavorites([]);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoadingFavorites(false);
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAlerts();
    fetchFavorites();

    const loadMarketOverview = async () => {
      setLoadingMarket(true);
      try {
        const movers = await getTopMovers();
        setMarketMovers(movers);
        if (movers.gainers.length > 0) {
          // Only fetch news if we have movers to analyze
          const news = await getMarketNewsAI(movers.gainers, movers.losers);
          setMarketNews(news);
        }
      } catch (e) {
        console.error("Failed to load market overview", e);
      } finally {
        setLoadingMarket(false);
      }
    };
    loadMarketOverview();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchSuggestions = async () => {
      if (ticker.length >= 2 && !stockData) {
        const results = await searchStockFromList(ticker);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const debounce = setTimeout(searchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [ticker, stockData]);

  const fetchAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('stock_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const [notificationPermission, setNotificationPermission] = useState(
    'Notification' in window ? Notification.permission : 'default'
  );

  useEffect(() => {
    // Check permission on mount
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error("Este navegador não suporta notificações.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        toast.success("Notificações permitidas! 🎉");

        // Tenta enviar uma notificação de teste imediata
        try {
          // Em mobile, ServiceWorkerRegistration.showNotification é mais confiável que new Notification()
          if (navigator.serviceWorker && navigator.serviceWorker.ready) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification('FinanceBot', {
              body: 'Notificações ativadas com sucesso!',
              icon: '/icon-192.png',
              vibrate: [200, 100, 200]
            });
          } else {
            new Notification("FinanceBot", {
              body: "Notificações ativadas com sucesso!",
              icon: "/icon-192.png"
            });
          }
        } catch (e) {
          console.error("Erro no teste de notificação:", e);
        }
      } else if (permission === 'denied') {
        toast.error("Notificações bloqueadas nas configurações do navegador.", {
          description: "Clique no cadeado 🔒 na barra de endereço ou vá em Configurações do Site para permitir.",
          duration: 8000
        });
      } else {
        toast.info("Você precisa permitir as notificações para receber alertas.");
      }
    } catch (error) {
      console.error("Erro ao solicitar permissão:", error);
      toast.error("Erro ao solicitar permissão.");
    }
  };



  // Monitor alerts
  useEffect(() => {
    const checkAlerts = async () => {
      // ... existing checkAlerts logic ...
    };
    // ...
  });

  // WAIT - I need to be careful with the Replace block. 
  // I will target the requestNotificationPermission function logic AND the button render logic.
  // But they are far apart in the file. I should use MultiReplaceFileContent or two separate calls.
  // Using MultiReplaceFileContent is safer.

  // Wait, I don't have MultiReplaceFileContent in this environment? Checking tools...
  // Yes I do: default_api:multi_replace_file_content.
  // Switching to multi_replace_file_content.


  const sendTestNotification = () => {
    if (Notification.permission === 'granted') {
      try {
        new Notification("FinanceBot 🔔", {
          body: "Teste de notificação funcionando perfeitamente!",
          icon: "/icon-192.png"
        });
        toast.success("Notificação enviada! Verifique sua área de notificações.");
      } catch (e) {
        console.error(e);
        toast.error("Erro ao enviar. Verifique se o 'Não Perturbe' está ativado.");
      }
    } else {
      toast.error("Permissão de notificação necessária.");
    }
  };

  // Monitor alerts
  useEffect(() => {
    const checkAlerts = async () => {
      if (alerts.length === 0) return;

      const activeAlerts = alerts.filter(a => a.is_active);
      if (activeAlerts.length === 0) return;

      // Group by ticker to minimize API calls
      const tickersToCheck = [...new Set(activeAlerts.map(a => a.ticker))];

      for (const ticker of tickersToCheck) {
        try {
          const data = await searchStock(ticker);
          if (data && data.regularMarketPrice) {
            const currentPrice = data.regularMarketPrice;

            // Check alerts for this ticker
            const tickerAlerts = activeAlerts.filter(a => a.ticker === ticker);

            for (const alert of tickerAlerts) {
              let triggered = false;
              if (alert.alert_type === 'buy' && currentPrice <= alert.target_price) {
                triggered = true;
              } else if (alert.alert_type === 'sell' && currentPrice >= alert.target_price) {
                triggered = true;
              }

              if (triggered) {
                if (Notification.permission === 'granted') {
                  new Notification(`Alerta de ${alert.alert_type === 'buy' ? 'Compra' : 'Venda'}: ${ticker}`, {
                    body: `O preço atingiu R$ ${currentPrice.toFixed(2)}. Alvo: R$ ${alert.target_price.toFixed(2)}`,
                    icon: data.logourl
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error(`Error checking price for ${ticker}`, e);
        }
      }
    };

    // Check every 60 seconds
    const intervalId = setInterval(checkAlerts, 60000);
    // Initial check
    const initialTimeout = setTimeout(checkAlerts, 5000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(initialTimeout);
    };
  }, [alerts]);

  const handleSelectSuggestion = async (stock: StockListItem) => {
    setTicker(stock.stock);
    setShowSuggestions(false);
    setSuggestions([]);

    setStockData({
      symbol: stock.stock,
      longName: stock.name,
      regularMarketPrice: stock.close,
      logourl: stock.logo,
      regularMarketChangePercent: stock.change
    });

    // Fetch historical data
    await fetchHistoricalData(stock.stock);
  };

  const fetchHistoricalData = async (symbol: string) => {
    setLoadingHistory(true);
    try {
      let history: HistoricalPrice[] = [];

      if (selectedRange === '1d') {
        // Simplified 1d logic: try 15m, then 5m, then fallback to 5d
        history = await getStockHistory(symbol, '1d', '15m');
        if (history.length <= 1) history = await getStockHistory(symbol, '1d', '5m');
        if (history.length <= 1) history = await getStockHistory(symbol, '5d', '1d');
      } else if (selectedRange === '5d') {
        // Simplified 5d logic
        history = await getStockHistory(symbol, '5d', '1d');
        if (history.length <= 1) history = await getStockHistory(symbol, '7d', '1d');
        if (history.length <= 1) history = await getStockHistory(symbol, '1mo', '1d');
      } else if (selectedRange === '30d') {
        history = await getStockHistory(symbol, '30d', '1d');
        if (history.length <= 1) history = await getStockHistory(symbol, '60d', '1d');
        if (history.length <= 1) history = await getStockHistory(symbol, '1mo', '1d');
      } else if (selectedRange === '60d') {
        history = await getStockHistory(symbol, '60d', '1d');
        if (history.length <= 1) history = await getStockHistory(symbol, '3mo', '1d');
        if (history.length <= 1) history = await getStockHistory(symbol, '6mo', '1d');
      } else {
        // 1y
        history = await getStockHistory(symbol, '1y', '1d');
        if (history.length <= 1) history = await getStockHistory(symbol, '6mo', '1d');
        if (history.length <= 1) history = await getStockHistory(symbol, '3mo', '1d');
      }


      setHistoricalData(history);
    } catch (error) {
      console.error("Error fetching historical data:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSearch = async () => {
    if (!ticker) return;

    setSearching(true);
    setShowSuggestions(false);

    // Clear previous results
    setStockData(null);
    setHistoricalData([]);
    setAnalysis(null);

    try {
      const data = await searchStock(ticker);
      if (data) {
        setStockData(data);
        await fetchHistoricalData(data.symbol);
      } else {
        toast.error("Ação não encontrada. Tente digitar o código completo (ex: PETR4)");
        setStockData(null);
        setHistoricalData([]);
      }
    } catch (error) {
      toast.error("Erro ao buscar ação");
    } finally {
      setSearching(false);
    }
  };

  const handleRefresh = async () => {
    if (!stockData) return;
    setSearching(true);
    try {
      const data = await searchStock(stockData.symbol);
      if (data) {
        setStockData(data);
      }
      await fetchHistoricalData(stockData.symbol);
    } finally {
      setSearching(false);
    }
  };


  const handleCreateAlert = async () => {
    if (!stockData || !targetPrice) {
      toast.error("Selecione uma ação e defina um preço alvo");
      return;
    }

    setSavingAlert(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const { error } = await supabase
        .from('stock_alerts')
        .insert({
          user_id: user.id,
          ticker: stockData.symbol,
          target_price: Number(targetPrice),
          alert_type: alertType,
          notify_email: false,
          notify_system: true,
        });

      if (error) throw error;

      toast.success(`Alerta de ${alertType === 'buy' ? 'compra' : 'venda'} criado!`);
      setTargetPrice("");
      fetchAlerts();
    } catch (error: any) {
      console.error("Error creating alert:", error);
      toast.error(error.message || "Erro ao criar alerta");
    } finally {
      setSavingAlert(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('stock_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      toast.success("Alerta removido!");
      fetchAlerts();
    } catch (error) {
      console.error("Error deleting alert:", error);
      toast.error("Erro ao remover alerta");
    }
  };

  const handleAnalyze = async () => {
    if (!stockData || historicalData.length === 0) return;
    setAnalyzing(true);
    try {
      const result = await getMarketAnalysis(
        stockData.symbol,
        stockData.regularMarketPrice || 0,
        historicalData,
        selectedRange
      );
      setAnalysis(result);
    } catch (error) {
      toast.error("Erro ao gerar análise");
    } finally {
      setAnalyzing(false);
    }
  };

  const clearSearch = () => {
    setTicker("");
    setStockData(null);
    setHistoricalData([]);
    setAnalysis(null);
    setTargetPrice("");
  };

  const chartData = historicalData.map(item => ({
    date:
      selectedRange === '1d'
        ? new Date(item.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
        : new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    price: item.close,
    high: item.high,
    low: item.low,
  }));

  const priceChange = historicalData.length > 1
    ? (selectedRange === '1d' && stockData?.regularMarketPreviousClose
      ? ((historicalData[historicalData.length - 1].close - (stockData.regularMarketPreviousClose || historicalData[0].close)) / (stockData.regularMarketPreviousClose || historicalData[0].close)) * 100
      : ((historicalData[historicalData.length - 1].close - historicalData[0].close) / historicalData[0].close) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Análise de Ações</h1>
          <p className="text-muted-foreground">Acompanhe o histórico do mercado e defina seus investimentos</p>
        </div>
      </div>

      {/* Favorites Section */}
      {favorites.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              Meus Favoritos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingFavorites ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {favorites.map((fav) => (
                  <button
                    key={fav.id}
                    onClick={() => {
                      setTicker(fav.ticker);
                      handleSearch();
                    }}
                    className="p-3 rounded-lg border border-border hover:border-primary hover:bg-accent transition-all text-left group"
                  >
                    <div className="font-bold text-sm text-primary group-hover:text-primary">{fav.ticker}</div>
                    {fav.price && (
                      <>
                        <div className="text-lg font-semibold mt-1">R$ {fav.price.toFixed(2)}</div>
                        {fav.change !== undefined && (
                          <div className={`text-xs font-medium ${fav.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {fav.change >= 0 ? '+' : ''}{fav.change.toFixed(2)}%
                          </div>
                        )}
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Market Overview Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Gainers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Maiores Altas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMarket ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : marketMovers?.gainers.length ? (
              <div className="rounded-md border">
                <div className="grid grid-cols-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <div>Ativo</div>
                  <div className="text-center">Data</div>
                  <div className="text-right">Último (R$)</div>
                  <div className="text-right">Var. Dia (%)</div>
                </div>
                <div className="divide-y max-h-[240px] overflow-y-auto">
                  {marketMovers.gainers.map((stock) => (
                    <div
                      key={stock.stock}
                      className="grid grid-cols-4 p-3 items-center hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleSelectSuggestion(stock)}
                    >
                      <div className="font-bold text-blue-600 dark:text-blue-400">{stock.stock}</div>
                      <div className="text-center text-sm">
                        {(() => {
                          const date = new Date();
                          const day = date.getDay();
                          // Adjust for weekend (0=Sun, 6=Sat) to show last Friday
                          if (day === 0) date.setDate(date.getDate() - 2);
                          else if (day === 6) date.setDate(date.getDate() - 1);
                          return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        })()}
                      </div>
                      <div className="text-right text-sm font-medium">{stock.close.toFixed(2)}</div>
                      <div className="text-right text-sm font-bold text-green-500">+{stock.change?.toFixed(2)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Dados indisponíveis</p>
            )}
          </CardContent>
        </Card>

        {/* Top Losers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Maiores Baixas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMarket ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : marketMovers?.losers.length ? (
              <div className="rounded-md border">
                <div className="grid grid-cols-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <div>Ativo</div>
                  <div className="text-center">Data</div>
                  <div className="text-right">Último (R$)</div>
                  <div className="text-right">Var. Dia (%)</div>
                </div>
                <div className="divide-y max-h-[240px] overflow-y-auto">
                  {marketMovers.losers.map((stock) => (
                    <div
                      key={stock.stock}
                      className="grid grid-cols-4 p-3 items-center hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleSelectSuggestion(stock)}
                    >
                      <div className="font-bold text-blue-600 dark:text-blue-400">{stock.stock}</div>
                      <div className="text-center text-sm">
                        {(() => {
                          const date = new Date();
                          const day = date.getDay();
                          // Adjust for weekend (0=Sun, 6=Sat) to show last Friday
                          if (day === 0) date.setDate(date.getDate() - 2);
                          else if (day === 6) date.setDate(date.getDate() - 1);
                          return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        })()}
                      </div>
                      <div className="text-right text-sm font-medium">{stock.close.toFixed(2)}</div>
                      <div className="text-right text-sm font-bold text-red-500">{stock.change?.toFixed(2)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Dados indisponíveis</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Ação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-md">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Digite o código (ex: PETR4, VALE3)"
                autoComplete="off"
              />
              <Button onClick={handleSearch} disabled={searching || !ticker}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
              {stockData && (
                <Button variant="outline" onClick={clearSearch}>
                  Limpar
                </Button>
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg"
              >
                <ScrollArea className="max-h-[200px]">
                  {suggestions.map((stock) => (
                    <button
                      key={stock.stock}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3 transition-colors"
                      onClick={() => handleSelectSuggestion(stock)}
                    >
                      {stock.logo && (
                        <img
                          src={stock.logo}
                          alt={stock.stock}
                          className="w-6 h-6 rounded"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{stock.stock}</p>
                        <p className="text-xs text-muted-foreground truncate">{stock.name}</p>
                      </div>
                      <span className="text-sm font-medium text-primary">
                        R$ {stock.close?.toFixed(2) || '0.00'}
                      </span>
                    </button>
                  ))}
                </ScrollArea>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Digite pelo menos 2 caracteres para ver sugestões
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stock Info & Chart */}
      {stockData && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {stockData.logourl && (
                    <img
                      src={stockData.logourl}
                      alt={stockData.symbol}
                      className="w-12 h-12 rounded-lg"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                  <div>
                    <CardTitle className="text-2xl">{stockData.symbol}</CardTitle>
                    <p className="text-muted-foreground">{stockData.longName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-3xl font-bold">R$ {stockData.regularMarketPrice?.toFixed(2)}</p>
                    <div className="flex items-center gap-1 justify-end">
                      {(stockData.regularMarketChangePercent || 0) >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <span className={`font-medium ${(stockData.regularMarketChangePercent || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {(stockData.regularMarketChangePercent || 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleFavorite}
                    disabled={loadingFavorite}
                    title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    className="h-10 w-10"
                  >
                    {loadingFavorite ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Star className={`h-5 w-5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : historicalData.length > 0 ? (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm text-muted-foreground">Variação {selectedRange.toUpperCase()}:</span>
                    <Badge variant={priceChange >= 0 ? "default" : "destructive"}>
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
                    <Tabs value={selectedRange} onValueChange={(v) => setSelectedRange(v as any)}>
                      <TabsList className="h-8 p-1 bg-muted">
                        {['1d', '5d', '30d', '60d', '1y'].map((range) => (
                          <TabsTrigger key={range} value={range} className="h-6 px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground rounded-sm">
                            {range.toUpperCase()}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={searching}>
                      <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar
                    </Button>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorGain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `R$${value.toFixed(0)}`}
                        className="text-muted-foreground"
                      />
                      <Tooltip
                        formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Preço']}
                        labelFormatter={(label) => `Data: ${label}`}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke={priceChange >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                        fillOpacity={1}
                        fill={priceChange >= 0 ? "url(#colorGain)" : "url(#colorLoss)"}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground text-sm p-4 text-center">
                  <p>Histórico não disponível para esta ação.</p>
                  <p className="text-xs mt-2 opacity-70">Verifique se o token da API Brapi está configurado no arquivo .env</p>
                </div>
              )}
            </CardContent>
          </Card>



          {/* AI Technical Analysis */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-500" />
                Análise Técnica Inteligente
              </CardTitle>
              {!analysis && (
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing || historicalData.length === 0}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                  Gerar Análise IA
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {analysis ? (
                <div className="space-y-6 pt-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Badge variant={
                          analysis.recommendation === 'buy' ? 'default' :
                            analysis.recommendation === 'sell' ? 'destructive' : 'secondary'
                        } className="text-lg px-4 py-1">
                          {analysis.recommendation === 'buy' ? 'COMPRA' :
                            analysis.recommendation === 'sell' ? 'VENDA' :
                              analysis.recommendation === 'hold' ? 'MANTER' : 'NEUTRO'}
                        </Badge>
                        <span className="text-sm font-medium text-muted-foreground">
                          Baseado em {selectedRange}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-lg">
                        <span className="text-sm font-medium">Confiabilidade do Sinal:</span>
                        <div className="w-32 h-2.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ease-out ${analysis.confidence >= 70 ? 'bg-green-500' :
                              analysis.confidence >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                            style={{ width: `${analysis.confidence}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold">{analysis.confidence}%</span>
                      </div>
                    </div>

                    <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={analyzing}>
                      <RefreshCcw className={`mr-2 h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
                      Atualizar Análise
                    </Button>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 p-5 rounded-xl border border-purple-100 dark:border-purple-900/50">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Bot className="h-4 w-4 text-purple-500" />
                      Resumo da IA
                    </h4>
                    <p className="text-sm leading-relaxed text-foreground/90">{analysis.summary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analysis.keyPoints.map((point, i) => (
                      <div key={i} className="group hover:bg-muted/50 transition-colors duration-200 flex items-start gap-3 bg-background p-4 rounded-lg border shadow-sm">
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-purple-500 shrink-0 group-hover:scale-125 transition-transform" />
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 bg-muted/10 rounded-xl border border-dashed border-muted mt-2">
                  <Bot className="h-12 w-12 text-muted-foreground/20 mb-3" />
                  <p className="text-muted-foreground font-medium">Análise Técnica com IA</p>
                  <p className="text-xs text-muted-foreground/70 max-w-xs text-center mb-4">
                    Utilize nossa inteligência artificial para analisar indicadores técnicos, tendências e volatilidade.
                  </p>
                  <Button onClick={handleAnalyze} disabled={analyzing || historicalData.length === 0} variant="outline" className="border-purple-200 hover:bg-purple-50 dark:border-purple-900 dark:hover:bg-purple-950/50 text-purple-700 dark:text-purple-300">
                    {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                    Executar Análise Agora
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alert Creation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Criar Alerta de Preço
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Tipo de Alerta</Label>
                  <div className="flex items-center space-x-2 bg-muted/50 p-1 rounded-lg">
                    <Button
                      variant={alertType === 'buy' ? 'default' : 'ghost'}
                      size="sm"
                      className={`flex-1 ${alertType === 'buy' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                      onClick={() => setAlertType('buy')}
                    >
                      Compra
                    </Button>
                    <Button
                      variant={alertType === 'sell' ? 'default' : 'ghost'}
                      size="sm"
                      className={`flex-1 ${alertType === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                      onClick={() => setAlertType('sell')}
                    >
                      Venda
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preço Alvo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder={`Ex: ${((stockData.regularMarketPrice || 0) * (alertType === 'buy' ? 0.95 : 1.05)).toFixed(2)}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Atual: R$ {stockData.regularMarketPrice?.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-end col-span-2 lg:col-span-2">
                  <Button onClick={handleCreateAlert} disabled={savingAlert || !targetPrice} className="w-full">
                    {savingAlert ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                    Criar Alerta
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )
      }



      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Meus Alertas Ativos ({alerts.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              {notificationPermission === 'granted' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast.success("Notificações ativas! Enviando teste...");
                    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                      navigator.serviceWorker.ready.then(reg => {
                        reg.showNotification('Teste FinanceBot', {
                          body: 'Se você está vendo isso, está funcionando!',
                          icon: '/icon-192.png'
                        });
                      });
                    } else {
                      new Notification("FinanceBot", {
                        body: "Teste de notificação!",
                        icon: "/icon-192.png"
                      });
                    }
                  }}
                  className="flex gap-2 border-green-200 text-green-700 hover:text-green-800 hover:bg-green-50"
                >
                  <Bell className="h-4 w-4" />
                  Ativas (Testar)
                </Button>
              ) : notificationPermission === 'denied' ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={requestNotificationPermission}
                  className="flex gap-2"
                >
                  <BellOff className="h-4 w-4" />
                  Desbloquear
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={requestNotificationPermission}
                  className="flex gap-2"
                >
                  <Bell className="h-4 w-4" />
                  Ativar Notificações
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAlerts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum alerta ativo. Busque uma ação e crie seu primeiro alerta!
            </p>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-bold text-lg">{alert.ticker}</p>
                      <p className="text-sm text-muted-foreground">
                        Alerta de {alert.alert_type === 'buy' ? 'compra' : 'venda'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-primary">R$ {Number(alert.target_price).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      {alert.notify_email && (
                        <Badge variant="outline" className="text-xs">
                          E-mail
                        </Badge>
                      )}
                      {alert.notify_system && (
                        <Badge variant="outline" className="text-xs">
                          Sistema
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div >
  );
};

