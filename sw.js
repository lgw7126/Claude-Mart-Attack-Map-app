// ============================================================
// sw.js — 서비스워커 (오프라인 지원)
// ------------------------------------------------------------
// 마트에서 와이파이/데이터가 끊겨도 앱이 계속 열리도록,
// 앱의 핵심 파일들을 브라우저에 캐시해둡니다.
// CACHE_NAME을 바꾸면 이전 캐시는 자동으로 정리됩니다.
// ============================================================

const CACHE_NAME = "mart-attack-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE_NAME;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// 캐시 우선 전략: 캐시에 있으면 즉시 응답, 없으면 네트워크로 받아와서 캐시에 저장
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request)
        .then(function (response) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
          return response;
        })
        .catch(function () {
          // 오프라인 + 캐시에도 없는 요청(예: 새 경로) → 첫 화면으로 대체
          return caches.match("./index.html");
        });
    })
  );
});
