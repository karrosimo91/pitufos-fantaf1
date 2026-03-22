const CACHE_NAME = "lp-fantaf1-v1";

// Installa: pre-cache delle risorse essenziali
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        "/",
        "/dashboard",
        "/icon.svg",
        "/manifest.json",
      ])
    )
  );
  self.skipWaiting();
});

// Attiva: pulisce cache vecchie
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network first, fallback cache
self.addEventListener("fetch", (event) => {
  // Skip non-GET e richieste Supabase/API
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache la risposta valida
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
