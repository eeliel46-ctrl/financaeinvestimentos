import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const formData = await req.formData()
        const audioFile = formData.get('audio')

        if (!audioFile) {
            return new Response(
                JSON.stringify({ error: 'No audio file provided' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const groqApiKey = Deno.env.get('GROQ_API_KEY')
        if (!groqApiKey) {
            return new Response(
                JSON.stringify({ error: 'GROQ_API_KEY not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create form data for Groq API
        const groqFormData = new FormData()
        groqFormData.append('file', audioFile)
        groqFormData.append('model', 'whisper-large-v3')
        groqFormData.append('language', 'pt')
        groqFormData.append('response_format', 'json')

        // Call Groq Whisper API
        const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`
            },
            body: groqFormData
        })

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text()
            console.error('Groq API error:', errorText)
            return new Response(
                JSON.stringify({ error: 'Transcription failed', details: errorText }),
                { status: groqResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const result = await groqResponse.json()

        return new Response(
            JSON.stringify({ text: result.text }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('Error in transcribe-audio function:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
