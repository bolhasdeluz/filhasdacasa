// Cloudflare Pages Function: /api/export
// Retorna dados completos: parceiros do Odoo + notas e pontos do KV
// GET /api/export → JSON com todos os campos para exportação CSV

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS });
  }

  const ODOO_URL  = env.ODOO_URL;
  const ODOO_DB   = env.ODOO_DB;
  const ODOO_USER = env.ODOO_USER;
  const ODOO_PASS = env.ODOO_PASS;
  const kv        = env.NOTAS_GUIAS;

  if (!ODOO_URL || !ODOO_DB || !ODOO_USER || !ODOO_PASS) {
    return new Response(
      JSON.stringify({ error: 'Variáveis de ambiente Odoo não configuradas.' }),
      { status: 500, headers: CORS }
    );
  }

  if (!kv) {
    return new Response(
      JSON.stringify({ error: 'KV binding NOTAS_GUIAS não configurado.' }),
      { status: 500, headers: CORS }
    );
  }

  function callKw(url, cookie, model, method, args, kwargs, id) {
    return fetch(`${url}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'call', id,
        params: { model, method, args, kwargs }
      })
    }).then(r => r.json());
  }

  try {
    // 1. Autenticar no Odoo
    const authRes = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'call', id: 1,
        params: { db: ODOO_DB, login: ODOO_USER, password: ODOO_PASS }
      })
    });

    const cookie   = authRes.headers.get('set-cookie') || '';
    const authData = await authRes.json();

    if (!authData.result?.uid) {
      return new Response(
        JSON.stringify({ error: 'Falha na autenticação com Odoo.' }),
        { status: 401, headers: CORS }
      );
    }

    // 2. Buscar parceiros + passagens (igual ao partners.js)
    const fields = [
      'name', 'function', 'id', 'email',
      'x_studio_data_da_iniciacao',
      'x_studio_caboclo',
      'x_studio_exu',
      'x_studio_pomba_gira',
      'x_studio_preto_velho',
      'x_studio_cigana',
      'x_studio_cosme',
    ];

    const [partnersRes, nomesRes, datasRes] = await Promise.all([
      callKw(ODOO_URL, cookie, 'res.partner', 'search_read',
        [[['user_ids', '!=', false]]],
        { fields, order: 'name asc' }, 2),

      callKw(ODOO_URL, cookie, 'x_res_partner_line_770ad', 'search_read',
        [[]],
        { fields: ['x_name', 'x_res_partner_id', 'x_studio_sequence'], order: 'x_studio_sequence asc' }, 3),

      callKw(ODOO_URL, cookie, 'x_res_partner_line_6f088', 'search_read',
        [[]],
        { fields: ['x_name', 'x_res_partner_id', 'x_studio_sequence'], order: 'x_studio_sequence asc' }, 4),
    ]);

    const partners = (partnersRes.result || []).filter(p => p.email !== ODOO_USER);

    const nomesPorPartner = {};
    const datasPorPartner = {};

    for (const row of (nomesRes.result || [])) {
      const pid = Array.isArray(row.x_res_partner_id) ? row.x_res_partner_id[0] : row.x_res_partner_id;
      if (!nomesPorPartner[pid]) nomesPorPartner[pid] = [];
      nomesPorPartner[pid].push(row.x_name);
    }
    for (const row of (datasRes.result || [])) {
      const pid = Array.isArray(row.x_res_partner_id) ? row.x_res_partner_id[0] : row.x_res_partner_id;
      if (!datasPorPartner[pid]) datasPorPartner[pid] = [];
      datasPorPartner[pid].push(row.x_name);
    }

    for (const p of partners) {
      p.passagens_nomes = nomesPorPartner[p.id] || [];
      p.passagens_datas = datasPorPartner[p.id] || [];
    }

    // 3. Listar todas as chaves do KV de uma vez
    const kvList = await kv.list();
    const allKvKeys = (kvList.keys || []).map(k => k.name);

    // 4. Buscar todos os valores do KV em paralelo
    const kvValues = await Promise.all(
      allKvKeys.map(k => kv.get(k).then(v => ({ k, v: v || '' })))
    );

    const kvMap = {};
    for (const { k, v } of kvValues) {
      kvMap[k] = v;
    }

    // 5. Montar chaves esperadas para cada parceiro e injetar dados do KV
    const GUIDES = [
      { key: 'x_studio_caboclo',     type: 'Caboclo'     },
      { key: 'x_studio_exu',         type: 'Exu'         },
      { key: 'x_studio_pomba_gira',  type: 'Pomba Gira'  },
      { key: 'x_studio_preto_velho', type: 'Preto Velho' },
      { key: 'x_studio_cigana',      type: 'Cigana'      },
      { key: 'x_studio_cosme',       type: 'Cosme'       },
    ];

    function nk(id, key) { return `p${id}_${key}`; }

    for (const p of partners) {
      p.notas_guias = {};
      p.pontos_guias = {};

      // Notas e pontos dos guias fixos
      for (const g of GUIDES) {
        if (p[g.key]) {
          const k = nk(p.id, g.key);
          p.notas_guias[g.type]  = kvMap[k]           || '';
          p.pontos_guias[g.type] = kvMap['ponto:' + k] || '';
        }
      }

      // Notas e pontos das passagens
      p.notas_passagens  = [];
      p.pontos_passagens = [];
      const passagens = (p.passagens_nomes || [])
        .map((nome, i) => ({ nome, data: (p.passagens_datas || [])[i] || null }))
        .filter(ps => ps.nome);

      for (let i = 0; i < passagens.length; i++) {
        const k = nk(p.id, `passagem_${i}`);
        p.notas_passagens.push(kvMap[k]           || '');
        p.pontos_passagens.push(kvMap['ponto:' + k] || '');
      }
    }

    return new Response(JSON.stringify(partners), { status: 200, headers: CORS });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: CORS }
    );
  }
}
