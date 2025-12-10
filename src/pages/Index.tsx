import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { Dashboard } from "@/components/Dashboard";
import { ChatInterface } from "@/components/ChatInterface";
import { BudgetsInterface } from "@/components/BudgetsInterface";
import { GoalsInterface } from "@/components/GoalsInterface";
import { InvestmentsInterface } from "@/components/InvestmentsInterface";
import { AnalyticsInterface } from "@/components/AnalyticsInterface";
import { ExpenseProvider } from "@/contexts/ExpenseContext";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useExpenses } from "@/contexts/ExpenseContext";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { signOut } = useExpenses();

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "chat":
        return <ChatInterface />;
      case "budgets":
        return <BudgetsInterface />;
      case "goals":
        return <GoalsInterface />;
      case "investments":
        return <InvestmentsInterface />;
      case "analytics":
        return <AnalyticsInterface />;
      case "settings":
        return (
          <div className="p-6">
            <h1 className="text-3xl font-bold mb-4">Configurações</h1>
            <p className="text-muted-foreground">Funcionalidade em desenvolvimento...</p>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden border-b border-border p-4 flex items-center justify-between bg-card text-card-foreground">
        <h1 className="font-bold text-lg text-primary">FinanceBot</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setActiveTab("settings")}>
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut} className="text-red-500">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <main className="flex-1 overflow-auto h-[calc(100vh-60px)] md:h-screen pb-20 md:pb-0">
        {renderContent()}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
