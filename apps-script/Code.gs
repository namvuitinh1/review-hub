/**
 * Review Hub – backend Google Apps Script
 * -----------------------------------------------------------
 * Gắn script này vào 1 Google Sheet (Tiện ích mở rộng → Apps Script).
 * Script Properties cần có:
 *   ROOT_FOLDER_ID  – ID thư mục mẹ trên Drive (mỗi thư mục con = 1 dự án)
 *   ADMIN_PASSWORD  – mật khẩu trang quản lý
 *
 * Cấu trúc Drive:
 *   Thư mục mẹ / Dự án / Video / (các file video = các phiên bản, cũ → mới)
 *   File video nằm thẳng trong thư mục dự án cũng được tính là 1 video 1 phiên bản.
 */

const PROPS = PropertiesService.getScriptProperties();
const COMMENT_COLS = ['id', 'token', 'videoId', 'fileId', 'parentId', 'n', 't', 'x', 'y',
  'shapes', 'text', 'author', 'authorId', 'done', 'createdAt', 'updatedAt', 'deleted', 'staff'];
const NOTE_COLS = ['token', 'fileId', 'note', 'updatedAt'];
const PROJECT_COLS = ['folderId', 'token', 'name', 'createdAt'];

/* ---------------- HTTP ---------------- */

function doGet(e) { return handle_(e && e.parameter ? e.parameter : {}); }

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) { }
  return handle_(body);
}

function handle_(p) {
  let res;
  try {
    res = Object.assign({ ok: true }, route_(p));
  } catch (err) {
    res = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function route_(p) {
  switch (p.action) {
    case 'project': return getProject_(p.token);
    case 'comments': return { comments: listComments_(p.token, p.videoId), notes: listNotes_(p.token, p.videoId) };
    case 'setNote': checkAdmin_(p.pw); return { note: setNote_(p) };
    case 'checkAdmin': checkAdmin_(p.pw); return { admin: true };
    case 'addComment': return { comment: addComment_(p) };
    case 'editComment': return { comment: editComment_(p) };
    case 'deleteComment': return deleteComment_(p);
    case 'setDone': return { comment: setDone_(p) };
    case 'admin': checkAdmin_(p.pw); return { projects: adminOverview_() };
    case 'ping': return { pong: true };
    default: throw new Error('Không rõ thao tác: ' + p.action);
  }
}

/* ---------------- Quyền ---------------- */

function isAdmin_(pw) {
  const real = PROPS.getProperty('ADMIN_PASSWORD');
  return !!real && !!pw && String(pw) === String(real);
}
function checkAdmin_(pw) { if (!isAdmin_(pw)) throw new Error('Sai mật khẩu quản lý'); }

/* ---------------- Sheet helpers ---------------- */

function sheet_(name, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < cols.length) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
  }
  return sh;
}

function readRows_(sh, cols) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, cols.length).getValues();
  return vals.map((r, i) => {
    const o = { _row: i + 2 };
    cols.forEach((c, j) => { o[c] = r[j]; });
    return o;
  });
}

function rowValues_(o, cols) { return cols.map(c => (o[c] === undefined || o[c] === null) ? '' : o[c]); }

function randomToken_(len) {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

/* ---------------- Drive ---------------- */

function rootFolder_() {
  const id = PROPS.getProperty('ROOT_FOLDER_ID');
  if (!id) throw new Error('Chưa đặt ROOT_FOLDER_ID trong Script Properties');
  return DriveApp.getFolderById(id);
}

function ensurePublic_(file) {
  try {
    if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK &&
        file.getSharingAccess() !== DriveApp.Access.ANYONE) {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
  } catch (err) { /* tài khoản không cho đổi chia sẻ: bỏ qua, người dùng tự chia sẻ thư mục mẹ */ }
}

function isVideo_(file) {
  const m = file.getMimeType() || '';
  return m.indexOf('video/') === 0 || /\.(mp4|mov|m4v|webm)$/i.test(file.getName());
}

function fileInfo_(f) {
  ensurePublic_(f);
  return { id: f.getId(), name: f.getName(), created: f.getDateCreated().getTime(), size: f.getSize(), mime: f.getMimeType() };
}

/** Danh sách video của 1 thư mục dự án (có cache 30 giây). */
function listVideos_(projectFolderId) {
  const cache = CacheService.getScriptCache();
  const key = 'videos_' + projectFolderId;
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  const folder = DriveApp.getFolderById(projectFolderId);
  const videos = [];
  const subs = folder.getFolders();
  while (subs.hasNext()) {
    const vf = subs.next();
    const versions = [];
    const files = vf.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      if (isVideo_(f)) versions.push(fileInfo_(f));
    }
    if (!versions.length) continue;
    versions.sort((a, b) => a.created - b.created);
    videos.push({ id: vf.getId(), name: vf.getName(), versions: versions, updated: versions[versions.length - 1].created });
  }
  const loose = folder.getFiles();
  while (loose.hasNext()) {
    const f = loose.next();
    if (!isVideo_(f)) continue;
    const info = fileInfo_(f);
    videos.push({ id: 'file:' + info.id, name: info.name.replace(/\.[^.]+$/, ''), versions: [info], updated: info.created });
  }
  videos.sort((a, b) => b.updated - a.updated);
  cache.put(key, JSON.stringify(videos), 30);
  return videos;
}

