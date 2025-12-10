import { supabase } from "@/integrations/supabase/client";

export interface AIAnalysisResult {
    recommendation: 'buy' | 'sell' | 'hold' | 'neutral';
    confidence: number;
    summary: string;
    keyPoints: string[];
}

export const getMarketAnalysis = async (
    ticker: string,
    price: number,
    history: any[],
    period: string = '30d'
): Promise<AIAnalysisResult> => {
    // Calculate comprehensive technical metrics
    const prices = history.map(h => h.close);
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    const change = ((endPrice - startPrice) / startPrice) * 100;
    const high = Math.max(...prices);
    const low = Math.min(...prices);

    // Calculate moving averages
    const sma5 = prices.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, prices.length);
    const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, prices.length);

    // Calculate volatility
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * 100;

    // Determine trend
    const recentPrices = prices.slice(-10);
    const trend = recentPrices[recentPrices.length - 1] > recentPrices[0] ? 'alta' :
        recentPrices[recentPrices.length - 1] < recentPrices[0] ? 'baixa' : 'lateral';

    // Calculate RSI (simplified)
    const gains = returns.filter(r => r > 0);
    const losses = returns.filter(r => r < 0).map(r => Math.abs(r));
    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0.0001;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    const prompt = `
    Você é um analista financeiro especializado no mercado brasileiro. Analise a ação ${ticker} com base nos dados técnicos abaixo:
    
    DADOS FUNDAMENTAIS:
    - Preço Atual: R$ ${price.toFixed(2)}
    - Período Analisado: ${period}
    - Variação no Período: ${change.toFixed(2)}%
    - Máxima: R$ ${high.toFixed(2)}
    - Mínima: R$ ${low.toFixed(2)}
    
    INDICADORES TÉCNICOS:
    - Média Móvel 5 dias (SMA5): R$ ${sma5.toFixed(2)}
    - Média Móvel 20 dias (SMA20): R$ ${sma20.toFixed(2)}
    - Tendência: ${trend}
    - Volatilidade: ${volatility.toFixed(2)}%
    - RSI (Índice de Força Relativa): ${rsi.toFixed(0)}
    - Posição no Range: ${((price - low) / (high - low) * 100).toFixed(0)}% (0% = mínima, 100% = máxima)
    
    INSTRUÇÕES DE ANÁLISE:
    1. Analise a tendência: se está em alta, baixa ou lateral
    2. Avalie o RSI: <30 = sobrevendido (possível compra), >70 = sobrecomprado (possível venda)
    3. Compare preço atual com médias móveis: acima de ambas = força, abaixo = fraqueza
    4. Considere a volatilidade: alta volatilidade = maior risco
    5. Analise a posição no range: próximo da máxima pode indicar resistência, próximo da mínima pode indicar suporte
    
    RECOMENDAÇÕES:
    - Use "buy" se: tendência de alta + RSI < 70 + preço acima das médias + variação positiva
    - Use "sell" se: tendência de baixa + RSI > 70 + preço abaixo das médias + variação negativa
    - Use "hold" se: tendência lateral + RSI entre 40-60 + sinais mistos
    - Use "neutral" APENAS se não houver dados suficientes
    
    CONFIANÇA:
    - 80-100%: Sinais técnicos muito claros e alinhados
    - 60-79%: Maioria dos indicadores apontam na mesma direção
    - 40-59%: Sinais mistos ou inconclusivos
    - 0-39%: Dados insuficientes ou muito conflitantes
    
    Forneça uma análise em formato JSON com:
    - recommendation: "buy", "sell", "hold", ou "neutral"
    - confidence: número entre 0 e 100 (baseado na força dos sinais)
    - summary: Parágrafo explicando a recomendação com base nos indicadores técnicos
    - keyPoints: Array com 3 pontos-chave específicos sobre a análise técnica
    
    Responda APENAS com o JSON válido. Seja específico e use os dados fornecidos.
    `;

    // Check for Demo Mode
    const isDemoMode = localStorage.getItem("demo_session");
    if (isDemoMode) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        return {
            recommendation: change > 0 ? 'buy' : 'hold',
            confidence: 85,
            summary: `[MODO DEMO] Análise simulada para ${ticker}. A ação apresenta comportamento ${change > 0 ? 'positivo' : 'estável'} no período analisado, com fundamentos técnicos que sugerem ${change > 0 ? 'potencial de valorização' : 'cautela no curto prazo'}.`,
            keyPoints: [
                `Tendência de ${change > 0 ? 'alta' : 'lateralização'} observada nos últimos dias`,
                "Volume de negociação dentro da média histórica",
                "Indicadores técnicos apontam para manutenção da posição"
            ]
        };
    }

    try {
        const { data, error } = await supabase.functions.invoke('analyze-stock', {
            body: {
                message: prompt,
                systemPrompt: "You are a professional financial analyst. Analyze the technical data provided and give specific, data-driven recommendations. Be decisive based on the indicators. Output valid JSON only.",
                jsonMode: true,
                temperature: 0.3
            }
        });

        if (error) throw error;

        const content = JSON.parse(data.choices[0].message.content);
        return content;
    } catch (error: any) {
        console.error("AI Analysis Error Details:", error);
        return {
            recommendation: 'neutral',
            confidence: 0,
            summary: `Erro ao gerar análise: ${error.message || 'Erro desconhecido'}`,
            keyPoints: []
        };
    }
};

