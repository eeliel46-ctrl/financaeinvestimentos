export interface StockData {
    symbol: string;
    longName: string;
    regularMarketPrice: number;
    logourl?: string;
    regularMarketChangePercent?: number;
}

export interface StockListItem {
    stock: string;
    name: string;
    close: number;
    change: number;
    volume: number;
    market_cap: number | null;
    logo: string;
    sector: string | null;
}

const BRAPI_BASE_URL = "https://brapi.dev/api";

const getToken = () => {
    return import.meta.env.VITE_BRAPI_API_TOKEN || "";
};

// Cache for the stock list
let stockListCache: StockListItem[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getAllStocks = async (): Promise<StockListItem[]> => {
    // Return cached data if still valid
    if (stockListCache && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
        return stockListCache;
    }

    try {
        const token = getToken();
        const tokenParam = token ? `?token=${token}` : "";
        const response = await fetch(`${BRAPI_BASE_URL}/quote/list${tokenParam}`);

        if (!response.ok) {
            throw new Error("Failed to fetch stock list");
        }

        const data = await response.json();

        if (data.stocks) {
            stockListCache = data.stocks;
            cacheTimestamp = Date.now();
            return data.stocks;
        }

        return [];
    } catch (error) {
        console.error("Error fetching stock list:", error);
        return [];
    }
};

export const searchStockFromList = async (query: string): Promise<StockListItem[]> => {
    const stocks = await getAllStocks();
    const upperQuery = query.toUpperCase();
    
    return stocks.filter(stock => 
        stock.stock.toUpperCase().includes(upperQuery) || 
        (stock.name && stock.name.toUpperCase().includes(upperQuery))
    ).slice(0, 10); // Limit to 10 results
};

export const searchStock = async (ticker: string): Promise<StockData | null> => {
    try {
        const token = getToken();
        const tokenParam = token ? `?token=${token}` : "";
        const response = await fetch(`${BRAPI_BASE_URL}/quote/${ticker}${tokenParam}`);

        if (!response.ok) {
            // Fallback: try to get from list
            const stocks = await getAllStocks();
            const stockFromList = stocks.find(s => s.stock.toUpperCase() === ticker.toUpperCase());
            
            if (stockFromList) {
                return {
                    symbol: stockFromList.stock,
                    longName: stockFromList.name,
                    regularMarketPrice: stockFromList.close,
                    logourl: stockFromList.logo,
                    regularMarketChangePercent: stockFromList.change
                };
            }
            return null;
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            return {
                symbol: result.symbol,
                longName: result.longName || result.shortName || ticker,
                regularMarketPrice: result.regularMarketPrice,
                logourl: result.logourl,
                regularMarketChangePercent: result.regularMarketChangePercent
            };
        }

        // Fallback: try to get from list
        const stocks = await getAllStocks();
        const stockFromList = stocks.find(s => s.stock.toUpperCase() === ticker.toUpperCase());
        
        if (stockFromList) {
            return {
                symbol: stockFromList.stock,
                longName: stockFromList.name,
                regularMarketPrice: stockFromList.close,
                logourl: stockFromList.logo,
                regularMarketChangePercent: stockFromList.change
            };
        }

        return null;
    } catch (error) {
        console.error("Error fetching stock data:", error);
        
        // Fallback: try to get from list
        try {
            const stocks = await getAllStocks();
            const stockFromList = stocks.find(s => s.stock.toUpperCase() === ticker.toUpperCase());
            
            if (stockFromList) {
                return {
                    symbol: stockFromList.stock,
                    longName: stockFromList.name,
                    regularMarketPrice: stockFromList.close,
                    logourl: stockFromList.logo,
                    regularMarketChangePercent: stockFromList.change
                };
            }
        } catch {
            // Ignore fallback errors
        }
        
        return null;
    }
};

export const getStocksBatch = async (tickers: string[]): Promise<StockData[]> => {
    if (tickers.length === 0) return [];

    try {
        const token = getToken();
        const tickerString = tickers.join(',');
        const tokenParam = token ? `?token=${token}` : "";
        const response = await fetch(`${BRAPI_BASE_URL}/quote/${tickerString}${tokenParam}`);

        if (!response.ok) {
            // Fallback: get from list
            const stocks = await getAllStocks();
            return tickers.map(ticker => {
                const stockFromList = stocks.find(s => s.stock.toUpperCase() === ticker.toUpperCase());
                if (stockFromList) {
                    return {
                        symbol: stockFromList.stock,
                        longName: stockFromList.name,
                        regularMarketPrice: stockFromList.close,
                        logourl: stockFromList.logo,
                        regularMarketChangePercent: stockFromList.change
                    };
                }
                return null;
            }).filter((s): s is NonNullable<typeof s> => s !== null) as StockData[];
        }

        const data = await response.json();

        if (data.results) {
            return data.results.map((result: any) => ({
                symbol: result.symbol,
                longName: result.longName || result.shortName || result.symbol,
                regularMarketPrice: result.regularMarketPrice,
                logourl: result.logourl,
                regularMarketChangePercent: result.regularMarketChangePercent
            }));
        }

        return [];

    } catch (error) {
        console.error("Error fetching batch stock data:", error);
        
        // Fallback: get from list
        try {
            const stocks = await getAllStocks();
            return tickers.map(ticker => {
                const stockFromList = stocks.find(s => s.stock.toUpperCase() === ticker.toUpperCase());
                if (stockFromList) {
                    return {
                        symbol: stockFromList.stock,
                        longName: stockFromList.name,
                        regularMarketPrice: stockFromList.close,
                        logourl: stockFromList.logo,
                        regularMarketChangePercent: stockFromList.change
                    };
                }
                return null;
            }).filter((s): s is NonNullable<typeof s> => s !== null) as StockData[];
        } catch {
            return [];
        }
    }
};
