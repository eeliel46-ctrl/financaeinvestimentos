import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { ChatInterface } from "@/components/ChatInterface";
import { BudgetsInterface } from "@/components/BudgetsInterface";
import { GoalsInterface } from "@/components/GoalsInterface";
import { ExpenseProvider } from "@/contexts/ExpenseContext";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

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
      case "analytics":
        return (
          <div className="p-6">
            <h1 className="text-3xl font-bold mb-4">Análises Avançadas</h1>
            <p className="text-muted-foreground">Funcionalidade em desenvolvimento...</p>
          </div>
        );
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
    <ExpenseProvider>
      <div className="min-h-screen bg-background flex">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </ExpenseProvider>
  );
};

export default Index;
