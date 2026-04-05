// ═══════════════════════════════════════════════════
// PREVIEW.JS — Preview WYSIWYG
//
// Matriz matemática unificada (mesma de formats.js):
//
//   baseW          = fmt.width  (ou CARD_BASE_WIDTH se original)
//   cardCSSWidth   = baseW × (Width%  / 100)  ← layout físico / text wrap
//   drawW          = baseW × (Scale%  / 100)  ← ocupação visual no canvas
//   transformScale = drawW / cardCSSWidth      ← zoom CSS de compensação
//                  = Scale% / Width%           (simplificado)
//
// Preview:
//   card.style.width     = cardCSSWidth + 'px'
//   wrap.style.transform = scale(transformScale)
//   vCanvas              = scale(viewScale)  ← só para caber na tela
//
// Export (calcCardLayout):
//   drawW = fmtW × Scale%
//   html2canvas captura cardCSSWidth, compose escala para drawW
//   → preview e export usam a MESMA matriz → WYSIWYG absoluto ✓
//
// Exemplo: Stories 810px, Width=109%, Scale=90%
//   cardCSSWidth   = 810 × 1.09 = 883px
//   drawW          = 810 × 0.90 = 729px
//   transformScale = 729 / 883  = 0.825
// ═══════════════════════════════════════════════════
(function () {
  'use strict';

  var LS_SCALE = 'cardx_scale_pct';
  var LS_WIDTH = 'cardx_width_pct';

  var AUTO_FIT_MAP = {
    original:     { scale: 100, width: 100 },
    ig_square:    { scale: 85,  width: 95  },
    ig_portrait:  { scale: 85,  width: 95  },
    ig_landscape: { scale: 80,  width: 85  },
    ig_reels:     { scale: 90,  width: 109 },
    ig_stories:   { scale: 90,  width: 109 },
    fb_post:      { scale: 80,  width: 85  },
    fb_square:    { scale: 85,  width: 95  },
    fb_reels:     { scale: 90,  width: 109 },
    fb_stories:   { scale: 90,  width: 109 },
    yt_video:     { scale: 70,  width: 75  },
    yt_fullhd:    { scale: 60,  width: 65  },
    yt_shorts:    { scale: 90,  width: 109 },
    tw_post:      { scale: 75,  width: 80  },
    tw_square:    { scale: 85,  width: 95  },
    tiktok:       { scale: 90,  width: 109 },
    tiktok_photo: { scale: 90,  width: 109 },
  };

  var wrap       = document.getElementById('card-scale-wrap');
  var card       = document.getElementById('tweet-card');
  var scaleEl    = document.getElementById('content-scale');
  var widthEl    = document.getElementById('content-width');
  var valScaleEl = document.getElementById('val-scale');
  var valWidthEl = document.getElementById('val-width');
  var wrapper    = document.getElementById('canvas-preview-wrapper');
  var vCanvas    = document.getElementById('virtual-canvas');

  function syncFill(input) {
    var min = parseFloat(input.min);
    var max = parseFloat(input.max);
    var pct = ((parseFloat(input.value) - min) / (max - min)) * 100;
    input.style.setProperty('--fill', pct.toFixed(2) + '%');
  }

  function getViewScale(fmtW, fmtH) {
    var parentW = wrapper.parentElement ? wrapper.parentElement.clientWidth - 40 : 400;
    var maxW = Math.min(parentW, 600);
    var maxH = window.innerHeight * 0.65;
    return Math.min(maxW / fmtW, maxH / fmtH);
  }

  // ── refreshCardTransform — núcleo do WYSIWYG ──────────────────────
  // Implementa a matriz unificada. Deve ser matematicamente idêntica
  // a getCardCSSWidth() + calcCardLayout() em formats.js.
  function refreshCardTransform() {
    var fmtSel = document.getElementById('s-export-format');
    var fmtKey = fmtSel ? fmtSel.value : 'original';
    var fmt    = FORMATS[fmtKey];

    var scalePct = parseInt(scaleEl.value, 10);
    var widthPct = parseInt(widthEl.value, 10);

    // BASE ÚNICA — idêntica à usada em getCardCSSWidth() e calcCardLayout()
    var baseW = (fmt && fmt.width) ? fmt.width : CARD_BASE_WIDTH;

    // [1] Largura física CSS → controla text wrap
    var cardCSSWidth = Math.max(1, Math.round(baseW * (widthPct / 100)));
    card.style.width = cardCSSWidth + 'px';

    // [2] Largura visual desejada no canvas (= Scale% de baseW)
    var drawW = baseW * (scalePct / 100);

    // [3] Zoom de compensação: transforma cardCSSWidth em drawW visualmente
    //     transformScale = drawW / cardCSSWidth = Scale% / Width%
    //     Não altera text wrap — apenas o tamanho visual percebido.
    var transformScale = drawW / cardCSSWidth;
    wrap.style.transform = 'scale(' + transformScale + ')';
  }

  window.updateScale = function () {
    var scalePct = parseInt(scaleEl.value, 10);
    valScaleEl.textContent = scalePct + '%';
    syncFill(scaleEl);
    localStorage.setItem(LS_SCALE, scalePct);
    refreshCardTransform();
  };

  window.updateWidth = function () {
    var widthPct = parseInt(widthEl.value, 10);
    valWidthEl.textContent = widthPct;
    syncFill(widthEl);
    localStorage.setItem(LS_WIDTH, widthPct);
    refreshCardTransform();
  };

  window.applyAutoFit = function (formatKey) {
    if (!formatKey) {
      var sel = document.getElementById('s-export-format');
      formatKey = sel ? sel.value : 'original';
    }
    var preset = AUTO_FIT_MAP[formatKey] || AUTO_FIT_MAP.original;
    scaleEl.value = preset.scale;
    widthEl.value = Math.min(Math.max(preset.width, parseInt(widthEl.min)), parseInt(widthEl.max));
    window.updateScale();
    window.updateWidth();
  };

  window.updatePreviewCanvas = function () {
    if (!wrapper || !vCanvas) return;

    var fmtSel = document.getElementById('s-export-format');
    var fmtKey = fmtSel ? fmtSel.value : 'original';
    var fmt    = FORMATS[fmtKey];

    if (fmt && fmt.width && fmt.height) {
      var viewScale = getViewScale(fmt.width, fmt.height);

      vCanvas.style.width  = fmt.width + 'px';
      vCanvas.style.height = fmt.height + 'px';

      // flex + center+center → #card-scale-wrap centralizado no canvas.
      // transform-origin:center center no CSS do #card-scale-wrap garante
      // que transformScale encolhe/amplia a partir do centro do canvas.
      vCanvas.style.display        = 'flex';
      vCanvas.style.justifyContent = 'center';
      vCanvas.style.alignItems     = 'center';

      vCanvas.style.overflow        = 'hidden';
      vCanvas.style.position        = 'relative';
      vCanvas.style.transformOrigin = 'top center';
      vCanvas.style.borderRadius    = '12px';
      vCanvas.style.boxShadow       = '0 10px 40px rgba(0,0,0,0.3)';
      vCanvas.style.transform       = 'scale(' + viewScale + ')';

      wrapper.style.height = (fmt.height * viewScale) + 40 + 'px';
    } else {
      vCanvas.style.width     = '100%';
      vCanvas.style.height    = 'auto';
      vCanvas.style.transform = 'none';
      vCanvas.style.display   = 'block';
      vCanvas.style.overflow  = 'visible';
      vCanvas.style.boxShadow = 'none';
      wrapper.style.height    = 'auto';
    }

    var bgSel   = document.getElementById('s-bg-style');
    var bgStyle = bgSel ? bgSel.value : 'dark';
    var bgMap = {
      dark:            '#0a0a0a',
      light:           '#f3f4f6',
      blue:            '#1d9bf0',
      'gradient-dark': 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      'gradient-blue': 'linear-gradient(135deg, #1d9bf0, #0a4d7a)',
      blur:            '#111',
    };
    vCanvas.style.background = bgMap[bgStyle] || '#0a0a0a';

    refreshCardTransform();
  };

  // ── Patch getCardCanvas ────────────────────────────────────────────
  // Reseta transforms antes do html2canvas para captura limpa em 1:1.
  // Mantém card.style.width = getCardCSSWidth() (layout de texto real).
  // No finally: restaura preview com rAF para evitar flash de transição.
  var _origGetCardCanvas = window.getCardCanvas;
  window.getCardCanvas = async function () {
    var savedVTransform    = vCanvas ? vCanvas.style.transform  : '';
    var savedVTransition   = vCanvas ? vCanvas.style.transition : '';
    var savedWrapTransform = wrap.style.transform;
    var savedWrapTransition= wrap.style.transition;

    if (vCanvas) {
      vCanvas.style.transition = 'none';
      vCanvas.style.transform  = 'scale(1)';
    }
    wrap.style.transition = 'none';
    wrap.style.transform  = 'scale(1)';

    // Largura física real para o html2canvas (sem zoom visual)
    card.style.width = getCardCSSWidth() + 'px';

    // Força reflow síncrono
    void wrap.offsetHeight;

    try {
      return await _origGetCardCanvas();
    } finally {
      if (vCanvas) {
        vCanvas.style.transform = savedVTransform;
        requestAnimationFrame(function () {
          if (vCanvas) vCanvas.style.transition = savedVTransition;
        });
      }
      wrap.style.transform = savedWrapTransform;
      requestAnimationFrame(function () {
        wrap.style.transition = savedWrapTransition;
      });
      refreshCardTransform();
    }
  };

  var formatSel = document.getElementById('s-export-format');
  if (formatSel) {
    formatSel.addEventListener('change', function () {
      applyAutoFit(this.value);
      updatePreviewCanvas();
    });
  }

  var bgSel = document.getElementById('s-bg-style');
  if (bgSel) bgSel.addEventListener('change', updatePreviewCanvas);

  window.addEventListener('resize', updatePreviewCanvas);

  function init() {
    wrap.style.transition = 'none';
    var savedScale = parseInt(localStorage.getItem(LS_SCALE), 10);
    var savedWidth = parseInt(localStorage.getItem(LS_WIDTH), 10);
    if (!isNaN(savedScale) && savedScale >= 0 && savedScale <= 200) scaleEl.value = savedScale;
    if (!isNaN(savedWidth) && savedWidth >= 0 && savedWidth <= 300) widthEl.value = savedWidth;
    window.updateScale();
    window.updateWidth();
    setTimeout(updatePreviewCanvas, 200);
    requestAnimationFrame(function () { wrap.style.transition = ''; });
  }

  init();
})();
