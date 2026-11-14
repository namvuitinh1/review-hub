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
  chev: '<path d="M9 6l6 6-6 6"/>'
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

export function brand() {
  return h('a', { class: 'rh-brand', href: '#', 'aria-label': 'Review Hub' }, 'Review', h('span', {}, 'Hub'));
}

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
