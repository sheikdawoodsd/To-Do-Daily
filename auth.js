
"use strict";

// Reuse the last selected dashboard theme on the authentication page.
try {
    const lastTheme = localStorage.getItem("todoDaily_lastTheme");
    if (["black-red", "white-blue", "black-purple", "pink-blue", "peach-coral", "mint-teal"].includes(lastTheme)) {
        document.documentElement.dataset.theme = lastTheme;
    }
} catch {}

const $ = id => document.getElementById(id);

const form = $("authForm");
const loginTab = $("loginTab");
const signupTab = $("signupTab");
const emailInput = $("email");
const passwordInput = $("password");
const confirmInput = $("confirmPassword");

let mode = "login";

// Accounts are stored locally for this demo.
function readAccounts() {
    try {
        const value = JSON.parse(localStorage.getItem("todoDaily_accounts") || "{}");
        return value && typeof value === "object" && !Array.isArray(value)
            ? value : {};
    } catch {
        return {};
    }
}

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setSession(email, remember) {
    // Remove any old session before choosing the storage type.
    localStorage.removeItem("todoDaily_session");
    sessionStorage.removeItem("todoDaily_session");

    const target = remember ? localStorage : sessionStorage;
    target.setItem("todoDaily_session", email);
}

function clearErrors() {
    ["emailError", "passwordError", "confirmError", "formError"].forEach(id => {
        $(id).textContent = "";
    });
}

function setMode(nextMode) {
    mode = nextMode;
    const login = mode === "login";

    clearErrors();
    loginTab.classList.toggle("active", login);
    signupTab.classList.toggle("active", !login);
    loginTab.setAttribute("aria-selected", String(login));
    signupTab.setAttribute("aria-selected", String(!login));

    $("formTitle").textContent = login ? "Welcome back." : "CREATE AN ACCOUNT";
    $("formSubtitle").textContent = login
        ? "Sign in and get back in your flow."
        : "Start building better habits today.";
    $("submitText").textContent = login ? "Sign in" : "Create account";
    $("confirmGroup").hidden = login;
    $("rememberRow").hidden = !login;
    confirmInput.required = !login;
    passwordInput.autocomplete = login ? "current-password" : "new-password";

    $("authSwitch").firstChild.textContent = login
        ? "New to TO DO Daily? "
        : "Already have an account? ";
    $("switchMode").textContent = login ? "Create an account" : "Login";
}

loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));
$("switchMode").addEventListener("click", () => {
    setMode(mode === "login" ? "signup" : "login");
});

function connectPasswordToggle(input, button) {
    button.addEventListener("click", () => {
        const reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        button.textContent = reveal ? "Hide" : "Show";
        button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    });
}

connectPasswordToggle(passwordInput, $("passwordToggle"));
connectPasswordToggle(confirmInput, $("confirmToggle"));

[emailInput, passwordInput, confirmInput].forEach(input => {
    input.addEventListener("input", clearErrors);
});

// Resume an existing valid session.
function getSessionEmail() {
    return localStorage.getItem("todoDaily_session") ||
        sessionStorage.getItem("todoDaily_session") || "";
}

const existingEmail = getSessionEmail();
if (existingEmail) {
    const existingAccount = readAccounts()[existingEmail];

    if (existingAccount) {
        if (!existingAccount.verified) {
            window.location.replace("verify.html");
        } else if (!existingAccount.profileComplete) {
            window.location.replace("profile.html");
        } else {
            window.location.replace("todo.html");
        }
    } else {
        localStorage.removeItem("todoDaily_session");
        sessionStorage.removeItem("todoDaily_session");
    }
}

form.addEventListener("submit", event => {
    event.preventDefault();
    clearErrors();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    let valid = true;

    if (!email || !validEmail(email)) {
        $("emailError").textContent = email
            ? "Please enter a valid email address."
            : "Please enter your email address.";
        valid = false;
    }

    if (!password || password.length < 6) {
        $("passwordError").textContent = !password
            ? "Please enter your password."
            : "Password must be at least 6 characters.";
        valid = false;
    }

    if (mode === "signup" && password !== confirmInput.value) {
        $("confirmError").textContent = "Passwords do not match.";
        valid = false;
    }

    if (!valid) return;

    let accounts = readAccounts();

    if (mode === "signup") {
        if (accounts[email]) {
            $("formError").textContent =
                "This email is already registered. Please login.";
            return;
        }

        // DEMO ONLY: never store plain-text passwords in a real app.
        const code = String(Math.floor(100000 + Math.random() * 900000));

        accounts[email] = {
            password,
            verified: false,
            verificationCode: code,
            verificationExpires: Date.now() + 10 * 60 * 1000,
            profileComplete: false,
            username: "",
            dob: "",
            gender: ""
        };

        try {
            localStorage.setItem("todoDaily_accounts", JSON.stringify(accounts));
            setSession(email, true);
            window.location.href = "verify.html";
        } catch {
            $("formError").textContent =
                "Could not save your account. Check browser storage.";
        }
        return;
    }

    const account = accounts[email];

    if (!account || account.password !== password) {
        $("formError").textContent = "Incorrect email or password.";
        return;
    }

    try {
        setSession(email, $("rememberMe").checked);

        if (!account.verified) {
            window.location.href = "verify.html";
        } else if (!account.profileComplete) {
            window.location.href = "profile.html";
        } else {
            window.location.href = "todo.html";
        }
    } catch {
        $("formError").textContent = "Unable to create a session.";
    }
});
