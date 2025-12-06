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
  isDemoMode: boolean;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const useExpenses = () => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenses deve ser usado dentro de um ExpenseProvider');
  }
  return context;
};

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<Session['user'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    // Check for demo session first
    const demoSession = localStorage.getItem("demo_session");
    if (demoSession) {
      setIsDemoMode(true);
      // Create a fake session object for demo mode
      const fakeSession = {
        user: { id: "demo-user", email: "demo@example.com" }
      } as unknown as Session;
      setSession(fakeSession);
      setUser(fakeSession.user);
      loadExpenses("demo-user", true);
      return;
    }

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
      if (!isDemoMode) { // Only if not already in demo mode
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          loadExpenses(session.user.id);
        } else {
          setExpenses([]);
          setLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadExpenses = async (userId: string, isDemo = false) => {
    try {
      setLoading(true);

      if (isDemo || isDemoMode) {
        const storedExpenses = localStorage.getItem("demo_expenses");
        if (storedExpenses) {
          const parsed = JSON.parse(storedExpenses);
          setExpenses(parsed.map((e: any) => ({
            ...e,
            date: new Date(e.date)
          })));
        } else {
          // Seed some demo data
          const demoData: Expense[] = [
            { id: "1", amount: 150.00, description: "Supermercado", category: "Alimentação", date: new Date(), type: "despesa", user_id: "demo-user" },
            { id: "2", amount: 5000.00, description: "Salário", category: "Salário", date: new Date(), type: "receita", user_id: "demo-user" },
            { id: "3", amount: 120.00, description: "Internet", category: "Contas", date: new Date(), type: "despesa", user_id: "demo-user" },
          ];
          setExpenses(demoData);
          localStorage.setItem("demo_expenses", JSON.stringify(demoData));
        }
        setLoading(false);
        return;
      }

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
      console.error('Erro ao carregar despesas:', error);
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

    if (isDemoMode) {
      const newExpense: Expense = {
        ...expense,
        id: Math.random().toString(36).substr(2, 9),
        user_id: "demo-user"
      };
      const updatedExpenses = [newExpense, ...expenses];
      setExpenses(updatedExpenses);
      localStorage.setItem("demo_expenses", JSON.stringify(updatedExpenses));
      toast.success(expense.type === 'receita' ? 'Receita registrada (Demo)!' : 'Despesa registrada (Demo)!');
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
      console.error('Erro ao adicionar despesa:', error);
      toast.error(`Erro ao registrar: ${error.message || error.details || 'Erro desconhecido'}`);
    }
  };

  const updateExpense = async (id: string, updates: Partial<Omit<Expense, 'id'>>) => {
    if (isDemoMode) {
      const updatedExpenses = expenses.map(exp => {
        if (exp.id === id) {
          return { ...exp, ...updates };
        }
        return exp;
      });
      setExpenses(updatedExpenses);
      localStorage.setItem("demo_expenses", JSON.stringify(updatedExpenses));
      toast.success('Registro atualizado (Demo)!');
      return;
    }

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
      console.error('Erro ao atualizar despesa:', error);
      toast.error('Erro ao atualizar registro');
    }
  };

  const deleteExpense = async (id: string) => {
    if (isDemoMode) {
      const updatedExpenses = expenses.filter(exp => exp.id !== id);
      setExpenses(updatedExpenses);
      localStorage.setItem("demo_expenses", JSON.stringify(updatedExpenses));
      toast.success('Registro excluído (Demo)!');
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setExpenses(prev => prev.filter(exp => exp.id !== id));
      toast.success('Registro excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
      toast.error('Erro ao excluir registro');
    }
  };

  const signOut = async () => {
    if (isDemoMode) {
      localStorage.removeItem("demo_session");
      setIsDemoMode(false);
      setSession(null);
      setUser(null);
      setExpenses([]);
      toast.success("Logout realizado (Demo)");
      return;
    }
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
      signOut,
      isDemoMode
    }}>
      {children}
    </ExpenseContext.Provider>
  );
};