/** Đồng bộ danh sách dự án (thư mục con của thư mục mẹ) với sheet Projects, tạo token cho dự án mới. */
function syncProjects_() {
  const sh = sheet_('Projects', PROJECT_COLS);
  const rows = readRows_(sh, PROJECT_COLS);
  const byFolder = {};
  rows.forEach(r => { byFolder[r.folderId] = r; });
  const out = [];
  const it = rootFolder_().getFolders();
  while (it.hasNext()) {
    const f = it.next();
    let r = byFolder[f.getId()];
    if (!r) {
      r = { folderId: f.getId(), token: randomToken_(8), name: f.getName(), createdAt: Date.now() };
      sh.appendRow(rowValues_(r, PROJECT_COLS));
    } else if (r.name !== f.getName()) {
      sh.getRange(r._row, 3).setValue(f.getName());
      r.name = f.getName();
    }
    out.push(r);
  }
  return out;
}

function projectByToken_(token) {
  if (!token) throw new Error('Thiếu mã dự án');
  const rows = readRows_(sheet_('Projects', PROJECT_COLS), PROJECT_COLS);
  let r = rows.filter(x => x.token === token)[0];
  if (!r) {
    // dự án vừa tạo trên Drive nhưng chưa đồng bộ
    r = syncProjects_().filter(x => x.token === token)[0];
  }
  if (!r) throw new Error('Link không đúng hoặc dự án đã bị xoá');
  return r;
}

/* ---------------- Nhận xét ---------------- */

function commentRows_() { return readRows_(sheet_('Comments', COMMENT_COLS), COMMENT_COLS); }

function publicComment_(r) {
  let shapes = [];
  try { shapes = r.shapes ? JSON.parse(r.shapes) : []; } catch (e) { }
  return {
    id: r.id, videoId: r.videoId, fileId: r.fileId, parentId: r.parentId || null,
    n: Number(r.n) || 0, t: r.t === '' ? null : Number(r.t),
    x: r.x === '' ? null : Number(r.x), y: r.y === '' ? null : Number(r.y),
    shapes: shapes, text: String(r.text || ''), author: String(r.author || ''), authorId: String(r.authorId || ''),
    done: r.done === true || r.done === 'TRUE', createdAt: Number(r.createdAt) || 0, updatedAt: Number(r.updatedAt) || 0,
    staff: r.staff === true || r.staff === 'TRUE'
  };
}

function videoBelongs_(project, videoId) {
  return listVideos_(project.folderId).some(v => v.id === videoId);
}

function listComments_(token, videoId) {
  projectByToken_(token);
  return commentRows_()
    .filter(r => r.token === token && r.videoId === videoId && !(r.deleted === true || r.deleted === 'TRUE'))
    .map(publicComment_);
}

function cleanText_(s, max) { return String(s || '').slice(0, max || 4000); }
function cleanShapes_(shapes) {
  if (!Array.isArray(shapes)) return '[]';
  const s = JSON.stringify(shapes.slice(0, 60));
  if (s.length > 45000) throw new Error('Hình vẽ quá lớn');
  return s;
}

function addComment_(p) {
  const project = projectByToken_(p.token);
  if (!videoBelongs_(project, p.videoId)) throw new Error('Video không thuộc dự án này');
  if (!p.authorId) throw new Error('Thiếu mã người dùng');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_('Comments', COMMENT_COLS);
    let n = 0;
    if (!p.parentId) {
      commentRows_().forEach(r => {
        if (r.token === p.token && r.fileId === p.fileId && !r.parentId) n = Math.max(n, Number(r.n) || 0);
      });
      n += 1;
    }
    const now = Date.now();
    const r = {
      id: Utilities.getUuid(), token: p.token, videoId: p.videoId, fileId: p.fileId, parentId: p.parentId || '',
      n: n, t: p.t == null ? '' : Number(p.t), x: p.x == null ? '' : Number(p.x), y: p.y == null ? '' : Number(p.y),
      shapes: cleanShapes_(p.shapes), text: cleanText_(p.text), author: cleanText_(p.author, 60), authorId: String(p.authorId),
      done: false, createdAt: now, updatedAt: now, deleted: false, staff: isAdmin_(p.pw)
    };
    sh.appendRow(rowValues_(r, COMMENT_COLS));
    return publicComment_(r);
  } finally { lock.releaseLock(); }
}

function findComment_(token, id) {
  const r = commentRows_().filter(x => x.token === token && x.id === id)[0];
  if (!r || r.deleted === true || r.deleted === 'TRUE') throw new Error('Không tìm thấy nhận xét');
  return r;
}

function writeRow_(r) {
  sheet_('Comments', COMMENT_COLS).getRange(r._row, 1, 1, COMMENT_COLS.length).setValues([rowValues_(r, COMMENT_COLS)]);
}

