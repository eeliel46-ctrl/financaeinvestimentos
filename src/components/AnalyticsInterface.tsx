import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Bell, BellOff, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { searchStock, searchStockFromList, getStockHistory, StockData, StockListItem, HistoricalPrice } from "@/services/brapi";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

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
  
  // Alert form state
  const [targetPrice, setTargetPrice] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySystem, setNotifySystem] = useState(true);
  const [savingAlert, setSavingAlert] = useState(false);

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
      const history = await getStockHistory(symbol, 90); // 90 days
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
    date: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    price: item.close,
    high: item.high,
    low: item.low,
  }));

  const priceChange = historicalData.length > 1 
    ? ((historicalData[historicalData.length - 1].close - historicalData[0].close) / historicalData[0].close) * 100 
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
                    <span className="text-sm text-muted-foreground">Variação 90 dias:</span>
                    <Badge variant={priceChange >= 0 ? "default" : "destructive"}>
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                    </Badge>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
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
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorPrice)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Histórico não disponível para esta ação
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