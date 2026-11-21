// Tiện ích dùng chung.

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const svgIcon = (d, size = 18, extra = '') =>
  `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

// Thương hiệu: logo con cáo nỉ + chữ tinhayOD
export function brand(tag = 'span', attrs = {}) {
  return h(tag, { class: 'rh-brand', 'aria-label': 'tinhayOD', ...attrs },
    h('img', { class: 'rh-logo', src: 'assets/felt/logo.png', alt: '', width: '36', height: '36' }),
    h('span', { class: 'rh-brand-t' }, 'tinhay', h('span', {}, 'OD')));
}

export const ICONS = {
  cursor: '<path d="M5 3l14 8-6 2-2 6z"/>',
  pin: '<circle cx="12" cy="9" r="5"/><path d="M12 14v7"/>',
  pen: '<path d="M3 21l4-1 12-12-3-3L4 17z"/>',
  arrow: '<path d="M5 19L19 5M9 5h10v10"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6.5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>',
  prev: '<path d="M15 6l-6 6 6 6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  folder: '<path d="M3 7h6l2 2h10v10H3z"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 010 6"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.5-2"/>',
  compare: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
};
export const icon = (name, size) => svgIcon(ICONS[name] || '', size);

export function fmtTime(sec, digits = 1) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const whole = Math.floor(s);
  if (!digits) return `${m}:${String(whole).padStart(2, '0')}`;
  const f = Math.floor((s - whole) * Math.pow(10, digits) + 1e-6);
  return `${m}:${String(whole).padStart(2, '0')},${String(f).padStart(digits, '0')}`;
}

export function ago(ts) {
  if (!ts) return '';
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'vừa xong';
  if (d < 3600) return `${Math.floor(d / 60)} phút trước`;
  if (d < 86400) return `${Math.floor(d / 3600)} giờ trước`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)} ngày trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  return (parts[parts.length - 1] || '?').charAt(0).toUpperCase();
}

let toastTimer;
export function toast(msg, kind = '') {
  let el = document.querySelector('.rh-toast');
  if (!el) { el = h('div', { class: 'rh-toast', role: 'status', 'aria-live': 'polite' }); document.body.append(el); }
  el.className = 'rh-toast show ' + kind;
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'rh-toast ' + kind; }, 3200);
}

/* ---------- danh tính người xem (lưu trên máy) ---------- */

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } }
};
export { store };

export function me() {
  let uid = store.get('rh-uid');
  if (!uid) { uid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)); store.set('rh-uid', uid); }
  return { uid, name: store.get('rh-name') || '' };
}
export function setName(n) { store.set('rh-name', n.trim()); }
export const adminPw = () => store.get('rh-admin-pw') || '';


/** Hộp hỏi tên (dùng khi đổi tên hoặc trước khi nhận xét). Trả về Promise<string|null>. */
export function askName(current = '', projectName = '', key = 'rh-name') {
  return new Promise(resolve => {
    const input = h('input', { id: 'rh-name-in', value: current, autocomplete: 'name', maxlength: '40' });
    const close = (v) => { wrap.remove(); resolve(v); };
    const submit = (e) => { e.preventDefault(); const v = input.value.trim(); if (!v) { input.focus(); return; } store.set(key, v); close(v); };
    const wrap = h('div', { class: 'rh-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rh-name-title' },
      h('form', { class: 'rh-modal-card', onsubmit: submit },
        projectName ? h('p', { class: 'rh-kicker' }, 'Dự án · ' + projectName) : null,
        h('h2', { id: 'rh-name-title' }, 'Anh chị ', h('mark', {}, 'tên là gì'), ' ạ?'),
        h('p', { class: 'rh-sub' }, 'Tên hiện cạnh mỗi nhận xét để bên dựng biết ai góp ý. Máy này sẽ nhớ tên cho lần sau.'),
        h('label', { for: 'rh-name-in' }, 'Tên của anh chị'),
        input,
        h('div', { class: 'rh-row' },
          current ? h('button', { type: 'button', class: 'rh-btn ghost', onclick: () => close(null) }, 'Huỷ') : null,
          h('button', { type: 'submit', class: 'rh-btn primary' }, 'Lưu tên'))));
    document.body.append(wrap);
    setTimeout(() => input.focus(), 30);
  });
}

/** Hộp xác nhận trong trang (thay cho window.confirm). */
export function confirmDialog(msg, okText = 'Xoá') {
  return new Promise(resolve => {
    const close = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } };
    const ok = h('button', { type: 'button', class: 'rh-btn primary danger', onclick: () => close(true) }, okText);
    const wrap = h('div', { class: 'rh-modal', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': msg, onclick: (e) => { if (e.target === wrap) close(false); } },
      h('div', { class: 'rh-modal-card small' },
        h('p', { class: 'rh-confirm' }, msg),
        h('div', { class: 'rh-row' },
          h('button', { type: 'button', class: 'rh-btn ghost', onclick: () => close(false) }, 'Huỷ'), ok)));
    document.body.append(wrap);
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => ok.focus(), 20);
  });
}

/** Nút chuyển sáng / tối (nhớ lựa chọn trên máy). */
export function themeToggle() {
  const root = document.documentElement;
  const isDark = () => root.dataset.theme === 'dark';
  const btn = h('button', { class: 'rh-theme', type: 'button' });
  const paint = () => {
    btn.innerHTML = icon(isDark() ? 'sun' : 'moon', 18);
    btn.setAttribute('aria-label', isDark() ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
    btn.title = btn.getAttribute('aria-label');
  };
  btn.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    store.set('rh-theme', root.dataset.theme);
    document.querySelectorAll('.rh-theme').forEach(b => b !== btn && b.dispatchEvent(new Event('rh-repaint')));
    paint();
  });
  btn.addEventListener('rh-repaint', paint);
  paint();
  return btn;
}

/* ---------- avatar con vật (vải nỉ) cho người đang xem ---------- */
export const ANIMALS = [
  { id: 'cao', name: 'Cáo' }, { id: 'meo', name: 'Mèo' }, { id: 'gau', name: 'Gấu' }, { id: 'tho', name: 'Thỏ' },
  { id: 'cu', name: 'Cú' }, { id: 'ech', name: 'Ếch' }, { id: 'cho', name: 'Chó' }, { id: 'gautruc', name: 'Gấu trúc' }
];
export function animalOf(uid) {
  let x = 0; for (const ch of String(uid)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return ANIMALS[x % ANIMALS.length];
}
export function animalAvatar(uid) {
  const a = animalOf(uid);
  return h('span', { class: 'rv-ava-felt' }, h('img', { src: 'assets/felt/' + a.id + '.png', alt: a.name, width: '34', height: '34', onerror: (e) => { e.target.replaceWith(document.createTextNode(a.name.charAt(0))); } }));
}


/* ---------- độ phân giải + fps của video ----------
   Trình duyệt không cho biết fps, nên đọc thẳng phần đầu mục lục (moov) của file mp4/mov:
   fps = số khung hình ÷ thời lượng của rãnh hình. Chỉ đọc vài KB, không chép cả file. */
const fpsCache = new Map();
export function videoFps(url) {
  if (!url) return Promise.resolve(null);
  if (!fpsCache.has(url)) fpsCache.set(url, readFps(url).catch(() => null));
  return fpsCache.get(url);
}
async function readFps(url) {
  const b = await (await fetch(url)).blob();
  const tag = (dv, o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  let off = 0;
  for (let guard = 0; off + 8 <= b.size && guard < 64; guard++) {
    const hd = new DataView(await b.slice(off, off + 16).arrayBuffer());
    let size = hd.getUint32(0), hdr = 8; const type = tag(hd, 4);
    if (size === 1) { size = Number(hd.getBigUint64(8)); hdr = 16; } else if (size === 0) size = b.size - off;
    if (size < 8) return null;
    if (type === 'moov') return moovFps(new DataView(await b.slice(off + hdr, off + size).arrayBuffer()));
    off += size;
  }
  return null;
  function kids(dv, a, z, fn) {
    for (let o = a; o + 8 <= z;) { let sz = dv.getUint32(o); const t = tag(dv, o + 4); let h = 8;
      if (sz === 1) { sz = Number(dv.getBigUint64(o + 8)); h = 16; } else if (sz === 0) sz = z - o;
      if (sz < 8) break; fn(t, o + h, o + sz); o += sz; }
  }
  function moovFps(dv) {
    let fps = null;
    kids(dv, 0, dv.byteLength, (t, a, z) => {
      if (t !== 'trak' || fps) return;
      let scale = 0, isVid = false, n = 0, ticks = 0;
      const walk = (a2, z2) => kids(dv, a2, z2, (t2, b2, e2) => {
        if (t2 === 'mdia' || t2 === 'minf' || t2 === 'stbl') walk(b2, e2);
        else if (t2 === 'mdhd') scale = dv.getUint8(b2) === 1 ? dv.getUint32(b2 + 20) : dv.getUint32(b2 + 12);
        else if (t2 === 'hdlr' && tag(dv, b2 + 8) === 'vide') isVid = true;   // mov có thêm hdlr trong minf, đừng ghi đè
        else if (t2 === 'stts') { const cnt = dv.getUint32(b2 + 4); for (let i = 0; i < cnt; i++) { const c = dv.getUint32(b2 + 8 + i * 8), d = dv.getUint32(b2 + 12 + i * 8); n += c; ticks += c * d; } }
      });
      walk(a, z);
      if (isVid && scale && ticks) fps = n * scale / ticks;
    });
    return fps;
  }
}
export function fmtFps(f) {
  if (!f) return '';
  const r = Math.round(f);
  return (Math.abs(f - r) < 0.02 ? String(r) : f.toFixed(2).replace('.', ',')) + ' fps';
}
export function fmtMeta(v, fps) {
  if (!v.videoWidth) return '';
  return `${v.videoWidth} × ${v.videoHeight}` + (fps ? ' · ' + fmtFps(fps) : '');
}
