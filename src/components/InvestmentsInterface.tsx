
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2, Search, Bot, Loader2, RefreshCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getMarketAnalysis, AIAnalysisResult } from "@/services/groq";
import { getStockHistory } from "@/services/brapi";
import { AddInvestmentDialog } from "./AddInvestmentDialog";
import { supabase } from "@/integrations/supabase/client";
import { getStocksBatch } from "@/services/brapi";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface Investment {
    id: string;
    ticker: string;
    quantity: number;
    purchase_price: number;
    purchase_date: string;
    current_price?: number;
    logo_url?: string;
}

export const InvestmentsInterface = () => {
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [totalInvested, setTotalInvested] = useState(0);
    const [currentTotalValue, setCurrentTotalValue] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");

    // AI Analysis State
    const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzedStock, setAnalyzedStock] = useState<string | null>(null);

    const handleAnalyze = async (ticker: string, currentPrice: number) => {
        setAnalyzing(true);
        setAnalyzedStock(ticker);
        setAnalysis(null);
        try {
            // Fetch minimal history for analysis (30d)
            const history = await getStockHistory(ticker, '30d');

            if (history.length === 0) {
                toast.error("Dados históricos insuficientes para análise");
                return;
            }

            const result = await getMarketAnalysis(
                ticker,
                currentPrice,
                history,
                '30d'
            );
            setAnalysis(result);
        } catch (error) {
            console.error("Analysis error:", error);
            toast.error("Erro ao gerar análise");
        } finally {
            setAnalyzing(false);
        }
    };

    const closeAnalysis = () => {
        setAnalysis(null);
        setAnalyzedStock(null);
    };

    const fetchInvestments = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) return;

            const { data, error } = await supabase
                .from('investments')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                // Clean and deduplicate tickers
                const cleanedData = data.map(inv => {
                    let cleanTicker = inv.ticker.trim().toUpperCase();

                    // Fix duplicated tickers (e.g., VALE3VALE3 -> VALE3)
                    const halfLength = Math.floor(cleanTicker.length / 2);
                    const firstHalf = cleanTicker.substring(0, halfLength);
                    const secondHalf = cleanTicker.substring(halfLength);

                    if (firstHalf === secondHalf && cleanTicker.length % 2 === 0) {
                        cleanTicker = firstHalf;
                    }

                    return {
                        ...inv,
                        ticker: cleanTicker
                    };
                });

                // Fetch current prices
                const tickers = [...new Set(cleanedData.map(inv => inv.ticker as string))] as string[];
                const stockData = await getStocksBatch(tickers);

                const investmentsWithPrices = cleanedData.map(inv => {
                    const stock = stockData.find(s => s.symbol === inv.ticker);
                    return {
                        ...inv,
                        current_price: stock?.regularMarketPrice || inv.purchase_price,
                        logo_url: stock?.logourl
                    };
                });

                setInvestments(investmentsWithPrices);

                // Calculate totals
                const invested = investmentsWithPrices.reduce((acc, curr) => acc + (curr.quantity * curr.purchase_price), 0);
                const current = investmentsWithPrices.reduce((acc, curr) => acc + (curr.quantity * (curr.current_price || 0)), 0);

                setTotalInvested(invested);
                setCurrentTotalValue(current);
            }
        } catch (error) {
            console.error("Error fetching investments:", error);
            toast.error("Erro ao carregar investimentos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvestments();
    }, []);

    // Listen for investment additions from ChatInterface
    useEffect(() => {
        const handleInvestmentAdded = () => {
            fetchInvestments();
        };

        window.addEventListener('investmentAdded', handleInvestmentAdded);

        return () => {
            window.removeEventListener('investmentAdded', handleInvestmentAdded);
        };
    }, []);

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from('investments')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success("Investimento removido");
            fetchInvestments();
        } catch (error) {
            toast.error("Erro ao remover investimento");
        }
    };

    const profit = currentTotalValue - totalInvested;
    const profitPercentage = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

    // Filter and sort investments by total value (descending)
    const filteredInvestments = investments
        .filter(inv => inv.ticker.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            const totalA = a.quantity * (a.current_price || 0);
            const totalB = b.quantity * (b.current_price || 0);
            return totalB - totalA; // Descending order
        });

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Investimentos</h1>
                    <p className="text-muted-foreground">Gerencie sua carteira de ações</p>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Investimento
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Investido</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Valor Atual</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {currentTotalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Lucro/Prejuízo</CardTitle>
                        {profit >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            R$ {profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <p className={`text-xs ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {profitPercentage > 0 ? '+' : ''}{profitPercentage.toFixed(2)}%
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* AI Analysis Section (Horizontal Layout) */}
            {analyzedStock && (
                <Card className="border-purple-200 dark:border-purple-900 overflow-hidden">
                    <CardHeader className="bg-purple-50/50 dark:bg-purple-950/20 pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                                <Bot className="h-5 w-5" />
                                Análise Inteligente: {analyzedStock}
                            </CardTitle>
                            <Button variant="ghost" size="icon" onClick={closeAnalysis} className="h-8 w-8 hover:bg-purple-100 dark:hover:bg-purple-900/50">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {analyzing ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                                <p className="text-sm text-muted-foreground animate-pulse">Analisando mercado e indicadores técnicos...</p>
                            </div>
                        ) : analysis ? (
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                {/* Left Column: Status & confidence */}
                                <div className="md:col-span-3 space-y-4 border-r md:border-r-border md:pr-6">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recomendação</span>
                                        <Badge variant={
                                            analysis.recommendation === 'buy' ? 'default' :
                                                analysis.recommendation === 'sell' ? 'destructive' : 'secondary'
                                        } className="justify-center text-lg py-1.5 w-full">
                                            {analysis.recommendation === 'buy' ? 'COMPRA' :
                                                analysis.recommendation === 'sell' ? 'VENDA' :
                                                    analysis.recommendation === 'hold' ? 'MANTER' : 'NEUTRO'}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-muted-foreground">Confiabilidade</span>
                                            <span className="text-xs font-bold">{analysis.confidence}%</span>
                                        </div>
                                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-1000 ease-out ${analysis.confidence >= 70 ? 'bg-green-500' :
                                                    analysis.confidence >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                style={{ width: `${analysis.confidence}%` }}
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs"
                                        onClick={async () => {
                                            try {
                                                // Fetch fresh stock data from API
                                                const stockData = await getStocksBatch([analyzedStock]);
                                                const currentPrice = stockData[0]?.regularMarketPrice;

                                                if (currentPrice) {
                                                    handleAnalyze(analyzedStock, currentPrice);
                                                } else {
                                                    // Fallback to stored price if API fails
                                                    const inv = investments.find(i => i.ticker === analyzedStock);
                                                    if (inv && (inv.current_price || inv.purchase_price)) {
                                                        handleAnalyze(analyzedStock, inv.current_price || inv.purchase_price);
                                                    }
                                                }
                                            } catch (error) {
                                                console.error('Error fetching fresh price:', error);
                                                // Fallback to stored price
                                                const inv = investments.find(i => i.ticker === analyzedStock);
                                                if (inv && (inv.current_price || inv.purchase_price)) {
                                                    handleAnalyze(analyzedStock, inv.current_price || inv.purchase_price);
                                                }
                                            }
                                        }}
                                    >
                                        <RefreshCcw className="mr-2 h-3 w-3" /> Reanalisar
                                    </Button>
                                </div>

                                {/* Middle: Summary */}
                                <div className="md:col-span-5 space-y-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <Bot className="h-4 w-4 text-purple-500" />
                                        Resumo da Análise
                                    </h4>
                                    <div className="bg-muted/30 p-4 rounded-lg text-sm leading-relaxed text-muted-foreground border border-muted">
                                        {analysis.summary}
                                    </div>
                                </div>

                                {/* Right: Key Points */}
                                <div className="md:col-span-4 space-y-3">
                                    <h4 className="text-sm font-semibold">Pontos Chave</h4>
                                    <ul className="space-y-2">
                                        {analysis.keyPoints.map((point, i) => (
                                            <li key={i} className="flex gap-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded border border-muted/50">
                                                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            )}

            {/* Investments List */}
            <Card>
                <CardHeader>
                    <CardTitle>Sua Carteira</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Carregando...</div>
                    ) : investments.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Você ainda não tem investimentos cadastrados.
                        </div>
                    ) : (
                        <>
                            {/* Search Input */}
                            <div className="mb-4 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por ação..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            {/* Scrollable Table Container - Max 4 rows visible (approx 320px) */}
                            <div className="max-h-[320px] overflow-y-auto border rounded-md">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead>Ativo</TableHead>
                                            <TableHead className="text-right">Qtd</TableHead>
                                            <TableHead className="text-right">Preço Médio</TableHead>
                                            <TableHead className="text-right">Preço Atual</TableHead>
                                            <TableHead className="text-right">Total Atual</TableHead>
                                            <TableHead className="text-right">Resultado</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredInvestments.map((inv) => {
                                            const total = inv.quantity * (inv.current_price || 0);
                                            const invProfit = total - (inv.quantity * inv.purchase_price);
                                            const invProfitPercent = (invProfit / (inv.quantity * inv.purchase_price)) * 100;

                                            return (
                                                <TableRow key={inv.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            {inv.logo_url && (
                                                                <img src={inv.logo_url} alt={inv.ticker} className="w-8 h-8 rounded" />
                                                            )}
                                                            <span className="font-bold">{inv.ticker}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">{inv.quantity}</TableCell>
                                                    <TableCell className="text-right">R$ {inv.purchase_price.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right">R$ {inv.current_price?.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right font-medium">R$ {total.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className={invProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                            R$ {invProfit.toFixed(2)}
                                                            <span className="text-xs ml-1">({invProfitPercent > 0 ? '+' : ''}{invProfitPercent.toFixed(1)}%)</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                title="Análise com IA"
                                                                onClick={() => {
                                                                    const price = inv.current_price || inv.purchase_price;
                                                                    handleAnalyze(inv.ticker, price);
                                                                }}
                                                                disabled={analyzing && analyzedStock === inv.ticker}
                                                                className={analyzedStock === inv.ticker ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30" : "text-muted-foreground hover:text-purple-600"}
                                                            >
                                                                {analyzing && analyzedStock === inv.ticker ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Bot className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(inv.id)}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <AddInvestmentDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onSuccess={fetchInvestments}
            />
        </div >
    );
};
