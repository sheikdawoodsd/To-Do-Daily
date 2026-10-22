
"use strict";

const $ = id => document.getElementById(id);
const otpInputs = [...document.querySelectorAll(".otp-input")];
const verifyForm = $("verifyForm");
const verifyError = $("verifyError");
const resendBtn = $("resendBtn");
const resendMessage = $("resendMessage");

function getSessionEmail() {
    return localStorage.getItem("todoDaily_session") ||
        sessionStorage.getItem("todoDaily_session") || "";
}

function getAccounts() {
    try {
        const value = JSON.parse(localStorage.getItem("todoDaily_accounts") || "{}");
        return value && typeof value === "object" && !Array.isArray(value)
            ? value : {};
    } catch {
        return {};
    }
}

const email = getSessionEmail();
let accounts = getAccounts();
let account = accounts[email];

if (!email || !account) {
    window.location.replace("index.html");
} else if (account.verified) {
    window.location.replace(account.profileComplete ? "todo.html" : "profile.html");
}

$("verificationEmail").textContent = email || "your email";

let countdown = 60;
let timerId = null;
let toastTimer = null;
let verificationMode = "unknown"; // "server" for the email API, "demo" when no API is deployed.

function showToast(message) {
    $("toastMessage").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 4000);
}

// Prefer the existing Vercel OTP API. If this is a static/demo deployment with
// no API route, fall back to the browser-based demo code and keep it visible.
async function sendVerificationCode(emailAddress) {
    try {
        const response = await fetch("/api/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailAddress })
        });
        const contentType = response.headers.get("content-type") || "";
        if (response.status === 404 || !contentType.includes("application/json")) {
            return { mode: "demo" };
        }
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not send the email. Please try again.");
        if (result.demoMode === true || result.mode === "demo") {
            return { mode: "demo", code: result.demoCode || result.code || "" };
        }
        return { mode: "server", code: result.demoCode || "" };
    } catch (error) {
        if (error instanceof TypeError) throw new Error("Could not connect to the verification service. Please try again.");
        throw error;
    }
}

function showDemoCode(code) {
    const card = $("demoCodeCard");
    const codeValue = $("demoCodeValue");
    if (!card || !codeValue) return;
    codeValue.textContent = code;
    card.hidden = false;
}

function hideDemoCode() {
    const card = $("demoCodeCard");
    if (card) card.hidden = true;
}

const copyDemoCodeButton = $("copyDemoCode");
if (copyDemoCodeButton) {
    copyDemoCodeButton.addEventListener("click", async () => {
        const code = $("demoCodeValue")?.textContent?.trim() || "";
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            showToast("Verification code copied.");
        } catch {
            const temporary = document.createElement("textarea");
            temporary.value = code;
            temporary.setAttribute("readonly", "");
            temporary.style.position = "fixed";
            temporary.style.opacity = "0";
            document.body.appendChild(temporary);
            temporary.select();
            const copied = document.execCommand("copy");
            temporary.remove();
            showToast(copied ? "Verification code copied." : "Please copy the code manually.");
        }
    });
}

function startCountdown() {
    clearInterval(timerId);
    countdown = 60;
    resendBtn.disabled = true;
    resendMessage.textContent = `Resend code in ${countdown}s`;

    timerId = setInterval(() => {
        countdown--;
        resendMessage.textContent = `Resend code in ${countdown}s`;

        if (countdown <= 0) {
            clearInterval(timerId);
            resendMessage.textContent = "Didn't receive the code?";
            resendBtn.disabled = false;
        }
    }, 1000);
}

async function issueCode(isResend = false) {
    accounts = getAccounts();
    account = accounts[email];

    if (!account || account.verified) {
        window.location.replace("index.html");
        return;
    }

    otpInputs.forEach(input => input.value = "");
    verifyError.textContent = "";
    resendBtn.disabled = true;
    resendMessage.textContent = "Preparing verification code…";

    try {
        const result = await sendVerificationCode(email);
        verificationMode = result.mode;
        if (verificationMode === "demo") {
            const code = result.code || String(Math.floor(100000 + Math.random() * 900000));
            account.verificationCode = code;
            account.verificationExpires = Date.now() + 10 * 60 * 1000;
            accounts[email] = account;
            localStorage.setItem("todoDaily_accounts", JSON.stringify(accounts));
            showDemoCode(code);
            console.info(`Demo verification code for ${email}: ${code}`);
        } else {
            hideDemoCode();
            if (result.code) showDemoCode(result.code);
            else showToast(isResend ? "A new verification code was sent." : "Verification code sent.");
        }
        startCountdown();
        if (isResend) otpInputs[0].focus();
    } catch (error) {
        resendBtn.disabled = false;
        resendMessage.textContent = "Didn't receive the code?";
        verifyError.textContent = error.message || "Unable to send verification code.";
    }
}

otpInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
        const digits = input.value.replace(/\D/g, "");
        input.value = digits.slice(-1);

        verifyError.textContent = "";

        if (input.value && index < otpInputs.length - 1) {
            otpInputs[index + 1].focus();
        }
    });

    input.addEventListener("keydown", event => {
        if (event.key === "Backspace" && !input.value && index > 0) {
            otpInputs[index - 1].focus();
        }

        if (event.key === "ArrowLeft" && index > 0) {
            otpInputs[index - 1].focus();
        }

        if (event.key === "ArrowRight" && index < otpInputs.length - 1) {
            otpInputs[index + 1].focus();
        }
    });

    input.addEventListener("paste", event => {
        event.preventDefault();

        const pasted = event.clipboardData.getData("text")
            .replace(/\D/g, "").slice(0, 6);

        pasted.split("").forEach((digit, i) => {
            otpInputs[i].value = digit;
        });

        otpInputs[Math.min(pasted.length, 5)].focus();
    });
});

verifyForm.addEventListener("submit", async event => {
    event.preventDefault();
    verifyError.textContent = "";

    const enteredCode = otpInputs.map(input => input.value).join("");
    if (!/^\d{6}$/.test(enteredCode)) {
        verifyError.textContent = "Please enter all 6 digits.";
        return;
    }

    accounts = getAccounts();
    account = accounts[email];
    if (!account) {
        window.location.replace("index.html");
        return;
    }

    if (verificationMode === "demo") {
        if (!account.verificationCode || Date.now() > account.verificationExpires) {
            verifyError.textContent = "Your code has expired. Please request a new one.";
            return;
        }
        if (enteredCode !== account.verificationCode) {
            verifyError.textContent = "Incorrect code. Please try again.";
            return;
        }
    } else {
        try {
            const response = await fetch("/api/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code: enteredCode })
            });
            const contentType = response.headers.get("content-type") || "";
            const result = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};
            if (!response.ok || !contentType.includes("application/json")) {
                verifyError.textContent = result.error || "Incorrect or expired code. Please try again.";
                return;
            }
        } catch {
            verifyError.textContent = "Could not connect to the verification service. Please try again.";
            return;
        }
    }

    account.verified = true;
    delete account.verificationCode;
    delete account.verificationExpires;
    try {
        localStorage.setItem("todoDaily_accounts", JSON.stringify(accounts));
        clearInterval(timerId);
        window.location.replace("profile.html");
    } catch {
        verifyError.textContent = "Unable to save verification. Please try again.";
    }
});

resendBtn.addEventListener("click", () => issueCode(true));

// Issue the initial code only when this account is still unverified.
if (account && !account.verified) {
    issueCode();
}

window.addEventListener("pagehide", () => clearInterval(timerId));
