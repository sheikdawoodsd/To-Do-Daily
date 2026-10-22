
"use strict";

const $ = id => document.getElementById(id);

function sessionEmail() {
    return localStorage.getItem("todoDaily_session") ||
        sessionStorage.getItem("todoDaily_session") || "";
}

function readAccounts() {
    try {
        const data = JSON.parse(localStorage.getItem("todoDaily_accounts") || "{}");
        return data && typeof data === "object" && !Array.isArray(data)
            ? data : {};
    } catch {
        return {};
    }
}

const email = sessionEmail();
let accounts = readAccounts();
let account = accounts[email];

if (!email || !account || !account.verified) {
    window.location.replace("index.html");
} else if (account.profileComplete) {
    window.location.replace("todo.html");
}

const form = $("profileForm");
const usernameInput = $("username");
const daySelect = $("dobDay");
const monthSelect = $("dobMonth");
const yearSelect = $("dobYear");

const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
monthNames.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = String(index + 1);
    option.textContent = month;
    monthSelect.appendChild(option);
});
const currentYear = new Date().getFullYear();
for (let year = currentYear; year >= currentYear - 100; year--) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
}
for (let day = 1; day <= 31; day++) {
    const option = document.createElement("option");
    option.value = String(day);
    option.textContent = String(day);
    daySelect.appendChild(option);
}

function selectedDob() {
    const day = Number(daySelect.value);
    const month = Number(monthSelect.value);
    const year = Number(yearSelect.value);
    if (!day || !month || !year) return "";
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function clearDobError() { $("dobError").textContent = ""; }

usernameInput.addEventListener("input", () => {
    $("usernameError").textContent = "";
});
[daySelect, monthSelect, yearSelect].forEach(select => select.addEventListener("change", clearDobError));

document.querySelectorAll('input[name="gender"]').forEach(input => {
    input.addEventListener("change", () => {
        $("genderError").textContent = "";
    });
});

form.addEventListener("submit", event => {
    event.preventDefault();

    $("usernameError").textContent = "";
    $("dobError").textContent = "";
    $("genderError").textContent = "";
    $("profileError").textContent = "";

    const username = usernameInput.value.trim().replace(/\\s+/g, " ");
    usernameInput.value = username;
    const dob = selectedDob();
    const genderInput = document.querySelector('input[name="gender"]:checked');
    const gender = genderInput ? genderInput.value : "";

    let valid = true;

    if (username.length < 3 || username.length > 20) {
        $("usernameError").textContent =
            "Username must contain 3 to 20 characters.";
        valid = false;
    } else if (!/^[a-zA-Z0-9]+(?: [a-zA-Z0-9]+)*$/.test(username)) {
        $("usernameError").textContent =
            "Use only letters, numbers, and single spaces between words.";
        valid = false;
    }

    if (!daySelect.value || !monthSelect.value || !yearSelect.value) {
        $("dobError").textContent = "Please select your date, month, and year of birth.";
        valid = false;
    } else if (!dob) {
        $("dobError").textContent = "Please select a real date of birth.";
        valid = false;
    } else {
        const [year, month, day] = dob.split("-").map(Number);
        const birthDate = new Date(year, month - 1, day);
        const today = new Date();
        let age = today.getFullYear() - year;
        if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) age--;
        if (birthDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
            $("dobError").textContent = "Date of birth must be in the past.";
            valid = false;
        } else if (age < 10) {
            $("dobError").textContent = "You must be at least 10 years old.";
            valid = false;
        }
    }

    if (!gender) {
        $("genderError").textContent = "Please select an option.";
        valid = false;
    }

    if (!valid) return;

    // Re-read storage before updating the current account.
    accounts = readAccounts();
    account = accounts[email];

    if (!account || !account.verified) {
        window.location.replace("index.html");
        return;
    }

    account.username = username;
    account.dob = dob;
    account.gender = gender;
    account.profileComplete = true;

    try {
        localStorage.setItem("todoDaily_accounts", JSON.stringify(accounts));
        window.location.replace("todo.html");
    } catch {
        $("profileError").textContent =
            "Could not save your profile. Check browser storage.";
    }
});

$("profileLogout").addEventListener("click", () => {
    localStorage.removeItem("todoDaily_session");
    sessionStorage.removeItem("todoDaily_session");
    window.location.replace("index.html");
});
