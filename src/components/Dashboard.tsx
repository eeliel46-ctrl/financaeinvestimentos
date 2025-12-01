import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  ShoppingCart,
  PieChart,
  BarChart3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Edit2
} from "lucide-react";
import { useExpenses, Expense } from "@/contexts/ExpenseContext";
import { EditExpenseDialog } from "./EditExpenseDialog";

export const Dashboard = () => {
  const {
    getTotalSpent,
    getTotalIncome,
    getBalance,
    getExpensesByCategory,
    getRecentExpenses,
    expenses,
    deleteExpense,
    selectedDate,
    setSelectedDate
  } = useExpenses();

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const monthlyTotal = getTotalSpent();
  const monthlyIncome = getTotalIncome();
  const balance = getBalance();
  const expensesByCategory = getExpensesByCategory();
  const recentExpenses = getRecentExpenses();

  // Calculate daily average based on days passed in selected month
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const daysPassed = () => {
    const now = new Date();
    if (selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear()) {
      return now.getDate();
    }
    return getDaysInMonth(selectedDate);
  };

  const dailyAverage = monthlyTotal / daysPassed();

  // Navigation functions
  const nextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate);
  };

  const prevMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate);
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleEditClick = (expense: Expense) => {
    setEditingExpense(expense);
    setIsEditDialogOpen(true);
  };

  // Map context data to chart format
  const categoryData = Object.entries(expensesByCategory).map(([name, amount]) => {
    const percentage = monthlyTotal > 0 ? (amount / monthlyTotal) * 100 : 0;
    return {
      name,
      amount,
      percentage: Number(percentage.toFixed(1)),
      color: "hsl(215 20% 65%)" // Default color, could be improved with a color map
    };
  }).sort((a, b) => b.amount - a.amount);

  // Color mapping helper
  const getCategoryColor = (index: number) => {
    const colors = [
      "hsl(142 76% 36%)", // Green
      "hsl(210 100% 25%)", // Blue
      "hsl(32 95% 44%)", // Orange
      "hsl(267 57% 50%)", // Purple
      "hsl(0 84% 60%)", // Red
      "hsl(215 20% 65%)" // Gray
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Date Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Financeiro</h1>
          <p className="text-muted-foreground">Visão geral dos seus gastos</p>
        </div>

        <div className="flex items-center gap-4 bg-card p-2 rounded-lg border shadow-sm">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center font-medium capitalize">
            {formatMonth(selectedDate)}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-card hover:shadow-hover transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">R$ {monthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Entradas do mês</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-hover transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">R$ {monthlyTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Saídas do mês</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-hover transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
              R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Diferença (entrada - saída)</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-hover transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Diária</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {dailyAverage.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Baseado em {daysPassed()} dias</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories Chart */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Gastos por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryData.length > 0 ? categoryData.map((category, index) => (
                <div key={category.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: getCategoryColor(index) }}
                    />
                    <span className="text-sm font-medium">{category.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">
                      R$ {category.amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {category.percentage}%
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-center text-muted-foreground py-8">Nenhuma despesa registrada neste mês</p>
              )}
            </div>

            {/* Visual Bar Chart */}
            {categoryData.length > 0 && (
              <div className="mt-6 space-y-2">
                {categoryData.map((category, index) => (
                  <div key={`bar-${category.name}`} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{category.name}</span>
                      <span>{category.percentage}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${category.percentage}%`,
                          backgroundColor: getCategoryColor(index),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Expenses */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Últimas Transações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentExpenses.length > 0 ? recentExpenses.map((expense, index) => (
                <div key={expense.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{expense.description}</p>
                      <Badge
                        variant="secondary"
                        className="text-xs"
                      >
                        {expense.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(expense.date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${expense.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                      {expense.type === 'receita' ? '+' : '-'} R$ {expense.amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(expense)}
                      className="text-muted-foreground hover:text-primary shrink-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteExpense(expense.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )) : (
                <p className="text-center text-muted-foreground py-8">Nenhuma transação recente</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <EditExpenseDialog
        expense={editingExpense}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </div>
  );
};