export const getStockChatResponse = async (
    ticker: string,
    message: string,
    context: any
): Promise<string> => {
    // Check for Demo Mode
    const isDemoMode = localStorage.getItem("demo_session");
    if (isDemoMode) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return `[MODO DEMO] Olá! Como estamos em modo de demonstração, não posso acessar dados em tempo real de ${ticker} ou processar análises complexas. Em produção, eu responderia sua pergunta: "${message}" com base em dados de mercado atualizados.`;
    }

    const systemPrompt = `
    You are a helpful financial assistant specializing in the Brazilian stock market.
    You are discussing the stock ${ticker}.
    Context: Current Price R$ ${context.price}, Change ${context.change}%.
    
    Answer the user's question concisely and professionally.
    If asked for advice, always include a disclaimer that this is not financial advice.
    Language: Portuguese (Brazil).
    `;

    try {
        const { data, error } = await supabase.functions.invoke('analyze-stock', {
            body: {
                message: message,
                systemPrompt: systemPrompt,
                temperature: 0.7,
                max_tokens: 500
            }
        });

        if (error) throw error;

        return data.choices[0].message.content;
    } catch (error: any) {
        console.error("AI Chat Error Details:", error);
        return `Erro: ${error.message || "Desculpe, estou com dificuldades para processar sua pergunta agora."}`;
    }
};

export const getMarketNewsAI = async (gainers: any[], losers: any[]): Promise<string[]> => {
    // Check for Demo Mode
    const isDemoMode = localStorage.getItem("demo_session");
    if (isDemoMode) {
        return [
            "Setor de Varejo impulsiona altas com otimismo sobre vendas trimestrais.",
            "Commodities recuam devido à desaceleração da demanda chinesa, afetando mineradoras."
        ];
    }

    const prompt = `
    Com base nas maiores altas e baixas da bolsa brasileira hoje:
    
    ALTAS: ${gainers.map(s => `${s.stock} (${s.change}%)`).join(', ')}
    BAIXAS: ${losers.map(s => `${s.stock} (${s.change}%)`).join(', ')}
    
    Gere 2 manchetes curtas de notícias fictícias mas plausíveis (baseadas na lógica de mercado e setores) que explicariam esses movimentos.
    Foque nos setores (Ex: "Setor bancário sobe...", "Petróleo cai...").
    
    Retorne APENAS um JSON array de strings. Exemplo: ["Manchete 1", "Manchete 2"]
    `;

    try {
        const { data, error } = await supabase.functions.invoke('analyze-stock', {
            body: {
                message: prompt,
                systemPrompt: "You are a financial news editor. Generate 2 plausible headlines explaining market movements based on the tickers provided. Output ONLY a raw JSON array of strings.",
                jsonMode: true,
                temperature: 0.7
            }
        });

        if (error) throw error;

        const content = JSON.parse(data.choices[0].message.content);
        // Ensure we handle both object with 'headlines' key or direct array
        return Array.isArray(content) ? content : (content.headlines || content.news || []);
    } catch (error: any) {
        console.error("AI News Error:", error);
        return [
            "Mercado reage a indicadores econômicos globais com volatilidade nos principais papéis.",
            "Investidores ajustam posições aguardando novas definições fiscais."
        ];
    }
};

