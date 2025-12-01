
import { useExpenses } from "@/contexts/ExpenseContext";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  BarChart3,
  Settings,
  Home,
  TrendingUp,
  PieChart,
  Target,
  LogOut
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { signOut } = useExpenses();

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "chat", label: "Registro Rápido", icon: MessageCircle },
    { id: "budgets", label: "Orçamentos", icon: PieChart },
    { id: "goals", label: "Metas", icon: Target },
    { id: "investments", label: "Investimentos", icon: TrendingUp },
    { id: "analytics", label: "Análises", icon: BarChart3 },
    { id: "settings", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="w-64 h-screen bg-gradient-primary p-6 flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary-foreground flex items-center gap-2">
          <BarChart3 className="h-8 w-8" />
          FinanceBot
        </h1>
        <p className="text-primary-foreground/80 text-sm mt-1">
          Seu assistente financeiro
        </p>
      </div>

      <nav className="flex-1">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <li key={item.id}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start gap-3 h-12 ${isActive
                    ? "bg-white/20 text-primary-foreground hover:bg-white/30"
                    : "text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
                    }`}
                  onClick={() => onTabChange(item.id)}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto pt-6 border-t border-primary-foreground/10">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-12 text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
          onClick={signOut}
        >
          <LogOut className="h-5 w-5" />
          Sair
        </Button>
      </div>
    </div>
  );
};