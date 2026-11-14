// Trang quản lý: chỉ người có mật khẩu.
import { api, DEMO } from './api.js';
import { h, icon, ago, toast, store } from './ui.js';

const app = document.getElementById('app');
const base = location.href.replace(/admin\.html.*$/, '').replace(/[?#].*$/, '');
const clientLink = (token) => base + '?p=' + encodeURIComponent(token);
let filter = 'all';
let data = null;
const collapsed = new Set(JSON.parse(store.get('rh-collapsed') || '[]'));

function header(right) {
  return h('header', { class: 'rh-top' },
    h('span', { class: 'rh-brand' }, 'Review', h('span', {}, 'Hub')),
    h('span', { class: 'rh-pill dark' }, 'QUẢN LÝ'),
    h('span', { class: 'rh-note rh-hide-sm', html: icon('folder', 15) + ' Drive / thư mục mẹ' }),
    h('span', { class: 'grow' }), right || null);
}

function login(msg) {
  const input = h('input', { id: 'pw', type: 'password', autocomplete: 'current-password' });
  const nameIn = h('input', { id: 'adname', autocomplete: 'name', value: store.get('rh-admin-name') || 'Nam' });
  app.replaceChildren(h('div', { class: 'rh-page' }, header(),
    h('main', { class: 'rh-main narrow' },
      h('h1', { class: 'rh-h1' }, 'Trang ', h('mark', {}, 'quản lý')),
      h('form', { class: 'login', onsubmit: (e) => { e.preventDefault(); store.set('rh-admin-pw', input.value); store.set('rh-admin-name', nameIn.value.trim() || 'Bên dựng'); load(); } },
        msg ? h('p', { class: 'err' }, msg) : null,
        DEMO ? h('p', { class: 'rh-note' }, 'Chế độ demo: gõ mật khẩu bất kỳ.') : null,
        h('label', { for: 'adname' }, 'Tên hiển thị khi trả lời khách'), nameIn,
        h('label', { for: 'pw' }, 'Mật khẩu'), input,
        h('button', { class: 'rh-btn primary', type: 'submit' }, 'Vào')))));
  setTimeout(() => input.focus(), 30);
}

async function load() {
  const pw = store.get('rh-admin-pw');
  if (!pw) return login();
  app.replaceChildren(h('div', { class: 'rh-center' }, h('div', { class: 'rh-spin' }), 'Đang đọc thư mục Drive…'));
  try { data = await api.admin(pw); render(); }
  catch (err) { store.del('rh-admin-pw'); login(err.message); }
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Đã copy link khách'); }
  catch { toast('Link khách: ' + text); }
}

function render() {
  const totalVideos = data.reduce((s, p) => s + p.videos.length, 0);
  const totalVers = data.reduce((s, p) => s + p.videos.reduce((a, v) => a + v.versions.length, 0), 0);
  const projects = data.filter(p => {
    const open = p.videos.reduce((s, v) => s + v.counts.open, 0);
    if (filter === 'open') return open > 0;
    if (filter === 'clean') return open === 0;
    return true;
  });
  const filt = (id, txt) => h('button', { class: 'rh-chip', 'aria-pressed': String(filter === id), onclick: () => { filter = id; render(); } }, txt);

  app.replaceChildren(h('div', { class: 'rh-page' },
    header(h('div', { class: 'rh-row' },
      h('button', { class: 'rh-btn outline', onclick: load }, 'Đồng bộ lại'),
      h('button', { class: 'link', onclick: () => { store.del('rh-admin-pw'); login(); } }, 'Đăng xuất'))),
    h('main', { class: 'rh-main wide' },
      h('div', { class: 'ad-hero' },
        h('div', {},
          h('p', { class: 'rh-kicker' }, `${data.length} dự án · ${totalVideos} video · ${totalVers} phiên bản`),
          h('h1', { class: 'rh-h1' }, 'Tất cả ', h('mark', {}, 'dự án'))),
        h('div', { class: 'rh-row wrap' }, filt('all', 'Tất cả'), filt('open', 'Có nhận xét chưa xử lý'), filt('clean', 'Đã xử lý hết'))),
      projects.length ? projects.map(projectBlock) : h('p', { class: 'rh-lead' }, 'Không có dự án nào. Tạo thư mục con trong thư mục mẹ trên Drive rồi bấm "Đồng bộ lại".'))));
}

function projectBlock(p) {
  const open = p.videos.reduce((s, v) => s + v.counts.open, 0);
  const isCol = collapsed.has(p.token);
  const toggle = () => { isCol ? collapsed.delete(p.token) : collapsed.add(p.token); store.set('rh-collapsed', JSON.stringify([...collapsed])); render(); };
  const link = clientLink(p.token);
  return h('section', { class: 'ad-proj' + (isCol ? ' col' : '') },
    h('div', { class: 'ad-proj-head' },
      h('button', { class: 'ad-proj-name', 'aria-expanded': String(!isCol), onclick: toggle },
        h('span', { class: 'chev', html: icon('chev', 18) }), h('h2', {}, p.name)),
      open ? h('span', { class: 'rh-pill red' }, `${open} chưa xử lý`) : h('span', { class: 'rh-pill' }, p.videos.length ? 'Đã xử lý hết' : 'Chưa có video'),
      h('span', { class: 'grow' }),
      h('span', { class: 'rh-note rh-hide-sm' }, 'Link khách: …?p=', h('b', {}, p.token)),
      h('button', { class: 'rh-btn primary', onclick: () => copy(link), html: icon('copy', 15) + ' Copy link khách' }),
      h('a', { class: 'rh-btn outline', href: link, target: '_blank', rel: 'noopener' }, 'Xem như khách')),
    isCol ? null : h('div', { class: 'ad-rows' }, p.videos.map(v => videoRow(p, v))));
}

function videoRow(p, v) {
  const last = v.versions[v.versions.length - 1];
  const th = api.thumbUrl(last);
  const open = (i) => `index.html?p=${encodeURIComponent(p.token)}&v=${encodeURIComponent(v.id)}&ver=${i + 1}&admin=1`;
  return h('div', { class: 'ad-row' },
    h('div', { class: 'ad-thumb' }, th ? h('img', { src: th, alt: '', loading: 'lazy', onerror: (e) => e.target.remove() }) : null),
    h('div', { class: 'ad-name' },
      h('a', { href: open(v.versions.length - 1) }, v.name),
      h('span', { class: 'rh-note' }, 'Thư mục: ' + p.name + ' / ' + (v.id.startsWith('file:') ? last.name : v.name))),
    h('div', { class: 'ad-vers', 'aria-label': 'Phiên bản' },
      v.versions.map((ver, i) => h('a', { class: 'ad-ver' + (i === v.versions.length - 1 ? ' last' : ''), href: open(i), title: ver.name + ' · ' + ago(ver.created) },
        `v${i + 1}` + (i === v.versions.length - 1 && v.versions.length > 1 ? ' · mới' : '')))),
    h('div', { class: 'ad-count' }, v.counts.total ? [h('b', { class: v.counts.open ? 'red' : '' }, String(v.counts.open)), ' chưa xử lý ', h('span', { class: 'mute' }, '/ ' + v.counts.total)] : h('span', { class: 'mute' }, 'Chưa có nhận xét')),
    h('div', { class: 'ad-last rh-note' }, v.counts.last ? `${v.counts.last.author} · ${ago(v.counts.last.at)}` : 'Tải lên ' + ago(last.created)),
    h('a', { class: 'rh-btn dark', href: open(v.versions.length - 1) }, 'Mở'));
}

load();
