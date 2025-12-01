
export interface StockData {
    symbol: string;
    longName: string;
    regularMarketPrice: number;
    logourl?: string;
    regularMarketChangePercent?: number;
}

const BRAPI_BASE_URL = "https://brapi.dev/api/quote";
// Using a public token if available or falling back to a default/demo one if needed.
// Ideally this should be in .env. For now we will try without a token for some endpoints or use a placeholder.
// The user mentioned: https://freeapihub.com/apis/brapi-api?utm_source=chatgpt.com which points to brapi.dev
// Brapi usually requires a token for reliable access: https://brapi.dev/dashboard
// We will use a default token if provided in env, otherwise try public access.

const getToken = () => {
    return import.meta.env.VITE_BRAPI_API_TOKEN || "public";
};

export const searchStock = async (ticker: string): Promise<StockData | null> => {
    try {
        const token = getToken();
        const response = await fetch(`${BRAPI_BASE_URL}/${ticker}?token=${token}`);

        if (!response.ok) {
            throw new Error("Failed to fetch stock data");
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            return {
                symbol: result.symbol,
                longName: result.longName,
                regularMarketPrice: result.regularMarketPrice,
                logourl: result.logourl,
                regularMarketChangePercent: result.regularMarketChangePercent
            };
        }

        return null;
    } catch (error) {
        console.error("Error fetching stock data:", error);
        return null;
    }
};

export const getStocksBatch = async (tickers: string[]): Promise<StockData[]> => {
    if (tickers.length === 0) return [];

    try {
        const token = getToken();
        const tickerString = tickers.join(',');
        const response = await fetch(`${BRAPI_BASE_URL}/${tickerString}?token=${token}`);

        if (!response.ok) {
            throw new Error("Failed to fetch batch stock data");
        }

        const data = await response.json();

        if (data.results) {
            return data.results.map((result: any) => ({
                symbol: result.symbol,
                longName: result.longName,
                regularMarketPrice: result.regularMarketPrice,
                logourl: result.logourl,
                regularMarketChangePercent: result.regularMarketChangePercent
            }));
        }

        return [];

    } catch (error) {
        console.error("Error fetching batch stock data:", error);
        return [];
    }
}
