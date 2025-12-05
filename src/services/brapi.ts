export interface StockData {
    symbol: string;
    longName: string;
    regularMarketPrice: number;
    logourl?: string;
    regularMarketChangePercent?: number;
    regularMarketPreviousClose?: number;
}

export interface HistoricalPrice {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
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

const BRAPI_BASE_URL = (import.meta.env.VITE_BRAPI_BASE_URL as string) || "https://brapi.dev/api";

const getToken = () => {
    return import.meta.env.VITE_BRAPI_API_TOKEN || "";
};

const fetchWithRetry = async (url: string, init?: RequestInit, retries: number = 3, delayMs: number = 500): Promise<Response> => {
    let attempt = 0;
    while (true) {
        try {
            const res = await fetch(url, init);
            if (!res.ok && (res.status >= 500 || res.status === 429)) {
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
                    attempt++;
                    continue;
                }
            }
            return res;
        } catch (e) {
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
                attempt++;
                continue;
            }
            throw e;
        }
    }
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
        const response = await fetchWithRetry(`${BRAPI_BASE_URL}/quote/list${tokenParam}`);

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
    ).slice(0, 50); // Limit to 50 results
};

export const searchStock = async (ticker: string): Promise<StockData | null> => {
    try {
        const token = getToken();
        const tokenParam = token ? `?token=${token}` : "";
        const response = await fetchWithRetry(`${BRAPI_BASE_URL}/quote/${ticker}${tokenParam}`);

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
                regularMarketChangePercent: result.regularMarketChangePercent,
                regularMarketPreviousClose: result.regularMarketPreviousClose
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
        const response = await fetchWithRetry(`${BRAPI_BASE_URL}/quote/${tickerString}${tokenParam}`);

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

type HistoryRange =
    | '1d' | '2d' | '5d' | '7d'
    | '1mo' | '3mo' | '6mo'
    | '1y' | '2y' | '5y' | '10y'
    | 'ytd' | 'max'
    | '30d' | '60d'
    | number

export const getStockHistory = async (ticker: string, range: HistoryRange = 30, interval?: '5m' | '15m' | '30m' | '1d'): Promise<HistoricalPrice[]> => {
    try {
        const token = getToken();
        const tokenParam = token ? `&token=${token}` : "";

        const toBrapiRange = (r: HistoryRange): string => {
            if (typeof r === 'number') {
                if (r <= 1) return '1d';
                if (r <= 2) return '2d';
                if (r <= 5) return '5d';
                if (r <= 7) return '7d';
                if (r <= 30) return '1mo';
                if (r <= 90) return '3mo';
                if (r <= 180) return '6mo';
                if (r <= 365) return '1y';
                if (r <= 730) return '2y';
                if (r <= 1825) return '5y';
                if (r <= 3650) return '10y';
                return 'max';
            }
            if (r === '30d') return '1mo';
            if (r === '60d') return '3mo';
            return r;
        };

        const rangeParam = toBrapiRange(range);

        let resolvedInterval = interval;
        if (!resolvedInterval) {
            resolvedInterval = range === '1d' ? '15m' : '1d';
        }

        const response = await fetchWithRetry(`${BRAPI_BASE_URL}/quote/${ticker}?range=${rangeParam}&interval=${resolvedInterval}${tokenParam}`);

        if (!response.ok) {
            console.error("Failed to fetch stock history:", response.status, response.statusText);
            return [];
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const result = data.results[0];

            if (result.historicalDataPrice) {
                return result.historicalDataPrice.map((item: any) => ({
                    date: new Date(item.date * 1000).toISOString(),
                    open: item.open,
                    high: item.high,
                    low: item.low,
                    close: item.close,
                    volume: item.volume
                }));
            } else {
                console.warn("No historicalDataPrice found in result:", result);
            }
        } else {
            console.warn("No results found in API response");
        }

        return [];
    } catch (error) {
        console.error("Error fetching stock history:", error);
        return [];
    }
};
