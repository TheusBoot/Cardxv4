const express = require('express');
const fetch   = require('node-fetch');
const cheerio = require('cheerio');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Headers que imitam um browser real ───────────────────────────────────────
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/123.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control':   'no-cache',
  'Pragma':          'no-cache',
  'Sec-Fetch-Dest':  'document',
  'Sec-Fetch-Mode':  'navigate',
  'Sec-Fetch-Site':  'none',
  'Upgrade-Insecure-Requests': '1',
};

// ─── Extrai todos os metadados da página ─────────────────────────────────────
function extractMeta($, baseUrl) {
  const get = (...selectors) => {
    for (const sel of selectors) {
      const val =
        $(`meta[property="${sel}"]`).attr('content') ||
        $(`meta[name="${sel}"]`).attr('content')     ||
        $(`meta[itemprop="${sel}"]`).attr('content') ||
        '';
      if (val.trim()) return val.trim();
    }
    return '';
  };

  // título
  const title =
    get('og:title', 'twitter:title', 'title') ||
    $('h1').first().text().trim()             ||
    $('title').text().trim()                  ||
    '';

  // descrição
  const description =
    get('og:description', 'twitter:description', 'description') ||
    '';

  // imagem: tenta várias fontes
  let image = get('og:image', 'twitter:image', 'twitter:image:src', 'image');

  if (!image) {
    // link rel="image_src"
    image = $('link[rel="image_src"]').attr('href') || '';
  }

  if (!image) {
    // primeira imagem com src absoluto e tamanho razoável
    $('img').each((_, el) => {
      const src = $(el).attr('src') || '';
      const w   = parseInt($(el).attr('width')  || '0');
      const h   = parseInt($(el).attr('height') || '0');
      if (src.startsWith('http') && (w === 0 || w > 100) && (h === 0 || h > 100)) {
        image = src;
        return false; // break
      }
    });
  }

  // garante URL absoluta na imagem
  if (image && !image.startsWith('http')) {
    try { image = new URL(image, baseUrl).href; } catch (_) { image = ''; }
  }

  // favicon como último recurso de ícone
  const favicon =
    $('link[rel="shortcut icon"]').attr('href') ||
    $('link[rel="icon"]').attr('href')          ||
    '/favicon.ico';

  return { title, description, image, favicon };
}

// ─── Rota principal de preview ────────────────────────────────────────────────
app.get('/api/preview', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Parâmetro "url" obrigatório.' });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'URL inválida.' });
  }

  const domain = parsed.hostname.replace(/^www\./, '');

  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      timeout: 12000,
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `Site retornou status ${response.status}.`,
        domain,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return res.status(415).json({
        error: 'URL não aponta para uma página HTML.',
        domain,
      });
    }

    const html = await response.text();
    const $    = cheerio.load(html);
    const meta = extractMeta($, url);

    return res.json({
      domain,
      title:       meta.title,
      description: meta.description,
      image:       meta.image,
      favicon:     meta.favicon,
      url,
    });

  } catch (err) {
    console.error('[preview error]', err.message);
    return res.status(502).json({
      error: 'Não foi possível acessar o site: ' + err.message,
      domain,
    });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true }));

// ─── Fallback SPA ─────────────────────────────────────────────────────────────
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 CardX rodando em http://localhost:${PORT}\n`);
});
