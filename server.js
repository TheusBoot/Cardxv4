/**
 * CardX — Proxy Server
 * Resolve CORS para fxtwitter e syndication do Twitter
 *
 * Como usar:
 *   npm install express node-fetch@2
 *   node server.js
 *   Abrir: http://localhost:3000
 */

const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Servir arquivos do frontend em /public
app.use(express.static(path.join(__dirname, 'public')));

// Headers CORS para todas as rotas /proxy
app.use('/proxy', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── /proxy/fxtwitter?user=USER&id=ID ──────────────────────────
app.get('/proxy/fxtwitter', async (req, res) => {
  const { user, id } = req.query;
  if (!user || !id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }
  try {
    const upstream = await fetch(
      `https://api.fxtwitter.com/${encodeURIComponent(user)}/status/${id}`,
      { headers: { 'User-Agent': 'CardX/2.0' }, timeout: 8000 }
    );
    const json = await upstream.json();
    res.status(upstream.status).json(json);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── /proxy/syndication?id=ID ──────────────────────────────────
app.get('/proxy/syndication', async (req, res) => {
  const { id } = req.query;
  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  // Token correto para syndication API
  const token = (Math.round(Number(id) / 1e15 * Math.PI) >>> 0).toString(36);
  try {
    const upstream = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=pt&token=${token}`,
      { headers: { 'User-Agent': 'CardX/2.0' }, timeout: 8000 }
    );
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `HTTP ${upstream.status}` });
    }
    const json = await upstream.json();
    res.json(json);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── /proxy/media?url=URL (proxy para imagens/vídeos com CORS) ──
// Suporta Range Requests para streaming de vídeo
app.get('/proxy/media', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('URL obrigatória');

  // Só permite domínios do Twitter/X
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).send('URL inválida'); }
  const allowed = ['pbs.twimg.com', 'video.twimg.com', 'abs.twimg.com', 'ton.twimg.com', 'twimg.com'];
  if (!allowed.some(d => parsed.hostname.endsWith(d))) {
    return res.status(403).send('Domínio não permitido');
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://twitter.com/',
    'Origin':  'https://twitter.com',
  };

  // Repassa Range header para suporte a streaming de vídeo
  if (req.headers.range) {
    headers['Range'] = req.headers.range;
  }

  try {
    const upstream = await fetch(url, { headers, timeout: 60000 });
    const ct = upstream.headers.get('Content-Type') || 'application/octet-stream';
    const cl = upstream.headers.get('Content-Length');
    const cr = upstream.headers.get('Content-Range');

    res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');
    if (cl) res.setHeader('Content-Length', cl);
    if (cr) res.setHeader('Content-Range', cr);

    const status = upstream.status === 206 ? 206 : 200;
    res.status(status);
    upstream.body.pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(502).send(err.message);
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ CardX Server rodando em http://localhost:${PORT}`);
  console.log(`   Abra http://localhost:${PORT} no navegador\n`);
});
