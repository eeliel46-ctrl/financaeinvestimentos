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
    Analyze the stock ${ticker}.
    Current Price: R$ ${price.toFixed(2)}
    Period: ${period}
    Price Change: ${change.toFixed(2)}%
    High: R$ ${high.toFixed(2)}
    Low: R$ ${low.toFixed(2)}
    
    Provide a concise analysis in JSON format with the following fields:
    - recommendation: "buy", "sell", "hold", or "neutral"
    - confidence: number between 0 and 100
    - summary: A short paragraph (max 3 sentences) explaining the outlook.
    - keyPoints: Array of 3 short bullet points.
    
    Respond ONLY with the JSON.
    `;

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
