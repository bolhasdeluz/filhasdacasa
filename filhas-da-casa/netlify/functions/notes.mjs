// Netlify Function: /api/notes
// Lê e salva notas no Netlify Blobs
// GET  /api/notes?key=p123_x_studio_caboclo  → { text: "..." }
// POST /api/notes  body: { key, text }        → { ok: true }

import { getStore } from '@netlify/blobs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS });
  }

  const store = getStore('notas-guias');

  // ── GET ──────────────────────────────────────────────────────
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (!key) {
      return new Response(
        JSON.stringify({ error: 'Parâmetro "key" obrigatório.' }),
        { status: 400, headers: CORS }
      );
    }

    try {
      const text = await store.get(key) ?? '';
      return new Response(JSON.stringify({ text }), { status: 200, headers: CORS });
    } catch {
      // Chave não existe ainda → retorna string vazia
      return new Response(JSON.stringify({ text: '' }), { status: 200, headers: CORS });
    }
  }

  // ── POST ─────────────────────────────────────────────────────
  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Body JSON inválido.' }),
        { status: 400, headers: CORS }
      );
    }

    const { key, text } = body;

    if (!key) {
      return new Response(
        JSON.stringify({ error: 'Campo "key" obrigatório.' }),
        { status: 400, headers: CORS }
      );
    }

    await store.set(key, text || '');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
  }

  return new Response('Method Not Allowed', { status: 405, headers: CORS });
};

export const config = { path: '/api/notes' };
