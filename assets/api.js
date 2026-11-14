// Lớp gọi dữ liệu: Apps Script thật hoặc chế độ demo (localStorage).
const CFG = window.RH_CONFIG || {};
export const DEMO = !CFG.API_URL;

/* ---------------- Apps Script ---------------- */

async function call(action, params = {}, post = false) {
  let res;
  if (post) {
    // text/plain để tránh preflight CORS với Apps Script
    res = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, ...params }) });
  } else {
    const url = new URL(CFG.API_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
    res = await fetch(url);
  }
  if (!res.ok) throw new Error('Máy chủ trả lỗi ' + res.status);
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'Lỗi không rõ');
  return j;
}

/* ---------------- Firebase (nhận xét realtime) ---------------- */

const FB_VER = '10.12.2';
let fbP = null;
function firebase() {
  if (fbP) return fbP;
  fbP = (async () => {
    const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
    const [appM, authM, fs] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
    const app = appM.initializeApp(CFG.FIREBASE);
    const auth = authM.getAuth(app);
    const db = fs.getFirestore(app);
    await new Promise(res => { const un = authM.onAuthStateChanged(auth, () => { un(); res(); }); });
    return { auth, authM, db, fs };
  })();
  return fbP;
}
async function ensureUser() {
  const f = await firebase();
  if (!f.auth.currentUser) await f.authM.signInAnonymously(f.auth);
  const u = f.auth.currentUser;
  try { localStorage.setItem('rh-uid', u.uid); } catch { }
  return u;
}
const isAdminUser = (u) => !!(u && u.email && CFG.ADMIN_EMAIL && u.email.toLowerCase() === CFG.ADMIN_EMAIL.toLowerCase());
const fromDoc = (d) => { const x = d.data(); let shapes = []; try { shapes = JSON.parse(x.shapes || '[]'); } catch { } return { ...x, id: d.id, shapes }; };
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const commentsCol = (f, token) => f.fs.collection(f.db, 'projects', token, 'comments');

function countComments(list) {
  const map = {};
  list.forEach(c => {
    if (c.parentId) return;
    const m = map[c.videoId] || (map[c.videoId] = { open: 0, total: 0, last: null });
    m.total++; if (!c.done) m.open++;
    if (!m.last || c.updatedAt > m.last.at) m.last = { at: c.updatedAt, author: c.author };
  });
  return map;
}

