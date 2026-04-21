// netlify/functions/candidates.js — 候选人数据 CRUD 代理
// 环境变量：SB_URL, SB_SERVICE_KEY（在 Netlify Dashboard → Environment variables 设置）

const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE_KEY;

function sbHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    ...extra
  };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  try {
    // GET — 获取所有候选人
    if (event.httpMethod === 'GET') {
      const r = await fetch(
        `${SB_URL}/rest/v1/candidates?select=*&order=added_at.desc`,
        { headers: sbHeaders() }
      );
      const data = await r.json();
      return { statusCode: r.ok ? 200 : r.status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
    }

    // POST — 新增候选人
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const r = await fetch(
        `${SB_URL}/rest/v1/candidates`,
        {
          method: 'POST',
          headers: sbHeaders({ 'Prefer': 'return=representation' }),
          body: JSON.stringify(body)
        }
      );
      const data = await r.json();
      return { statusCode: r.ok ? 201 : r.status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
    }

    // DELETE — 删除候选人 ?id=xxx
    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id required' }) };
      const r = await fetch(
        `${SB_URL}/rest/v1/candidates?id=eq.${id}`,
        { method: 'DELETE', headers: sbHeaders() }
      );
      if (!r.ok) {
        const data = await r.json();
        return { statusCode: r.status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
      }
      return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    return { statusCode: 500, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
