// ============================================================
// sw.js — 서비스워커 (오프라인 지원)
// ------------------------------------------------------------
// 마트에서 와이파이/데이터가 끊겨도 앱이 계속 열리도록,
// 앱의 핵심 파일들을 브라우저에 캐시해둡니다.
//
// [전략] "네트워크 우선, 실패하면 캐시"
//   - 온라인: 항상 서버의 최신 버전을 받아서 보여주고 캐시를 갱신
//   - 오프라인: 마지막으로 캐시된 버전으로 동작
//   → 새 버전을 배포하면 즉시 반영되면서, 오프라인도 계속 지원됩니다.
//     (예전의 "캐시 우선" 방식은 업데이트가 반영되지 않는 문제가 있었음)
// ============================================================

const CACHE_NAME = "mart-attack-v2";

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
            return key !== CACHE_NAME; // 옛 버전 캐시(v1 등)는 삭제
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// 네트워크 우선 전략: 최신 버전을 먼저 시도하고, 오프라인이면 캐시로 대체
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        // 성공적으로 받아온 응답은 캐시에 복사해두기 (다음 오프라인 대비)
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, copy);
        });
        return response;
      })
      .catch(function () {
        // 오프라인: 캐시에서 찾고, 그래도 없으면 첫 화면으로 대체
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match("./index.html");
        });
      })
  );
});
