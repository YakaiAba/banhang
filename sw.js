// Giúp app Bán hàng mở được và quét mã được cả khi mất mạng.
// Trang app: lấy bản mới từ mạng trước, mất mạng thì dùng bản đã lưu.
// Bộ đọc mã (jsdelivr, unpkg): dùng bản đã lưu, không có mới tải.
const CACHE = 'banhang-v3';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('banhang-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Trang app và file cùng trang: mạng trước (chờ tối đa 4 giây), lỗi thì dùng bản lưu
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([
          fetch(req),
          new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 4000))
        ]);
        if (res && res.ok) cache.put(req.mode === 'navigate' ? './' : req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req.mode === 'navigate' ? './' : req, { ignoreSearch: true })
          || await cache.match('./index.html');
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }

  // Thư viện đọc mã vạch: lưu sẵn để dùng khi mất mạng
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'unpkg.com' || url.hostname === 'fastly.jsdelivr.net') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    })());
  }
  // Còn lại (Google Sheets, mã QR ngân hàng): để trình duyệt tự xử lý
});
