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
    // Calculate basic metrics from history
    const prices = history.map(h => h.close);
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    const change = ((endPrice - startPrice) / startPrice) * 100;
    const high = Math.max(...prices);
    const low = Math.min(...prices);

    const prompt = `
    Analise a ação ${ticker} do mercado brasileiro.
    Preço Atual: R$ ${price.toFixed(2)}
    Período: ${period}
    Variação de Preço: ${change.toFixed(2)}%
    Máxima: R$ ${high.toFixed(2)}
    Mínima: R$ ${low.toFixed(2)}
    
    Forneça uma análise concisa em formato JSON com os seguintes campos:
    - recommendation: "buy", "sell", "hold", ou "neutral"
    - confidence: número entre 0 e 100
    - summary: Um parágrafo curto (máximo 3 frases) explicando a perspectiva em português do Brasil.
    - keyPoints: Array com 3 pontos-chave curtos em português do Brasil.
    
    Responda APENAS com o JSON. Toda a análise deve estar em português do Brasil.
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
                systemPrompt: "You are a financial analyst AI. Provide conservative, data-driven analysis. Output JSON only.",
                jsonMode: true,
                temperature: 0.5
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
