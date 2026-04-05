// ═══════════════════════════════════════════════════
// FORMATS.JS — Definições de formatos de redes
// sociais e gestão do select de formato
// ═══════════════════════════════════════════════════

window.FORMATS = {
  original: {
    label: 'Original (card)', width: null, height: null, ratio: null,
    fps: null, videoBitrate: 4_000_000,
    notes: 'Tamanho natural do card gerado', group: 'Geral',
  },
  ig_square: {
    label: 'Instagram Post (quadrado)', width: 864, height: 864, ratio: '1:1',
    fps: null, videoBitrate: 6_000_000,
    notes: 'Feed 1:1. Instagram redimensiona para 1080px.', group: 'Instagram',
  },
  ig_portrait: {
    label: 'Instagram Post (retrato)', width: 864, height: 1080, ratio: '4:5',
    fps: null, videoBitrate: 6_000_000,
    notes: 'Ocupa mais espaço no feed. Proporção 4:5.', group: 'Instagram',
  },
  ig_landscape: {
    label: 'Instagram Post (paisagem)', width: 864, height: 452, ratio: '1.91:1',
    fps: null, videoBitrate: 6_000_000,
    notes: 'Cortado nas laterais no feed mobile.', group: 'Instagram',
  },
  ig_reels: {
    label: 'Instagram Reels', width: 864, height: 1536, ratio: '9:16',
    fps: 30, videoBitrate: 8_000_000,
    notes: 'Vídeo vertical 9:16. Máx 90s.', group: 'Instagram',
  },
  ig_stories: {
    label: 'Instagram Stories', width: 1080, height: 1920, ratio: '9:16',
    fps: 30, videoBitrate: 6_000_000,
    notes: 'Stories 9:16. Máx 15s vídeo.', group: 'Instagram',
  },
  fb_post: {
    label: 'Facebook Post (feed)', width: 960, height: 504, ratio: '1.91:1',
    fps: null, videoBitrate: 6_000_000,
    notes: 'Feed 1.91:1. Facebook redimensiona para exibição.', group: 'Facebook',
  },
  fb_square: {
    label: 'Facebook Post (quadrado)', width: 864, height: 864, ratio: '1:1',
    fps: null, videoBitrate: 6_000_000,
    notes: 'Melhor engajamento no feed mobile.', group: 'Facebook',
  },
  fb_reels: {
    label: 'Facebook Reels', width: 864, height: 1536, ratio: '9:16',
    fps: 30, videoBitrate: 8_000_000,
    notes: 'Máx 90s. Proporção 9:16.', group: 'Facebook',
  },
  fb_stories: {
    label: 'Facebook Stories', width: 864, height: 1536, ratio: '9:16',
    fps: 30, videoBitrate: 6_000_000,
    notes: 'Máx 20s vídeo. Proporção 9:16.', group: 'Facebook',
  },
  yt_video: {
    label: 'YouTube Vídeo (HD)', width: 1280, height: 720, ratio: '16:9',
    fps: 30, videoBitrate: 12_000_000,
    notes: 'HD 720p. Recomendado H.264 + AAC.', group: 'YouTube',
  },
  yt_fullhd: {
    label: 'YouTube Vídeo (Full HD)', width: 1920, height: 1080, ratio: '16:9',
    fps: 30, videoBitrate: 16_000_000,
    notes: 'Full HD 1080p.', group: 'YouTube',
  },
  yt_shorts: {
    label: 'YouTube Shorts', width: 864, height: 1536, ratio: '9:16',
    fps: 30, videoBitrate: 8_000_000,
    notes: 'Máx 60s. Proporção 9:16.', group: 'YouTube',
  },
  tw_post: {
    label: 'Twitter/X Post (imagem)', width: 1200, height: 675, ratio: '16:9',
    fps: null, videoBitrate: 6_000_000,
    notes: 'Padrão recomendado 16:9. Máx 5MB.', group: 'Twitter/X',
  },
  tw_square: {
    label: 'Twitter/X Post (quadrado)', width: 864, height: 864, ratio: '1:1',
    fps: null, videoBitrate: 5_000_000,
    notes: 'Quadrado 1:1. Máx 5MB.', group: 'Twitter/X',
  },
  tiktok: {
    label: 'TikTok Vídeo', width: 864, height: 1536, ratio: '9:16',
    fps: 60, videoBitrate: 10_000_000,
    notes: 'Máx 10min. Proporção 9:16.', group: 'TikTok',
  },
  tiktok_photo: {
    label: 'TikTok Foto/Carrossel', width: 864, height: 1536, ratio: '9:16',
    fps: null, videoBitrate: null,
    notes: 'Máx 20MB por foto, até 35 fotos.', group: 'TikTok',
  },
};