const remote = {
  async ready() { await ensureUser(); },
  async project(token) {
    const [j, f] = await Promise.all([call('project', { token }), ensureUser().then(() => firebase())]);
    const snap = await f.fs.getDocs(commentsCol(f, token));
    const counts = countComments(snap.docs.map(fromDoc));
    j.videos.forEach(v => { v.counts = counts[v.id] || { open: 0, total: 0, last: null }; });
    return j;
  },
  // Theo dõi realtime: gọi cb(list) mỗi khi có thay đổi. Trả về hàm huỷ theo dõi.
  watch(token, videoId, cb) {
    let un = null, dead = false;
    ensureUser().then(firebase).then(f => {
      if (dead) return;
      const q = f.fs.query(commentsCol(f, token), f.fs.where('videoId', '==', videoId));
      un = f.fs.onSnapshot(q, snap => cb(snap.docs.map(fromDoc)), err => cb(null, err));
    }).catch(err => cb(null, err));
    return () => { dead = true; un && un(); };
  },
  watchNotes(token, cb) {
    let un = null, dead = false;
    ensureUser().then(firebase).then(f => {
      if (dead) return;
      un = f.fs.onSnapshot(f.fs.collection(f.db, 'projects', token, 'notes'), snap => {
        const out = {}; snap.docs.forEach(d => { out[d.id] = d.data(); }); cb(out);
      }, err => cb(null, err));
    }).catch(err => cb(null, err));
    return () => { dead = true; un && un(); };
  },
  async addComment(d) {
    const u = await ensureUser(); const f = await firebase(); const now = Date.now();
    const data = { token: d.token, videoId: d.videoId, fileId: d.fileId, parentId: d.parentId || null, n: d.n || 0,
      t: d.t ?? null, x: d.x ?? null, y: d.y ?? null, shapes: JSON.stringify(d.shapes || []), text: d.text || '',
      author: d.author || '', authorId: u.uid, done: false, staff: isAdminUser(u), createdAt: now, updatedAt: now };
    const ref = await f.fs.addDoc(commentsCol(f, d.token), data);
    return { ...data, id: ref.id, shapes: d.shapes || [] };
  },
  async editComment(d) {
    await ensureUser(); const f = await firebase();
    const upd = clean({ text: d.text, shapes: d.shapes === undefined ? undefined : JSON.stringify(d.shapes), x: d.x, y: d.y, updatedAt: Date.now() });
    const ref = f.fs.doc(f.db, 'projects', d.token, 'comments', d.id);
    await f.fs.updateDoc(ref, upd);
    return fromDoc(await f.fs.getDoc(ref));
  },
  async deleteComment(d) {
    await ensureUser(); const f = await firebase();
    await f.fs.deleteDoc(f.fs.doc(f.db, 'projects', d.token, 'comments', d.id));
    return { deleted: d.id };
  },
  async setDone(d) {
    const f = await firebase(); const ref = f.fs.doc(f.db, 'projects', d.token, 'comments', d.id);
    await f.fs.updateDoc(ref, { done: !!d.done, updatedAt: Date.now() });
    return fromDoc(await f.fs.getDoc(ref));
  },
  async setNote(d) {
    const f = await firebase(); const n = { note: String(d.note || ''), updatedAt: Date.now() };
    await f.fs.setDoc(f.fs.doc(f.db, 'projects', d.token, 'notes', d.fileId), n);
    return { fileId: d.fileId, ...n };
  },
  async adminLogin(email, pw) {
    const f = await firebase();
    await f.authM.signInWithEmailAndPassword(f.auth, email, pw);
    try { localStorage.setItem('rh-uid', f.auth.currentUser.uid); } catch { }
  },
  async adminLogout() { const f = await firebase(); await f.authM.signOut(f.auth); },
  async checkAdmin(pw) {
    const f = await firebase();
    if (!isAdminUser(f.auth.currentUser)) throw new Error('Chưa đăng nhập tài khoản quản lý');
    await call('checkAdmin', { pw }); return true;
  },
  async admin(pw) {
    const f = await firebase();
    if (!isAdminUser(f.auth.currentUser)) throw new Error('Chưa đăng nhập tài khoản quản lý');
    const [projects, snap] = await Promise.all([call('admin', { pw }).then(j => j.projects), f.fs.getDocs(f.fs.collectionGroup(f.db, 'comments'))]);
    const all = snap.docs.map(fromDoc);
    projects.forEach(p => {
      const counts = countComments(all.filter(c => c.token === p.token));
      p.videos.forEach(v => { v.counts = counts[v.id] || { open: 0, total: 0, last: null }; });
    });
    return projects;
  },
  // Báo "tôi đang xem video này" mỗi 25 giây và theo dõi những ai đang xem cùng. Trả về hàm dừng.
  presence(token, videoId, info, cb) {
    let un = null, timer = null, dead = false, ref = null, f = null;
    const beat = () => f && ref && f.fs.setDoc(ref, { videoId, name: info().name || '', admin: !!info().admin, at: Date.now() }).catch(() => { });
    ensureUser().then(async (u) => {
      f = await firebase(); if (dead) return;
      ref = f.fs.doc(f.db, 'projects', token, 'presence', u.uid);
      beat(); timer = setInterval(() => { if (document.visibilityState === 'visible') beat(); }, 25000);
      const q = f.fs.query(f.fs.collection(f.db, 'projects', token, 'presence'), f.fs.where('videoId', '==', videoId));
      un = f.fs.onSnapshot(q, snap => cb(snap.docs.map(d => ({ uid: d.id, ...d.data() }))), () => { });
    }).catch(() => { });
    const bye = () => { if (f && ref) f.fs.deleteDoc(ref).catch(() => { }); };
    window.addEventListener('pagehide', bye);
    return () => { dead = true; clearInterval(timer); un && un(); bye(); window.removeEventListener('pagehide', bye); };
  },
  videoUrl(v) { return `https://www.googleapis.com/drive/v3/files/${v.id}?alt=media&key=${CFG.DRIVE_API_KEY}`; },
  thumbUrl(v) { return `https://drive.google.com/thumbnail?id=${v.id}&sz=w480`; }
};

/* ---------------- Demo ---------------- */

const DKEY = 'rh-demo-v2';
const day = 86400000;

