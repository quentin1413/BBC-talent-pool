// api/candidates.js — 候选人数据 CRUD 代理
// 环境变量：SB_URL, SB_SERVICE_KEY（在 Vercel Dashboard 设置）

const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE_KEY;

function sbHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Prefer': 'return=minimal'
  };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET /api/candidates — 获取所有候选人
    if (req.method === 'GET') {
      const r = await fetch(
        `${SB_URL}/rest/v1/candidates?select=*&order=added_at.desc`,
        { headers: sbHeaders() }
      );
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);
      return res.status(200).json(data);
    }

    // POST /api/candidates — 新增候选人
    if (req.method === 'POST') {
      const body = req.body;
      const r = await fetch(
        `${SB_URL}/rest/v1/candidates`,
        {
          method: 'POST',
          headers: { ...sbHeaders(), 'Prefer': 'return=representation' },
          body: JSON.stringify(body)
        }
      );
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);
      return res.status(201).json(data);
    }

    // DELETE /api/candidates?id=xxx — 删除候选人
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id required' });
      const r = await fetch(
        `${SB_URL}/rest/v1/candidates?id=eq.${id}`,
        { method: 'DELETE', headers: sbHeaders() }
      );
      if (!r.ok) {
        const data = await r.json();
        return res.status(r.status).json(data);
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