export interface AIExpenseResult {
    amount: number;
    description: string;
    category: string;
    type: 'receita' | 'despesa' | 'investimento';
    location?: string;
    confidence: number;
    investmentData?: {
        ticker: string;
        quantity: number;
        price: number;
    };
}

export const parseExpenseWithAI = async (text: string): Promise<AIExpenseResult | null> => {
    // Check for Demo Mode
    const isDemoMode = localStorage.getItem("demo_session");
    if (isDemoMode) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Simple demo fallback logic for testing without API cost
        const amountMatch = text.match(/[\d.,]+/);
        const amount = amountMatch ? parseFloat(amountMatch[0].replace(/\./g, '').replace(',', '.')) : 0;

        if (text.toLowerCase().includes('compra') || text.toLowerCase().includes('comprei') || text.toLowerCase().includes('ação')) {
            return {
                amount: amount || 100,
                description: text,
                category: "Investimentos",
                type: 'investimento',
                confidence: 0.9,
                investmentData: {
                    ticker: "PETR4",
                    quantity: 10,
                    price: 30.50
                }
            };
        }

        return {
            amount: amount || 0,
            description: text,
            category: "Outros",
            type: text.toLowerCase().includes('recebi') ? 'receita' : 'despesa',
            confidence: 0.8
        };
    }

    const prompt = `
    Analise a seguinte frase financeira: "${text}"
    
    Identifique se é uma **DESPESA**, **RECEITA** ou **INVESTIMENTO** (compra de ações/fundos).

    REGRAS CRÍTICAS PARA NÚMEROS:
    - O formato brasileiro usa PONTO para milhar e VÍRGULA para decimais (Ex: 1.000,00).
    - "1.000" DEVE ser interpretado como MIL (1000), não como UM (1).
    - "1,000" DEVE ser interpretado como UM (1).
    - Se o usuário escrever "1k", entenda como 1000.
    
    SE FOR INVESTIMENTO (ex: "Comprei 100 ações da Petrobras por 30 reais"):
    - Tente identificar o TICKER da ação pelo nome da empresa. 
      Exemplos: 
      "Petrobras" -> "PETR4"
      "Vale" -> "VALE3"
      "Itaú" -> "ITUB4"
      "Banco do Brasil" -> "BBAS3"
      "Bradesco" -> "BBDC4"
      Se não souber, use o nome da empresa em caixa alta (ex: "AMBEV").
    - Extraia a QUANTIDADE e o PREÇO UNITÁRIO.
    - Se o usuário disser o total gasto e a quantidade, calcule o preço unitário.
    - Se disser o preço unitário e a quantidade, calcule o total (amount).

    Retorne APENAS um JSON com:
    - amount: número (float). Valor total da transação.
    - description: descrição resumida.
    - category: escolha a melhor categoria (Investimentos, Alimentação, etc).
    - type: 'receita', 'despesa' ou 'investimento'.
    - location: estabelecimento (se houver) ou null.
    - confidence: 0 a 1.
    - investmentData: (APENAS SE type='investimento') {
        ticker: string (ex: "PETR4"),
        quantity: number (inteiro),
        price: number (preço unitário)
      }
    
    Se não for transação financeira, retorne null.
    `;

    try {
        const { data, error } = await supabase.functions.invoke('analyze-stock', {
            body: {
                message: prompt,
                systemPrompt: "You are a financial parsing expert. Output ONLY valid JSON. Detect investments and infer B3 Tickers.",
                jsonMode: true,
                temperature: 0.1
            }
        });

        if (error) throw error;

        const content = JSON.parse(data.choices[0].message.content);
        return content;
    } catch (error) {
        console.error("AI Expense Parsing Error:", error);
        return null;
    }
};
