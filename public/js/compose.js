// ═══════════════════════════════════════════════════
// COMPOSE.JS — Composição no canvas de export:
// fundos, posicionamento do card, modo nativo
// ═══════════════════════════════════════════════════

// ── Clip com cantos arredondados ────────────────
window.clipRoundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

// Alias para gravação de vídeo (sem clip automático)
window.pathRoundRect = clipRoundRect;

// ── Desenho de fundo ────────────────────────────
window.drawBackground = (ctx, W, H, bgStyle, cardCanvas) => {
  ctx.save();
  const fills = {
    dark:  '#0a0a0a',
    light: '#f3f4f6',
    blue:  '#1d9bf0',
  };

  if (fills[bgStyle]) {
    ctx.fillStyle = fills[bgStyle];
    ctx.fillRect(0, 0, W, H);

  } else if (bgStyle === 'gradient-dark') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0f0c29');
    g.addColorStop(0.5, '#302b63');
    g.addColorStop(1, '#24243e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

  } else if (bgStyle === 'gradient-blue') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1d9bf0');
    g.addColorStop(1, '#0a4d7a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

  } else if (bgStyle === 'blur' && cardCanvas) {
    const ca = cardCanvas.width / cardCanvas.height;
    const sa = W / H;
    let bW, bH;
    if (ca > sa) { bH = H * 1.1; bW = bH * ca; }
    else         { bW = W * 1.1; bH = bW / ca; }
    ctx.filter = 'blur(28px) brightness(0.35) saturate(1.4)';
    ctx.drawImage(cardCanvas, (W - bW) / 2, (H - bH) / 2, bW, bH);
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, H);

  } else {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
};

// ── Composição do card centralizado no canvas ───
// Usa calcCardLayout() para garantir WYSIWYG
window.composeOnFormatCanvas = (cardCanvas, fmt, bgStyle) => {
  const W = fmt.width;
  const H = fmt.height;
  const out = document.createElement('canvas');
  out.width  = W;
  out.height = H;
  const ctx  = out.getContext('2d');

  drawBackground(ctx, W, H, bgStyle, cardCanvas);

  const cardAspect = cardCanvas.width / cardCanvas.height;
  const { drawW, drawH, drawX, drawY } = calcCardLayout(W, H, cardAspect);

  // Sombra + clip arredondado
  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur    = Math.round(drawW * 0.05);
  ctx.shadowOffsetY = Math.round(drawW * 0.015);
  const r = Math.round(18 * (drawW / CARD_BASE_WIDTH));
  clipRoundRect(ctx, drawX, drawY, drawW, drawH, r);
  ctx.clip();
  ctx.shadowBlur = 0;
  ctx.drawImage(cardCanvas, drawX, drawY, drawW, drawH);
  ctx.restore();

  return out;
};

// ── Modo Nativo ─────────────────────────────────

window.isNativeMode = () => {
  const fmt  = getSelectedFormat();
  const mode = el('s-compose-mode') && el('s-compose-mode').value;
  return mode === 'native' && fmt.width && (fmt.height > fmt.width)
    && tweetData && tweetData.videos && tweetData.videos.length > 0;
};

