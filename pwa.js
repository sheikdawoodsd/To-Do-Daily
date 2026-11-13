"use strict";

// PWA support: registers the service worker and offers an "Install app" button.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => {});
    });
}

(function installPrompt() {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (standalone) return;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem("todoDaily_installDismissed") === "1"; } catch {}
    if (dismissed) return;

    let deferred = null;
    let bar = null;

    function showBar(message, actionLabel, onAction) {
        if (bar || !document.body) return;
        bar = document.createElement("div");
        bar.setAttribute("role", "dialog");
        bar.setAttribute("aria-label", "Install TO DO Daily");
        bar.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:9999;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:16px;background:#141414;color:#fff;border:1px solid #e50914;box-shadow:0 10px 30px rgba(0,0,0,.45);font:600 14px/1.3 Inter,system-ui,sans-serif;max-width:460px;margin:0 auto";
        const icon = document.createElement("img");
        icon.src = "icons/icon-192.png"; icon.alt = ""; icon.width = 36; icon.height = 36;
        icon.style.cssText = "border-radius:9px;flex:none";
        const text = document.createElement("span");
        text.textContent = message; text.style.flex = "1";
        bar.append(icon, text);
        if (actionLabel) {
            const action = document.createElement("button");
            action.type = "button"; action.textContent = actionLabel;
            action.style.cssText = "border:0;border-radius:10px;padding:9px 14px;background:#e50914;color:#fff;font:700 13px Inter,system-ui,sans-serif;cursor:pointer;flex:none";
            action.addEventListener("click", onAction);
            bar.append(action);
        }
        const close = document.createElement("button");
        close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label", "Dismiss");
        close.style.cssText = "border:0;background:transparent;color:#aaa;font-size:22px;line-height:1;cursor:pointer;flex:none";
        close.addEventListener("click", hideBar);
        bar.append(close);
        document.body.appendChild(bar);
    }

    function hideBar(remember = true) {
        if (bar) bar.remove();
        bar = null;
        if (remember) { try { sessionStorage.setItem("todoDaily_installDismissed", "1"); } catch {} }
    }

    // Android / Chrome / Edge: native install prompt.
    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        deferred = event;
        showBar("Install TO DO Daily on your device", "Install", async () => {
            if (!deferred) return;
            deferred.prompt();
            await deferred.userChoice.catch(() => {});
            deferred = null;
            hideBar(false);
        });
    });
    window.addEventListener("appinstalled", () => hideBar(false));

    // iPhone / iPad Safari: no install prompt exists, so show the manual steps.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
    if (isIos && isSafari) {
        window.addEventListener("load", () => setTimeout(
            () => showBar("To install: tap Share, then “Add to Home Screen”.", "", null), 1500));
    }
})();
