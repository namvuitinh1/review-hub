// So sánh 2 phiên bản cạnh nhau.
// Mỗi bên có thanh tua riêng. Bấm "Khoá" thì hai bên chạy cùng nhau và GIỮ NGUYÊN độ lệch lúc khoá
// (vì đổi voice / dời hiệu ứng làm 2 bản dài ngắn khác nhau, không thể ép cùng một giây).
import { h, icon, fmtTime, videoFps, fmtMeta } from './ui.js';

export function mountCompare(host, o) {
  // o: { versions, a, b, getUrl(ver, onProg) -> Promise<url>, comments(verId) -> [], shapeSvg, FPS, onClose }
  const { versions, FPS } = o;
  let locked = false, offset = 0, hearB = true, raf = 0, dead = false;

  function side(key, idx) {
    const P = { key, idx, ver: versions[idx], sel: null };
    P.video = h('video', { class: 'cmp-video', playsinline: '', preload: 'auto' });
    P.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); P.svg.setAttribute('class', 'rv-ov');
    P.pins = h('div', { class: 'rv-pins' });
    P.label = h('div', { class: 'rv-label', hidden: true });
    P.loading = h('div', { class: 'rv-loading' }, 'Đang tải video…');
    P.stage = h('div', { class: 'cmp-stage' }, P.video, P.svg, P.pins, P.label);
    P.meta = h('div', { class: 'rv-meta' });
    P.box = h('div', { class: 'cmp-box' }, P.meta, P.stage, P.loading);
    P.select = h('select', { class: 'rv-speed', 'aria-label': 'Phiên bản bên ' + (key === 'a' ? 'trái' : 'phải'), onchange: () => setVer(P, Number(P.select.value)) },
      versions.map((v, i) => h('option', { value: String(i), selected: i === idx }, `v${i + 1}` + (i === versions.length - 1 ? ' · mới' : ''))));
    P.prog = h('div', { class: 'rv-tl-prog' }); P.head = h('div', { class: 'rv-tl-head' }); P.marks = h('div', { class: 'rv-tl-marks' });
    P.tl = h('div', { class: 'rv-tl', role: 'slider', tabindex: '0', 'aria-label': 'Thanh tua bên ' + (key === 'a' ? 'trái' : 'phải') }, h('div', { class: 'rv-tl-track' }), P.prog, P.marks, P.head);
    P.time = h('span', { class: 'cmp-time' });
    P.el = h('div', { class: 'cmp-side' },
      h('div', { class: 'cmp-head' }, P.select, h('span', { class: 'grow' }), P.time),
      P.box, P.tl,
      h('div', { class: 'cmp-steps' },
        h('button', { class: 'rv-icon', 'aria-label': 'Lùi 1 khung', title: 'Lùi 1 khung', onclick: () => stepSide(P, -1), html: icon('prev') }),
        h('button', { class: 'rv-icon', 'aria-label': 'Tiến 1 khung', title: 'Tiến 1 khung', onclick: () => stepSide(P, 1), html: icon('next') })));
    let scrub = false;
    const at = (e) => { const r = P.tl.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (P.video.duration || 0); };
    P.tl.addEventListener('pointerdown', (e) => { if (e.target.closest('.rv-mark')) return; scrub = true; pauseAll(); P.tl.setPointerCapture(e.pointerId); seekSide(P, at(e)); });
    P.tl.addEventListener('pointermove', (e) => { if (scrub) seekSide(P, at(e)); });
    P.tl.addEventListener('pointerup', () => { scrub = false; });
    P.video.addEventListener('loadedmetadata', () => {
      P.loading.hidden = true; layout(P); renderMarks(P); draw(P);
      const src = P.video.currentSrc || P.video.src; P.meta.textContent = fmtMeta(P.video);
      videoFps(src).then(f => { if ((P.video.currentSrc || P.video.src) === src) P.meta.textContent = fmtMeta(P.video, f); });
    });
    P.video.addEventListener('seeked', () => draw(P));
    return P;
  }
  const A = side('a', o.a), B = side('b', o.b);

  const playBtn = h('button', { class: 'rv-play', 'aria-label': 'Phát cả hai', onclick: () => togglePlay(), html: icon('play', 20) });
  const lockBtn = h('button', { class: 'rh-btn sm ghost', 'aria-pressed': 'false', onclick: () => toggleLock() });
  const status = h('span', { class: 'cmp-status', role: 'status' });
  const hearBtn = h('button', { class: 'rh-btn sm ghost', onclick: () => { hearB = !hearB; applyAudio(); } });
  const bar = h('div', { class: 'cmp-bar' }, playBtn, lockBtn, status, h('span', { class: 'grow' }), hearBtn,
    h('button', { class: 'rh-btn sm ghost', onclick: () => o.onClose() }, 'Thoát so sánh'));
  host.replaceChildren(h('div', { class: 'cmp-grid' }, A.el, B.el), bar);

  function setVer(P, i) {
    P.idx = i; P.ver = versions[i]; P.sel = null; P.loading.hidden = false; P.loading.textContent = 'Đang tải video…';
    o.getUrl(P.ver, (pct) => { P.loading.textContent = `Đang tải video ${pct}%`; }).then(u => { if (!dead && P.ver === versions[i]) P.video.src = u; })
      .catch(() => { P.loading.textContent = 'Không tải được video này.'; });
    if (locked) toggleLock(false);
  }
  function layout(P) {
    const vw = P.video.videoWidth || 9, vh = P.video.videoHeight || 16, r = P.box.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const MH = 24, H = r.height - MH;
    let w = r.width, hh = w * vh / vw; if (hh > H) { hh = H; w = hh * vw / vh; }
    P.stage.style.width = Math.floor(w) + 'px'; P.stage.style.height = Math.floor(hh) + 'px'; P.stage.style.marginTop = MH + 'px';
    P.meta.style.left = P.stage.offsetLeft + 'px'; P.meta.style.top = (P.stage.offsetTop - MH) + 'px'; draw(P);
  }
  const ro = new ResizeObserver(() => { layout(A); layout(B); }); ro.observe(A.box); ro.observe(B.box);

  const clampT = (P, t) => Math.min(Math.max(0, t), (P.video.duration || 0) - 0.001);
  const other = (P) => (P === A ? B : A);
  function seekSide(P, t, follow = true) {
    if (!P.video.duration) return;
    P.video.currentTime = clampT(P, t);
    if (locked && follow) { const Q = other(P); Q.video.currentTime = clampT(Q, P === A ? t + offset : t - offset); }
    tick();
  }
  function stepSide(P, n) { pauseAll(); seekSide(P, (Math.round(P.video.currentTime * FPS) + n) / FPS + 0.0001); }
  function pauseAll() { A.video.pause(); B.video.pause(); }
  function togglePlay() {
    if (A.video.paused && B.video.paused) {
      if (locked) B.video.currentTime = clampT(B, A.video.currentTime + offset);
      A.video.play().catch(() => { }); B.video.play().catch(() => { });
    } else pauseAll();
  }
  function toggleLock(v = !locked) {
    locked = v;
    if (locked) offset = B.video.currentTime - A.video.currentTime;
    renderBar();
  }
  function applyAudio() { A.video.muted = hearB; B.video.muted = !hearB; renderBar(); }
  function renderBar() {
    lockBtn.setAttribute('aria-pressed', String(locked));
    lockBtn.innerHTML = icon(locked ? 'lock' : 'unlock', 16) + (locked ? ' Đã khoá' : ' Khoá đồng bộ');
    const a = `v${A.idx + 1}`, b = `v${B.idx + 1}`, d = Math.abs(offset).toFixed(1).replace('.', ',');
    status.textContent = locked
      ? (Math.abs(offset) < 0.05 ? `${a} và ${b} chạy cùng mốc` : `${b} ${offset > 0 ? 'chậm' : 'nhanh'} hơn ${a} ${d} giây`)
      : 'Tua từng bên tới cùng một khoảnh khắc rồi bấm khoá';
    hearBtn.innerHTML = icon('sound', 16) + ` Nghe ${hearB ? b : a}`;
  }

  function visible(P) {
    const t = P.video.currentTime, playing = !P.video.paused;
    return o.comments(P.ver.id).filter(c => c.t != null && (P.sel === c.id && Math.abs(t - c.t) < 0.6 || (playing ? (t >= c.t - 0.05 && t < c.t + 0.8) : Math.abs(t - c.t) <= Math.max(0.5 / FPS, 0.12))));
  }
  function draw(P) {
    const W = P.stage.clientWidth, H = P.stage.clientHeight; if (!W) return;
    P.svg.setAttribute('viewBox', `0 0 ${W} ${H}`); P.svg.setAttribute('width', W); P.svg.setAttribute('height', H);
    const vis = visible(P);
    P.svg.innerHTML = vis.map(c => (c.shapes || []).map(s => o.shapeSvg(s, W, H)).join('')).join('');
    P.pins.replaceChildren(...vis.filter(c => c.x != null).map(c => h('span', { class: 'rv-pin ' + (c.done ? 'done' : 'open'), style: { left: c.x * W + 'px', top: c.y * H + 'px', pointerEvents: 'none' } }, h('span', {}, String(c.n)))));
    const lab = vis.find(c => c.id === P.sel) || vis[0];
    P.label.hidden = !lab; P.label.textContent = lab ? `#${lab.n} ${lab.text}` : '';
  }
  function renderMarks(P) {
    const d = P.video.duration; P.marks.replaceChildren(); if (!d) return;
    o.comments(P.ver.id).filter(c => c.t != null).forEach(c => P.marks.append(h('button', {
      class: 'rv-mark ' + (c.done ? 'done' : 'open'), style: { left: (c.t / d) * 100 + '%' }, title: `#${c.n} ${fmtTime(c.t)} – ${c.text.slice(0, 60)}`,
      'aria-label': `Nhận xét #${c.n} tại ${fmtTime(c.t)}`, onclick: (e) => { e.stopPropagation(); focusOn(P, c); }
    })));
  }
  function focusOn(P, c) { pauseAll(); P.sel = c.id; seekSide(P, c.t, false); draw(P); }
  function tick() {
    [A, B].forEach(P => {
      const d = P.video.duration || 0, t = P.video.currentTime, pct = d ? t / d * 100 : 0;
      P.prog.style.width = pct + '%'; P.head.style.left = pct + '%';
      P.time.replaceChildren(fmtTime(t, 2), h('span', {}, ' / ' + fmtTime(d)));
      draw(P);
    });
  }
  function loop() {
    if (dead) return;
    // giữ độ lệch khi đang phát: bên B chạy theo bên A
    if (locked && !A.video.paused && !B.video.paused) {
      const want = A.video.currentTime + offset;
      if (want >= 0 && want < (B.video.duration || 0) && Math.abs(B.video.currentTime - want) > 0.08) B.video.currentTime = want;
    }
    tick();
    raf = (!A.video.paused || !B.video.paused) ? requestAnimationFrame(loop) : 0;
  }
  [A, B].forEach(P => {
    P.video.addEventListener('play', () => { playBtn.innerHTML = icon('pause', 20); playBtn.setAttribute('aria-label', 'Dừng cả hai'); if (!raf) raf = requestAnimationFrame(loop); });
    P.video.addEventListener('pause', () => { if (A.video.paused && B.video.paused) { playBtn.innerHTML = icon('play', 20); playBtn.setAttribute('aria-label', 'Phát cả hai'); } tick(); });
  });

  setVer(A, o.a); setVer(B, o.b); applyAudio();

  return {
    // bấm một nhận xét trong cột bên phải: bản nào chứa nhận xét đó thì bên đó nhảy tới
    focus(c) { const P = A.ver.id === c.fileId ? A : B.ver.id === c.fileId ? B : null; if (!P) { const Q = versions.findIndex(v => v.id === c.fileId); setVer(A, Q); A.video.addEventListener('loadedmetadata', () => focusOn(A, c), { once: true }); return; } focusOn(P, c); },
    refresh() { renderMarks(A); renderMarks(B); draw(A); draw(B); },
    key(e) {
      if (e.key === ' ') { e.preventDefault(); togglePlay(); return true; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const n = e.key === 'ArrowLeft' ? -1 : 1; pauseAll(); seekSide(A, (Math.round(A.video.currentTime * FPS) + n) / FPS + 0.0001); if (!locked) seekSide(B, (Math.round(B.video.currentTime * FPS) + n) / FPS + 0.0001, false); return true; }
      if (e.key === 'Escape') { o.onClose(); return true; }
      return false;
    },
    destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); pauseAll(); host.replaceChildren(); }
  };
}
