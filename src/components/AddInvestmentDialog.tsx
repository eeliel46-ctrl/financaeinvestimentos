import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, TrendingUp } from "lucide-react";
import { searchStock, searchStockFromList, getStockHistory, StockData, StockListItem, HistoricalPrice } from "@/services/brapi";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AddInvestmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export const AddInvestmentDialog = ({ open, onOpenChange, onSuccess }: AddInvestmentDialogProps) => {
    const [ticker, setTicker] = useState("");
    const [quantity, setQuantity] = useState("");
    const [price, setPrice] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [stockData, setStockData] = useState<StockData | null>(null);
    const [suggestions, setSuggestions] = useState<StockListItem[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [historicalData, setHistoricalData] = useState<HistoricalPrice[]>([]);
    const [timeRange, setTimeRange] = useState("30d");
    const [loadingHistory, setLoadingHistory] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

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
            if (ticker.length >= 2) {
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
    }, [ticker]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!stockData) return;

            setLoadingHistory(true);
            try {
                const days = parseInt(timeRange.replace('d', '')) || 30;
                // Map '1y' to 365 days
                const range = timeRange === '1y' ? 365 : days;

                const history = await getStockHistory(stockData.symbol, range);
                setHistoricalData(history);
            } catch (error) {
                console.error("Error fetching history:", error);
            } finally {
                setLoadingHistory(false);
            }
        };

        fetchHistory();
    }, [stockData, timeRange]);

    const handleSelectSuggestion = async (stock: StockListItem) => {
        setTicker(stock.stock);
        setShowSuggestions(false);
        setSuggestions([]);

        // Set stock data from the list
        setStockData({
            symbol: stock.stock,
            longName: stock.name,
            regularMarketPrice: stock.close,
            logourl: stock.logo,
            regularMarketChangePercent: stock.change
        });
        setPrice(stock.close.toString());
    };

    const handleSearch = async () => {
        if (!ticker) return;

        setSearching(true);
        setShowSuggestions(false);
        try {
            const data = await searchStock(ticker);
            if (data) {
                setStockData(data);
                setPrice(data.regularMarketPrice.toString());
            } else {
                toast.error("Ação não encontrada. Tente digitar o código completo (ex: PETR4)");
                setStockData(null);
            }
        } catch (error) {
            toast.error("Erro ao buscar ação");
        } finally {
            setSearching(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stockData || !quantity || !price || !date) {
            toast.error("Preencha todos os campos");
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                toast.error("Usuário não autenticado");
                return;
            }

            const { error } = await supabase
                .from('investments')
                .insert({
                    user_id: user.id,
                    ticker: stockData.symbol,
                    quantity: Number(quantity),
                    purchase_price: Number(price),
                    purchase_date: new Date(date).toISOString(),
                });

            if (error) throw error;

            toast.success("Investimento adicionado com sucesso!");
            onSuccess();
            onOpenChange(false);

            // Reset form
            setTicker("");
            setQuantity("");
            setPrice("");
            setStockData(null);

        } catch (error: any) {
            console.error("Error adding investment:", error);
            toast.error(error.message || "Erro ao salvar investimento");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            // Reset form when closing
            setTicker("");
            setQuantity("");
            setPrice("");
            setStockData(null);
            setSuggestions([]);
            setShowSuggestions(false);
        }
        onOpenChange(isOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Adicionar Investimento</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="ticker">Código da Ação (Ticker)</Label>
                        <div className="relative">
                            <div className="flex gap-2">
                                <Input
                                    ref={inputRef}
                                    id="ticker"
                                    value={ticker}
                                    onChange={(e) => {
                                        setTicker(e.target.value.toUpperCase());
                                        setStockData(null);
                                    }}
                                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                    placeholder="Digite o código (ex: PETR4, VALE3)"
                                    autoComplete="off"
                                />
                                <Button type="button" size="icon" onClick={handleSearch} disabled={searching}>
                                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
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
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Digite pelo menos 2 caracteres para ver sugestões
                        </p>
                    </div>

                    {stockData && (
                        <div className="space-y-4">
                            <div className="p-3 bg-muted rounded-lg flex items-center gap-3">
                                {stockData.logourl && (
                                    <img
                                        src={stockData.logourl}
                                        alt={stockData.symbol}
                                        className="w-10 h-10 rounded"
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                )}
                                <div className="flex-1">
                                    <p className="font-bold">{stockData.symbol}</p>
                                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">{stockData.longName}</p>
                                    <p className="text-sm font-medium text-primary">
                                        Preço Atual: R$ {stockData.regularMarketPrice?.toFixed(2) || '0.00'}
                                    </p>
                                </div>
                            </div>

                            {/* Historical Price Chart */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">Histórico de Preços</Label>
                                    <Tabs value={timeRange} onValueChange={setTimeRange} className="w-auto">
                                        <TabsList className="h-6 p-0 bg-transparent">
                                            {['1d', '5d', '30d', '60d', '1y'].map((range) => (
                                                <TabsTrigger
                                                    key={range}
                                                    value={range}
                                                    className="h-6 px-2 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-sm"
                                                >
                                                    {range.toUpperCase()}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>
                                    </Tabs>
                                </div>

                                <div className="h-[200px] w-full border rounded-md p-2 bg-card">
                                    {loadingHistory ? (
                                        <div className="h-full flex items-center justify-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : historicalData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={historicalData}>
                                                <defs>
                                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis
                                                    dataKey="date"
                                                    tickFormatter={(date) => {
                                                        const d = new Date(date);
                                                        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                                    }}
                                                    tick={{ fontSize: 10 }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    minTickGap={30}
                                                />
                                                <YAxis
                                                    domain={['auto', 'auto']}
                                                    tick={{ fontSize: 10 }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={(val) => `R$${val.toFixed(0)}`}
                                                    width={40}
                                                />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    labelFormatter={(date) => new Date(date).toLocaleDateString('pt-BR')}
                                                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Preço']}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="close"
                                                    stroke="#10b981"
                                                    strokeWidth={2}
                                                    fillOpacity={1}
                                                    fill="url(#colorPrice)"
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                            Histórico não disponível para esta ação
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="quantity">Quantidade</Label>
                            <Input
                                id="quantity"
                                type="number"
                                step="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="price">Preço de Compra</Label>
                            <Input
                                id="price"
                                type="number"
                                step="0.01"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="date">Data da Compra</Label>
                        <Input
                            id="date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading || !stockData}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Salvar Investimento
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
