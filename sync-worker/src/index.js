// RIPAM Quiz — Worker di sincronizzazione cross-device
// Storage: Cloudflare KV. Un singolo blob per utente logico ("u").
// Ogni device invia il proprio snapshot; il Worker fa MERGE non distruttivo
// (union dei quiz fatti, ultimo stato per quiz) e restituisce lo stato unificato.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function kvKey(u) {
  const safe = (u || 'default').toString().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
  return `state:${safe}`;
}

const EMPTY = { progress: {}, leitner: {}, stats: {}, simCount: 0, updatedAt: 0 };

// Merge non distruttivo: last-write-wins per singolo quiz, union sull'insieme.
function mergeState(a, b) {
  a = a || {};
  b = b || {};

  // progress[id] = { c: 0|1 (ultimo esito), m: materia, t: timestamp } → tieni il più recente
  const progress = { ...(a.progress || {}) };
  for (const [id, p] of Object.entries(b.progress || {})) {
    const cur = progress[id];
    if (!cur || (p.t || 0) >= (cur.t || 0)) progress[id] = p;
  }

  // leitnerStates[id] → tieni lo stato con lastAttemptAt più recente
  const leitner = { ...(a.leitner || {}) };
  for (const [id, l] of Object.entries(b.leitner || {})) {
    const cur = leitner[id];
    if (!cur || (l.lastAttemptAt || 0) >= (cur.lastAttemptAt || 0)) leitner[id] = l;
  }

  // stats[materia] → tieni la versione con più tentativi (evita doppio conteggio grossolano)
  const stats = { ...(a.stats || {}) };
  for (const [m, v] of Object.entries(b.stats || {})) {
    if (!stats[m] || (v.totale || 0) >= (stats[m].totale || 0)) stats[m] = v;
  }

  return {
    progress,
    leitner,
    stats,
    simCount: Math.max(a.simCount || 0, b.simCount || 0),
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0, Date.now()),
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const u = url.searchParams.get('u') || 'default';

    try {
      if (url.pathname === '/state' && request.method === 'GET') {
        const cur = await env.RIPAM_KV.get(kvKey(u), 'json');
        return json(cur || EMPTY);
      }

      if (url.pathname === '/state' && request.method === 'POST') {
        let incoming;
        try {
          incoming = await request.json();
        } catch {
          return json({ error: 'invalid json' }, 400);
        }
        const cur = await env.RIPAM_KV.get(kvKey(u), 'json');
        const merged = mergeState(cur, incoming);
        await env.RIPAM_KV.put(kvKey(u), JSON.stringify(merged));
        return json(merged);
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
