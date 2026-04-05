// ═══════════════════════════════════════════════════
// APP.JS — Fetch de tweets, renderização do card,
// mídia e inicialização
// ═══════════════════════════════════════════════════

// ── Parse URL ───────────────────────────────────
window.parseTweetUrl = raw => {
  const s = raw.trim();
  try {
    const url = new URL(s.match(/^https?:\/\//) ? s : 'https://' + s);
    const m   = url.pathname.match(/\/([^/?#]+)\/status\/(\d+)/);
    if (m) return { username: m[1], id: m[2] };
  } catch {}
  const m2 = s.match(/(?:twitter\.com|x\.com)\/([^/?#]+)\/status\/(\d+)/);
  if (m2) return { username: m2[1], id: m2[2] };
  return null;
};

// ── Fontes de dados ─────────────────────────────
async function tryFxTwitter(parsed, signal) {
  const res  = await fetchTimeout(API.fxtwitter(parsed.username, parsed.id), { signal });
  if (!res.ok) throw new Error('fxtwitter HTTP ' + res.status);
  const json = await res.json();
  if (!json.tweet) throw new Error(json.message || 'not found');
  const t = json.tweet;
  return {
    name: t.author.name, screen_name: t.author.screen_name,
    avatar: t.author.avatar_url || '',
    verified: !!(t.author.blue_verified || t.author.verified),
    text: t.text || '', created_at: t.created_at,
    likes: t.likes || 0, retweets: t.retweets || 0, views: t.views || null,
    photos: (t.media && t.media.photos) || [],
    videos: (t.media && t.media.videos) || [],
  };
}

async function trySyndication(parsed, signal) {
  const res = await fetchTimeout(API.syndication(parsed.id), { signal });
  if (!res.ok) throw new Error('syndication HTTP ' + res.status);
  const t = await res.json();
  if (!t || !t.user) throw new Error('resposta incompleta');

  const photos = [], videos = [];
  (t.mediaDetails || []).forEach(m => {
    if (m.type === 'photo') {
      photos.push({ url: m.media_url_https });
    } else if (m.type === 'video' || m.type === 'animated_gif') {
      const variants = (m.video_info && m.video_info.variants) || [];
      const mp4s = variants.filter(v => v.content_type === 'video/mp4')
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      if (mp4s[0]) videos.push({ url: mp4s[0].url });
    }
  });

  return {
    name: t.user.name, screen_name: t.user.screen_name,
    avatar: (t.user.profile_image_url_https || '').replace('_normal', '_400x400'),
    verified: !!(t.user.is_blue_verified || t.user.verified),
    text: t.text || t.full_text || '', created_at: t.created_at,
    likes: t.favorite_count || 0, retweets: t.retweet_count || 0, views: null,
    photos, videos,
  };
}

// ── Fetch principal ─────────────────────────────
window.fetchTweet = async () => {
  const raw = document.getElementById('inp-url').value.trim();
  if (!raw) return showError('Cole uma URL de tweet primeiro.');

  const parsed = parseTweetUrl(raw);
  if (!parsed) return showError('URL inválida. Use: x.com/usuario/status/ID');

  if (fetchController) fetchController.abort();
  fetchController = new AbortController();
  const { signal } = fetchController;

  hideError();
  showSkeleton();
  setFetchLoading(true);

  let data   = null;
  const errs = [];

  try { data = await tryFxTwitter(parsed, signal); }
  catch (e) { if (e.name !== 'AbortError') errs.push('fxtwitter: ' + e.message); }

  if (!data && !signal.aborted) {
    try { data = await trySyndication(parsed, signal); }
    catch (e) { if (e.name !== 'AbortError') errs.push('syndication: ' + e.message); }
  }

  setFetchLoading(false);
  if (signal.aborted) return;

  if (!data) {
    hideSkeleton();
    showError('Não foi possível carregar o tweet. Verifique se é público.\n(' + errs.join(' | ') + ')');
    return;
  }

  tweetData = data;
  applyData(data);
};

function applyData(d) {
  set('s-name',   d.name || '');
  set('s-handle', '@' + (d.screen_name || ''));
  set('s-avatar', d.avatar || '');
  document.getElementById('s-verified').checked = !!d.verified;
  set('s-text', d.text || '');

  const date = d.created_at ? new Date(d.created_at) : new Date();
  set('s-time',  formatDate(date));
  set('s-likes', fmtNum(d.likes));
  set('s-rt',    fmtNum(d.retweets));
  set('s-views', d.views ? fmtNum(d.views) : '');

  renderCard();
  hideSkeleton();
  document.getElementById('tweet-card').style.display = 'block';
  document.getElementById('bottom-hint').style.display = 'block';
  setStatus('Tweet carregado!', 'var(--green)');
  setTimeout(() => setStatus(''), 2500);
}

// ── Render Card ─────────────────────────────────
window.renderCard = () => {
  const dark     = document.getElementById('s-dark').checked;
  const name     = get('s-name')   || 'Usuário';
  const handle   = get('s-handle') || '@usuario';
  const verified = document.getElementById('s-verified').checked;
  const text     = get('s-text');
  const avatarUrl = get('s-avatar').trim();
  const time     = get('s-time');
  const likes    = get('s-likes');
  const rt       = get('s-rt');
  const views    = get('s-views');

  const card = document.getElementById('tweet-card');
  card.classList.toggle('dark', dark);

  // Avatar
  const av = document.getElementById('c-avatar');
  av.style.background = avatarColor;
  if (avatarUrl) {
    av.innerHTML = `<img src="${esc(avatarUrl)}" alt="" onerror="this.remove()" />`;
  } else {
    av.textContent = name.charAt(0).toUpperCase();
  }

  // Nome + badge
  const badge = `<svg width="17" height="17" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.9-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C3.13 9.33 2.25 10.57 2.25 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.66 1.31 1.9 2.19 3.34 2.19s2.67-.88 3.33-2.19c1.4.46 2.91.2 3.92-.81s1.26-2.52.8-3.91C21.38 14.67 22.25 13.43 22.25 12zm-9.25 4.5L8.5 12l1.41-1.41 3.09 3.09 5.59-5.59L20 9.5l-7 7z"/></svg>`;
  document.getElementById('c-name').innerHTML   = esc(name) + (verified ? ' ' + badge : '');
  document.getElementById('c-handle').textContent = handle.startsWith('@') ? handle : '@' + handle;
  document.getElementById('c-text').innerHTML = renderText(text);
  document.getElementById('c-time').textContent = time;

  // Stats
  document.getElementById('c-stats').innerHTML = [
    rt    ? `<span>🔁 <b>${esc(rt)}</b> Retweets</span>`  : '',
    likes ? `<span>❤️ <b>${esc(likes)}</b> Curtidas</span>` : '',
    views ? `<span>📊 ${esc(views)} Views</span>`          : '',
  ].filter(Boolean).join('');

  // Mídia (não re-renderiza se estiver gravando)
  const recording = mediaRecorder && mediaRecorder.state === 'recording';
  if (tweetData && !recording) renderMedia();
};

// ── Render Mídia ────────────────────────────────
window.renderMedia = () => {
  const t = tweetData;
  const wrap = document.getElementById('c-media');
  wrap.innerHTML = '';
  wrap.style.display = 'none';
  wrap.className = 'tw-media-wrap';
  videoEl   = null;
  mediaType = null;

  const videos = t.videos || [];
  const photos = t.photos || [];

  if (videos.length > 0) {
    mediaType = 'video';
    const vid = document.createElement('video');
    vid.src         = API.mediaProxy(videos[0].url);
    vid.controls    = true;
    vid.playsInline = true;

    // ✅ CORREÇÃO: sem max-height fixo. O CSS do .tw-media-wrap video
    //    já define height:auto + max-height:none, permitindo que o vídeo
    //    escale proporcionalmente com o slider de Content Width.
    vid.style.cssText = 'width:100%;display:block;height:auto;object-fit:contain;background:#000';

    wrap.appendChild(vid);
    wrap.style.display = 'block';
    videoEl = vid;

    el('btn-vid').style.display = 'flex';
    el('btn-vid').disabled      = false;
    el('btn-png').disabled      = false;
    el('btn-copy').disabled     = false;
    const fmtWrap = el('vid-format-wrap');
    if (fmtWrap) fmtWrap.style.display = 'block';

  } else if (photos.length > 0) {
    mediaType = 'image';
    if (photos.length === 1) {
      const img = document.createElement('img');
      img.src = API.mediaProxy(photos[0].url);
      img.alt = '';
      // ✅ Sem inline styles que conflitem com o CSS corrigido
      wrap.appendChild(img);
      wrap.style.display = 'block';
    } else {
      const count = Math.min(photos.length, 4);
      wrap.className = `tw-media-wrap grid-${count}`;
      photos.slice(0, count).forEach(p => {
        const div = document.createElement('div');
        div.className = 'photo-item';
        const img = document.createElement('img');
        img.src = API.mediaProxy(p.url);
        img.alt = '';
        div.appendChild(img);
        wrap.appendChild(div);
      });
    }
    el('btn-vid').style.display = 'none';
    el('btn-png').disabled      = false;
    el('btn-copy').disabled     = false;
    const fmtWrap = el('vid-format-wrap');
    if (fmtWrap) fmtWrap.style.display = 'none';
  } else {
    el('btn-vid').style.display = 'none';
    el('btn-png').disabled      = false;
    el('btn-copy').disabled     = false;
    const fmtWrap = el('vid-format-wrap');
    if (fmtWrap) fmtWrap.style.display = 'none';
  }
};

// ── Avatar color ────────────────────────────────
window.setAvatarColor = elSwatch => {
  avatarColor = elSwatch.dataset.c;
  document.querySelectorAll('.cswatch').forEach(s => s.classList.remove('active'));
  elSwatch.classList.add('active');
  renderCard();
};

// ── Init ────────────────────────────────────────
populateFormatSelect();