window.populateFormatSelect = () => {
  const sel = el('s-export-format');
  if (!sel) return;
  const groups = {};
  Object.entries(FORMATS).forEach(([key, fmt]) => {
    if (!groups[fmt.group]) groups[fmt.group] = [];
    groups[fmt.group].push({ key, fmt });
  });
  sel.innerHTML = '';
  Object.entries(groups).forEach(([groupName, items]) => {
    const og = document.createElement('optgroup');
    og.label = groupName;
    items.forEach(({ key, fmt }) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = fmt.label + (fmt.width ? ` · ${fmt.width}×${fmt.height}` : '');
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });
  sel.addEventListener('change', onFormatChange);
  const modeEl = el('s-compose-mode');
  if (modeEl) modeEl.addEventListener('change', updateComposeModeUI);
};

window.onFormatChange = () => {
  const key = el('s-export-format').value;
  const fmt = FORMATS[key];
  if (!fmt) return;
  const info = el('format-info');
  if (info) {
    info.textContent = fmt.notes || '';
    info.style.display = fmt.notes ? 'block' : 'none';
  }
  updateComposeModeUI();
};

window.updateComposeModeUI = () => {
  const mode   = el('s-compose-mode') && el('s-compose-mode').value;
  const bgWrap = el('bg-style-wrap');
  if (bgWrap) bgWrap.style.display = (mode === 'native') ? 'none' : 'block';
};

window.getSelectedFormat = () => {
  const key = (el('s-export-format') && el('s-export-format').value) || 'original';
  return { key, ...FORMATS[key] };
};

// ══════════════════════════════════════════════════════════════════════
// MATRIZ MATEMÁTICA WYSIWYG — base única fmt.width
//
//   baseW        = fmt.width  (ou CARD_BASE_WIDTH quando fmt=original)
//   cardCSSWidth = baseW × (Width%  / 100)   ← layout físico / text wrap
//   drawW        = baseW × (Scale%  / 100)   ← ocupação visual no canvas
//   transformScale = drawW / cardCSSWidth = Scale% / Width%
//
// Exemplo: Stories 810px, Width=109%, Scale=90%
//   cardCSSWidth = 810 × 1.09 = 883px  (texto com largura confortável)
//   drawW        = 810 × 0.90 = 729px  (ocupa 90% dos 810px do canvas)
//   transformScale = 729 / 883 ≈ 0.825
//
// getCardCSSWidth → usado por html2canvas e export.js (vidInCard)
// calcCardLayout  → usado por composeOnFormatCanvas (PNG + vídeo)
// Mesma base → preview e export matematicamente idênticos → WYSIWYG ✓
// ══════════════════════════════════════════════════════════════════════

// Largura física CSS do #tweet-card.
// BASE ÚNICA: sempre fmt.width (ou CARD_BASE_WIDTH para "original").
window.getCardCSSWidth = () => {
  const widthEl  = document.getElementById('content-width');
  const widthPct = widthEl ? parseInt(widthEl.value, 10) : 100;
  const fmt      = window.getSelectedFormat();
  const baseW    = (fmt && fmt.width) ? fmt.width : CARD_BASE_WIDTH;
  return Math.max(1, Math.round(baseW * (widthPct / 100)));
};

// Posição e tamanho do card no canvas de exportação.
// drawW = fmtW × Scale% — fração visual do canvas.
// composeOnFormatCanvas escala o snapshot (capturado em cardCSSWidth)
// para drawW → idêntico ao que o preview mostra. WYSIWYG ✓
window.calcCardLayout = (fmtW, fmtH, cardAspect) => {
  const scaleEl  = document.getElementById('content-scale');
  const scalePct = scaleEl ? parseInt(scaleEl.value, 10) : 100;

  // Largura visual no canvas = porcentagem direta de fmtW
  const drawW = Math.round(fmtW * (scalePct / 100));
  const drawH = Math.round(drawW / cardAspect);

  // Centralização no canvas
  const drawX = Math.round((fmtW - drawW) / 2);
  const drawY = Math.round((fmtH - drawH) / 2);

  return { drawW, drawH, drawX, drawY };
};
