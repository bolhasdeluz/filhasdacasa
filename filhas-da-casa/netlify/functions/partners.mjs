// Netlify Function: /api/partners
// Authenticates with Odoo and returns partner data

export default async (request) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS });
  }

  const ODOO_URL  = process.env.ODOO_URL;   // e.g. https://suaempresa.odoo.com
  const ODOO_DB   = process.env.ODOO_DB;    // nome do banco
  const ODOO_USER = process.env.ODOO_USER;  // login admin
  const ODOO_PASS = process.env.ODOO_PASS;  // senha admin

  if (!ODOO_URL || !ODOO_DB || !ODOO_USER || !ODOO_PASS) {
    return new Response(
      JSON.stringify({ error: 'Variáveis de ambiente não configuradas.' }),
      { status: 500, headers: CORS }
    );
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

    const setCookie = authRes.headers.get('set-cookie') || '';
    const authData  = await authRes.json();

    if (!authData.result?.uid) {
      return new Response(
        JSON.stringify({ error: 'Falha na autenticação com Odoo.' }),
        { status: 401, headers: CORS }
      );
    }

    // 2. Buscar parceiros (filhas)
    const fields = [
      'name', 'function', 'image_128', 'id', 'email',
      'x_studio_data_da_iniciacao',
      'x_studio_caboclo',
      'x_studio_exu',
      'x_studio_pomba_gira',
      'x_studio_preto_velho',
      'x_studio_cigana',
      'x_studio_cosme',
    ];

    const dataRes = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': setCookie,
      },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'call', id: 2,
        params: {
          model: 'res.partner',
          method: 'search_read',
          args: [[['user_ids', '!=', false]]],
          kwargs: { fields, order: 'name asc' }
        }
      })
    });

    const data = await dataRes.json();

    // Filtra a conta admin da lista
    const partners = (data.result || []).filter(p => p.email !== ODOO_USER);

    return new Response(JSON.stringify(partners), { status: 200, headers: CORS });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: CORS }
    );
  }
};

export const config = { path: '/api/partners' };
