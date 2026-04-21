// api/upload.js — 简历图片上传代理（转发到 Supabase Storage）
// 接收 multipart/form-data，字段名 file

import { Readable } from 'stream';

const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE_KEY;
const BUCKET = 'resumes';

export const config = {
  api: { bodyParser: false }   // 关闭 Vercel 默认 body 解析，手动处理二进制
};

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// 从 multipart body 中提取第一个文件
function parseMultipart(buffer, boundary) {
  const sep = Buffer.from('--' + boundary);
  const parts = [];
  let start = buffer.indexOf(sep) + sep.length + 2; // skip \r\n
  while (start < buffer.length) {
    const end = buffer.indexOf(sep, start);
    if (end === -1) break;
    const part = buffer.slice(start, end - 2); // trim trailing \r\n
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) { start = end + sep.length + 2; continue; }
    const headerStr = part.slice(0, headerEnd).toString();
    const body = part.slice(headerEnd + 4);
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const fileMatch = headerStr.match(/filename="([^"]+)"/);
    const typeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/);
    parts.push({
      name: nameMatch ? nameMatch[1] : '',
      filename: fileMatch ? fileMatch[1] : '',
      contentType: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
      data: body
    });
    start = end + sep.length + 2;
  }
  return parts;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) return res.status(400).json({ error: 'No boundary in content-type' });
    const boundary = boundaryMatch[1];

    const rawBody = await readRawBody(req);
    const parts = parseMultipart(rawBody, boundary);
    const filePart = parts.find(p => p.name === 'file');
    if (!filePart) return res.status(400).json({ error: 'No file field found' });

    const ext = filePart.filename.split('.').pop() || 'jpg';
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const uploadRes = await fetch(
      `${SB_URL}/storage/v1/object/${BUCKET}/${path}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SB_KEY}`,
          'apikey': SB_KEY,
          'Content-Type': filePart.contentType,
          'Cache-Control': '3600'
        },
        body: filePart.data
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return res.status(uploadRes.status).json({ error: err });
    }

    const publicUrl = `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    return res.status(200).json({ url: publicUrl });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
