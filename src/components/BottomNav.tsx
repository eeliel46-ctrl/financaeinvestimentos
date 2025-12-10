import { Button } from "@/components/ui/button";
import {
    Home,
    MessageCircle,
    PieChart,
    Target,
    TrendingUp,
    BarChart3,
} from "lucide-react";

interface BottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
    const menuItems = [
        { id: "dashboard", label: "Dashboard", icon: Home },
        { id: "chat", label: "Registro", icon: MessageCircle },
        { id: "budgets", label: "Orçamentos", icon: PieChart },
        { id: "goals", label: "Metas", icon: Target },
        { id: "investments", label: "Investimentos", icon: TrendingUp },
        { id: "analytics", label: "Análises", icon: BarChart3 },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black/95 border-t border-white/10 backdrop-blur-xl z-50">
            <div className="flex items-center justify-around px-2 py-2 overflow-x-auto">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={`flex flex-col items-center justify-center min-w-[60px] px-2 py-2 rounded-lg transition-all ${isActive
                                    ? "bg-yellow-500 text-black"
                                    : "text-zinc-400 hover:text-white"
                                }`}
                        >
                            <Icon className="h-5 w-5 mb-1" />
                            <span className="text-[10px] font-medium leading-tight text-center">
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
