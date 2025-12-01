import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExpenses, Expense } from "@/contexts/ExpenseContext";

interface EditExpenseDialogProps {
    expense: Expense | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const EditExpenseDialog = ({ expense, open, onOpenChange }: EditExpenseDialogProps) => {
    const { updateExpense } = useExpenses();
    const [formData, setFormData] = useState({
        description: "",
        amount: "",
        category: "",
        type: "despesa" as "receita" | "despesa",
        date: ""
    });

    useEffect(() => {
        if (expense) {
            setFormData({
                description: expense.description,
                amount: expense.amount.toString(),
                category: expense.category,
                type: expense.type,
                date: expense.date.toISOString().split('T')[0]
            });
        }
    }, [expense]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!expense) return;

        updateExpense(expense.id, {
            description: formData.description,
            amount: parseFloat(formData.amount),
            category: formData.category,
            type: formData.type,
            date: new Date(formData.date)
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar Transação</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="amount">Valor</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="category">Categoria</Label>
                        <Select
                            value={formData.category}
                            onValueChange={(value) => setFormData({ ...formData, category: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Alimentação">Alimentação</SelectItem>
                                <SelectItem value="Transporte">Transporte</SelectItem>
                                <SelectItem value="Saúde">Saúde</SelectItem>
                                <SelectItem value="Lazer">Lazer</SelectItem>
                                <SelectItem value="Casa">Casa</SelectItem>
                                <SelectItem value="Educação">Educação</SelectItem>
                                <SelectItem value="Salário">Salário</SelectItem>
                                <SelectItem value="Investimentos">Investimentos</SelectItem>
                                <SelectItem value="Outros">Outros</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="date">Data</Label>
                        <Input
                            id="date"
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit">Salvar Alterações</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
