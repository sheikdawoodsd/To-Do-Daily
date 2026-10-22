"use strict";

// Loads the public Google OAuth client ID from the Vercel API route.
// The client ID is public; never place a client secret in this file.
(async function loadGoogleSignIn() {
  const button = document.getElementById("googleSignInBtn");
  const note = document.getElementById("googleSignInNote");
  if (!button) return;
  try {
    const response = await fetch("/api/google-config", { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || !data.clientId) throw new Error(data.error || "Google sign-in is not configured.");
    if (!window.google?.accounts?.id) {
      note.textContent = "Google sign-in is temporarily unavailable. You can use email instead.";
      return;
    }
    window.google.accounts.id.initialize({
      client_id: data.clientId,
      callback: async ({ credential }) => {
        note.textContent = "Signing in with Google…";
        button.disabled = true;
        try {
          const verifyResponse = await fetch("/api/google-auth", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential })
          });
          const identity = await verifyResponse.json();
          if (!verifyResponse.ok || !identity.email) throw new Error(identity.error || "Google sign-in failed.");
          const key = "todoDaily_accounts";
          let accounts = {};
          try { accounts = JSON.parse(localStorage.getItem(key) || "{}"); } catch {}
          const email = identity.email.trim().toLowerCase();
          const old = accounts[email] && typeof accounts[email] === "object" ? accounts[email] : {};
          accounts[email] = { ...old, email, verified: true, googleAccount: true, googleName: identity.name || old.name || "", googlePicture: identity.picture || old.photo || "" };
          localStorage.setItem(key, JSON.stringify(accounts));
          localStorage.setItem("todoDaily_session", email);
          sessionStorage.removeItem("todoDaily_session");
          window.location.href = accounts[email].profileComplete ? "todo.html" : "profile.html";
        } catch (error) {
          note.textContent = error.message || "Google sign-in failed. Please try again.";
          button.disabled = false;
        }
      }
    });
    button.addEventListener("click", () => {
      if (window.google?.accounts?.id) window.google.accounts.id.prompt();
      else note.textContent = "Google sign-in is loading. Please try again in a moment.";
    });
  } catch (error) {
    note.textContent = error.message || "Google sign-in is not configured. You can use email instead.";
  }
})();
