// RIPAM Quiz — Worker di sincronizzazione cross-device
// Storage: Cloudflare KV.
//  - Stato di studio (progress/leitner/stats): un blob per utente, merge non distruttivo.
//  - Storico simulazioni: OGNI prova è una chiave separata `sim:{u}:{id}` → scritture
//    idempotenti per id, immuni al ritardo di consistenza di KV (niente sovrascritture).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function safeUser(u) {
  return (u || 'default').toString().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
}
function kvKey(u) {
  return `state:${safeUser(u)}`;
}
function simPrefix(u) {
  return `sim:${safeUser(u)}:`;
}

const EMPTY = { progress: {}, leitner: {}, stats: {}, simCount: 0, simStorico: [], updatedAt: 0 };

// Merge non distruttivo dello stato di STUDIO (lo storico è gestito a chiavi separate).
function mergeState(a, b) {
  a = a || {};
  b = b || {};

  const progress = { ...(a.progress || {}) };
  for (const [id, p] of Object.entries(b.progress || {})) {
    const cur = progress[id];
    if (!cur || (p.t || 0) >= (cur.t || 0)) progress[id] = p;
  }

  const leitner = { ...(a.leitner || {}) };
  for (const [id, l] of Object.entries(b.leitner || {})) {
    const cur = leitner[id];
    if (!cur || (l.lastAttemptAt || 0) >= (cur.lastAttemptAt || 0)) leitner[id] = l;
  }

  const stats = { ...(a.stats || {}) };
  for (const [m, v] of Object.entries(b.stats || {})) {
    if (!stats[m] || (v.totale || 0) >= (stats[m].totale || 0)) stats[m] = v;
  }

  // Riconciliazione: uno stato Leitner è valido solo se la domanda ha una risposta (progress).
  // Rimuove gli stati "fantasma" creati in blocco da import/bug passati.
  const leitnerPulito = {};
  for (const [id, l] of Object.entries(leitner)) {
    if (progress[id]) leitnerPulito[id] = l;
  }

  return {
    progress,
    leitner: leitnerPulito,
    stats,
    simCount: Math.max(a.simCount || 0, b.simCount || 0),
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0, Date.now()),
  };
}

// Carica tutte le simulazioni salvate come chiavi separate, ordinate dalla più recente.
async function loadAllSims(env, u) {
  const list = await env.RIPAM_KV.list({ prefix: simPrefix(u) });
  const sims = await Promise.all(list.keys.map(k => env.RIPAM_KV.get(k.name, 'json')));
  return sims.filter(Boolean);
}

function dedupSims(sims) {
  const map = {};
  for (const s of sims) if (s && s.id) map[s.id] = s;
  return Object.values(map).sort((x, y) => (y.data || 0) - (x.data || 0));
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const u = url.searchParams.get('u') || 'default';

    try {
      if (url.pathname === '/state' && request.method === 'GET') {
        const cur = (await env.RIPAM_KV.get(kvKey(u), 'json')) || EMPTY;
        const simStorico = dedupSims(await loadAllSims(env, u));
        return json({ ...cur, simStorico, simCount: Math.max(cur.simCount || 0, simStorico.length) });
      }

      if (url.pathname === '/state' && request.method === 'POST') {
        let incoming;
        try {
          incoming = await request.json();
        } catch {
          return json({ error: 'invalid json' }, 400);
        }

        // 1) Ogni simulazione ricevuta → chiave separata idempotente per id (no conflitti)
        const incomingSims = Array.isArray(incoming.simStorico) ? incoming.simStorico.filter(s => s && s.id) : [];
        await Promise.all(incomingSims.map(s => env.RIPAM_KV.put(simPrefix(u) + s.id, JSON.stringify(s))));

        // 2) Merge dello stato di studio (senza lo storico nel blob)
        const cur = await env.RIPAM_KV.get(kvKey(u), 'json');
        const merged = mergeState(cur, incoming);
        await env.RIPAM_KV.put(kvKey(u), JSON.stringify(merged));

        // 3) Risposta con lo storico completo (include subito le sim appena inviate)
        const simStorico = dedupSims([...(await loadAllSims(env, u)), ...incomingSims]);
        return json({ ...merged, simStorico, simCount: Math.max(merged.simCount || 0, simStorico.length) });
      }

      if (url.pathname === '/state' && request.method === 'DELETE') {
        const list = await env.RIPAM_KV.list({ prefix: simPrefix(u) });
        await Promise.all([
          env.RIPAM_KV.delete(kvKey(u)),
          ...list.keys.map(k => env.RIPAM_KV.delete(k.name)),
        ]);
        return json({ ok: true, reset: true });
      }

      if (url.pathname === '/' || url.pathname === '/health') {
        return json({ ok: true, service: 'ripam-sync' });
      }

      return json({ error: 'not found' }, 404);
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  },
};
