import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { Dashboard } from "@/components/Dashboard";
import { ChatInterface } from "@/components/ChatInterface";
import { BudgetsInterface } from "@/components/BudgetsInterface";
import { GoalsInterface } from "@/components/GoalsInterface";
import { InvestmentsInterface } from "@/components/InvestmentsInterface";
import { BankAccountsInterface } from "@/components/BankAccountsInterface";
import { AnalyticsInterface } from "@/components/AnalyticsInterface";
import { ExpenseProvider } from "@/contexts/ExpenseContext";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, User, Menu } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useExpenses } from "@/contexts/ExpenseContext";
import { toast } from "sonner";
// @ts-ignore
import { useRegisterSW } from 'virtual:pwa-register/react';

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { signOut } = useExpenses();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // PWA Update Logic
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: any) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error: any) {
      console.log('SW registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      toast.info("Nova atualização disponível!", {
        description: "Uma nova versão do app está pronta. Clique para atualizar.",
        action: {
          label: "Atualizar Agora",
          onClick: () => updateServiceWorker(true),
        },
        duration: Infinity, // Mantém o toast até o usuário interagir
      });
    }
  }, [needRefresh, updateServiceWorker]);

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
      case "bank-accounts":
        return <BankAccountsInterface />;
      case "analytics":
        return <AnalyticsInterface />;
      case "settings":
        return (
          <div className="p-6">
            <h1 className="text-3xl font-bold mb-4">Configurações</h1>
            <p className="text-muted-foreground">Funcionalidade em desenvolvimento...</p>
            {/* Debug button for testing update UI */}
            {/* <Button onClick={() => setNeedRefresh(true)}>Testar Aviso de Atualização</Button> */}
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
        <div className="flex items-center gap-2">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px]">
              <Sidebar
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setActiveTab(tab);
                  setIsMobileMenuOpen(false);
                }}
              />
            </SheetContent>
          </Sheet>
          <h1 className="font-bold text-lg text-primary">FinanceBot</h1>
        </div>

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
