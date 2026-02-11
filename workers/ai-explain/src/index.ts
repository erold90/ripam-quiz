interface Env {
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGIN: string;
}

interface ExplainRequest {
  domanda: string;
  risposte: Array<{ id: string; testo: string; corretta: boolean; efficacia?: string }>;
  rispostaUtente: string;
  materia: string;
}

const SYSTEM_PROMPT = `Sei un tutor esperto per il concorso pubblico RIPAM 3997 posti (Assistenti Amministrativi per la Pubblica Amministrazione italiana).

Il tuo compito è spiegare BREVEMENTE perché la risposta data è sbagliata e perché quella corretta è giusta.

Regole:
- Rispondi in italiano
- Sii conciso: massimo 3-4 frasi
- Cita il riferimento normativo se applicabile (es. art. X del D.Lgs. Y)
- Per le domande situazionali, spiega perché il comportamento efficace è migliore
- Non ripetere la domanda, vai dritto alla spiegazione
- Usa un tono diretto e chiaro, come un tutor che spiega a uno studente`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [env.ALLOWED_ORIGIN, 'http://localhost:3000'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : env.ALLOWED_ORIGIN;

    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = (await request.json()) as ExplainRequest;

      if (!body.domanda || !body.risposte || !body.rispostaUtente) {
        return new Response(JSON.stringify({ error: 'Missing fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rispostaCorretta = body.risposte.find(r => r.corretta);
      const rispostaData = body.risposte.find(r => r.id === body.rispostaUtente);

      const userPrompt = `Materia: ${body.materia.replace(/-/g, ' ')}

Domanda: ${body.domanda}

Risposta data dall'utente (SBAGLIATA): ${rispostaData?.id?.toUpperCase()}) ${rispostaData?.testo}
Risposta corretta: ${rispostaCorretta?.id?.toUpperCase()}) ${rispostaCorretta?.testo}${rispostaCorretta?.efficacia ? ` (efficacia: ${rispostaCorretta.efficacia})` : ''}

Spiega brevemente perché la risposta corretta è giusta.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Anthropic API error:', errText);
        return new Response(JSON.stringify({ error: 'AI service error' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
      };

      const spiegazione = data.content?.[0]?.text || 'Spiegazione non disponibile.';

      return new Response(JSON.stringify({ spiegazione }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
