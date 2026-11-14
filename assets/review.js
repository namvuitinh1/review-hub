// Màn hình review: phát video, ghim nhận xét lên khung hình, vẽ, sửa/xoá, phiên bản.
import { api, cfg } from './api.js';
import { h, icon, fmtTime, ago, initials, toast, me, askName, adminPw, confirmDialog, store } from './ui.js';

const COLORS = ['#FFD43B', '#D92B1F', '#1B56F8', '#FFFFFF', '#111014'];
const TOOLS = [
  ['cursor', 'Ghim nhận xét: bấm vào video (V)', 'Ghim'],
  ['pen', 'Bút vẽ tự do (P)', 'Bút'],
  ['arrow', 'Mũi tên (A)', 'Mũi tên'],
  ['rect', 'Khung chữ nhật (R)', 'Khung'],
  ['ellipse', 'Vòng tròn (E)', 'Vòng tròn']
];
const TOOL_KEYS = { v: 'cursor', p: 'pen', a: 'arrow', r: 'rect', e: 'ellipse' };

export function mountReview(root, ctx) {
  // ctx: { token, project, video, verIndex, isAdmin, onBack, onVersion }
  const FPS = Number(cfg.FPS) || 30;
  const versions = ctx.video.versions;
  const S = {
    vi: ctx.verIndex ?? versions.length - 1,
    comments: [], tool: 'cursor', color: COLORS[0], width: 4,
    draft: null, sel: null, filter: 'open', live: null,
    editReply: null, replyTo: null, showOld: false, dur: 0, busy: false,
    notes: {}, editNote: false
  };
  const ADMIN = !!ctx.isAdmin;
  const myName = () => ADMIN ? (store.get('rh-admin-name') || 'Bên dựng') : me().name;
  if (!ADMIN) S.filter = 'all';
  const cur = () => versions[S.vi];
  const mine = (c) => c.authorId === me().uid;
  const pw = ctx.isAdmin ? adminPw() : undefined;
  const isSmall = () => window.matchMedia('(max-width: 900px)').matches;

  /* ---------- khung ---------- */
  const video = h('video', { class: 'rv-video', playsinline: true, 'webkit-playsinline': true, preload: 'auto', crossorigin: null });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'rv-ov');
  const pins = h('div', { class: 'rv-pins' });
  const label = h('div', { class: 'rv-label', hidden: true });
  const stage = h('div', { class: 'rv-stage tool-cursor', tabindex: '-1' }, video, svg, pins, label);
  const loading = h('div', { class: 'rv-loading' }, 'Đang tải video…');
  const quickText = h('textarea', { id: 'rv-quick-text', rows: '2', placeholder: 'Gõ nhận xét cho điểm này…' });
  const quickTitle = h('label', { for: 'rv-quick-text', class: 'rv-quick-title' });
  const quickSave = h('button', { class: 'rh-btn primary sm', onclick: () => saveDraft() }, 'Lưu');
  const quick = h('div', { class: 'rv-quick', hidden: true },
    quickTitle, quickText,
    h('div', { class: 'rv-quick-row' },
      h('span', { class: 'rv-hint' }, 'Enter lưu · Esc huỷ'),
      h('span', { class: 'grow' }),
      h('button', { class: 'rh-btn ghost sm', onclick: () => cancelDraft() }, 'Huỷ'),
      quickSave));
  const stageBox = h('div', { class: 'rv-stagebox' }, stage, loading, quick);

  const toolBtns = {};
  const colorBtns = [];
  const tools = h('div', { class: 'rv-tools', role: 'toolbar', 'aria-label': 'Công cụ' },
    TOOLS.map(([id, tip, name]) => (toolBtns[id] = h('button', { class: 'rv-tool', title: tip, 'aria-label': name, 'aria-pressed': String(id === S.tool), onclick: () => setTool(id), html: icon(id === 'cursor' ? 'pin' : id, 20) }))),
    h('span', { class: 'rv-tools-sep' }),
    COLORS.map(c => { const b = h('button', { class: 'rv-color', title: 'Màu nét', 'aria-label': 'Màu ' + c, 'aria-pressed': String(c === S.color), onclick: () => setColor(c) }, h('span', { style: { background: c } })); colorBtns.push([c, b]); return b; }),
    h('span', { class: 'rv-tools-sep' }),
    h('button', { class: 'rv-tool', title: 'Hoàn tác nét vẽ (Ctrl+Z)', 'aria-label': 'Hoàn tác', onclick: () => undoShape(), html: icon('undo', 20) }));

  /* ---------- điều khiển ---------- */
  const playBtn = h('button', { class: 'rv-play', 'aria-label': 'Phát', onclick: () => togglePlay(), html: icon('play', 20) });
  const timeEl = h('div', { class: 'rv-time' });
  const frameEl = h('span', { class: 'rv-frame' });
  const speed = h('select', { class: 'rv-speed', 'aria-label': 'Tốc độ', onchange: () => { video.playbackRate = Number(speed.value); } },
    ['0.5', '1', '1.5', '2'].map(v => h('option', { value: v, selected: v === '1' }, v + '×')));
  const muteBtn = h('button', { class: 'rv-icon', 'aria-label': 'Tắt tiếng', onclick: () => { video.muted = !video.muted; muteBtn.innerHTML = icon(video.muted ? 'mute' : 'sound'); }, html: icon('sound') });
  const tlProg = h('div', { class: 'rv-tl-prog' });
  const tlHead = h('div', { class: 'rv-tl-head' });
  const tlMarks = h('div', { class: 'rv-tl-marks' });
  const tl = h('div', { class: 'rv-tl', role: 'slider', 'aria-label': 'Thanh tua', tabindex: '0' }, h('div', { class: 'rv-tl-track' }), tlProg, tlMarks, tlHead);
  const controls = h('div', { class: 'rv-ctrl' }, tl,
    h('div', { class: 'rv-ctrl-row' },
      h('button', { class: 'rv-icon', 'aria-label': 'Lùi 1 khung hình', title: 'Lùi 1 khung (←)', onclick: () => step(-1), html: icon('prev') }),
      playBtn,
      h('button', { class: 'rv-icon', 'aria-label': 'Tiến 1 khung hình', title: 'Tiến 1 khung (→)', onclick: () => step(1), html: icon('next') }),
      timeEl, frameEl, h('span', { class: 'grow' }), speed, muteBtn));

  const tip = h('div', { class: 'rv-tip' },
    h('b', {}, 'Mẹo'), h('span', {}, 'Bấm vào video → gõ nhận xét ngay tại chỗ'),
    h('span', { class: 'rv-tip-k' }, h('kbd', {}, 'Space'), ' phát / dừng'),
    h('span', { class: 'rv-tip-k' }, h('kbd', {}, '← →'), ' từng khung'),
    h('span', { class: 'rv-tip-k' }, h('kbd', {}, 'P A R E'), ' vẽ'));

  /* ---------- cột nhận xét ---------- */
  const listEl = h('div', { class: 'rv-list' });
  const countEl = h('h2', { class: 'rv-count' });
  const noteEl = h('section', { class: 'rv-note', 'aria-label': 'Ghi chú phiên bản' });
  const tabs = {};
  const tabRow = h('div', { class: 'rv-tabs', role: 'tablist' },
    [['open', 'Chưa xử lý'], ['done', 'Đã sửa'], ['all', 'Tất cả']].map(([id, txt]) =>
      (tabs[id] = h('button', { role: 'tab', 'aria-selected': String(id === S.filter), onclick: () => { S.filter = id; renderList(); } }, txt))));
  const oldEl = h('div', { class: 'rv-old' });
  const genText = h('textarea', { id: 'rv-gen', rows: '2', placeholder: 'Nhận xét chung cho cả video…' });
  const genLabel = h('label', { for: 'rv-gen', class: 'rv-gen-label' });
  const composer = h('form', { class: 'rv-composer', onsubmit: (e) => { e.preventDefault(); saveGeneral(); } },
    genLabel, genText,
    h('div', { class: 'rv-quick-row' },
      h('label', { class: 'rv-check' }, h('input', { type: 'checkbox', id: 'rv-gen-time', checked: true }), 'Gắn vào giây hiện tại'),
      h('span', { class: 'grow' }),
      h('button', { class: 'rh-btn primary sm', type: 'submit' }, 'Gửi')));
  const side = h('aside', { class: 'rv-side' }, noteEl, h('div', { class: 'rv-side-head' }, countEl, ADMIN ? tabRow : null), listEl, oldEl, composer);

  /* ---------- đầu trang ---------- */
  const verSeg = h('div', { class: 'rv-vers', role: 'group', 'aria-label': 'Chọn phiên bản' },
    versions.map((v, i) => h('button', {
      'aria-pressed': String(i === S.vi), title: v.name,
      onclick: () => switchVersion(i)
    }, `v${i + 1}` + (i === versions.length - 1 ? ' · mới' : ''))));
  const userChip = h('button', { class: 'rh-user', title: 'Đổi tên', onclick: async () => {
    if (ADMIN) { const n = await askName(store.get('rh-admin-name') || '', 'Tên hiển thị của bên dựng', 'rh-admin-name'); if (n) renderUser(); return; }
    const n = await askName(me().name, ctx.project.name); if (n) { renderUser(); renderList(); } } });
  const top = h('header', { class: 'rh-top rv-top' },
    h('button', { class: 'rh-back', onclick: () => ctx.onBack(), 'aria-label': 'Về danh sách video', html: icon('back') }),
    h('div', { class: 'rv-title' }, h('span', { class: 'rv-proj' }, ctx.project.name), h('span', { class: 'rv-vname' }, ctx.video.name)),
    verSeg,
    h('span', { class: 'grow' }),
    ADMIN ? h('span', { class: 'rh-pill light' }, 'QUẢN LÝ') : null,
    ADMIN ? h('button', { class: 'rh-btn sm light', onclick: () => copyClientLink(), html: icon('copy', 14) + ' Copy link khách' }) : null,
    userChip);

  const main = h('section', { class: 'rv-main' }, tip, h('div', { class: 'rv-stagewrap' }, tools, stageBox), controls);
  const page = h('div', { class: 'rv' + (ADMIN ? ' is-admin' : '') }, top, h('div', { class: 'rv-body' }, main, side));
  root.replaceChildren(page);

  /* ---------- tiện ích ---------- */
  async function copyClientLink() {
    const url = location.href.split('?')[0].replace(/admin\.html$/, '') + '?p=' + encodeURIComponent(ctx.token);
    try { await navigator.clipboard.writeText(url); toast('Đã copy link khách'); } catch { toast('Link khách: ' + url); }
  }
  function renderUser() {
    const n = myName() || 'Nhập tên';
    userChip.replaceChildren(h('span', { class: 'rh-ava' }, initials(n)), h('span', { class: 'rh-user-name' }, n));
  }
  const tops = () => S.comments.filter(c => !c.parentId);
  const curTops = () => tops().filter(c => c.fileId === cur().id).sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9) || a.n - b.n);
  const repliesOf = (id) => S.comments.filter(c => c.parentId === id).sort((a, b) => a.createdAt - b.createdAt);
  const frameOf = (t) => Math.round(t * FPS);

  function stageRect() { return stage.getBoundingClientRect(); }
  function norm(e) {
    const r = stageRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  }

  /* ---------- kích thước khung theo tỉ lệ video ---------- */
  function layout() {
    const vw = video.videoWidth || 9, vh = video.videoHeight || 16;
    const box = stageBox.getBoundingClientRect();
    let maxH = box.height, maxW = box.width;
    if (isSmall()) maxH = Math.min(window.innerHeight * 0.62, 640);
    if (maxW <= 0 || maxH <= 0) return;
    let w = maxW, hgt = w * vh / vw;
    if (hgt > maxH) { hgt = maxH; w = hgt * vw / vh; }
    stage.style.width = Math.floor(w) + 'px';
    stage.style.height = Math.floor(hgt) + 'px';
    renderOverlay();
    placeQuick();
  }
  const ro = new ResizeObserver(() => layout());
  ro.observe(stageBox);

  /* ---------- vẽ lớp phủ ---------- */
  function shapeSvg(s, W, H) {
    const P = (p) => [p[0] * W, p[1] * H];
    const sw = s.w || 4, col = s.color || '#FFD43B';
    const base = `fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
    if (s.type === 'pen') {
      if (!s.pts.length) return '';
      const d = s.pts.map((p, i) => { const [x, y] = P(p); return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }).join(' ');
      return `<path d="${d}" ${base}/>`;
    }
    if (s.pts.length < 2) return '';
    const [x1, y1] = P(s.pts[0]), [x2, y2] = P(s.pts[1]);
    if (s.type === 'rect') return `<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" rx="3" ${base}/>`;
    if (s.type === 'ellipse') return `<ellipse cx="${(x1 + x2) / 2}" cy="${(y1 + y2) / 2}" rx="${Math.abs(x2 - x1) / 2}" ry="${Math.abs(y2 - y1) / 2}" ${base}/>`;
    if (s.type === 'arrow') {
      const a = Math.atan2(y2 - y1, x2 - x1), L = Math.max(12, sw * 4);
      const hx1 = x2 - L * Math.cos(a - 0.45), hy1 = y2 - L * Math.sin(a - 0.45);
      const hx2 = x2 - L * Math.cos(a + 0.45), hy2 = y2 - L * Math.sin(a + 0.45);
      return `<path d="M${x1} ${y1} L${x2} ${y2} M${hx1} ${hy1} L${x2} ${y2} L${hx2} ${hy2}" ${base}/>`;
    }
    return '';
  }

  function visibleComments() {
    if (S.draft) return [];
    const t = video.currentTime, playing = !video.paused;
    return curTops().filter(c => {
      if (c.t == null) return false;
      if (S.sel === c.id && Math.abs(t - c.t) < 0.6) return true;
      return playing ? (t >= c.t - 0.05 && t < c.t + 0.8) : Math.abs(t - c.t) <= Math.max(0.5 / FPS, 0.12);
    });
  }

  function renderOverlay() {
    const r = stageRect(), W = r.width, H = r.height;
    if (!W) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    let out = '';
    const vis = visibleComments();
    vis.forEach(c => (c.shapes || []).forEach(s => { out += shapeSvg(s, W, H); }));
    if (S.draft) S.draft.shapes.forEach(s => { out += shapeSvg(s, W, H); });
    svg.innerHTML = out;

    pins.replaceChildren();
    const pinEl = (x, y, n, cls, id) => {
      const el = h('button', { class: 'rv-pin ' + cls, style: { left: x * W + 'px', top: y * H + 'px' }, 'aria-label': 'Nhận xét #' + n, tabindex: id ? '0' : '-1' }, h('span', {}, String(n)));
      if (id) el.addEventListener('pointerdown', (e) => { e.stopPropagation(); select(id, true); });
      pins.append(el);
    };
    vis.forEach(c => { if (c.x != null) pinEl(c.x, c.y, c.n, (ADMIN && c.done ? 'done' : 'open') + (S.sel === c.id ? ' sel' : ''), c.id); });
    if (S.draft && S.draft.x != null) pinEl(S.draft.x, S.draft.y, S.draft.n, 'draft', null);

    const lab = vis.find(c => c.id === S.sel) || vis[0];
    if (lab && lab.text) { label.hidden = false; label.textContent = `#${lab.n} ${lab.text}`; }
    else { label.hidden = true; label.textContent = ''; }
  }

  /* ---------- công cụ ---------- */
  function setTool(id) {
    S.tool = id;
    Object.entries(toolBtns).forEach(([k, b]) => b.setAttribute('aria-pressed', String(k === id)));
    stage.className = 'rv-stage tool-' + id;
  }
  function setColor(c) {
    S.color = c;
    colorBtns.forEach(([k, b]) => b.setAttribute('aria-pressed', String(k === c)));
  }
  function undoShape() {
    if (!S.draft) return;
    const i = S.draft.shapes.length - 1;
    if (i >= 0) { S.draft.shapes.splice(i, 1); renderOverlay(); }
  }

  /* ---------- bản nháp nhận xét ---------- */
  function nextN() { return curTops().reduce((m, c) => Math.max(m, c.n || 0), 0) + 1; }

  function startDraft() {
    if (S.draft) return S.draft;
    video.pause();
    S.sel = null;
    S.draft = { t: video.currentTime, shapes: [], x: null, y: null, n: nextN(), editId: null, text: '' };
    return S.draft;
  }

  function openQuick(focus = true) {
    const d = S.draft; if (!d) return;
    quickTitle.textContent = (d.editId ? `Sửa nhận xét #${d.n}` : `Nhận xét #${d.n}`) + ' · ' + fmtTime(d.t);
    quickSave.textContent = d.editId ? 'Lưu thay đổi' : 'Lưu';
    if (quick.hidden) quickText.value = d.text || '';
    quick.hidden = false;
    placeQuick();
    if (focus) {
      try { quickText.focus({ preventScroll: true }); } catch { quickText.focus(); }
      if (isSmall()) { bringIntoView(); setTimeout(bringIntoView, 350); }
    }
  }

  function anchorOf(d) {
    if (d.x != null) return [d.x, d.y];
    const pts = d.shapes.flatMap(s => s.pts);
    if (!pts.length) return [0.5, 0.5];
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return [Math.max(...xs), Math.min(...ys)];
  }

  // Điểm khung nhận xét bám vào: mũi ghim, hoặc giữa mép dưới hình vẽ nếu chưa có ghim.
  function boxAnchor(d) {
    if (d.x != null) return { x: d.x, y: d.y, pin: true };
    const pts = d.shapes.flatMap(s => s.pts);
    if (!pts.length) return { x: 0.5, y: 0.5, pin: false };
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.max(...ys), yTop: Math.min(...ys), pin: false };
  }

  // Khung nhận xét luôn nằm ngay DƯỚI ghim (mũi tên chỉ lên ghim); sát đáy video thì lật lên trên ghim (máy tính).
  function placeQuick() {
    if (quick.hidden || !S.draft) return;
    const sr = stageRect(), br = stageBox.getBoundingClientRect();
    const a = boxAnchor(S.draft);
    const px = sr.left - br.left + a.x * sr.width, tipY = sr.top - br.top + a.y * sr.height;
    const qw = Math.min(340, Math.max(240, br.width - 16));
    quick.style.width = qw + 'px';
    const qh = quick.offsetHeight || 150;
    const gap = 12, headH = a.pin ? 44 : 0;
    let left = Math.min(Math.max(8, px - qw / 2), br.width - qw - 8);
    let top = tipY + gap, below = true;
    const topAbove = (a.pin ? tipY - headH : sr.top - br.top + (a.yTop ?? a.y) * sr.height) - gap - qh;
    if (!isSmall() && top + qh > br.height + 40 && topAbove >= -br.top + 70) { top = topAbove; below = false; }
    quick.style.left = left + 'px'; quick.style.top = top + 'px';
    quick.classList.toggle('up', below); quick.classList.toggle('down', !below);
    quick.style.setProperty('--ax', Math.min(Math.max(18, px - left), qw - 18) + 'px');
  }

  // Điện thoại: cuộn trang để ghim lên gần mép trên, khung nhận xét ở nửa trên màn hình, bàn phím ở nửa dưới không che.
  function bringIntoView() {
    if (!S.draft || quick.hidden) return;
    const sr = stageRect(), a = boxAnchor(S.draft);
    const pinTop = sr.top + a.y * sr.height - (a.pin ? 44 : 0);
    const target = window.scrollY + pinTop - 56;
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }

  function hideQuick() {
    if (quick.contains(document.activeElement)) document.activeElement.blur();
    quick.hidden = true; quickText.value = '';
  }
  function cancelDraft() {
    S.draft = null; hideQuick();
    renderOverlay(); renderList();
  }

  async function ensureName() {
    if (ADMIN || me().name) return true;
    const n = await askName('', ctx.project.name);
    renderUser();
    return !!n;
  }

  async function saveDraft() {
    const d = S.draft; if (!d || S.busy) return;
    const text = quickText.value.trim();
    if (!text && !d.shapes.length) { quickText.focus(); toast('Gõ vài chữ nhận xét trước khi lưu'); return; }
    if (!(await ensureName())) return;
    S.busy = true; quickSave.disabled = true;
    const [ax, ay] = d.x != null ? [d.x, d.y] : (d.shapes.length ? anchorOf(d) : [null, null]);
    try {
      let c;
      if (d.editId) {
        c = await api.editComment({ token: ctx.token, id: d.editId, authorId: me().uid, pw, text, shapes: d.shapes, x: ax, y: ay });
        S.comments = S.comments.map(x => x.id === c.id ? c : x);
        toast('Đã lưu thay đổi');
      } else {
        c = await api.addComment({ token: ctx.token, videoId: ctx.video.id, fileId: cur().id, n: Math.max(d.n, nextN()), t: d.t, x: ax, y: ay, shapes: d.shapes, text, author: myName(), authorId: me().uid, pw });
        (S.comments.some(x => x.id === c.id) || S.comments.push(c));
        toast('Đã lưu nhận xét #' + c.n);
      }
      S.draft = null; hideQuick();
      S.sel = c.id;
      if (S.filter === 'done' && !c.done) S.filter = 'open';
      renderAll();
    } catch (err) { toast(err.message, 'err'); }
    finally { S.busy = false; quickSave.disabled = false; }
  }

  async function saveGeneral() {
    const text = genText.value.trim();
    if (!text) { genText.focus(); return; }
    if (!(await ensureName())) return;
    const withTime = composer.querySelector('#rv-gen-time').checked;
    try {
      const c = await api.addComment({ token: ctx.token, videoId: ctx.video.id, fileId: cur().id, n: nextN(), t: withTime ? video.currentTime : null, x: null, y: null, shapes: [], text, author: myName(), authorId: me().uid, pw });
      (S.comments.some(x => x.id === c.id) || S.comments.push(c)); genText.value = ''; S.sel = c.id;
      toast('Đã gửi nhận xét #' + c.n);
      renderAll();
    } catch (err) { toast(err.message, 'err'); }
  }

  function editComment(c) {
    if (c.fileId !== cur().id) return;
    cancelDraft();
    if (c.t != null) seek(c.t);
    video.pause();
    S.sel = null;
    S.draft = { t: c.t ?? video.currentTime, shapes: JSON.parse(JSON.stringify(c.shapes || [])), x: c.x, y: c.y, n: c.n, editId: c.id, text: c.text };
    quickText.value = c.text;
    quick.hidden = true;
    openQuick(true);
    renderOverlay(); renderList();
    if (c.x == null && !(c.shapes || []).length) toast('Bấm vào video nếu muốn ghim nhận xét này vào một điểm');
  }

  async function removeComment(c) {
    const isReply = !!c.parentId;
    if (!(await confirmDialog(isReply ? 'Xoá trả lời này?' : `Xoá nhận xét #${c.n}?`))) return;
    try {
      await api.deleteComment({ token: ctx.token, id: c.id, authorId: me().uid, pw });
      S.comments = S.comments.filter(x => x.id !== c.id && x.parentId !== c.id);
      if (S.sel === c.id) S.sel = null;
      toast('Đã xoá');
      renderAll();
    } catch (err) { toast(err.message, 'err'); }
  }

  async function toggleDone(c, done) {
    try {
      const n = await api.setDone({ token: ctx.token, id: c.id, done, pw });
      S.comments = S.comments.map(x => x.id === n.id ? n : x);
      renderAll();
    } catch (err) { toast(err.message, 'err'); }
  }

  async function sendReply(parent, text, input) {
    if (!text.trim()) { input.focus(); return; }
    if (!(await ensureName())) return;
    try {
      const c = await api.addComment({ token: ctx.token, videoId: ctx.video.id, fileId: parent.fileId, parentId: parent.id, t: null, x: null, y: null, shapes: [], text: text.trim(), author: myName(), authorId: me().uid, pw });
      (S.comments.some(x => x.id === c.id) || S.comments.push(c)); S.replyTo = null; renderList();
    } catch (err) { toast(err.message, 'err'); }
  }
  async function saveReplyEdit(r, text) {
    try {
      const c = await api.editComment({ token: ctx.token, id: r.id, authorId: me().uid, pw, text: text.trim() });
      S.comments = S.comments.map(x => x.id === c.id ? c : x); S.editReply = null; renderList();
    } catch (err) { toast(err.message, 'err'); }
  }

  /* ---------- chuột / chạm trên khung hình ---------- */
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const p = norm(e);
    e.preventDefault();
    if (S.tool === 'cursor') {
      const d = S.draft && S.draft.editId ? S.draft : startDraft();
      if (!quick.hidden && d.x != null && !d.editId) {
        // đã có ghim: bấm chỗ khác thì dời ghim
      }
      d.x = p[0]; d.y = p[1];
      if (!quick.hidden) d.text = quickText.value;
      renderOverlay(); openQuick(true); renderList();
      return;
    }
    const d = startDraft();
    if (!quick.hidden) d.text = quickText.value;
    S.live = { type: S.tool, color: S.color, w: S.width, pts: [p] };
    d.shapes.push(S.live);
    stage.setPointerCapture(e.pointerId);
    renderOverlay();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!S.live) return;
    const p = norm(e);
    if (S.live.type === 'pen') S.live.pts.push(p); else S.live.pts = [S.live.pts[0], p];
    renderOverlay();
  });
  const endLive = () => {
    if (!S.live) return;
    const s = S.live; S.live = null;
    const tiny = s.type !== 'pen' && (s.pts.length < 2 || Math.hypot(s.pts[1][0] - s.pts[0][0], s.pts[1][1] - s.pts[0][1]) < 0.01);
    if (tiny || (s.type === 'pen' && s.pts.length < 2)) S.draft.shapes.pop();
    if (S.draft && (S.draft.shapes.length || S.draft.x != null || S.draft.editId)) openQuick(true); else cancelDraft();
    renderOverlay(); renderList();
  };
  stage.addEventListener('pointerup', endLive);
  stage.addEventListener('pointercancel', endLive);

  quickText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); saveDraft(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelDraft(); }
  });
  quickText.addEventListener('input', () => { if (S.draft) S.draft.text = quickText.value; });

  /* ---------- phát / tua ---------- */
  function togglePlay() {
    if (S.draft) { if (!quickText.value.trim() && !S.draft.shapes.length && !S.draft.editId) cancelDraft(); else { toast('Lưu hoặc huỷ nhận xét đang viết trước đã'); return; } }
    if (video.paused) video.play().catch(() => { }); else video.pause();
  }
  function seek(t) {
    const d = video.duration || S.dur || 0;
    video.currentTime = Math.min(Math.max(0, t), d ? d - 0.001 : t);
    tick();
  }
  function step(n) { video.pause(); seek((Math.round(video.currentTime * FPS) + n) / FPS + 0.0001); }

  function tick() {
    const t = video.currentTime, d = video.duration || S.dur || 0;
    timeEl.replaceChildren(fmtTime(t, 2), h('span', {}, ' / ' + fmtTime(d)));
    frameEl.textContent = 'khung ' + frameOf(t);
    const pct = d ? (t / d) * 100 : 0;
    tlProg.style.width = pct + '%'; tlHead.style.left = pct + '%';
    tl.setAttribute('aria-valuenow', Math.round(pct));
    renderOverlay();
  }
  let raf = 0;
  const loop = () => { tick(); raf = video.paused ? 0 : requestAnimationFrame(loop); };
  video.addEventListener('play', () => { playBtn.innerHTML = icon('pause', 20); playBtn.setAttribute('aria-label', 'Dừng'); if (!raf) raf = requestAnimationFrame(loop); });
  video.addEventListener('pause', () => { playBtn.innerHTML = icon('play', 20); playBtn.setAttribute('aria-label', 'Phát'); tick(); });
  video.addEventListener('seeked', tick);
  video.addEventListener('timeupdate', () => { if (video.paused) tick(); });
  video.addEventListener('loadedmetadata', () => {
    S.dur = video.duration; loading.hidden = true;
    if (video.currentTime === 0) { try { video.currentTime = 0.001; } catch { } }
    layout(); tick(); renderMarks();
  });
  video.addEventListener('waiting', () => { loading.hidden = false; loading.textContent = 'Đang tải…'; });
  video.addEventListener('canplay', () => { loading.hidden = true; });
  video.addEventListener('error', () => { if (!video.getAttribute('src')) return; loading.hidden = false; loading.textContent = 'Không phát được video này. Thử xuất lại file MP4 (H.264) rồi tải lên Drive.'; });

  // thanh tua: bấm / kéo
  let scrubbing = false;
  const scrubTo = (e) => { const r = tl.getBoundingClientRect(); const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); seek(f * (video.duration || 0)); };
  tl.addEventListener('pointerdown', (e) => { if (e.target.closest('.rv-mark')) return; scrubbing = true; video.pause(); tl.setPointerCapture(e.pointerId); scrubTo(e); });
  tl.addEventListener('pointermove', (e) => { if (scrubbing) scrubTo(e); });
  tl.addEventListener('pointerup', () => { scrubbing = false; });
  tl.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); } if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } });

  function renderMarks() {
    const d = video.duration || 0;
    tlMarks.replaceChildren();
    if (!d) return;
    curTops().filter(c => c.t != null).forEach(c => {
      tlMarks.append(h('button', {
        class: 'rv-mark ' + (c.done ? 'done' : 'open') + (S.sel === c.id ? ' sel' : ''),
        style: { left: (c.t / d) * 100 + '%' }, title: `#${c.n} ${fmtTime(c.t)} – ${c.text.slice(0, 60)}`,
        'aria-label': `Nhận xét #${c.n} tại ${fmtTime(c.t)}`,
        onclick: (e) => { e.stopPropagation(); select(c.id, true); }
      }));
    });
  }

  /* ---------- chọn nhận xét ---------- */
  function select(id, scroll) {
    const c = S.comments.find(x => x.id === id); if (!c) return;
    if (S.draft) cancelDraft();
    if (c.fileId !== cur().id) { switchVersion(versions.findIndex(v => v.id === c.fileId), c.t, id); return; }
    S.sel = id;
    video.pause();
    if (c.t != null) seek(c.t);
    renderAll();
    if (scroll) { const el = listEl.querySelector(`[data-id="${id}"]`); el && el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }

  /* ---------- danh sách nhận xét ---------- */
  function commentCard(c, readonly = false) {
    const hasDrawing = (c.shapes || []).length > 0;
    const isEditing = S.draft && S.draft.editId === c.id;
    const replies = repliesOf(c.id);
    const actions = h('div', { class: 'rv-c-act' },
      hasDrawing ? h('span', { class: 'rv-badge', html: icon('pen', 13) + ' Có hình vẽ' }) : null,
      !readonly ? h('button', { class: 'link', onclick: (e) => { e.stopPropagation(); S.replyTo = S.replyTo === c.id ? null : c.id; renderList(); } }, 'Trả lời') : null,
      !readonly && mine(c) ? h('button', { class: 'link', onclick: (e) => { e.stopPropagation(); editComment(c); } }, 'Sửa') : null,
      (mine(c) || ctx.isAdmin) ? h('button', { class: 'link danger', onclick: (e) => { e.stopPropagation(); removeComment(c); } }, 'Xoá') : null,
      h('span', { class: 'grow' }),
      ADMIN ? h('label', { class: 'rv-check', onclick: (e) => e.stopPropagation() },
        h('input', { type: 'checkbox', checked: c.done, onchange: (e) => toggleDone(c, e.target.checked) }), 'Đã sửa') : null);

    const repEls = replies.map(r => {
      if (S.editReply === r.id) {
        const ta = h('textarea', { rows: '2', 'aria-label': 'Sửa trả lời', 'data-autofocus': '1' }); ta.value = r.text;
        return h('div', { class: 'rv-reply editing', onclick: (e) => e.stopPropagation() }, ta,
          h('div', { class: 'rv-quick-row' }, h('span', { class: 'grow' }),
            h('button', { class: 'rh-btn ghost sm', onclick: () => { S.editReply = null; renderList(); } }, 'Huỷ'),
            h('button', { class: 'rh-btn primary sm', onclick: () => saveReplyEdit(r, ta.value) }, 'Lưu')));
      }
      return h('div', { class: 'rv-reply' },
        h('div', { class: 'rv-reply-top' }, h('b', {}, r.author), r.staff ? h('span', { class: 'rv-staff' }, 'Bên dựng') : null, h('span', { class: 'rv-ago' }, ago(r.createdAt) + (r.updatedAt - r.createdAt > 2000 ? ' · đã sửa' : '')),
          h('span', { class: 'grow' }),
          mine(r) ? h('button', { class: 'link', onclick: (e) => { e.stopPropagation(); S.editReply = r.id; renderList(); } }, 'Sửa') : null,
          (mine(r) || ctx.isAdmin) ? h('button', { class: 'link danger', onclick: (e) => { e.stopPropagation(); removeComment(r); } }, 'Xoá') : null),
        h('p', {}, r.text));
    });

    let replyBox = null;
    if (S.replyTo === c.id) {
      const ta = h('textarea', { rows: '2', placeholder: 'Viết trả lời…', 'aria-label': 'Trả lời nhận xét #' + c.n, 'data-autofocus': '1' });
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendReply(c, ta.value, ta); } });
      replyBox = h('div', { class: 'rv-reply editing', onclick: (e) => e.stopPropagation() }, ta,
        h('div', { class: 'rv-quick-row' }, h('span', { class: 'grow' }),
          h('button', { class: 'rh-btn ghost sm', onclick: () => { S.replyTo = null; renderList(); } }, 'Huỷ'),
          h('button', { class: 'rh-btn primary sm', onclick: () => sendReply(c, ta.value, ta) }, 'Gửi')));
    }

    return h('article', {
      class: 'rv-c' + (S.sel === c.id ? ' sel' : '') + (ADMIN && c.done ? ' is-done' : '') + (isEditing ? ' editing' : ''), 'data-id': c.id,
      onclick: () => select(c.id, false)
    },
      h('div', { class: 'rv-c-top' },
        h('span', { class: 'rh-ava' }, initials(c.author)),
        h('div', { class: 'rv-c-who' }, h('b', {}, c.author + (mine(c) ? ' (bạn)' : ''), c.staff ? h('span', { class: 'rv-staff' }, 'Bên dựng') : null), h('span', { class: 'rv-ago' }, ago(c.createdAt) + (c.updatedAt - c.createdAt > 2000 ? ' · đã sửa' : ''))),
        h('span', { class: 'grow' }),
        h('button', { class: 'rv-tc', onclick: (e) => { e.stopPropagation(); select(c.id, false); } }, `#${c.n}` + (c.t != null ? ' · ' + fmtTime(c.t) : ' · chung'))),
      isEditing ? h('p', { class: 'rv-c-text muted' }, 'Đang sửa trên khung hình…') : h('p', { class: 'rv-c-text' }, c.text || '(chỉ có hình vẽ)'),
      actions, repEls, replyBox);
  }

  function renderList() {
    const all = curTops();
    const open = all.filter(c => !c.done).length;
    countEl.replaceChildren(...(ADMIN ? ['Nhận xét ', h('span', { class: 'red' }, String(open)), h('span', { class: 'mute' }, '/' + all.length)] : ['Nhận xét ', h('span', { class: 'mute' }, '(' + all.length + ')')]));
    renderNote();
    Object.entries(tabs).forEach(([k, b]) => b.setAttribute('aria-selected', String(k === S.filter)));
    const items = all.filter(c => S.filter === 'all' || (S.filter === 'open' ? !c.done : c.done));
    listEl.replaceChildren(...(items.length ? items.map(c => commentCard(c)) :
      [h('div', { class: 'rv-empty' }, ADMIN && S.filter === 'open' && all.length ? 'Không còn nhận xét nào chưa xử lý.' : 'Chưa có nhận xét. Bấm vào video để ghim nhận xét đầu tiên.')]));

    // nhận xét của các phiên bản cũ
    oldEl.replaceChildren();
    const olderIdx = versions.map((v, i) => i).filter(i => i !== S.vi && tops().some(c => c.fileId === versions[i].id)).reverse();
    olderIdx.forEach(i => {
      const list = tops().filter(c => c.fileId === versions[i].id).sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9));
      const done = list.filter(c => c.done).length;
      const openK = S.showOld === i;
      oldEl.append(h('button', { class: 'rv-old-btn', 'aria-expanded': String(openK), onclick: () => { S.showOld = openK ? false : i; renderList(); } },
        h('span', { class: 'chev', html: icon('chev', 14) }),
        h('span', { class: 'grow' }, `Nhận xét từ bản v${i + 1} `, h('b', {}, ADMIN ? `· ${done}/${list.length} đã sửa` : `· ${list.length}`))));
      if (openK) oldEl.append(h('div', { class: 'rv-old-list' }, list.map(c => commentCard(c, true))));
    });

    genLabel.textContent = 'Nhận xét chung · ' + fmtTime(video.currentTime);
    renderMarks();
    const af = listEl.querySelector('[data-autofocus]');
    if (af && document.activeElement !== af) { af.focus({ preventScroll: true }); af.setSelectionRange(af.value.length, af.value.length); }
  }

  function renderAll() { renderList(); renderOverlay(); renderMarks(); }

  /* ---------- ghi chú phiên bản ---------- */
  function renderNote() {
    const vLabel = 'v' + (S.vi + 1);
    const n = S.notes[cur().id];
    const text = n ? n.note : '';
    if (!ADMIN) {
      noteEl.hidden = !text;
      if (text) noteEl.replaceChildren(
        h('div', { class: 'rv-note-head' }, h('b', {}, 'Ghi chú ' + vLabel), h('span', { class: 'rv-ago' }, 'từ bên dựng · ' + ago(n.updatedAt))),
        h('p', { class: 'rv-note-text' }, text));
      return;
    }
    noteEl.hidden = false;
    if (S.editNote) {
      if (noteEl.querySelector('textarea')) return;
      const ta = h('textarea', { rows: '3', id: 'rv-note-in', placeholder: 'Bản này đã sửa gì? Ví dụ: đổi nhạc, tăng cỡ chữ, thay ảnh…' });
      ta.value = text;
      const save = async () => {
        try {
          const r = await api.setNote({ token: ctx.token, videoId: ctx.video.id, fileId: cur().id, note: ta.value.trim(), pw });
          S.notes[cur().id] = { note: r.note, updatedAt: r.updatedAt }; S.editNote = false; renderNote(); toast('Đã lưu ghi chú ' + vLabel);
        } catch (err) { toast(err.message, 'err'); }
      };
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } if (e.key === 'Escape') { S.editNote = false; renderNote(); } });
      noteEl.replaceChildren(
        h('label', { for: 'rv-note-in', class: 'rv-note-head' }, h('b', {}, 'Ghi chú ' + vLabel), h('span', { class: 'rv-ago' }, 'khách xem được')),
        ta,
        h('div', { class: 'rv-quick-row' }, h('span', { class: 'grow' }),
          h('button', { class: 'rh-btn ghost sm', onclick: () => { S.editNote = false; renderNote(); } }, 'Huỷ'),
          h('button', { class: 'rh-btn primary sm', onclick: save }, 'Lưu ghi chú')));
      ta.focus();
      return;
    }
    noteEl.replaceChildren(
      h('div', { class: 'rv-note-head' }, h('b', {}, 'Ghi chú ' + vLabel), h('span', { class: 'rv-ago' }, text ? 'khách xem được · ' + ago(n.updatedAt) : 'khách xem được'),
        h('span', { class: 'grow' }),
        h('button', { class: 'link', onclick: () => { S.editNote = true; renderNote(); } }, text ? 'Sửa' : 'Viết ghi chú')),
      text ? h('p', { class: 'rv-note-text' }, text) : h('p', { class: 'rv-note-text muted' }, 'Chưa có ghi chú cho bản này.'));
  }

  /* ---------- tải video ---------- */
  // Tải cả file về máy MỘT lần rồi phát từ bộ nhớ: tua bao nhiêu cũng không gửi thêm yêu cầu lên Drive
  // (tua liên tục kiểu stream làm Google tưởng là truy cập tự động và chặn tạm thời mạng của người xem).
  const blobCache = new Map();   // fileId -> objectURL (trong phiên này)
  let loadCtl = null;
  async function loadVideo(ver) {
    if (loadCtl) loadCtl.abort();
    const url = api.videoUrl(ver);
    if (blobCache.has(ver.id)) { video.src = blobCache.get(ver.id); return; }
    if (!/^https?:/.test(url)) { video.src = url; return; }   // chế độ demo: file cục bộ
    const ctl = loadCtl = new AbortController();
    loading.hidden = false; loading.textContent = 'Đang tải video…';
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const total = Number(res.headers.get('content-length')) || ver.size || 0;
      const reader = res.body.getReader();
      const chunks = []; let got = 0, lastPaint = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        const now = performance.now();
        if (now - lastPaint > 150) {
          lastPaint = now;
          const mb = (got / 1048576).toFixed(1);
          loading.textContent = total ? `Đang tải video ${Math.floor(got / total * 100)}% (${mb} / ${(total / 1048576).toFixed(0)} MB)` : `Đang tải video… ${mb} MB`;
        }
      }
      if (ctl.signal.aborted) return;
      const obj = URL.createObjectURL(new Blob(chunks, { type: ver.mime || 'video/mp4' }));
      blobCache.set(ver.id, obj);
      video.src = obj;
    } catch (err) {
      if (ctl.signal.aborted) return;
      loading.hidden = false;
      loading.textContent = 'Không tải được video. Nếu vừa tua liên tục, Google có thể đang tạm chặn mạng này, đợi vài phút rồi tải lại trang.';
    } finally { if (loadCtl === ctl) loadCtl = null; }
  }

  /* ---------- phiên bản ---------- */
  function switchVersion(i, t = null, selId = null) {
    if (i < 0 || i >= versions.length) return;
    cancelDraft();
    S.vi = i; S.sel = selId; S.showOld = false; S.editNote = false;
    verSeg.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    loading.hidden = false; loading.textContent = 'Đang tải video…';
    const poster = api.thumbUrl(cur());
    if (poster) video.poster = poster; else video.removeAttribute('poster');
    loadVideo(cur());
    if (t != null) video.addEventListener('loadedmetadata', () => seek(t), { once: true });
    ctx.onVersion && ctx.onVersion(i);
    renderAll();
  }

  /* ---------- phím tắt ---------- */
  function onKey(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    if (document.querySelector('.rh-modal')) return;
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.shiftKey ? seek(video.currentTime - 1) : step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.shiftKey ? seek(video.currentTime + 1) : step(1); }
    else if (e.key === 'Escape') { if (S.draft) cancelDraft(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoShape(); }
    else if (!e.ctrlKey && !e.metaKey && !e.altKey && TOOL_KEYS[e.key.toLowerCase()]) setTool(TOOL_KEYS[e.key.toLowerCase()]);
  }
  document.addEventListener('keydown', onKey);
  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  /* ---------- dữ liệu realtime ---------- */
  // Nhận xét của mọi người hiện ngay khi có thay đổi (Firebase), không cần tải lại trang.
  const busyTyping = () => S.draft || S.replyTo != null || S.editReply != null;
  const unwatch = api.watch(ctx.token, ctx.video.id, (list, err) => {
    if (err) { toast('Mất kết nối nhận xét: ' + err.message, 'err'); return; }
    S.comments = list;
    if (S.sel && !list.some(c => c.id === S.sel)) S.sel = null;
    if (!busyTyping()) renderAll(); else { renderMarks(); renderOverlay(); }
  });
  const unwatchNotes = api.watchNotes(ctx.token, (notes, err) => {
    if (err || S.editNote) return;
    S.notes = notes || {}; renderNote();
  });

  renderUser();
  switchVersion(S.vi);

  return {
    destroy() {
      unwatch(); unwatchNotes(); ro.disconnect(); cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize);
      if (loadCtl) loadCtl.abort();
      video.pause(); video.removeAttribute('src'); video.load();
      blobCache.forEach(u => URL.revokeObjectURL(u));
    }
  };
}
