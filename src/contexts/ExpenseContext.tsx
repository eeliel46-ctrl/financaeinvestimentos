import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: Date;
  location?: string;
  type: 'receita' | 'despesa';
  user_id?: string;
}

interface ExpenseContextType {
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  deleteExpense: (id: string) => void;
  updateExpense: (id: string, expense: Partial<Omit<Expense, 'id'>>) => void;
  getTotalSpent: () => number;
  getTotalIncome: () => number;
  getBalance: () => number;
  getExpensesByCategory: () => Record<string, number>;
  getCurrentMonthExpensesByCategory: () => Record<string, number>;
  getIncomeByCategory: () => Record<string, number>;
  getRecentExpenses: (limit?: number) => Expense[];
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const useExpenses = () => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenses must be used within an ExpenseProvider');
  }
  return context;
};

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<Session['user'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth changes FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadExpenses(session.user.id);
      } else {
        setExpenses([]);
        setLoading(false);
      }
    });

    // THEN check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadExpenses(session.user.id);
      } else {
        setExpenses([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadExpenses = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;

      if (data) {
        setExpenses(data.map(expense => ({
          ...expense,
          date: new Date(expense.date),
          type: expense.type as 'receita' | 'despesa'
        })));
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
      toast.error('Erro ao carregar despesas');
    } finally {
      setLoading(false);
    }
  };

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    if (!session?.user) {
      toast.error("Você precisa estar logado para adicionar registros");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert([{
          amount: expense.amount,
          description: expense.description,
          category: expense.category,
          date: expense.date.toISOString(),
          location: expense.location,
          type: expense.type,
          user_id: session.user.id
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newExpense: Expense = {
          ...data,
          date: new Date(data.date),
          type: data.type as 'receita' | 'despesa'
        };
        setExpenses(prev => [newExpense, ...prev]);
        const message = expense.type === 'receita' ? 'Receita registrada com sucesso!' : 'Despesa registrada com sucesso!';
        toast.success(message);

        // Força reload após salvar para garantir sincronização com Dashboard e Orçamento
        setTimeout(async () => {
          if (session?.user) {
            await loadExpenses(session.user.id);
          }
        }, 500);
      }
    } catch (error: any) {
      console.error('Error adding expense:', error);
      toast.error(`Erro ao registrar: ${error.message || error.details || 'Erro desconhecido'}`);
    }
  };

  const updateExpense = async (id: string, updates: Partial<Omit<Expense, 'id'>>) => {
    try {
      const dbUpdates: any = { ...updates };
      if (updates.date) {
        dbUpdates.date = updates.date.toISOString();
      }

      const { data, error } = await supabase
        .from('expenses')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setExpenses(prev => prev.map(exp => {
          if (exp.id === id) {
            return {
              ...exp,
              ...data,
              date: new Date(data.date),
              type: data.type as 'receita' | 'despesa'
            };
          }
          return exp;
        }));
        toast.success('Registro atualizado com sucesso!');
      }
    } catch (error) {
      console.error('Error updating expense:', error);
      toast.error('Erro ao atualizar registro');
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setExpenses(prev => prev.filter(exp => exp.id !== id));
      toast.success('Registro excluído com sucesso!');
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Erro ao excluir registro');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setExpenses([]);
    toast.success("Logout realizado com sucesso");
  };

  const getTotalSpent = () => {
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();

    return expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        return expense.type === 'despesa' &&
          expenseDate.getMonth() === currentMonth &&
          expenseDate.getFullYear() === currentYear;
      })
      .reduce((total, expense) => total + expense.amount, 0);
  };

  const getTotalIncome = () => {
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();

    return expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        return expense.type === 'receita' &&
          expenseDate.getMonth() === currentMonth &&
          expenseDate.getFullYear() === currentYear;
      })
      .reduce((total, expense) => total + expense.amount, 0);
  };

  const getBalance = () => {
    return getTotalIncome() - getTotalSpent();
  };

  const getExpensesByCategory = () => {
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();

    return expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        return expense.type === 'despesa' &&
          expenseDate.getMonth() === currentMonth &&
          expenseDate.getFullYear() === currentYear;
      })
      .reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
      }, {} as Record<string, number>);
  };

  // Always returns current month expenses (for Budget interface)
  const getCurrentMonthExpensesByCategory = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        return expense.type === 'despesa' &&
          expenseDate.getMonth() === currentMonth &&
          expenseDate.getFullYear() === currentYear;
      })
      .reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
      }, {} as Record<string, number>);
  };

  const getIncomeByCategory = () => {
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();

    return expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        return expense.type === 'receita' &&
          expenseDate.getMonth() === currentMonth &&
          expenseDate.getFullYear() === currentYear;
      })
      .reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
      }, {} as Record<string, number>);
  };

  const getRecentExpenses = (limit = 5) => {
    return expenses
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  };

  return (
    <ExpenseContext.Provider value={{
      expenses,
      addExpense,
      deleteExpense,
      updateExpense,
      getTotalSpent,
      getTotalIncome,
      getBalance,
      getExpensesByCategory,
      getCurrentMonthExpensesByCategory,
      getIncomeByCategory,
      getRecentExpenses,
      selectedDate,
      setSelectedDate,
      session,
      loading,
      signOut
    }}>
      {children}
    </ExpenseContext.Provider>
  );
};