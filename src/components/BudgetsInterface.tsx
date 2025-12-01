import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useExpenses } from "@/contexts/ExpenseContext";
import { toast } from "sonner";
import { PieChart, Save, Plus, Trash2 } from "lucide-react";

interface Budget {
    category: string;
    limit: number;
}

export const BudgetsInterface = () => {
    const { getExpensesByCategory } = useExpenses();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [newCategory, setNewCategory] = useState("");
    const [newLimit, setNewLimit] = useState("");

    const expensesByCategory = getExpensesByCategory();

    // Load budgets from localStorage on mount
    useEffect(() => {
        const savedBudgets = localStorage.getItem("budgets");
        if (savedBudgets) {
            setBudgets(JSON.parse(savedBudgets));
        } else {
            // Default budgets
            const defaults = [
                { category: "Alimentação", limit: 1500 },
                { category: "Transporte", limit: 500 },
                { category: "Lazer", limit: 300 },
            ];
            setBudgets(defaults);
            localStorage.setItem("budgets", JSON.stringify(defaults));
        }
    }, []);

    const saveBudgets = (updatedBudgets: Budget[]) => {
        setBudgets(updatedBudgets);
        localStorage.setItem("budgets", JSON.stringify(updatedBudgets));
    };

    const handleAddBudget = () => {
        if (!newCategory || !newLimit) {
            toast.error("Preencha a categoria e o limite");
            return;
        }

        if (budgets.some(b => b.category.toLowerCase() === newCategory.toLowerCase())) {
            toast.error("Categoria já existe nos orçamentos");
            return;
        }

        const updated = [...budgets, { category: newCategory, limit: parseFloat(newLimit) }];
        saveBudgets(updated);
        setNewCategory("");
        setNewLimit("");
        toast.success("Orçamento adicionado");
    };

    const handleRemoveBudget = (category: string) => {
        const updated = budgets.filter(b => b.category !== category);
        saveBudgets(updated);
        toast.success("Orçamento removido");
    };

    const handleUpdateLimit = (category: string, newLimit: string) => {
        const limit = parseFloat(newLimit);
        if (isNaN(limit)) return;

        const updated = budgets.map(b =>
            b.category === category ? { ...b, limit } : b
        );
        saveBudgets(updated);
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Orçamentos</h1>
                <p className="text-muted-foreground">Defina e acompanhe seus limites de gastos mensais</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Add New Budget */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Novo Orçamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-4 items-end">
                            <div className="space-y-2 flex-1">
                                <label className="text-sm font-medium">Categoria</label>
                                <Input
                                    placeholder="Ex: Saúde"
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2 w-32">
                                <label className="text-sm font-medium">Limite (R$)</label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={newLimit}
                                    onChange={(e) => setNewLimit(e.target.value)}
                                />
                            </div>
                            <Button onClick={handleAddBudget}>
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Summary Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Resumo Geral</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Total Orçado:</span>
                                <span className="font-bold">
                                    R$ {budgets.reduce((acc, b) => acc + b.limit, 0).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Total Gasto (Categorias monitoradas):</span>
                                <span className="font-bold text-destructive">
                                    R$ {budgets.reduce((acc, b) => acc + (expensesByCategory[b.category] || 0), 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {budgets.map((budget) => {
                    const spent = expensesByCategory[budget.category] || 0;
                    const percentage = Math.min((spent / budget.limit) * 100, 100);
                    const isOverBudget = spent > budget.limit;

                    return (
                        <Card key={budget.category} className={isOverBudget ? "border-destructive/50" : ""}>
                            <CardContent className="pt-6">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                                {budget.category}
                                                {isOverBudget && (
                                                    <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                                                        Estourado
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                Gasto: R$ {spent.toFixed(2)} / R$ {budget.limit.toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24">
                                                <Input
                                                    type="number"
                                                    className="h-8 text-right"
                                                    value={budget.limit}
                                                    onChange={(e) => handleUpdateLimit(budget.category, e.target.value)}
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive"
                                                onClick={() => handleRemoveBudget(budget.category)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>{percentage.toFixed(1)}% utilizado</span>
                                            <span>R$ {(budget.limit - spent).toFixed(2)} restante</span>
                                        </div>
                                        <Progress
                                            value={percentage}
                                            className={`h-2 ${isOverBudget ? "bg-destructive/20" : ""}`}
                                        // Note: shadcn Progress component usually takes a generic indicator color, 
                                        // but we might need custom styling for the indicator itself if we want it red.
                                        // For now, relying on default primary color unless we customize the component.
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {budgets.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <PieChart className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>Nenhum orçamento definido.</p>
                        <p className="text-sm">Adicione categorias acima para começar a monitorar seus gastos.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
