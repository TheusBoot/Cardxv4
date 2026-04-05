// ═══════════════════════════════════════════════════
// EXPORT.JS — Exportação de PNG e gravação de vídeo
// ═══════════════════════════════════════════════════

// ── PNG: renderiza card como canvas ─────────────
window.getCardCanvas = async () => {
  const dark    = document.getElementById('s-dark').checked;
  const fmt     = getSelectedFormat();
  const bgStyle = (el('s-bg-style') && el('s-bg-style').value) || 'dark';
  const cardBg  = dark ? '#15202b' : '#ffffff';

  setStatus('Renderizando card…', '#aaa');

  if (isNativeMode()) {
    setStatus(`Compondo nativo ${fmt.width}×${fmt.height}…`, '#aaa');
    return composeNativeStill(fmt);
  }

  const swaps = await preloadImagesAsBlobURLs();
  let cardCanvas;
  try {
    const cardCSSWidth = getCardCSSWidth();
    const renderScale = cardCSSWidth < 400 ? 3 : 2;
    cardCanvas = await html2canvas(document.getElementById('tweet-card'), {
      scale: renderScale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: cardBg,
      logging: false,
    });
  } finally {
    restoreImages(swaps);
  }

  if (!fmt.width) return cardCanvas;

  setStatus(`Compondo ${fmt.width}×${fmt.height}…`, '#aaa');
  return composeOnFormatCanvas(cardCanvas, fmt, bgStyle);
};

// ── Download PNG ────────────────────────────────
window.downloadPNG = async () => {
  el('btn-png').disabled = true;
  try {
    const fmt = getSelectedFormat();
    const c   = await getCardCanvas();
    const suffix = fmt.width ? `_${fmt.width}x${fmt.height}` : '';
    const a = document.createElement('a');
    a.download = `tweet_card${suffix}.png`;
    a.href     = c.toDataURL('image/png');
    a.click();
    setStatus(`PNG salvo · ${c.width}×${c.height}`, 'var(--green)');
  } catch (e) {
    setStatus('Erro ao gerar PNG: ' + e.message, 'var(--red)');
    console.error(e);
  } finally {
    el('btn-png').disabled = false;
    setTimeout(() => setStatus(''), 3000);
  }
};

// ── Copiar PNG ──────────────────────────────────
window.copyPNG = async () => {
  el('btn-copy').disabled = true;
  try {
    const c    = await getCardCanvas();
    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    setStatus('Copiado!', 'var(--green)');
  } catch (e) {
    setStatus('Erro ao copiar — tente o download', 'var(--red)');
    console.error(e);
  } finally {
    el('btn-copy').disabled = false;
    setTimeout(() => setStatus(''), 3000);
  }
};

// ── Codec do vídeo ──────────────────────────────
function getMimeType(format) {
  const map = {
    webm: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
    mp4:  ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'],
  };
  const candidates = map[format] || map.webm;
  return candidates.find(t => {
    try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
  }) || '';
}

