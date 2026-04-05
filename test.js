const fetch   = require('node-fetch');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

fetch('https://g1.globo.com/', { headers: HEADERS, timeout: 10000 })
  .then(r => r.text())
  .then(html => {
    const $ = cheerio.load(html);
    const title = $('meta[property="og:title"]').attr('content') || $('title').text();
    const img   = $('meta[property="og:image"]').attr('content') || 'nenhuma';
    console.log('titulo:', title);
    console.log('imagem:', img);
  })
  .catch(e => console.log('erro:', e.message));
