// ═══════════════════════════════════════════════════
// HELPERS.JS — Estado global, utilitários DOM,
// formatação, status UI e manipulação de blobs
// ═══════════════════════════════════════════════════

// ── Estado Global ────────────────────────────────
window.avatarColor   = '#1d9bf0';
window.tweetData     = null;
window.videoEl       = null;
window.mediaType     = null;
window.mediaRecorder = null;
window.recChunks     = [];
window.fetchController = null;

// ── Constantes ───────────────────────────────────
window.IS_LOCAL_SERVER = location.protocol === 'http:' && location.hostname === 'localhost';
window.CARD_BASE_WIDTH = 500; // largura CSS fixa do card

// ── API URLs ─────────────────────────────────────
window.API = {
  fxtwitter(user, id) {
    return IS_LOCAL_SERVER
      ? `/proxy/fxtwitter?user=${encodeURIComponent(user)}&id=${id}`
      : `https://api.fxtwitter.com/${encodeURIComponent(user)}/status/${id}`;
  },
  syndication(id) {
    if (IS_LOCAL_SERVER) return `/proxy/syndication?id=${id}`;
    const token = (Math.round(Number(id) / 1e15 * Math.PI) >>> 0).toString(36);
    return `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=pt&token=${token}`;
  },
  mediaProxy(url) {
    return IS_LOCAL_SERVER ? `/proxy/media?url=${encodeURIComponent(url)}` : url;
  }
};

// ── DOM Helpers ──────────────────────────────────
window.el  = id => document.getElementById(id);
window.get = id => el(id).value;
window.set = (id, v) => { el(id).value = v; };

// ── Escape XSS ──────────────────────────────────
window.esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ── Linkify texto do tweet ──────────────────────
window.renderText = raw => {
  if (!raw) return '';
  const urlRe = /(https?:\/\/[^\s]+)/g;
  const parts = raw.split(urlRe);
  return parts.map(part => {
    if (urlRe.test(part)) {
      return `<a href="${part}" target="_blank" rel="noopener noreferrer">${esc(part)}</a>`;
    }
    return esc(part)
      .replace(/@(\w+)/g, '<a href="https://x.com/$1" target="_blank" rel="noopener">@$1</a>')
      .replace(/#(\w+)/g, '<a href="https://x.com/hashtag/$1" target="_blank" rel="noopener">#$1</a>');
  }).join('');
};

// ── Formatar números ────────────────────────────
window.fmtNum = n => {
  if (n == null || n === '') return '';
  const num = typeof n === 'string' ? parseInt(n.replace(/[^\d]/g, ''), 10) : n;
  if (isNaN(num)) return String(n);
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace('.0', '') + 'K';
  return String(num);
};

// ── Formatar data ───────────────────────────────
window.formatDate = d => {
  const pad = n => String(n).padStart(2, '0');
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${h12}:${pad(d.getMinutes())} ${ampm} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

// ── Status UI ───────────────────────────────────
window.setStatus = (msg, color = 'var(--green)') => {
  const s = el('status');
  s.style.color = color;
  s.textContent = msg;
};

window.setFetchLoading = on => {
  const btn = el('btn-fetch');
  btn.disabled = on;
  btn.innerHTML = on
    ? 'Buscando…'
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Buscar`;
};

window.showSkeleton = () => {
  el('empty-state').style.display = 'none';
  el('tweet-card').style.display  = 'none';
  el('skeleton').style.display    = 'flex';
  el('bottom-hint').style.display = 'none';
};
window.hideSkeleton = () => { el('skeleton').style.display = 'none'; };

window.showError = msg => {
  el('empty-state').style.display = 'none';
  el('skeleton').style.display    = 'none';
  const e = el('error-msg');
  e.textContent = '⚠ ' + msg;
  e.style.display = 'block';
};
window.hideError = () => { el('error-msg').style.display = 'none'; };

// ── Fetch com timeout ───────────────────────────
window.fetchTimeout = async (url, options = {}, ms = 9000) => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Timeout — servidor não respondeu');
    throw e;
  } finally {
    clearTimeout(timer);
  }
};

// ── Blob URL handling (evita canvas tainted) ────
window.urlToBlobURL = async src => {
  const url = (IS_LOCAL_SERVER && !src.startsWith('blob:') && !src.startsWith('data:'))
    ? `/proxy/media?url=${encodeURIComponent(src)}`
    : src;
  const res = await fetchTimeout(url, {}, 15000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

window.preloadImagesAsBlobURLs = async () => {
  const card  = document.getElementById('tweet-card');
  const swaps = [];
  for (const img of Array.from(card.querySelectorAll('img'))) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('blob:') || src.startsWith('data:')) continue;
    try {
      const blobUrl = await urlToBlobURL(src);
      swaps.push({ img, original: src });
      img.crossOrigin = 'anonymous';
      img.src = blobUrl;
      await new Promise(res => {
        if (img.complete && img.naturalWidth) return res();
        img.onload = img.onerror = res;
      });
    } catch (e) {
      console.warn('[preload img] falhou:', src, e.message);
    }
  }
  return swaps;
};

window.restoreImages = swaps => {
  for (const { img, original } of swaps) {
    img.removeAttribute('crossOrigin');
    if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
    img.src = original;
  }
};

// Esconde banner se já está no servidor
if (IS_LOCAL_SERVER) el('setup-banner').classList.add('hidden');
