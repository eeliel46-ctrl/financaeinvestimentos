
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2, Search } from "lucide-react";
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
                // Fetch current prices
                const tickers = [...new Set(data.map(inv => inv.ticker))];
                const stockData = await getStocksBatch(tickers);

                const investmentsWithPrices = data.map(inv => {
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
                                            <TableHead></TableHead>
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
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(inv.id)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
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
        </div>
    );
};
