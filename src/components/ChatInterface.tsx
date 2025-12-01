import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Check, X, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useExpenses } from "@/contexts/ExpenseContext";

interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
  expense?: {
    amount: number;
    description: string;
    category: string;
    location?: string;
    date: Date;
    type: 'receita' | 'despesa';
  };
}

interface ExpenseConfirmation {
  amount: number;
  description: string;
  category: string;
  location?: string;
  date: Date;
  type: 'receita' | 'despesa';
}

export const ChatInterface = () => {
  const { addExpense } = useExpenses();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "bot",
      content: "Olá! Sou seu assistente financeiro. Você pode me contar sobre suas despesas e receitas de forma natural. Exemplos:\n• Despesas: 'Gastei R$ 45 no supermercado'\n• Receitas: 'Recebi R$ 3000 salário' ou 'Recebi R$ 50 pix'",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<ExpenseConfirmation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Simula processamento de IA para extrair dados da despesa ou receita
  const processExpenseMessage = (message: string): ExpenseConfirmation | null => {
    // Regex patterns para extrair informações
    const amountPattern = /R?\$?\s?(\d+[.,]?\d*)/;
    const locationPattern = /(no|na|em)\s+([^0-9]+?)(?:\s|$)/i;
    
    const amountMatch = message.match(amountPattern);
    if (!amountMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(",", "."));
    const locationMatch = message.match(locationPattern);
    const location = locationMatch ? locationMatch[2].trim() : undefined;

    const lowerMessage = message.toLowerCase();
    
    // Detectar se é receita (começando com "recebi") ou despesa (começando com "paguei" ou padrão)
    const isIncome = lowerMessage.startsWith("recebi");
    const isExpense = lowerMessage.startsWith("paguei") || lowerMessage.startsWith("gastei");
    
    let category = "Outras";
    
    if (isIncome) {
      // Categorização de receitas
      const incomeCategories = {
        "Pix": ["pix"],
        "Cartão": ["cartão", "cartao"],
        "Salário Fixo": ["salário", "salario"],
        "Boleto": ["boleto"],
        "Extra": ["extra", "freelance", "bico"],
      };
      
      for (const [cat, keywords] of Object.entries(incomeCategories)) {
        if (keywords.some(keyword => lowerMessage.includes(keyword))) {
          category = cat;
          break;
        }
      }
    } else {
      // Categorização de despesas com categorias expandidas
      const expenseCategories = {
        // Despesas Fixas
        "Aluguel/Prestação": ["aluguel", "prestação", "prestacao"],
        "Energia": ["energia", "luz", "eletricidade"],
        "Água": ["água", "agua", "saneamento"],
        "Internet/Telefone": ["internet", "telefone", "celular", "wifi"],
        "Transporte Fixo": ["transporte fixo", "metrô", "metro", "combustível", "combustivel", "uber mensal"],
        "Mensalidades": ["mensalidade", "academia", "escola", "streaming", "netflix", "spotify"],
        "Plano de Saúde": ["plano de saúde", "plano de saude", "convênio", "convenio"],
        
        // Despesas Variáveis
        "Alimentação": ["alimentação", "alimentacao", "supermercado", "restaurante", "comida", "lanche", "jantar", "almoço", "almoco", "café", "cafe", "padaria"],
        "Lazer": ["lazer", "cinema", "bar", "balada", "show", "teatro", "parque", "festa"],
        "Compras Gerais": ["compras gerais", "compras", "shopping"],
        "Farmácia": ["farmácia", "farmacia", "remédio", "remedio", "medicamento"],
        "Roupas": ["roupas", "roupa", "vestuário", "vestuario", "sapato", "calça", "calca", "camisa", "vestido"],
        "Manutenção do Carro": ["manutenção do carro", "manutencao do carro", "mecânico", "mecanico", "revisão", "revisao"],
        
        // Dívidas e Obrigações
        "Empréstimos": ["empréstimo", "emprestimo"],
        "Cartão de Crédito": ["cartão de crédito", "cartao de credito", "fatura"],
        "Financiamentos": ["financiamento", "boleto carro"],
        "Parcelamentos": ["parcelamento", "parcela"],
        
        // Gastos Anuais/Periódicos
        "IPVA": ["ipva"],
        "IPTU": ["iptu"],
        "Seguro do Carro": ["seguro do carro", "seguro"],
        "Renovações": ["renovação", "renovacao", "assinatura anual"],
        "Material Escolar": ["material escolar"],
        "Viagens": ["viagem", "viagens", "passagem", "hotel"],
        
        // Gastos Não Planejados
        "Emergências": ["emergência", "emergencia", "urgência", "urgencia"],
        "Saúde": ["saúde", "saude", "médico", "medico", "hospital", "consulta", "dentista"],
        "Consertos": ["conserto", "reparo"],
        "Multas": ["multa"],
      };
      
      for (const [cat, keywords] of Object.entries(expenseCategories)) {
        if (keywords.some(keyword => lowerMessage.includes(keyword))) {
          category = cat;
          break;
        }
      }
    }

    return {
      amount,
      description: message,
      category,
      location,
      date: new Date(),
      type: isIncome ? 'receita' : 'despesa'
    };
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Simula processamento de IA
    await new Promise(resolve => setTimeout(resolve, 1500));

    const expenseData = processExpenseMessage(inputValue);

    if (expenseData) {
      const confirmationMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: `Identifiquei uma ${expenseData.type === 'receita' ? 'receita' : 'despesa'}! Por favor, confirme os dados:`,
        timestamp: new Date(),
        expense: expenseData,
      };

      setMessages(prev => [...prev, confirmationMessage]);
      setPendingConfirmation(expenseData);
    } else {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: "Não consegui identificar uma transação nessa mensagem. Tente algo como:\n• Despesa: 'Gastei R$ 50 no supermercado'\n• Receita: 'Recebi R$ 3000 salário'",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
    }

    setIsLoading(false);
  };

  const handleConfirmExpense = () => {
    if (!pendingConfirmation) return;

    // Adiciona a despesa/receita ao contexto global
    addExpense({
      amount: pendingConfirmation.amount,
      description: pendingConfirmation.description,
      category: pendingConfirmation.category,
      location: pendingConfirmation.location,
      date: pendingConfirmation.date,
      type: pendingConfirmation.type
    });

    toast({
      title: pendingConfirmation.type === 'receita' ? "Receita registrada!" : "Despesa registrada!",
      description: `R$ ${pendingConfirmation.amount.toFixed(2)} em ${pendingConfirmation.category}`,
    });

    const confirmMessage: Message = {
      id: Date.now().toString(),
      type: "bot",
      content: `✅ ${pendingConfirmation.type === 'receita' ? 'Receita' : 'Despesa'} registrada com sucesso! Posso ajudar com mais alguma coisa?`,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, confirmMessage]);
    setPendingConfirmation(null);
  };

  const handleRejectExpense = () => {
    const rejectMessage: Message = {
      id: Date.now().toString(),
      type: "bot",
      content: "Entendi. Pode me enviar mais detalhes ou tentar reformular a despesa?",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, rejectMessage]);
    setPendingConfirmation(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          Registro Rápido via Chat
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Descreva suas despesas de forma natural
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] ${
                message.type === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border"
              } rounded-lg p-3 shadow-card`}
            >
              <div className="flex items-start gap-2">
                {message.type === "bot" && (
                  <Bot className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                )}
                {message.type === "user" && (
                  <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm">{message.content}</p>
                  
                  {/* Expense confirmation card */}
                  {message.expense && (
                    <Card className="mt-3 p-3 bg-gradient-chart">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-lg">
                            R$ {message.expense.amount.toFixed(2)}
                          </span>
                          <Badge variant="secondary">
                            {message.expense.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {message.expense.description}
                        </p>
                        {message.expense.location && (
                          <p className="text-xs text-muted-foreground">
                            📍 {message.expense.location}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          📅 {message.expense.date.toLocaleDateString()}
                        </p>
                        
                        {pendingConfirmation && (
                          <div className="space-y-3 mt-3">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium">Tipo:</label>
                                <select 
                                  value={pendingConfirmation.type}
                                  onChange={(e) => setPendingConfirmation({
                                    ...pendingConfirmation,
                                    type: e.target.value as 'receita' | 'despesa'
                                  })}
                                  className="px-2 py-1 text-xs rounded border bg-background text-foreground"
                                >
                                  <option value="despesa">Despesa</option>
                                  <option value="receita">Receita</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium">Categoria:</label>
                                <input
                                  type="text"
                                  value={pendingConfirmation.category}
                                  onChange={(e) => setPendingConfirmation({
                                    ...pendingConfirmation,
                                    category: e.target.value
                                  })}
                                  className="px-2 py-1 text-xs rounded border bg-background text-foreground flex-1"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={handleConfirmExpense}
                                className="flex-1"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Confirmar
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={handleRejectExpense}
                                className="flex-1"
                              >
                                <X className="h-4 w-4 mr-1" />
                                Corrigir
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </div>
              </div>
              <p className="text-xs opacity-70 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card border rounded-lg p-3 shadow-card">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ex: Gastei R$ 45 no supermercado hoje..."
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSendMessage} disabled={isLoading || !inputValue.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};