window.drawNativeOverlay = (ctx, W, H) => {
  if (!tweetData) return;
  const scale = W / 375;
  const pad   = Math.round(W * 0.055);

  // Gradiente topo
  const gradTop = ctx.createLinearGradient(0, 0, 0, H * 0.35);
  gradTop.addColorStop(0, 'rgba(0,0,0,0.72)');
  gradTop.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradTop;
  ctx.fillRect(0, 0, W, H);

  // Gradiente base
  const gradBot = ctx.createLinearGradient(0, H * 0.55, 0, H);
  gradBot.addColorStop(0, 'rgba(0,0,0,0)');
  gradBot.addColorStop(1, 'rgba(0,0,0,0.80)');
  ctx.fillStyle = gradBot;
  ctx.fillRect(0, 0, W, H);

  // Avatar
  const avatarSize = Math.round(40 * scale);
  const topY = Math.round(H * 0.06);
  ctx.save();
  ctx.beginPath();
  ctx.arc(pad + avatarSize / 2, topY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#1d9bf0';
  ctx.fillRect(pad, topY, avatarSize, avatarSize);
  ctx.font = `700 ${Math.round(18 * scale)}px -apple-system, sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initName = (el('s-name') && el('s-name').value) || 'U';
  ctx.fillText(initName.charAt(0).toUpperCase(), pad + avatarSize / 2, topY + avatarSize / 2);
  ctx.restore();

  // Nome + handle
  const nameText   = (el('s-name')   && el('s-name').value)   || '';
  const handleText = (el('s-handle') && el('s-handle').value) || '';
  const timeText   = (el('s-time')   && el('s-time').value)   || '';
  const verified   = el('s-verified') && el('s-verified').checked;

  const textX = pad + avatarSize + Math.round(10 * scale);
  ctx.font = `700 ${Math.round(15 * scale)}px -apple-system, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(nameText + (verified ? ' ✓' : ''), textX, topY + Math.round(16 * scale));

  ctx.font = `400 ${Math.round(12 * scale)}px -apple-system, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`${handleText}  ·  ${timeText.split('·')[0].trim()}`, textX, topY + Math.round(32 * scale));

  // Texto do tweet (base)
  const tweetText = (el('s-text') && el('s-text').value) || '';
  if (tweetText) {
    const fontSize = Math.round(14 * scale);
    ctx.font = `400 ${fontSize}px -apple-system, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const maxLineW = W - pad * 2;
    const words = tweetText.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxLineW) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
      if (lines.length >= 3) break;
    }
    if (cur && lines.length < 3) lines.push(cur);

    const lineH  = Math.round(fontSize * 1.4);
    const statsH = Math.round(40 * scale);
    const textBaseY = H - Math.round(H * 0.07) - statsH - lines.length * lineH;
    lines.forEach((line, i) => ctx.fillText(line, pad, textBaseY + i * lineH));
  }

  // Stats
  const statsY = H - Math.round(H * 0.06);
  ctx.font = `400 ${Math.round(13 * scale)}px -apple-system, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'left';

  const likes = (el('s-likes') && el('s-likes').value) || '';
  const rt    = (el('s-rt')    && el('s-rt').value)    || '';
  const views = (el('s-views') && el('s-views').value) || '';
  let statX = pad;
  const gap = Math.round(28 * scale);
  if (rt)    { ctx.fillText('🔁 ' + rt,   statX, statsY); statX += ctx.measureText('🔁 ' + rt).width + gap; }
  if (likes) { ctx.fillText('❤️ ' + likes, statX, statsY); statX += ctx.measureText('❤️ ' + likes).width + gap; }
  if (views) { ctx.fillText('📊 ' + views, statX, statsY); }

  // Logo X
  ctx.font = `700 ${Math.round(18 * scale)}px serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.textAlign = 'right';
  ctx.fillText('𝕏', W - pad, topY + Math.round(18 * scale));
};

// Composição nativa para PNG
window.composeNativeStill = fmt => {
  const W = fmt.width, H = fmt.height;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  if (videoEl && videoEl.readyState >= 2) {
    const va = videoEl.videoWidth / videoEl.videoHeight;
    const ca = W / H;
    let sx = 0, sy = 0, sw = videoEl.videoWidth, sh = videoEl.videoHeight;
    if (va > ca) { sw = Math.round(sh * ca); sx = Math.round((videoEl.videoWidth - sw) / 2); }
    else         { sh = Math.round(sw / ca); sy = Math.round((videoEl.videoHeight - sh) / 2); }
    ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, W, H);
  }

  drawNativeOverlay(ctx, W, H);
  return out;
};
