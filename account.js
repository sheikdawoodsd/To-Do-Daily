"use strict";

// Account: custom logout and deletion confirmation flows.
// Delete Flow: two-step confirmation before permanently removing user-scoped data.
const $ = id => document.getElementById(id);
const email = localStorage.getItem("todoDaily_session") || sessionStorage.getItem("todoDaily_session") || "";
function readAccounts() {
    try { const data = JSON.parse(localStorage.getItem("todoDaily_accounts") || "{}"); return data && typeof data === "object" ? data : {}; }
    catch { return {}; }
}
const accounts = readAccounts();
const account = accounts[email];
if (!email || !account || !account.verified || !account.profileComplete) {
    window.location.replace("index.html");
} else {
    $("accountUsername").textContent = account.username || "Your account";
    $("accountEmail").textContent = email;
}
let previousFocus = null;
function openModal(title, description, buttons) {
    previousFocus = document.activeElement;
    $("accountModalTitle").textContent = title;
    $("accountModalDescription").textContent = description;
    const actions = $("accountModalActions"); actions.replaceChildren();
    buttons.forEach(item => {
        const button = document.createElement("button"); button.type = "button";
        button.className = `btn ${item.primary ? "btn-primary" : "btn-outline"} modal-action`;
        button.textContent = item.label; button.addEventListener("click", item.action); actions.appendChild(button);
    });
    $("accountModal").hidden = false;
    requestAnimationFrame(() => actions.querySelector("button")?.focus());
}
function closeModal() {
    $("accountModal").hidden = true;
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
}
function logout() {
    localStorage.removeItem("todoDaily_session");
    sessionStorage.removeItem("todoDaily_session");
    window.location.replace("index.html");
}
function deleteAccount() {
    const theme = localStorage.getItem(`todoDaily_theme_${email}`) || "black-red";
    // Remove every user-scoped key, including tasks, photo, daily/weekly history and chart choices.
    for (const key of Object.keys(localStorage)) {
        if (key.startsWith("todoDaily_") && key.includes(email) && key !== "todoDaily_accounts") localStorage.removeItem(key);
    }
    for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith("todoDaily_") && key.includes(email) && key !== "todoDaily_session") sessionStorage.removeItem(key);
    }
    const latest = readAccounts(); delete latest[email];
    localStorage.setItem("todoDaily_accounts", JSON.stringify(latest));
    if (localStorage.getItem("todoDaily_session") === email) localStorage.removeItem("todoDaily_session");
    if (sessionStorage.getItem("todoDaily_session") === email) sessionStorage.removeItem("todoDaily_session");
    if (localStorage.getItem("todoDaily_lastTheme") === theme) localStorage.setItem("todoDaily_lastTheme", "black-red");
    $("accountModal").hidden = true;
    $("accountToast").textContent = "Your account has been deleted";
    $("accountToast").hidden = false;
    setTimeout(() => window.location.replace("index.html"), 1000);
}
$("accountLogoutBtn").addEventListener("click", () => openModal(
    "Log out", "Are you sure you want to log out?", [
        { label: "Yes", primary: true, action: logout },
        { label: "No", action: closeModal }
    ]
));
$("accountDeleteBtn").addEventListener("click", () => openModal(
    "Delete account", "All your data will be deleted: your account, profile, photo, tasks, and progress.", [
        { label: "Sure", primary: true, action: () => openModal(
            "Final confirmation", `${account?.username || "User"}, are you sure you want to delete your account? This cannot be undone.`, [
                { label: "Yes", primary: true, action: deleteAccount },
                { label: "No", action: closeModal }
            ]
        ) },
        { label: "Not", action: () => { closeModal(); window.location.href = "todo.html"; } }
    ]
));
$("backToWebsite").addEventListener("click", () => { window.location.href = "todo.html"; });
$("accountModal").addEventListener("click", event => { if (event.target === $("accountModal")) closeModal(); });
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !$("accountModal").hidden) closeModal();
    if (event.key === "Tab" && !$("accountModal").hidden) {
        const focusable = [...$("accountModal").querySelectorAll("button:not(:disabled)")];
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
});
