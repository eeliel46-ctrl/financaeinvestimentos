import { useState, useEffect } from "react";
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
  LogOut,
  Download
} from "lucide-react";
import { toast } from "sonner";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { signOut } = useExpenses();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      toast.success("Aplicativo instalando...");
    }
  };

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
    <div className="w-64 h-screen bg-black/95 border-r border-white/10 p-6 flex flex-col backdrop-blur-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <div className="bg-yellow-500 p-1.5 rounded-lg">
            <BarChart3 className="h-5 w-5 text-black" />
          </div>
          Finance<span className="text-yellow-500">Bot</span>
        </h1>
        <p className="text-zinc-400 text-sm mt-2 ml-1">
          XP Style Edition
        </p>
      </div>

      <nav className="flex-1">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <li key={item.id}>
                <Button
                  variant="ghost"
                  className={`w-full justify-start gap-3 h-11 transition-all duration-200 ${isActive
                    ? "bg-yellow-500 text-black font-semibold shadow-lg shadow-yellow-500/20 hover:bg-yellow-400"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
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

      <div className="mt-auto space-y-2 pt-6 border-t border-white/10">
        {deferredPrompt && (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-11 text-zinc-400 hover:bg-white/5 hover:text-green-400"
            onClick={handleInstallClick}
          >
            <Download className="h-5 w-5" />
            Instalar App
          </Button>
        )}

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-11 text-zinc-400 hover:bg-white/5 hover:text-red-400"
          onClick={signOut}
        >
          <LogOut className="h-5 w-5" />
          Sair
        </Button>
      </div>
    </div>
  );
};