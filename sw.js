
const CACHE_NAME = "kickoff-v1";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];

// نصب و ذخیره فایل‌های اصلی
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// فعال‌سازی نسخه جدید و پاک‌سازی کش‌های قدیمی
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// پاسخ‌گویی به درخواست‌ها از حافظه ذخیره‌شده
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // درخواست‌های خارج از سایت خودمان
  // مثل فونت‌های آنلاین، از کش داخلی عبور نمی‌کنند.
  if (url.origin !== self.location.origin) return;

  // صفحات سایت
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(async () => {
          return await caches.match("./index.html")
            || Response.error();
        })
    );
    return;
  }

  // فایل‌های دیگر
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy));
        }

        return response;
      });
    })
  );
});
