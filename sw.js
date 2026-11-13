"use strict";
// Service worker: lets TO DO Daily open fast and work offline.
// Bump CACHE_VERSION whenever the app files change.
const CACHE_VERSION = "todo-daily-v1";
const SHELL = [
    "/", "index.html", "verify.html", "profile.html", "todo.html", "account.html",
    "style.css", "auth.js", "verify.js", "profile.js", "todo.js", "account.js", "config.js", "pwa.js",
    "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {}))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);
    // Never touch API calls (email codes, Google sign-in) or other websites.
    if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

    if (request.mode === "navigate") {
        // Pages: try the network first so updates show up, fall back to the cache offline.
        event.respondWith(
            fetch(request).then(response => {
                const copy = response.clone();
                caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
                return response;
            }).catch(() => caches.match(request).then(hit => hit || caches.match("index.html")))
        );
        return;
    }

    // Files (css, js, icons): serve from cache, refresh in the background.
    event.respondWith(
        caches.match(request).then(hit => {
            const fresh = fetch(request).then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
                }
                return response;
            }).catch(() => hit);
            return hit || fresh;
        })
    );
});
