
"use strict";

const CACHE_NAME = "kickoff-v6";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css?v=7",
  "./app.js?v=6",
  "./manifest.json",
  "./logo.svg"
];

// نصب نسخه جدید و ذخیره فایل‌های اصلی
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// فعال‌سازی نسخه جدید و حذف کش‌های قدیمی KICKOFF
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            key.startsWith("kickoff-") && key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// دریافت نسخه جدید از اینترنت و استفاده از کش هنگام آفلاین بودن
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();

          event.waitUntil(
            caches.open(CACHE_NAME).then(cache =>
              cache.put(request, copy)
            )
          );
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || Response.error();
      })
  );
});