// ── Gravação de vídeo ───────────────────────────
window.startRecordVideo = async () => {
  if (!videoEl) return;

  if (!IS_LOCAL_SERVER) {
    showError('A gravação de vídeo requer o servidor local. Execute: node server.js');
    return;
  }

  const format   = (el('s-vid-format') && el('s-vid-format').value) || 'webm';
  const mimeType = getMimeType(format);
  if (!mimeType) {
    showError('Seu navegador não suporta gravação. Use Chrome ou Firefox.');
    return;
  }

  el('btn-vid').disabled       = true;
  el('btn-stop').style.display = 'flex';
  el('btn-stop').disabled      = false;
  setStatus('Preparando gravação…', '#aaa');

  // Aguardar vídeo carregar
  if (videoEl.readyState < 2) {
    setStatus('Aguardando vídeo carregar…', '#aaa');
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Timeout ao carregar vídeo')), 15000);
      videoEl.addEventListener('canplay', () => { clearTimeout(t); resolve(); }, { once: true });
      videoEl.addEventListener('error',   () => { clearTimeout(t); reject(new Error('Erro no vídeo')); }, { once: true });
    }).catch(e => {
      el('btn-vid').disabled       = false;
      el('btn-stop').style.display = 'none';
      showError('Não foi possível carregar o vídeo: ' + e.message);
      throw e;
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // ── TRANSFORM RESET ──────────────────────────────────────────────────
  //
  // PROBLEMA: getBoundingClientRect() e html2canvas() são contaminados
  // pelos transform:scale() do preview da UI em dois elementos pai:
  //   • #virtual-canvas  → viewScale (ex: scale(0.28) para Stories 9:16)
  //   • #card-scale-wrap → Content Scale do usuário (ex: scale(2.0))
  //
  // Com os transforms ativos, o browser reporta coordenadas do mundo
  // visual (pós-zoom), não do mundo CSS (layout real). Isso causa:
  //   • cardRect com dimensões erradas → vidInCard com offsets massivos
  //   • html2canvas captura o card deslocado/cortado
  //   • O vídeo aparece no canto superior do MP4 em vez de centralizado
  //
  // SOLUÇÃO: salvar, resetar para scale(1), medir e capturar, restaurar.
  // Mesmo padrão aplicado no patch de getCardCanvas() em preview.js.
  // ─────────────────────────────────────────────────────────────────────

  const card      = document.getElementById('tweet-card');
  const vCanvas   = document.getElementById('virtual-canvas');
  const scaleWrap = document.getElementById('card-scale-wrap');

  // [1] Salvar transforms e transitions originais dos dois elementos pai
  const saved = {
    vCanvasTransform:    vCanvas   ? vCanvas.style.transform    : '',
    vCanvasTransition:   vCanvas   ? vCanvas.style.transition   : '',
    scaleWrapTransform:  scaleWrap ? scaleWrap.style.transform  : '',
    scaleWrapTransition: scaleWrap ? scaleWrap.style.transition : '',
  };

  // [2] Resetar transforms para 1:1 e desligar transições CSS
  //     (transições animariam o reset, atrasando o reflow)
  if (vCanvas) {
    vCanvas.style.transition = 'none';
    vCanvas.style.transform  = 'scale(1)';
  }
  if (scaleWrap) {
    scaleWrap.style.transition = 'none';
    scaleWrap.style.transform  = 'scale(1)';
  }

  // [3] Forçar reflow síncrono — o browser recalcula layout sem zoom
  //     antes de qualquer getBoundingClientRect() ou html2canvas()
  void card.offsetHeight;

  // Todos os blocos de medição + html2canvas ficam dentro deste try/finally
  // para garantir restauração mesmo em caso de erro ou abort
  let cardRect;
  let cardSnapshot;
  let vidRect;
  const cardScale = 2;

  try {
    // ── [4a] Medir cardRect com transforms zerados ──────────────────────
    // Agora getBoundingClientRect() retorna coordenadas CSS reais (1:1),
    // sem distorção dos zooms do preview.
    setStatus('Capturando fundo do card…', '#aaa');
    const fmt     = getSelectedFormat();
    const bgStyle = (el('s-bg-style') && el('s-bg-style').value) || 'dark';

    cardRect = card.getBoundingClientRect();

    // ── [4b] html2canvas com transforms zerados ─────────────────────────
    // html2canvas tem um bug conhecido com ancestors escalonados:
    // ele lê offsetParent/offsetLeft que são afetados pelo scale,
    // gerando um canvas deslocado. Com scale(1) o offset é 0,0 correto.
    videoEl.style.visibility = 'hidden';
    const imgSwaps = await preloadImagesAsBlobURLs();
    try {
      const dark = document.getElementById('s-dark').checked;
      cardSnapshot = await html2canvas(card, {
        scale: cardScale, useCORS: true, allowTaint: false,
        backgroundColor: dark ? '#15202b' : '#ffffff', logging: false,
      });
    } catch (e) {
      console.warn('html2canvas snapshot error:', e);
    } finally {
      restoreImages(imgSwaps);
      videoEl.style.visibility = 'visible';
    }

    // ── [4c] Medir vidRect com transforms zerados ───────────────────────
    // vidRect precisa ser medido DEPOIS do html2canvas (para manter o
    // mesmo estado do DOM) mas AINDA dentro do bloco de reset.
    // Se medido fora, os transforms do preview já foram restaurados e
    // as coordenadas voltam a ser do espaço visual (com zoom), quebrando
    // o cálculo de vidInCard.
    vidRect = videoEl.getBoundingClientRect();

    // A partir daqui as variáveis cardRect, cardSnapshot e vidRect
    // estão todas em espaço de coordenadas CSS 1:1. ✓

    let W, H, bgCanvas;
    if (fmt.width) {
      const composed = composeOnFormatCanvas(cardSnapshot, fmt, bgStyle);
      W = composed.width;
      H = composed.height;
      bgCanvas = composed;
    } else {
      W = cardSnapshot ? cardSnapshot.width  : Math.round(cardRect.width  * cardScale);
      H = cardSnapshot ? cardSnapshot.height : Math.round(cardRect.height * cardScale);
      bgCanvas = cardSnapshot;
    }

    // Canvas de gravação
    const recCanvas  = document.createElement('canvas');
    recCanvas.width  = W;
    recCanvas.height = H;
    const ctx = recCanvas.getContext('2d');

    // Testar taint
    try {
      if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, W, H);
      videoEl.currentTime = 0;
      await new Promise(r => { videoEl.onseeked = r; setTimeout(r, 500); });
      ctx.drawImage(videoEl, 0, 0, 1, 1);
      ctx.getImageData(0, 0, 1, 1);
      ctx.clearRect(0, 0, W, H);
    } catch (e) {
      el('btn-vid').disabled       = false;
      el('btn-stop').style.display = 'none';
      showError('CORS: não foi possível gravar o vídeo. Acesse via http://localhost:3000');
      return;
    }

    // ── Posição do vídeo no canvas de saída ─────────────────────────────
    // vidRect e cardRect agora estão em 1:1 → vidInCard é preciso.
    let relX, relY, relW, relH, radius;

    if (fmt.width) {
      const cardAspect = cardSnapshot
        ? cardSnapshot.width / cardSnapshot.height
        : cardRect.width / cardRect.height;
      const { drawW: cW, drawH: cH, drawX: cX, drawY: cY } = calcCardLayout(W, H, cardAspect);

      const scaleX = cW / (cardRect.width  * cardScale);
      const scaleY = cH / (cardRect.height * cardScale);

      const vidInCard = {
        left:   (vidRect.left  - cardRect.left)  * cardScale,
        top:    (vidRect.top   - cardRect.top)   * cardScale,
        width:  vidRect.width  * cardScale,
        height: vidRect.height * cardScale,
      };

      relX   = cX + vidInCard.left   * scaleX;
      relY   = cY + vidInCard.top    * scaleY;
      relW   = vidInCard.width  * scaleX;
      relH   = vidInCard.height * scaleY;
      radius = 18 * (cW / CARD_BASE_WIDTH);
    } else {
      relX   = (vidRect.left - cardRect.left) * cardScale;
      relY   = (vidRect.top  - cardRect.top)  * cardScale;
      relW   = vidRect.width  * cardScale;
      relH   = vidRect.height * cardScale;
      radius = 14 * cardScale;
    }

    // Duração
    const rawDur   = videoEl.duration;
    const duration = (!rawDur || !isFinite(rawDur)) ? 60 : rawDur;

    // Stream de gravação
    recChunks = [];
    const canvasStream = recCanvas.captureStream(30);
    let audioTracks = [];
    try {
      const vidStream = (videoEl.captureStream || videoEl.mozCaptureStream)
        ? (videoEl.captureStream || videoEl.mozCaptureStream).call(videoEl)
        : null;
      if (vidStream) {
        audioTracks = vidStream.getAudioTracks();
        audioTracks.forEach(t => canvasStream.addTrack(t));
      }
    } catch (e) {
      console.warn('[rec] não foi possível capturar áudio:', e.message);
    }

    const fmtBitrate = getSelectedFormat().videoBitrate || 4_000_000;
    mediaRecorder = new MediaRecorder(canvasStream, {
      mimeType, videoBitsPerSecond: fmtBitrate, audioBitsPerSecond: 192_000,
    });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      audioTracks.forEach(t => { try { canvasStream.removeTrack(t); } catch {} });
      saveRecording(mimeType);
    };

    const barFill = el('rec-bar-fill');
    const recInfo = el('rec-info');
    el('rec-bar-wrap').style.display = 'flex';
    barFill.style.width = '0%';

    mediaRecorder.start(200);
    videoEl.currentTime = 0;
    await videoEl.play().catch(() => {});

    const startTime = performance.now();
    let drawnFrames = 0;
    const nativeRec = isNativeMode();

    function drawFrame() {
      if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
      ctx.clearRect(0, 0, W, H);

      if (nativeRec) {
        if (videoEl.readyState >= 2 && !videoEl.paused && !videoEl.ended) {
          const va = videoEl.videoWidth / videoEl.videoHeight;
          const ca = W / H;
          let sx = 0, sy = 0, sw = videoEl.videoWidth, sh = videoEl.videoHeight;
          if (va > ca) { sw = Math.round(sh * ca); sx = Math.round((videoEl.videoWidth - sw) / 2); }
          else         { sh = Math.round(sw / ca); sy = Math.round((videoEl.videoHeight - sh) / 2); }
          ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, W, H);
          drawnFrames++;
        } else {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, W, H);
        }
        drawNativeOverlay(ctx, W, H);
      } else {
        if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, W, H);
        if (videoEl.readyState >= 2 && !videoEl.paused && !videoEl.ended) {
          ctx.save();
          pathRoundRect(ctx, relX, relY, relW, relH, radius);
          ctx.clip();
          ctx.drawImage(videoEl, relX, relY, relW, relH);
          ctx.restore();
          drawnFrames++;
        }
      }

      const elapsed = (performance.now() - startTime) / 1000;
      barFill.style.width = Math.min((elapsed / duration) * 100, 100) + '%';
      recInfo.textContent = `${nativeRec ? '📱 Nativo' : '🖼 Card'} · ${elapsed.toFixed(1)}s / ${duration.toFixed(1)}s · ${drawnFrames} frames`;
      requestAnimationFrame(drawFrame);
    }

    drawFrame();
    videoEl.onended = () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') stopRecording();
    };
    setStatus('● Gravando…', '#f4212e');

  } finally {
    // ── [5] Restaurar transforms e transitions do preview ───────────────
    // Executado SEMPRE — com sucesso, erro ou return antecipado.
    // O usuário retorna ao estado de preview exato que tinha antes de
    // clicar em gravar, sem nenhuma quebra visual na UI.
    if (vCanvas) {
      vCanvas.style.transform  = saved.vCanvasTransform;
      // Reativa transição no próximo frame para não animar o restore
      requestAnimationFrame(() => {
        if (vCanvas) vCanvas.style.transition = saved.vCanvasTransition;
      });
    }
    if (scaleWrap) {
      scaleWrap.style.transform  = saved.scaleWrapTransform;
      requestAnimationFrame(() => {
        if (scaleWrap) scaleWrap.style.transition = saved.scaleWrapTransition;
      });
    }
  }
};

window.stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    if (videoEl) videoEl.pause();
  }
  el('btn-stop').style.display     = 'none';
  el('btn-vid').disabled           = false;
  el('rec-bar-wrap').style.display = 'none';
  setStatus('Processando…', '#aaa');
};

function saveRecording(mimeType) {
  const ext  = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob(recChunks, { type: mimeType });
  const sizeMB = (blob.size / 1024 / 1024).toFixed(1);

  if (blob.size < 1000) {
    setStatus(`Arquivo vazio (${blob.size}B) — tente novamente`, 'var(--red)');
    return;
  }

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `tweet_card.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus(`✓ ${ext.toUpperCase()} salvo · ${sizeMB} MB`, 'var(--green)');
  setTimeout(() => setStatus(''), 4000);
}
