
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLUGGY_API_URL = "https://api.pluggy.ai";

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
        const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');

        if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
            console.error("Missing Pluggy credentials");
            throw new Error("Missing Pluggy credentials in Edge Function secrets.");
        }

        // 1. Authenticate to get API Key
        console.log("Authenticating with Pluggy...");
        const authResponse = await fetch(`${PLUGGY_API_URL}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId: PLUGGY_CLIENT_ID,
                clientSecret: PLUGGY_CLIENT_SECRET,
            }),
        });

        if (!authResponse.ok) {
            const errorText = await authResponse.text();
            console.error("Pluggy Auth Error:", errorText);
            throw new Error(`Pluggy Auth Failed: ${authResponse.status} ${errorText}`);
        }

        const { apiKey } = await authResponse.json();

        // 2. Process Request
        const { action, ...body } = await req.json();
        console.log(`Processing action: ${action}`);

        let result;
        let endpoint = "";
        let method = "GET";
        let payload = null;

        switch (action) {
            case 'createConnectToken':
                endpoint = "/connect_token";
                method = "POST";
                break;
            case 'fetchAccounts':
                if (!body.itemId) throw new Error("itemId is required");
                endpoint = `/accounts?itemId=${body.itemId}`;
                break;
            case 'fetchTransactions':
                if (!body.accountId) throw new Error("accountId is required");
                // Fetch last 30 days by default if not specified
                // Note: Pluggy API might require 'from' date. Let's start simple.
                endpoint = `/transactions?accountId=${body.accountId}`;
                break;
            case 'fetchItem':
                if (!body.itemId) throw new Error("itemId is required");
                endpoint = `/items/${body.itemId}`;
                break;
            default:
                throw new Error(`Unknown action: ${action}`);
        }

        const requestOptions: any = {
            method,
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json',
            },
        };

        if (payload) {
            requestOptions.body = JSON.stringify(payload);
        }

        console.log(`Calling Pluggy API: ${method} ${endpoint}`);
        const apiResponse = await fetch(`${PLUGGY_API_URL}${endpoint}`, requestOptions);

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`Pluggy API Error (${endpoint}):`, errorText);
            throw new Error(`Pluggy API Error: ${apiResponse.status} ${errorText}`);
        }

        result = await apiResponse.json();

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error("Edge Function Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, // Returning 500 to indicate server error clearly
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
