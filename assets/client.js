// Trang khách: ?p=MÃ_DỰ_ÁN  → danh sách video;  &v=VIDEO&ver=SỐ → màn hình review.
import { api, DEMO } from './api.js';
import { h, icon, ago, initials, toast, me, askName, store, adminPw, themeToggle } from './ui.js';
import { mountReview } from './review.js';

const app = document.getElementById('app');
let current = null;   // màn hình review đang mở
let cache = null;     // dữ liệu dự án
let adminOk = null;   // đã kiểm tra mật khẩu quản lý với máy chủ chưa

async function isAdminMode() {
  if (params().get('admin') !== '1' || !adminPw()) return false;
  if (adminOk === null) { try { await api.checkAdmin(adminPw()); adminOk = true; } catch { adminOk = false; } }
  return adminOk;
}

// Lưu truy vấn trong biến để vẫn chạy khi trình duyệt không cho đổi URL (vd. khung nhúng).
let query = location.search.replace(/^\?/, '');
function params() { return new URLSearchParams(query); }
function setUrl(q, replace) {
  query = q;
  try {
    const url = location.pathname + (q ? '?' + q : '');
    replace ? history.replaceState(null, '', url) : history.pushState(null, '', url);
  } catch { }
}
function go(q, replace = false) { setUrl(q, replace); route(); }
window.addEventListener('popstate', () => { query = location.search.replace(/^\?/, ''); route(); });

async function route() {
  const p = params();
  let token = p.get('p');
  if (!token && DEMO) { go('p=demo', true); return; }
  if (current) { current.destroy(); current = null; }
  if (!token) return renderError('Link chưa đúng', 'Anh chị kiểm tra lại đường link bên dựng gửi nhé.');

  if (!cache || cache.token !== token) {
    app.replaceChildren(h('div', { class: 'rh-center' }, h('div', { class: 'rh-spin' }), 'Đang tải dự án…'));
    try { await api.ready(); const d = await api.project(token); cache = { token, ...d }; }
    catch (err) { return renderError('Không mở được dự án', err.message); }
  }
  document.title = cache.project.name + ' – Review Hub';

  const admin = await isAdminMode();
  if (!me().name && !admin) {
    await welcome();
  }

  const vid = p.get('v');
  const video = vid && cache.videos.find(v => v.id === vid);
  if (video) {
    let ver = Number(p.get('ver'));
    ver = Number.isFinite(ver) && ver >= 1 && ver <= video.versions.length ? ver - 1 : video.versions.length - 1;
    if (ver === video.versions.length - 1) store.set('rh-seen-' + video.id, video.versions[ver].id);
    const isAdmin = admin;
    current = mountReview(app, {
      token, project: cache.project, video, verIndex: ver, isAdmin,
      onBack: () => { cache = null; go(`p=${encodeURIComponent(token)}${isAdmin ? '&admin=1' : ''}`); },
      onVersion: (i) => {
        const q = params(); q.set('ver', String(i + 1));
        setUrl(q.toString(), true);
        if (i === video.versions.length - 1) store.set('rh-seen-' + video.id, video.versions[i].id);
      }
    });
    return;
  }
  renderProject(token, admin);
}

function renderError(title, msg) {
  app.replaceChildren(h('div', { class: 'rh-page' }, header(), h('main', { class: 'rh-main' },
    h('h1', { class: 'rh-h1' }, title), h('p', { class: 'rh-lead' }, msg))));
}

function header(extra) {
  return h('header', { class: 'rh-top' },
    h('span', { class: 'rh-brand' }, 'Review', h('span', {}, 'Hub')),
    cache ? h('span', { class: 'rh-crumb' }, '/ ' + cache.project.name) : null,
    h('span', { class: 'grow' }),
    extra || null,
    themeToggle());
}

function userChip() {
  const n = me().name;
  return h('div', { class: 'rh-userbox' },
    h('span', { class: 'rh-ava' }, initials(n || '?')),
    h('b', {}, n || 'Khách'),
    h('button', { class: 'link', onclick: async () => { if (await askName(n, cache.project.name)) route(); } }, 'Đổi tên'));
}

