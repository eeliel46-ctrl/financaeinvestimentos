
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2 } from "lucide-react";
import { searchStock, StockData } from "@/services/brapi";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

    const handleSearch = async () => {
        if (!ticker) return;

        setSearching(true);
        try {
            const data = await searchStock(ticker);
            if (data) {
                setStockData(data);
                setPrice(data.regularMarketPrice.toString());
            } else {
                toast.error("Ação não encontrada");
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Adicionar Investimento</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="ticker">Código da Ação (Ticker)</Label>
                        <div className="flex gap-2">
                            <Input
                                id="ticker"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                placeholder="Ex: PETR4"
                            />
                            <Button type="button" size="icon" onClick={handleSearch} disabled={searching}>
                                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    {stockData && (
                        <div className="p-3 bg-muted rounded-lg flex items-center gap-3">
                            {stockData.logourl && (
                                <img src={stockData.logourl} alt={stockData.symbol} className="w-10 h-10 rounded" />
                            )}
                            <div>
                                <p className="font-bold">{stockData.symbol}</p>
                                <p className="text-sm text-muted-foreground truncate max-w-[200px]">{stockData.longName}</p>
                                <p className="text-sm font-medium">Preço Atual: R$ {stockData.regularMarketPrice}</p>
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
