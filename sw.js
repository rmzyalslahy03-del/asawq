// sw.js - Service Worker لتخزين الموقع وجعله يعمل بدون إنترنت
const CACHE_NAME = 'markets-pwa-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// تثبيت Service Worker وتخزين الملفات الأساسية
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// تنظيف الإصدارات القديمة
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// استراتيجية: Cache First ثم Network للصور والملفات الثابتة
// للبيانات الديناميكية (API) نفضل Network First
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // تجنب تخزين طلبات Supabase مؤقتاً (لأننا نستخدم localStorage cache)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request).catch(() => {
      return new Response(JSON.stringify({ error: 'offline' }), { headers: { 'Content-Type': 'application/json' } });
    }));
    return;
  }
  
  // للصور والملفات الثابتة: cache first
  if (event.request.destination === 'image' || event.request.destination === 'style' || event.request.destination === 'script' || event.request.destination === 'font') {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(fetchRes => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchRes.clone());
            return fetchRes;
          });
        });
      }).catch(() => {
        return caches.match('/offline.html'); // يمكنك إضافة صفحة مخصصة للطوارئ
      })
    );
  } else {
    // للمستندات HTML: network first ثم cache
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
  }
});