function welcome() {
  return new Promise(resolve => {
    const input = h('input', { id: 'wel-name', autocomplete: 'name', maxlength: '40', placeholder: 'Ví dụ: Chị Hạnh' });
    const submit = (e) => {
      e.preventDefault();
      const v = input.value.trim(); if (!v) { input.focus(); return; }
      store.set('rh-name', v); resolve();
    };
    const first = cache.videos[0];
    app.replaceChildren(h('div', { class: 'rh-page' }, header(),
      h('main', { class: 'wel' },
        h('div', { class: 'wel-art', 'aria-hidden': 'true' },
          first ? h('div', { class: 'wel-thumb back' }) : null,
          h('div', { class: 'wel-thumb front' }, first && api.thumbUrl(first.versions[first.versions.length - 1]) ? h('img', { src: api.thumbUrl(first.versions[first.versions.length - 1]), alt: '' }) : h('span', {}, cache.project.name))),
        h('form', { class: 'wel-form', onsubmit: submit },
          h('p', { class: 'rh-kicker' }, 'Dự án · ' + cache.project.name),
          h('h1', { class: 'rh-h1' }, 'Chào anh chị,', h('br'), h('mark', {}, 'tên là gì'), ' ạ?'),
          h('p', { class: 'rh-lead' }, 'Tên sẽ hiện cạnh mỗi nhận xét để bên dựng biết ai góp ý.'),
          h('label', { for: 'wel-name', class: 'wel-label' }, 'Tên của anh chị'),
          input,
          h('div', { class: 'rh-row' }, h('button', { class: 'rh-btn primary lg', type: 'submit' }, 'Vào xem video'),
            h('span', { class: 'rh-note' }, 'Máy này sẽ nhớ tên, lần sau không cần nhập lại.'))))));
    setTimeout(() => input.focus(), 30);
  });
}

function renderProject(token, isAdmin) {
  const vids = cache.videos;
  const fresh = vids.filter(v => store.get('rh-seen-' + v.id) !== v.versions[v.versions.length - 1].id && v.versions.length > 1);
  const cards = vids.map(v => {
    const last = v.versions[v.versions.length - 1];
    const isNew = store.get('rh-seen-' + v.id) !== last.id;
    const th = api.thumbUrl(last);
    const q = `p=${encodeURIComponent(token)}&v=${encodeURIComponent(v.id)}${isAdmin ? '&admin=1' : ''}`;
    return h('a', { class: 'vcard', href: '?' + q, onclick: (e) => { e.preventDefault(); go(q); } },
      h('div', { class: 'vcard-thumb' },
        th ? h('img', { src: th, alt: '', loading: 'lazy', onerror: (e) => e.target.remove() }) : null,
        h('span', { class: 'vcard-fallback' }, v.name),
        h('span', { class: 'vcard-ver' + (isNew ? ' new' : '') }, `v${v.versions.length}` + (isNew ? ' · MỚI' : ''))),
      h('div', { class: 'vcard-body' },
        h('h2', {}, v.name),
        h('p', { class: 'rh-note' }, `${v.versions.length} phiên bản · cập nhật ${ago(v.updated)}`),
        h('p', {}, !v.counts.total ? 'Chưa có nhận xét' : isAdmin ? [h('b', { class: v.counts.open ? 'red' : '' }, String(v.counts.open)), ' chưa xử lý / ', String(v.counts.total), ' nhận xét'] : `${v.counts.total} nhận xét`),
        h('span', { class: 'rh-btn ' + (isNew ? 'primary' : 'outline') }, isNew ? `Xem v${v.versions.length}` : 'Xem video')));
  });
  app.replaceChildren(h('div', { class: 'rh-page' + (isAdmin ? ' is-admin' : '') }, header(h('div', { class: 'rh-row' }, isAdmin ? h('a', { class: 'rh-pill light', href: 'admin.html' }, '← QUẢN LÝ') : null, userChip())),
    h('main', { class: 'rh-main' },
      DEMO ? demoBar() : null,
      h('p', { class: 'rh-kicker' }, `${vids.length} video trong dự án`),
      h('h1', { class: 'rh-h1' }, fresh.length ? ['Có ', h('mark', {}, 'bản mới'), ' chờ', h('br'), 'anh chị xem.'] : ['Video ', h('mark', {}, 'cần duyệt'), '.']),
      vids.length ? h('div', { class: 'vgrid' }, cards) : h('p', { class: 'rh-lead' }, 'Dự án chưa có video nào.'))));
}

function demoBar() {
  return h('div', { class: 'demo-bar' }, h('b', {}, 'Chế độ demo'), ' Dữ liệu mẫu, chỉ lưu trên trình duyệt này. ',
    h('a', { href: 'admin.html' }, 'Mở trang quản lý'), ' · ',
    h('button', { class: 'link', onclick: () => { api.reset(); localStorage.removeItem('rh-name'); Object.keys(localStorage).filter(k => k.startsWith('rh-seen-')).forEach(k => localStorage.removeItem(k)); cache = null; route(); } }, 'Xoá dữ liệu demo'));
}

route();
