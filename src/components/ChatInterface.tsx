import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Check, X, Image as ImageIcon, Mic, MicOff, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useExpenses } from "@/contexts/ExpenseContext";
import { AudioRecorder } from "@/services/audioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { getStockChatResponse, parseExpenseWithAI } from "@/services/groq";

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
  type: 'receita' | 'despesa' | 'investimento';
  investmentData?: {
    ticker: string;
    quantity: number;
    price: number;
  };
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
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [audioRecorder] = useState(() => new AudioRecorder());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize Web Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'pt-BR';

      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Erro no reconhecimento de voz",
          description: "Não foi possível capturar o áudio. Tente novamente.",
          variant: "destructive",
        });
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  const toggleVoiceRecognition = async () => {
    if (isListening) {
      // Stop recording and transcribe
      try {
        setIsListening(false);
        const audioBlob = await audioRecorder.stop();

        toast({
          title: "Processando áudio...",
          description: "Enviando para transcrição",
        });

        // Send audio to Edge Function for transcription
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: formData,
        });

        if (error) {
          console.error('Transcription error:', error);
          toast({
            title: "Erro na transcrição",
            description: "Não foi possível transcrever o áudio. Tente novamente.",
            variant: "destructive",
          });
          return;
        }

        if (data?.text) {
          setInputValue(data.text);
          toast({
            title: "✅ Transcrição concluída",
            description: "Texto adicionado ao campo",
          });
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
        setIsListening(false);
        toast({
          title: "Erro ao parar gravação",
          description: error instanceof Error ? error.message : "Erro desconhecido",
          variant: "destructive",
        });
      }
    } else {
      // Start recording
      try {
        await audioRecorder.start();
        setIsListening(true);
        toast({
          title: "🎤 Gravando...",
          description: "Fale sua despesa ou receita. Clique novamente para parar.",
        });
      } catch (error) {
        console.error('Error starting recording:', error);
        toast({
          title: "Erro ao iniciar gravação",
          description: error instanceof Error ? error.message : "Permita o acesso ao microfone",
          variant: "destructive",
        });
      }
    }
  };

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

  const handleConfirmInvestment = async () => {
    if (!pendingConfirmation || !pendingConfirmation.investmentData) return;

    try {
      // Check for Demo Mode
      const isDemoMode = localStorage.getItem("demo_session");
      if (isDemoMode) {
        toast({
          title: "Investimento registrado (Demo)!",
          description: `${pendingConfirmation.investmentData.quantity}x ${pendingConfirmation.investmentData.ticker} a R$ ${pendingConfirmation.investmentData.price.toFixed(2)}`,
        });

        const confirmMessage: Message = {
          id: Date.now().toString(),
          type: "bot",
          content: `✅ Investimento em ${pendingConfirmation.investmentData.ticker} registrado com sucesso!`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, confirmMessage]);
        setPendingConfirmation(null);

        // Dispatch custom event to notify InvestmentsInterface
        window.dispatchEvent(new CustomEvent('investmentAdded'));
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para salvar investimentos.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('investments')
        .insert({
          user_id: user.id,
          ticker: pendingConfirmation.investmentData.ticker.trim().toUpperCase(),
          quantity: pendingConfirmation.investmentData.quantity,
          purchase_price: pendingConfirmation.investmentData.price,
          purchase_date: pendingConfirmation.date.toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Investimento Adicionado!",
        description: `${pendingConfirmation.investmentData.quantity}x ${pendingConfirmation.investmentData.ticker} salvos na carteira.`,
      });

      const confirmMessage: Message = {
        id: Date.now().toString(),
        type: "bot",
        content: `✅ Investimento em ${pendingConfirmation.investmentData.ticker} registrado com sucesso! Pode conferir na aba de Investimentos.`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, confirmMessage]);
      setPendingConfirmation(null);

      // Dispatch custom event to notify InvestmentsInterface
      window.dispatchEvent(new CustomEvent('investmentAdded'));

    } catch (error: any) {
      console.error("Erro ao salvar investimento:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível registrar o investimento.",
        variant: "destructive"
      });
    }
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

    try {
      // Tenta usar IA primeiro para maior precisão
      const aiExpenseData = await parseExpenseWithAI(inputValue);

      let expenseData: ExpenseConfirmation | null = null;

      if (aiExpenseData && aiExpenseData.amount > 0) {
        expenseData = {
          amount: aiExpenseData.amount,
          description: aiExpenseData.description,
          category: aiExpenseData.category,
          location: aiExpenseData.location,
          date: new Date(),
          type: aiExpenseData.type
        };

        if (aiExpenseData.type === 'investimento' && aiExpenseData.investmentData) {
          expenseData.investmentData = aiExpenseData.investmentData;
        }
      } else {
        // Fallback para Regex antigo se IA falhar ou não achar nada
        expenseData = processExpenseMessage(inputValue);
      }

      if (expenseData) {
        if (expenseData.type === 'investimento') {
          const confirmationMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: "bot",
            content: `Identifiquei uma compra de ações! Confirme os dados do investimento:`,
            timestamp: new Date(),
            expense: expenseData,
          };
          setMessages(prev => [...prev, confirmationMessage]);
          setPendingConfirmation(expenseData);
        } else {
          const confirmationMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: "bot",
            content: `Identifiquei uma ${expenseData.type === 'receita' ? 'receita' : 'despesa'}! Por favor, confirme os dados:`,
            timestamp: new Date(),
            expense: expenseData,
          };
          setMessages(prev => [...prev, confirmationMessage]);
          setPendingConfirmation(expenseData);
        }
      } else {
        // Se não for despesa, tenta responder como chat financeiro
        const chatResponse = await getStockChatResponse("MERCADO", inputValue, { price: 0, change: 0 }); // Contexto genérico

        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "bot",
          content: chatResponse.includes("Erro") ?
            "Não entendi. Tente 'Gastei 50 no mercado' ou pergunte sobre ações." :
            chatResponse,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, botMessage]);
      }
    } catch (e) {
      console.error(e);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: "Desculpe, tive um erro ao processar. Pode tentar novamente?",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = () => {
    if (!pendingConfirmation) return;

    if (pendingConfirmation.type === 'investimento') {
      handleConfirmInvestment();
      return;
    }

    // ... existing expense handling ...
    handleConfirmExpense();
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
              className={`max-w-[80%] ${message.type === "user"
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

                        {/* Investment Data Section - Editable if pending */}
                        {message.expense.investmentData && (
                          <div className="mt-2 p-2 bg-background/50 rounded text-sm border border-border/50">
                            {pendingConfirmation && message.id === messages[messages.length - 1].id ? (
                              <>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-muted-foreground w-20">Ticker:</span>
                                  <input
                                    className="w-full text-right bg-transparent border-b border-border focus:border-primary outline-none font-bold font-mono"
                                    value={pendingConfirmation.investmentData?.ticker}
                                    onChange={(e) => setPendingConfirmation({
                                      ...pendingConfirmation,
                                      investmentData: {
                                        ...pendingConfirmation.investmentData!,
                                        ticker: e.target.value.toUpperCase()
                                      }
                                    })}
                                  />
                                </div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-muted-foreground w-20">Qtd:</span>
                                  <input
                                    type="number"
                                    className="w-full text-right bg-transparent border-b border-border focus:border-primary outline-none"
                                    value={pendingConfirmation.investmentData?.quantity}
                                    onChange={(e) => setPendingConfirmation({
                                      ...pendingConfirmation,
                                      investmentData: {
                                        ...pendingConfirmation.investmentData!,
                                        quantity: parseInt(e.target.value) || 0
                                      }
                                    })}
                                  />
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground w-20">Preço:</span>
                                  <div className="flex items-center w-full justify-end border-b border-border focus-within:border-primary">
                                    <span className="mr-1">R$</span>
                                    <input
                                      type="number"
                                      className="w-20 text-right bg-transparent outline-none"
                                      value={pendingConfirmation.investmentData?.price}
                                      onChange={(e) => setPendingConfirmation({
                                        ...pendingConfirmation,
                                        investmentData: {
                                          ...pendingConfirmation.investmentData!,
                                          price: parseFloat(e.target.value) || 0
                                        }
                                      })}
                                    />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Ticker:</span>
                                  <span className="font-bold font-mono">{message.expense.investmentData.ticker}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Quantidade:</span>
                                  <span>{message.expense.investmentData.quantity}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Preço Unitário:</span>
                                  <span>R$ {message.expense.investmentData.price.toFixed(2)}</span>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                          📅 {message.expense.date.toLocaleDateString()}
                        </p>

                        {pendingConfirmation && message.id === messages[messages.length - 1].id && (
                          <div className="space-y-3 mt-3">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium">Tipo:</label>
                                <select
                                  value={pendingConfirmation.type}
                                  onChange={(e) => setPendingConfirmation({
                                    ...pendingConfirmation,
                                    type: e.target.value as 'receita' | 'despesa' | 'investimento'
                                  })}
                                  className="px-2 py-1 text-xs rounded border bg-background text-foreground"
                                >
                                  <option value="despesa">Despesa</option>
                                  <option value="receita">Receita</option>
                                  <option value="investimento">Investimento</option>
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
                                onClick={handleConfirmAction}
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
          <Button
            variant="outline"
            size="icon"
            onClick={toggleVoiceRecognition}
            className={isListening ? "bg-red-500 text-white hover:bg-red-600" : ""}
            title={isListening ? "Parar gravação" : "Gravar voz"}
          >
            {isListening ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isListening ? "Escutando..." : "Ex: Gastei R$ 45 no supermercado hoje..."}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={isLoading || isListening}
            className="flex-1"
          />
          <Button onClick={handleSendMessage} disabled={isLoading || !inputValue.trim() || isListening}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {isListening && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            Fale agora... (clique no microfone novamente para parar)
          </p>
        )}
      </div>
    </div>
  );
};