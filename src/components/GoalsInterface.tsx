import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Target, Plus, Trash2, Trophy, Calendar } from "lucide-react";

interface Goal {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string;
}

export const GoalsInterface = () => {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [newGoal, setNewGoal] = useState({
        name: "",
        targetAmount: "",
        currentAmount: "",
        deadline: ""
    });

    // Load goals from localStorage on mount
    useEffect(() => {
        const savedGoals = localStorage.getItem("goals");
        if (savedGoals) {
            setGoals(JSON.parse(savedGoals));
        } else {
            // Default goals example
            const defaults = [
                {
                    id: "1",
                    name: "Reserva de Emergência",
                    targetAmount: 10000,
                    currentAmount: 2500,
                    deadline: "2025-12-31"
                },
                {
                    id: "2",
                    name: "Viagem de Férias",
                    targetAmount: 5000,
                    currentAmount: 1000,
                    deadline: "2025-07-01"
                }
            ];
            setGoals(defaults);
            localStorage.setItem("goals", JSON.stringify(defaults));
        }
    }, []);

    const saveGoals = (updatedGoals: Goal[]) => {
        setGoals(updatedGoals);
        localStorage.setItem("goals", JSON.stringify(updatedGoals));
    };

    const handleAddGoal = () => {
        if (!newGoal.name || !newGoal.targetAmount) {
            toast.error("Preencha o nome e o valor alvo");
            return;
        }

        const goal: Goal = {
            id: Date.now().toString(),
            name: newGoal.name,
            targetAmount: parseFloat(newGoal.targetAmount),
            currentAmount: parseFloat(newGoal.currentAmount) || 0,
            deadline: newGoal.deadline
        };

        const updated = [...goals, goal];
        saveGoals(updated);
        setNewGoal({ name: "", targetAmount: "", currentAmount: "", deadline: "" });
        toast.success("Meta adicionada com sucesso!");
    };

    const handleRemoveGoal = (id: string) => {
        const updated = goals.filter(g => g.id !== id);
        saveGoals(updated);
        toast.success("Meta removida");
    };

    const handleUpdateAmount = (id: string, amount: string) => {
        const val = parseFloat(amount);
        if (isNaN(val)) return;

        const updated = goals.map(g =>
            g.id === id ? { ...g, currentAmount: val } : g
        );
        saveGoals(updated);
    };

    const calculateDaysLeft = (deadline: string) => {
        if (!deadline) return null;
        const today = new Date();
        const end = new Date(deadline);
        const diffTime = end.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Metas Financeiras</h1>
                <p className="text-muted-foreground">Defina objetivos e acompanhe seu progresso</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Add New Goal Form */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Nova Meta</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nome da Meta</label>
                                <Input
                                    placeholder="Ex: Carro Novo"
                                    value={newGoal.name}
                                    onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Valor Alvo (R$)</label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={newGoal.targetAmount}
                                    onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Valor Inicial (R$)</label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={newGoal.currentAmount}
                                    onChange={(e) => setNewGoal({ ...newGoal, currentAmount: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Data Alvo</label>
                                <Input
                                    type="date"
                                    value={newGoal.deadline}
                                    onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                                />
                            </div>
                            <Button onClick={handleAddGoal} className="w-full">
                                <Plus className="h-4 w-4 mr-2" />
                                Criar Meta
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Goals List */}
                <div className="md:col-span-2 space-y-6">
                    {goals.map((goal) => {
                        const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                        const daysLeft = calculateDaysLeft(goal.deadline);

                        return (
                            <Card key={goal.id}>
                                <CardContent className="pt-6">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <h3 className="font-semibold text-xl flex items-center gap-2">
                                                    <Trophy className={`h-5 w-5 ${percentage >= 100 ? "text-yellow-500" : "text-muted-foreground"}`} />
                                                    {goal.name}
                                                </h3>
                                                {daysLeft !== null && (
                                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {daysLeft} dias restantes
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive"
                                                onClick={() => handleRemoveGoal(goal.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Progresso</span>
                                                <span className="font-bold">{percentage.toFixed(1)}%</span>
                                            </div>
                                            <Progress value={percentage} className="h-3" />
                                        </div>

                                        <div className="flex items-center justify-between pt-2">
                                            <div className="text-sm">
                                                <span className="text-muted-foreground">Meta: </span>
                                                <span className="font-bold">R$ {goal.targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-muted-foreground">Atual:</span>
                                                <div className="w-32 relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                                                    <Input
                                                        type="number"
                                                        className="h-9 pl-8 text-right"
                                                        value={goal.currentAmount}
                                                        onChange={(e) => handleUpdateAmount(goal.id, e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {goals.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                            <Target className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>Nenhuma meta definida.</p>
                            <p className="text-sm">Crie sua primeira meta financeira ao lado.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
