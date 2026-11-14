/* Màn mở đầu "vũ trụ": hạt sáng li ti và ký tự trôi lơ lửng bị hút về tâm.
   Khi trang tải xong: mọi thứ lao vào tâm, lóe sáng, sóng tròn lan ra để lộ giao diện.
   Nhẹ: 1 canvas 2D, không thư viện, tự dừng và tự xoá sau khi xong. Tắt hẳn nếu máy bật "giảm chuyển động". */
(function () {
  var app = document.getElementById('app');
  if (!app) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MIN_MS = reduce ? 0 : 1100;            // xem đủ một nhịp hút vào rồi mới nổ
  var t0 = performance.now();

  var wrap = document.createElement('div');
  wrap.className = 'cosmos';
  wrap.setAttribute('role', 'status');
  wrap.setAttribute('aria-label', 'Đang mở tinhayOD');
  var cv = document.createElement('canvas');
  var cap = document.createElement('div');
  cap.className = 'cosmos-cap';
  cap.textContent = 'tinhayOD';
  wrap.appendChild(cv); wrap.appendChild(cap);
  document.body.appendChild(wrap);
  document.documentElement.classList.add('cosmos-on');

  var g = cv.getContext('2d'), W = 0, H = 0, cx = 0, cy = 0, R = 0, dpr = Math.min(1.5, window.devicePixelRatio || 1);
  function size() {
    W = innerWidth; H = innerHeight; cx = W / 2; cy = H / 2; R = Math.hypot(cx, cy);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size(); addEventListener('resize', size);

  var small = W < 700;
  var N = small ? 160 : 320, GN = small ? 18 : 34;
  var GLYPHS = ['0:14,2', '#3', 'v2', '▶', '✎', '⌖', 'ă', 'ơ', 'ư', 'đ', 'Ê', '24', ':', ',', '00:07', '◯', '↗', 'Sửa', 'Cut', 'fps', '+1', 'A', 'Ω', '∞'];
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function spawn(p, far) {
    p.a = rnd(0, Math.PI * 2); p.r = far ? rnd(R * 0.75, R * 1.05) : rnd(R * 0.08, R * 1.05);
    p.v = rnd(0.25, 0.9); p.w = rnd(0.0025, 0.006) * (Math.random() < 0.5 ? 1 : -1);
    p.s = rnd(0.8, 2.4); p.hue = Math.random() < 0.82 ? 0 : 1;
    return p;
  }
  var P = []; for (var i = 0; i < N; i++) P.push(spawn({}, false));
  var G = [];
  for (var j = 0; j < GN; j++) {
    var q = spawn({}, false); q.ch = GLYPHS[j % GLYPHS.length]; q.rot = rnd(-0.6, 0.6); q.vr = rnd(-0.01, 0.01);
    q.fs = rnd(14, 30); q.v *= 0.35; q.serif = Math.random() < 0.5; G.push(q);
  }

  var phase = 0;      // 0: đang hút, 1: lao vào tâm, 2: sóng lan ra
  var pt = 0, last = t0, raf = 0, boom = 0;
  function frame(now) {
    var dt = Math.min(48, now - last) / 16.67; last = now;
    var pull = phase === 0 ? 1 : 1 + (now - pt) / 40;           // giai đoạn 1: tăng tốc rất nhanh
    // nền: phủ mờ để hạt để lại vệt (rẻ hơn vẽ đuôi từng hạt)
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0,0,0,' + (phase === 0 ? 0.28 : 0.18) + ')';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';

    // lõi sáng ở tâm, đập nhẹ
    var pulse = 1 + Math.sin(now / 260) * 0.08 + (phase ? (now - pt) / 120 : 0);
    var core = g.createRadialGradient(cx, cy, 0, cx, cy, 70 * pulse);
    core.addColorStop(0, 'rgba(255,255,255,0.95)');
    core.addColorStop(0.18, 'rgba(140,180,255,0.65)');
    core.addColorStop(0.5, 'rgba(59,130,249,0.18)');
    core.addColorStop(1, 'rgba(59,130,249,0)');
    g.fillStyle = core; g.beginPath(); g.arc(cx, cy, 70 * pulse, 0, 7); g.fill();

    // hạt: xoắn ốc vào tâm, càng gần càng nhanh
    for (var i = 0; i < P.length; i++) {
      var p = P[i], k = 1 + (R / (p.r + 40)) * 0.9;
      p.r -= p.v * k * pull * dt; p.a += p.w * k * dt;
      if (p.r < 6) { if (phase) { p.dead = 1; continue; } spawn(p, true); }
      var x = cx + Math.cos(p.a) * p.r, y = cy + Math.sin(p.a) * p.r * 0.92;
      var al = Math.min(1, 0.25 + (R - p.r) / (R * 0.35)) * (p.r < 60 ? p.r / 60 : 1);
      g.fillStyle = p.hue ? 'rgba(238,59,46,' + al + ')' : 'rgba(200,220,255,' + al + ')';
      g.fillRect(x, y, p.s, p.s);
    }
    // ký tự lơ lửng: trôi chậm, xoay, nhỏ dần khi bị hút
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (var j = 0; j < G.length; j++) {
      var q = G[j], kk = 1 + (R / (q.r + 60)) * 0.6;
      q.r -= q.v * kk * pull * dt; q.a += q.w * 0.6 * dt; q.rot += q.vr * dt;
      if (q.r < 18) { if (phase) { q.dead = 1; continue; } spawn(q, true); q.v = rnd(0.1, 0.3); }
      var gx = cx + Math.cos(q.a) * q.r, gy = cy + Math.sin(q.a) * q.r * 0.92;
      var sc = Math.min(1, q.r / (R * 0.5)), a2 = Math.min(0.85, 0.2 + (R - q.r) / (R * 0.45)) * Math.min(1, q.r / 90);
      g.save(); g.translate(gx, gy); g.rotate(q.rot);
      g.font = (q.serif ? '700 ' : '400 ') + Math.max(6, q.fs * (0.35 + 0.65 * sc)) + 'px ' + (q.serif ? 'Tinos, Times New Roman, serif' : 'Arimo, Arial, sans-serif');
      g.fillStyle = 'rgba(230,236,255,' + a2 + ')';
      g.fillText(q.ch, 0, 0); g.restore();
    }

    if (phase === 1 && now - pt > 420) { phase = 2; boom = now; burst(); }
    raf = requestAnimationFrame(frame);
  }

  // Sóng tròn lan từ tâm: khoét lỗ trong suốt trên màn vũ trụ để lộ giao diện bên dưới
  function burst() {
    document.documentElement.classList.remove('cosmos-on');
    document.documentElement.classList.add('cosmos-reveal');
    var D = 700, start = performance.now();
    (function grow(now) {
      var t = Math.min(1, (now - start) / D), e = 1 - Math.pow(1 - t, 3), r = e * R * 1.15;
      var m = 'radial-gradient(circle at 50% 50%, transparent ' + r + 'px, #000 ' + (r + 60) + 'px)';
      wrap.style.webkitMaskImage = m; wrap.style.maskImage = m;
      wrap.style.setProperty('--ring', r + 'px');
      if (t < 1) requestAnimationFrame(grow); else end();
    })(start);
  }
  function end() {
    cancelAnimationFrame(raf); removeEventListener('resize', size);
    wrap.remove();
    setTimeout(function () { document.documentElement.classList.remove('cosmos-reveal'); }, 700);
  }
  function finish() {
    if (phase) return;
    var wait = Math.max(0, MIN_MS - (performance.now() - t0));
    setTimeout(function () {
      if (reduce) { wrap.remove(); document.documentElement.classList.remove('cosmos-on'); return; }
      phase = 1; pt = performance.now();
    }, wait);
  }

  // Trang coi là "đã tải xong" khi #app không còn màn chờ (.rh-center)
  function ready() { return app.children.length && !app.querySelector('.rh-center'); }
  if (!reduce) raf = requestAnimationFrame(frame);
  var mo = new MutationObserver(function () { if (ready()) { mo.disconnect(); finish(); } });
  mo.observe(app, { childList: true, subtree: false });
  setTimeout(function () { if (!phase) { mo.disconnect(); finish(); } }, 15000);   // an toàn: không kẹt quá 15 giây
})();