function seed() {
  const now = Date.now();
  const projects = [
    {
      token: 'demo', name: 'NOEL Parquet', videos: [
        {
          id: 'vid-gt', name: 'Giới thiệu sàn gỗ', versions: [
            { id: 'v1', name: 'gioi-thieu-v1.mp4', src: 'demo/gioi-thieu-v1.mp4', thumb: 'demo/gioi-thieu-v1.jpg', created: now - 2 * day },
            { id: 'v2', name: 'gioi-thieu-v2.mp4', src: 'demo/gioi-thieu-v2.mp4', thumb: 'demo/gioi-thieu-v2.jpg', created: now - 3600000 }
          ]
        },
        {
          id: 'vid-teaser', name: 'Teaser 15 giây', versions: [
            { id: 't1', name: 'teaser.mp4', src: 'demo/teaser-v1.mp4', thumb: 'demo/teaser-v1.jpg', created: now - day }
          ]
        }
      ]
    },
    {
      token: 'demo2', name: 'Tin Hay Nhà Đất', videos: [
        {
          id: 'vid-coc', name: 'Bẫy tiền cọc', versions: [
            { id: 'c1', name: 'bay-tien-coc.mp4', src: 'demo/teaser-v1.mp4', thumb: 'demo/teaser-v1.jpg', created: now - 5 * day }
          ]
        }
      ]
    }
  ];
  const mk = (o) => ({ id: Math.random().toString(36).slice(2), parentId: null, shapes: [], done: false, createdAt: now - 7200000, updatedAt: now - 7200000, deleted: false, ...o });
  const comments = [
    mk({ token: 'demo', videoId: 'vid-gt', fileId: 'v1', n: 1, t: 1.2, x: 0.5, y: 0.2, text: 'Logo xuất hiện hơi muộn, cho lên ngay giây đầu.', author: 'Chị Hạnh', authorId: 'demo-hanh', done: true }),
    mk({ token: 'demo', videoId: 'vid-gt', fileId: 'v1', n: 2, t: 4.5, x: 0.52, y: 0.48, text: 'Chữ to thêm chút, xem trên điện thoại hơi nhỏ.', author: 'Anh Tuấn', authorId: 'demo-tuan', done: true }),
    mk({ token: 'demo', videoId: 'vid-gt', fileId: 'v2', n: 1, t: 3.0, x: 0.3, y: 0.7, text: 'Đổi màu khối này sang tông gỗ sồi trắng.', author: 'Chị Hạnh', authorId: 'demo-hanh',
      shapes: [{ type: 'ellipse', color: '#FFD43B', w: 4, pts: [[0.12, 0.6], [0.5, 0.8]] }] }),
    mk({ token: 'demo', videoId: 'vid-gt', fileId: 'v2', n: 2, t: 7.4, x: 0.7, y: 0.35, text: 'Nhạc nền đoạn này lớn quá, lấn giọng đọc.', author: 'Anh Tuấn', authorId: 'demo-tuan' })
  ];
  comments.push(mk({ token: 'demo', videoId: 'vid-gt', fileId: 'v2', parentId: comments[3].id, text: 'Đã giảm 4 dB, anh xem lại giúp em.', author: 'Nam', authorId: 'demo-nam', staff: true, createdAt: now - 3000000, updatedAt: now - 3000000 }));
  const notes = { 'demo|v2': { note: 'Bản v2: đổi chữ tiêu đề to hơn, thay khối màu theo góp ý của chị Hạnh, giảm nhạc nền 4 dB.', updatedAt: now - 3600000 } };
  return { projects, comments, notes };
}

function load() {
  try { const s = JSON.parse(localStorage.getItem(DKEY)); if (s && s.projects) return s; } catch { }
  const s = seed(); save(s); return s;
}
function save(s) { try { localStorage.setItem(DKEY, JSON.stringify(s)); } catch { } setTimeout(() => typeof notify === 'function' && notify(), 0); }
const wait = (ms = 150) => new Promise(r => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));

function counts(db, token) {
  const map = {};
  db.comments.filter(c => c.token === token && !c.deleted && !c.parentId).forEach(c => {
    const m = map[c.videoId] || (map[c.videoId] = { open: 0, total: 0, last: null });
    m.total++; if (!c.done) m.open++;
    if (!m.last || c.updatedAt > m.last.at) m.last = { at: c.updatedAt, author: c.author };
  });
  return map;
}
function withMeta(db, p) {
  const cnt = counts(db, p.token);
  const videos = clone(p.videos).map(v => ({ ...v, updated: v.versions[v.versions.length - 1].created, counts: cnt[v.id] || { open: 0, total: 0, last: null } }));
  videos.sort((a, b) => b.updated - a.updated);
  return videos;
}
function find(db, d) {
  const c = db.comments.find(x => x.id === d.id && x.token === d.token && !x.deleted);
  if (!c) throw new Error('Không tìm thấy nhận xét');
  return c;
}
const isAdminPw = (pw) => !!pw;

const listeners = new Set();
function notify() { const db = load(); listeners.forEach(l => l(db)); }

