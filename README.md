# CardX — Link Preview Editor

Preview de links editável estilo Facebook, com scraping server-side real.

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar o servidor
npm start
# ou, para desenvolvimento com hot-reload:
npm run dev
```

Acesse: **http://localhost:3000**

## Como funciona

```
Usuário cola URL
      │
      ▼
Frontend (public/index.html)
      │  GET /api/preview?url=...
      ▼
Backend (server.js)
      │  fetch() com headers de browser real
      ▼
Site de destino
      │  retorna HTML
      ▼
Cheerio extrai: og:title, og:description, og:image
      │  + fallbacks: twitter:image, primeira <img>, etc.
      ▼
Frontend renderiza o card editável
```

## Estrutura

```
cardx/
├── server.js          ← backend Express
├── package.json
├── public/
│   └── index.html     ← frontend completo
└── README.md
```

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT`   | `3000` | Porta do servidor |

## Deploy (Render / Railway / Fly.io)

Qualquer plataforma que rode Node.js funciona. Aponte para `npm start`.

## Integrando com banco de dados

No `public/index.html`, localize a função `publish()` e substitua o `alert` pela sua chamada de API:

```js
async function publish() {
  const payload = {
    text:  document.getElementById('postText').value,
    title: document.getElementById('previewTitle').value,
    desc:  document.getElementById('previewDesc').value,
    image: document.getElementById('previewImg').src,
    url:   document.getElementById('urlInput').value,
  };
  await fetch('/api/posts', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
}
```
