import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

if (!API_KEY) {
  console.error("Google API Key not found in environment variables");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export interface ExtractedExpense {
  amount: number;
  description: string;
  category: string;
  location?: string;
  date: Date;
  type: 'receita' | 'despesa';
  confidence: number;
}

export interface AIResponse {
  success: boolean;
  expense?: ExtractedExpense;
  message?: string;
  needsMoreInfo?: boolean;
  suggestedQuestions?: string[];
}

const EXPENSE_CATEGORIES = [
  // Despesas Fixas
  "Aluguel/Prestação", "Energia", "Água", "Internet/Telefone", 
  "Transporte Fixo", "Mensalidades", "Plano de Saúde",
  
  // Despesas Variáveis
  "Alimentação", "Lazer", "Compras Gerais", "Farmácia", 
  "Roupas", "Manutenção do Carro",
  
  // Dívidas e Obrigações
  "Empréstimos", "Cartão de Crédito", "Financiamentos", "Parcelamentos",
  
  // Gastos Anuais/Periódicos
  "IPVA", "IPTU", "Seguro do Carro", "Renovações", 
  "Material Escolar", "Viagens",
  
  // Gastos Não Planejados
  "Emergências", "Saúde", "Consertos", "Multas",
  
  // Outras
  "Outras"
];

const INCOME_CATEGORIES = [
  "Pix", "Cartão", "Salário Fixo", "Boleto", "Extra", "Outras"
];

const createPrompt = (userMessage: string, conversationHistory: string[] = []) => {
  const historyContext = conversationHistory.length > 0 
    ? `\n\nContexto da conversa anterior:\n${conversationHistory.join('\n')}`
    : '';

  return `Você é um assistente financeiro inteligente em português brasileiro. Sua tarefa é extrair informações de transações financeiras (despesas ou receitas) de mensagens em linguagem natural.

${historyContext}

Mensagem do usuário: "${userMessage}"

CATEGORIAS DE DESPESAS DISPONÍVEIS:
${EXPENSE_CATEGORIES.join(", ")}

CATEGORIAS DE RECEITAS DISPONÍVEIS:
${INCOME_CATEGORIES.join(", ")}

INSTRUÇÕES:
1. Identifique se é uma DESPESA ou RECEITA
2. Extraia o valor em reais (R$)
3. Identifique a categoria mais apropriada
4. Identifique o local/estabelecimento se mencionado
5. Identifique a data (use hoje se não especificada)
6. Crie uma descrição clara da transação

Se a mensagem não contiver informações suficientes, indique quais informações faltam.

Responda APENAS com um objeto JSON no seguinte formato (sem markdown, sem code blocks, apenas JSON puro):
{
  "success": true/false,
  "type": "receita" ou "despesa",
  "amount": número,
  "category": "categoria escolhida",
  "location": "local (opcional)",
  "description": "descrição clara",
  "confidence": número entre 0 e 1,
  "needsMoreInfo": true/false,
  "missingInfo": ["informação1", "informação2"],
  "suggestedQuestions": ["pergunta1", "pergunta2"]
}

Exemplos de respostas corretas:

Para "Gastei R$ 45 no supermercado":
{"success": true, "type": "despesa", "amount": 45, "category": "Alimentação", "location": "supermercado", "description": "Compras no supermercado", "confidence": 0.95, "needsMoreInfo": false}

Para "Recebi R$ 3000 de salário":
{"success": true, "type": "receita", "amount": 3000, "category": "Salário Fixo", "location": null, "description": "Salário recebido", "confidence": 0.98, "needsMoreInfo": false}

Para "Gastei dinheiro":
{"success": false, "type": null, "amount": null, "category": null, "location": null, "description": null, "confidence": 0, "needsMoreInfo": true, "missingInfo": ["valor"], "suggestedQuestions": ["Quanto você gastou?"]}`;
};

export const extractExpenseFromMessage = async (
  message: string,
  conversationHistory: string[] = []
): Promise<AIResponse> => {
  try {
    if (!API_KEY) {
      throw new Error("Google API Key não configurada");
    }

    const prompt = createPrompt(message, conversationHistory);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Remove markdown code blocks se presentes
    const cleanedText = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsedResponse = JSON.parse(cleanedText);

    if (!parsedResponse.success) {
      return {
        success: false,
        message: parsedResponse.suggestedQuestions?.[0] || "Não consegui entender. Pode fornecer mais detalhes?",
        needsMoreInfo: true,
        suggestedQuestions: parsedResponse.suggestedQuestions || []
      };
    }

    const expense: ExtractedExpense = {
      amount: parsedResponse.amount,
      description: parsedResponse.description,
      category: parsedResponse.category,
      location: parsedResponse.location || undefined,
      date: new Date(),
      type: parsedResponse.type,
      confidence: parsedResponse.confidence
    };

    return {
      success: true,
      expense
    };

  } catch (error) {
    console.error("Error processing message with Gemini:", error);
    
    // Fallback para processamento básico em caso de erro
    return {
      success: false,
      message: "Desculpe, houve um erro ao processar sua mensagem. Tente novamente ou seja mais específico (ex: 'Gastei R$ 50 no supermercado')",
      needsMoreInfo: false
    };
  }
};

export const generateContextualResponse = async (
  userMessage: string,
  conversationHistory: string[] = []
): Promise<string> => {
  try {
    if (!API_KEY) {
      return "Olá! Como posso ajudar com suas finanças?";
    }

    const historyContext = conversationHistory.length > 0 
      ? `\n\nHistórico da conversa:\n${conversationHistory.join('\n')}`
      : '';

    const prompt = `Você é um assistente financeiro amigável em português brasileiro. 
${historyContext}

Mensagem do usuário: "${userMessage}"

Responda de forma breve, amigável e útil. Se for uma saudação, seja cordial. Se for uma pergunta sobre finanças, forneça uma resposta concisa.
Não use markdown, apenas texto simples.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error("Error generating contextual response:", error);
    return "Posso ajudar você a registrar suas despesas e receitas. Tente algo como: 'Gastei R$ 50 no supermercado'";
  }
};