const demo = {
  async ready() { },
  watch(token, videoId, cb) {
    const l = (db) => cb(clone(db.comments.filter(c => c.token === token && c.videoId === videoId && !c.deleted)));
    listeners.add(l); setTimeout(() => l(load()), 60);
    return () => listeners.delete(l);
  },
  watchNotes(token, cb) {
    const l = (db) => { const out = {}; Object.entries(db.notes || {}).forEach(([k, v]) => { const [t, f] = k.split('|'); if (t === token) out[f] = v; }); cb(out); };
    listeners.add(l); setTimeout(() => l(load()), 60);
    return () => listeners.delete(l);
  },
  async adminLogin() { },
  async adminLogout() { },
  presence(token, videoId, info, cb) {
    const now = Date.now();
    const fake = token === 'demo' ? [{ uid: 'demo-hanh', name: 'Chị Hạnh', at: now }, { uid: 'demo-anon', name: '', at: now }] : [];
    const t = setTimeout(() => cb([{ uid: localStorage.getItem('rh-uid') || 'me', name: info().name, admin: !!info().admin, at: Date.now() }, ...fake]), 300);
    return () => clearTimeout(t);
  },
  async project(token) {
    await wait(); const db = load();
    const p = db.projects.find(x => x.token === token);
    if (!p) throw new Error('Link không đúng hoặc dự án đã bị xoá');
    return { project: { name: p.name, token: p.token }, videos: withMeta(db, p) };
  },
  async comments(token, videoId) {
    await wait(80); const db = load();
    const p = db.projects.find(x => x.token === token); const v = p && p.videos.find(x => x.id === videoId);
    const notes = {};
    (v ? v.versions : []).forEach(ver => { const n = (db.notes || {})[token + '|' + ver.id]; if (n) notes[ver.id] = n; });
    return { comments: clone(db.comments.filter(c => c.token === token && c.videoId === videoId && !c.deleted)), notes };
  },
  async setNote(d) {
    await wait(); if (!isAdminPw(d.pw)) throw new Error('Sai mật khẩu quản lý');
    const db = load(); db.notes = db.notes || {};
    const n = { note: String(d.note || ''), updatedAt: Date.now() };
    db.notes[d.token + '|' + d.fileId] = n; save(db); return { fileId: d.fileId, ...n };
  },
  async checkAdmin(pw) { await wait(50); if (!isAdminPw(pw)) throw new Error('Sai mật khẩu quản lý'); return true; },
  async addComment(d) {
    await wait(); const db = load(); let n = 0;
    if (!d.parentId) { db.comments.forEach(c => { if (c.token === d.token && c.fileId === d.fileId && !c.parentId) n = Math.max(n, c.n || 0); }); n++; }
    if (d.n) n = Math.max(n, d.n);
    const now = Date.now();
    const c = { id: Math.random().toString(36).slice(2), token: d.token, videoId: d.videoId, fileId: d.fileId, parentId: d.parentId || null, n, t: d.t ?? null, x: d.x ?? null, y: d.y ?? null, shapes: d.shapes || [], text: d.text || '', author: d.author, authorId: d.authorId, done: false, createdAt: now, updatedAt: now, deleted: false, staff: isAdminPw(d.pw) };
    db.comments.push(c); save(db); return clone(c);
  },
  async editComment(d) {
    await wait(); const db = load(); const c = find(db, d);
    if (c.authorId !== d.authorId && !isAdminPw(d.pw)) throw new Error('Chỉ người viết mới sửa được nhận xét này');
    ['text', 'shapes', 'x', 'y', 't'].forEach(k => { if (d[k] !== undefined) c[k] = d[k]; });
    c.updatedAt = Date.now(); save(db); return clone(c);
  },
  async deleteComment(d) {
    await wait(); const db = load(); const c = find(db, d);
    if (c.authorId !== d.authorId && !isAdminPw(d.pw)) throw new Error('Chỉ người viết mới xoá được nhận xét này');
    c.deleted = true; save(db); return { deleted: d.id };
  },
  async setDone(d) {
    await wait(); if (!isAdminPw(d.pw)) throw new Error('Chỉ bên dựng mới đánh dấu đã sửa');
    const db = load(); const c = find(db, d);
    c.done = !!d.done; c.updatedAt = Date.now(); save(db); return clone(c);
  },
  async admin(pw) {
    await wait(); if (!pw) throw new Error('Sai mật khẩu quản lý');
    const db = load();
    return db.projects.map(p => ({ name: p.name, token: p.token, videos: withMeta(db, p) }));
  },
  videoUrl(v) { return new URL(v.src, location.href).href; },
  thumbUrl(v) { return v.thumb || ''; },
  reset() { localStorage.removeItem(DKEY); localStorage.removeItem('rh-demo-v1'); }
};

export const api = DEMO ? demo : remote;
export const cfg = CFG;
