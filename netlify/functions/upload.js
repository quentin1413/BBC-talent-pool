// netlify/functions/upload.js — 简历图片上传代理（转发到 Supabase Storage）
// 环境变量：SB_URL, SB_SERVICE_KEY

const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE_KEY;
const BUCKET = 'resumes';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// 从 multipart body 中提取第一个文件
function parseMultipart(buffer, boundary) {
  const sep = Buffer.from('--' + boundary);
  const parts = [];
  let start = buffer.indexOf(sep) + sep.length + 2;
  while (start < buffer.length) {
    const end = buffer.indexOf(sep, start);
    if (end === -1) break;
    const part = buffer.slice(start, end - 2);
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

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const contentType = event.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No boundary in content-type' }) };
    }
    const boundary = boundaryMatch[1];

    // Netlify 传入 base64 编码的 body
    const rawBody = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
    const parts = parseMultipart(rawBody, boundary);
    const filePart = parts.find(p => p.name === 'file');
    if (!filePart) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No file field found' }) };
    }

    const ext = (filePart.filename.split('.').pop() || 'jpg').toLowerCase();
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
      return { statusCode: uploadRes.status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err }) };
    }

    const publicUrl = `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ url: publicUrl }) };
  } catch (e) {
    return { statusCode: 500, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
