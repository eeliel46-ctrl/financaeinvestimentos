import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Bell, BellOff, TrendingUp, TrendingDown, Trash2, RefreshCcw, Bot, Send } from "lucide-react";
import { getStockChatResponse } from "@/services/groq";
import { searchStock, searchStockFromList, getStockHistory, StockData, StockListItem, HistoricalPrice } from "@/services/brapi";
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
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySystem, setNotifySystem] = useState(true);
  const [savingAlert, setSavingAlert] = useState(false);

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
  }, [stockData?.symbol]);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAlerts();
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

  useEffect(() => {
    if (stockData) {
      fetchHistoricalData(stockData.symbol);
    }
  }, [selectedRange]);

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
      const attempts: Array<{ r: '1d' | '2d' | '5d' | '7d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max' | '30d' | '60d'; i?: '15m' | '30m' | '1d' }> = [];
      if (selectedRange === '1d') {
        attempts.push(
          { r: '1d', i: '15m' },
          { r: '1d', i: '30m' },
          { r: '2d', i: '1d' },
          { r: '5d', i: '1d' },
          { r: '7d', i: '1d' },
          { r: '1mo', i: '1d' },
          { r: '3mo', i: '1d' },
          { r: '6mo', i: '1d' },
          { r: '1y', i: '1d' },
          { r: '2y', i: '1d' },
          { r: '5y', i: '1d' },
          { r: '10y', i: '1d' },
          { r: 'ytd', i: '1d' },
          { r: 'max', i: '1d' }
        );
      } else if (selectedRange === '30d') {
        attempts.push(
          { r: '30d', i: '1d' },
          { r: '60d', i: '1d' },
          { r: '1mo', i: '1d' },
          { r: '3mo', i: '1d' },
          { r: '6mo', i: '1d' },
          { r: '1y', i: '1d' },
          { r: 'ytd', i: '1d' },
          { r: 'max', i: '1d' },
          { r: '5d', i: '1d' },
          { r: '1d', i: '30m' }
        );
      } else if (selectedRange === '60d') {
        attempts.push(
          { r: '60d', i: '1d' },
          { r: '30d', i: '1d' },
          { r: '3mo', i: '1d' },
          { r: '6mo', i: '1d' },
          { r: '1y', i: '1d' },
          { r: 'ytd', i: '1d' },
          { r: 'max', i: '1d' },
          { r: '5d', i: '1d' }
        );
      } else if (selectedRange === '5d') {
        attempts.push(
          { r: '5d', i: '1d' },
          { r: '7d', i: '1d' },
          { r: '1mo', i: '1d' },
          { r: '3mo', i: '1d' },
          { r: '6mo', i: '1d' },
          { r: '1y', i: '1d' }
        );
      } else {
        attempts.push(
          { r: '1y', i: '1d' },
          { r: '6mo', i: '1d' },
          { r: '3mo', i: '1d' },
          { r: '1mo', i: '1d' },
          { r: '60d', i: '1d' },
          { r: '30d', i: '1d' },
          { r: '5d', i: '1d' },
          { r: '1d', i: '30m' }
        );
      }

      let history: HistoricalPrice[] = [];
      for (const a of attempts) {
        history = await getStockHistory(symbol, a.r, a.i);
        if (history.length > 1) break;
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
          alert_type: 'buy',
          notify_email: notifyEmail,
          notify_system: notifySystem,
        });

      if (error) throw error;

      toast.success("Alerta de compra criado com sucesso!");
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

  const clearSearch = () => {
    setTicker("");
    setStockData(null);
    setHistoricalData([]);
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
          <p className="text-muted-foreground">Acompanhe o histórico e defina alertas de compra</p>
        </div>
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
                onChange={(e) => {
                  setTicker(e.target.value.toUpperCase());
                  if (stockData) {
                    setStockData(null);
                    setHistoricalData([]);
                  }
                }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Digite o código (ex: PETR4, VALE3)"
                autoComplete="off"
              />
              <Button onClick={handleSearch} disabled={searching}>
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

          {/* Alert Creation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Criar Alerta de Compra
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Preço Alvo de Compra</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder={`Ex: ${((stockData.regularMarketPrice || 0) * 0.95).toFixed(2)}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Preço atual: R$ {stockData.regularMarketPrice?.toFixed(2)}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="notify-email"
                      checked={notifyEmail}
                      onCheckedChange={setNotifyEmail}
                    />
                    <Label htmlFor="notify-email">Notificar por E-mail</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="notify-system"
                      checked={notifySystem}
                      onCheckedChange={setNotifySystem}
                    />
                    <Label htmlFor="notify-system">Notificação no Sistema</Label>
                  </div>
                </div>

                <div className="flex items-end">
                  <Button onClick={handleCreateAlert} disabled={savingAlert || !targetPrice} className="w-full">
                    {savingAlert ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                    Criar Alerta
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* AI Chat Section */}
      {stockData && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Assistente IA - {stockData.symbol}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
                    <Bot className="h-12 w-12 mb-2 opacity-20" />
                    <p>Olá! Sou seu assistente financeiro.</p>
                    <p className="text-sm">Pergunte-me sobre {stockData.symbol}, tendências ou fundamentos.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                            }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg p-3">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua pergunta..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={chatLoading}
                />
                <Button onClick={handleSendMessage} disabled={chatLoading || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Meus Alertas Ativos ({alerts.length})
          </CardTitle>
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
    </div>
  );
};
