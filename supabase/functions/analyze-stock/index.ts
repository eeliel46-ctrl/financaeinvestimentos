import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { message, model, systemPrompt, temperature, max_tokens, jsonMode } = await req.json()

        // Get API key from secrets
        const apiKey = Deno.env.get('GROQ_API_KEY')
        if (!apiKey) {
            throw new Error('GROQ_API_KEY not set in Supabase Secrets')
        }

        const messages = [
            { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
            { role: 'user', content: message }
        ]

        const body: any = {
            model: model || 'llama-3.3-70b-versatile',
            messages: messages,
            temperature: temperature || 0.7,
        }

        if (max_tokens) body.max_tokens = max_tokens
        if (jsonMode) body.response_format = { type: "json_object" }

        console.log("Calling Groq API...")
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        const data = await response.json()

        if (!response.ok) {
            console.error("Groq API Error:", data)
            throw new Error(data.error?.message || 'Failed to fetch from Groq')
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error("Edge Function Error:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