function editComment_(p) {
  projectByToken_(p.token);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const r = findComment_(p.token, p.id);
    if (String(r.authorId) !== String(p.authorId) && !isAdmin_(p.pw)) throw new Error('Chỉ người viết mới sửa được nhận xét này');
    if (p.text !== undefined) r.text = cleanText_(p.text);
    if (p.shapes !== undefined) r.shapes = cleanShapes_(p.shapes);
    if (p.x !== undefined) r.x = p.x == null ? '' : Number(p.x);
    if (p.y !== undefined) r.y = p.y == null ? '' : Number(p.y);
    if (p.t !== undefined && p.t !== null) r.t = Number(p.t);
    r.updatedAt = Date.now();
    writeRow_(r);
    return publicComment_(r);
  } finally { lock.releaseLock(); }
}

function deleteComment_(p) {
  projectByToken_(p.token);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const r = findComment_(p.token, p.id);
    if (String(r.authorId) !== String(p.authorId) && !isAdmin_(p.pw)) throw new Error('Chỉ người viết mới xoá được nhận xét này');
    r.deleted = true; r.updatedAt = Date.now();
    writeRow_(r);
    return { deleted: p.id };
  } finally { lock.releaseLock(); }
}

function setDone_(p) {
  projectByToken_(p.token);
  checkAdmin_(p.pw);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const r = findComment_(p.token, p.id);
    r.done = !!p.done; r.updatedAt = Date.now();
    writeRow_(r);
    return publicComment_(r);
  } finally { lock.releaseLock(); }
}

/* ---------------- Ghi chú phiên bản ---------------- */

function listNotes_(token, videoId) {
  const project = projectByToken_(token);
  const video = listVideos_(project.folderId).filter(v => v.id === videoId)[0];
  if (!video) return {};
  const ids = {};
  video.versions.forEach(v => { ids[v.id] = true; });
  const out = {};
  readRows_(sheet_('Notes', NOTE_COLS), NOTE_COLS).forEach(r => {
    if (r.token === token && ids[r.fileId]) out[r.fileId] = { note: String(r.note || ''), updatedAt: Number(r.updatedAt) || 0 };
  });
  return out;
}

function setNote_(p) {
  const project = projectByToken_(p.token);
  if (!videoBelongs_(project, p.videoId)) throw new Error('Video không thuộc dự án này');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_('Notes', NOTE_COLS);
    const rows = readRows_(sh, NOTE_COLS);
    const r = rows.filter(x => x.token === p.token && x.fileId === p.fileId)[0];
    const now = Date.now();
    const note = cleanText_(p.note, 6000);
    if (r) sh.getRange(r._row, 3, 1, 2).setValues([[note, now]]);
    else sh.appendRow([p.token, p.fileId, note, now]);
    return { fileId: p.fileId, note: note, updatedAt: now };
  } finally { lock.releaseLock(); }
}

/* ---------------- Dữ liệu cho trang ---------------- */

function countsFor_(comments) {
  const map = {};
  comments.forEach(c => {
    const m = map[c.videoId] || (map[c.videoId] = { open: 0, total: 0, last: null });
    if (c.parentId) return;
    m.total++;
    if (!c.done) m.open++;
    if (!m.last || c.updatedAt > m.last.at) m.last = { at: c.updatedAt, author: c.author };
  });
  return map;
}

function getProject_(token) {
  const project = projectByToken_(token);
  const videos = listVideos_(project.folderId);
  const comments = commentRows_().filter(r => r.token === token && !(r.deleted === true || r.deleted === 'TRUE')).map(publicComment_);
  const counts = countsFor_(comments);
  videos.forEach(v => { v.counts = counts[v.id] || { open: 0, total: 0, last: null }; });
  return { project: { name: project.name, token: project.token }, videos: videos };
}

function adminOverview_() {
  const projects = syncProjects_();
  const all = commentRows_().filter(r => !(r.deleted === true || r.deleted === 'TRUE')).map(r => Object.assign(publicComment_(r), { token: r.token }));
  return projects.map(p => {
    const videos = listVideos_(p.folderId);
    const counts = countsFor_(all.filter(c => c.token === p.token));
    videos.forEach(v => { v.counts = counts[v.id] || { open: 0, total: 0, last: null }; });
    return { name: p.name, token: p.token, videos: videos };
  }).sort((a, b) => {
    const ua = Math.max.apply(null, [0].concat(a.videos.map(v => v.updated)));
    const ub = Math.max.apply(null, [0].concat(b.videos.map(v => v.updated)));
    return ub - ua;
  });
}

/** Chạy 1 lần trong trình soạn thảo để cấp quyền và tạo các sheet. */
function setup() {
  sheet_('Projects', PROJECT_COLS);
  sheet_('Comments', COMMENT_COLS);
  sheet_('Notes', NOTE_COLS);
  const projects = syncProjects_();
  Logger.log('Đã tìm thấy ' + projects.length + ' dự án: ' + projects.map(p => p.name + ' → ' + p.token).join(', '));
}
