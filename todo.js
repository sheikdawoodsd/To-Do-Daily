"use strict";

// Daily Reset: each user's completed tasks clear at the start of a new local calendar day.
const $ = id => document.getElementById(id);
const THEME_KEY = "todoDaily_lastTheme";
const THEMES = ["black-red", "white-blue", "black-purple", "pink-blue", "peach-coral", "mint-teal"];

function getSessionEmail() {
    return localStorage.getItem("todoDaily_session") ||
        sessionStorage.getItem("todoDaily_session") || "";
}
function getAccounts() {
    try {
        const data = JSON.parse(localStorage.getItem("todoDaily_accounts") || "{}");
        return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    } catch { return {}; }
}
function setAccounts(data) {
    localStorage.setItem("todoDaily_accounts", JSON.stringify(data));
}
function getThemeForUser(userEmail) {
    const saved = localStorage.getItem(`todoDaily_theme_${userEmail}`);
    return THEMES.includes(saved) ? saved : (THEMES.includes(localStorage.getItem(THEME_KEY)) ? localStorage.getItem(THEME_KEY) : "black-red");
}

const email = getSessionEmail();
let accounts = getAccounts();
let account = accounts[email];

if (!email || !account || !account.verified || !account.profileComplete) {
    window.location.replace("index.html");
} else {
    initializeDashboard(account);
}

function initializeDashboard(initialAccount) {
    let account = initialAccount;
    let username = normalizeName(account.username || "User");
    // My Tasks Boxes: the selected list is isolated by user and list/day.
    const dailyStorageKey = `todoDaily_tasks_${email}`;
    const weekTasksKey = `todoDaily_weekTasks_${email}`;
    const selectedViewKey = `todoDaily_selectedTaskView_${email}`;
    const selectedDayKey = `todoDaily_selectedTaskDay_${email}`;
    let selectedView = localStorage.getItem(selectedViewKey) || "daily";
    if (!['daily','weekdays','weekend'].includes(selectedView)) selectedView = 'daily';
    const dayIds = ['mon','tue','wed','thu','fri','sat','sun'];
    const dayNames = {mon:'Monday',tue:'Tuesday',wed:'Wednesday',thu:'Thursday',fri:'Friday',sat:'Saturday',sun:'Sunday'};
    let todayId = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
    let selectedDay = localStorage.getItem(selectedDayKey) || (selectedView === 'weekend' ? (['sat','sun'].includes(todayId)?todayId:'sat') : (['sat','sun'].includes(todayId)?'mon':todayId));
    if (!dayIds.includes(selectedDay)) selectedDay = 'mon';
    if (selectedView === 'weekdays' && !dayIds.slice(0,5).includes(selectedDay)) selectedDay = ['mon','tue','wed','thu','fri'].includes(todayId) ? todayId : 'mon';
    if (selectedView === 'weekend' && !dayIds.slice(5).includes(selectedDay)) selectedDay = ['sat','sun'].includes(todayId) ? todayId : 'sat';
    let storageKey = dailyStorageKey;
    const weeklyKey = `todoDaily_weekly_${email}`;
    const dailyLogKey = `todoDaily_dailyLog_${email}`;
    const resetUndoSnapshotKey = `todoDaily_dailyResetUndo_${email}`;
    let dailyResetUndoSnapshot = null;
    let resetUndoTimer = null;
    const userThemeKey = `todoDaily_theme_${email}`;
    const photoKey = `todoDaily_photo_${email}`;
    const weeklyChartKey = `todoDaily_weeklyChart_${email}`;
    const dailyChartKey = `todoDaily_dailyChart_${email}`;
    let tasks = [];
    let filter = "all";
    let toastTimer;
    let toastVersion = 0;
    let lastFocusedElement = null;
    let modalAction = null;
    let modalReturnToPanel = false;

    // Praise Messages: a varied opener pool; task names are rendered as text, never HTML.
    const praiseOpeners = ["Great job", "Amazing work", "Well done", "Fantastic", "Brilliant", "Superb effort", "Outstanding", "Excellent", "Nailed it", "Impressive", "You're on fire", "Keep it up", "Proud of you", "Way to go", "Splendid", "Wonderful", "Incredible", "Beautifully done"];
    let lastPraise = -1;
    const praiseStyles = [
        (opener, name, task) => `${opener}, ${name}! You have completed the task “${task}”.`,
        (opener, name, task) => `${opener}, ${name}! “${task}” is done.`,
        (opener, name, task) => `${opener}, ${name}! You just finished “${task}”.`
    ];

    const addWrap = document.createElement("div");
    addWrap.className = "add-task-wrap";
    addWrap.innerHTML = `
        <form id="taskForm" class="add-task-form">
            <span class="add-input-icon" aria-hidden="true">＋</span>
            <input id="taskInput" type="text" maxlength="200" placeholder="What needs to get done?" aria-label="New task" autocomplete="off">
            <button class="btn btn-outline task-time-toggle" id="taskTimeToggle" type="button" aria-expanded="false">⏰ Set time</button>
            <button class="btn btn-primary add-task-btn" type="submit">＋ Add Task</button>
        </form>
        <div class="task-time-options" id="taskTimeOptions" hidden><label><span>Hour</span><select id="taskHour" aria-label="Task reminder hour"></select></label><label><span>Minute</span><select id="taskMinute" aria-label="Task reminder minute"></select></label><label><span>AM/PM</span><select id="taskAmPm" aria-label="Task reminder AM or PM"><option>AM</option><option>PM</option></select></label><small id="taskTomorrowNote" class="panel-subtitle"></small></div>
        <p id="taskError" class="field-error" role="alert"></p>`;
    const panel = document.querySelector(".task-panel");
    const taskListElement = $("taskList");
    const taskForm = addWrap.querySelector("#taskForm");
    const taskInput = addWrap.querySelector("#taskInput");
    const taskError = addWrap.querySelector("#taskError");
    const toolbar = panel.querySelector(".task-toolbar");
    const progressSection = panel.querySelector(".progress-section");
    panel.insertBefore(addWrap, toolbar);

    // Themes
    function applyTheme(theme, persist = true) {
        if (!THEMES.includes(theme)) theme = "black-red";
        document.documentElement.dataset.theme = theme;
        if (persist) {
            localStorage.setItem(userThemeKey, theme);
            localStorage.setItem(THEME_KEY, theme);
        }
        document.querySelectorAll("[data-theme-choice]").forEach(button => {
            const selected = button.dataset.themeChoice === theme;
            button.classList.toggle("selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = ["white-blue", "pink-blue", "peach-coral", "mint-teal"].includes(theme) ? ({"white-blue":"#ffffff","pink-blue":"#ffd6ec","peach-coral":"#fff2e8","mint-teal":"#d8f8e8"}[theme]) : (theme === "black-purple" ? "#0b0910" : "#0a0a0a");
    }
    applyTheme(getThemeForUser(email), false);
    document.querySelectorAll("[data-theme-choice]").forEach(button => {
        button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));
    });

    // Shared identity updates
    function updateIdentity() {
        username = normalizeName(account.username || "User");
        $("navUsername").textContent = username;
        $("profileDisplayName").textContent = username;
        renderProfilePhoto();
        $("profileDisplayEmail").textContent = email;
        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
        $("greeting").replaceChildren(
            document.createTextNode(`${greeting}, ${username}`),
            Object.assign(document.createElement("span"), { className: "accent", textContent: "." })
        );
    }
    function normalizeName(value) {
        return String(value || "").trim().replace(/\s+/g, " ");
    }
    function activeListKey() { return selectedView === 'daily' ? dailyStorageKey : `${weekTasksKey}_${selectedDay}`; }
    function readTaskArray(key) { try { const v=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(v)?v.filter(t=>t&&typeof t.id==='string'&&typeof t.text==='string'&&typeof t.completed==='boolean'):[]; } catch { return []; } }
    function allSavedTasks() { return [dailyStorageKey, ...dayIds.map(d=>`${weekTasksKey}_${d}`)].flatMap(readTaskArray); }
    function dayShortName(id) { return ({mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun'})[id] || id; }
    function renderTaskViewSelectors() {
        document.querySelectorAll('[data-task-view]').forEach(btn=>{const on=btn.dataset.taskView===selectedView;btn.classList.toggle('selected',on);btn.setAttribute('aria-pressed',String(on));});
        $('weekdaySelector').hidden = selectedView !== 'weekdays'; $('weekendSelector').hidden = selectedView !== 'weekend'; $('selectedDaySummary').hidden = selectedView === 'daily';
        const makeButtons=(ids)=>ids.map(id=>`<button type="button" class="task-day-button ${id===selectedDay?'selected':''} ${id===todayId?'is-today':''}" data-task-day="${id}" aria-label="Show ${dayNames[id]} tasks" aria-pressed="${id===selectedDay}">${dayShortName(id)}${id===todayId?'<i aria-hidden="true"></i>':''}</button>`).join('');
        $('weekdaySelector').innerHTML=makeButtons(dayIds.slice(0,5)); $('weekendSelector').innerHTML=makeButtons(dayIds.slice(5));
        document.querySelectorAll('[data-task-day]').forEach(btn=>btn.addEventListener('click',()=>{selectedDay=btn.dataset.taskDay;localStorage.setItem(selectedDayKey,selectedDay);switchTaskList();}));
    }
    function switchTaskList() { storageKey=activeListKey(); loadTasks(); filter='all'; renderTaskViewSelectors(); resetForNewDay(false); renderTasks(); }
    document.querySelectorAll('[data-task-view]').forEach(btn=>btn.addEventListener('click',()=>{selectedView=btn.dataset.taskView;localStorage.setItem(selectedViewKey,selectedView);if(selectedView==='weekdays'&&!['mon','tue','wed','thu','fri'].includes(selectedDay))selectedDay='mon';if(selectedView==='weekend'&&!['sat','sun'].includes(selectedDay))selectedDay=['sat','sun'].includes(todayId)?todayId:'sat';localStorage.setItem(selectedDayKey,selectedDay);switchTaskList();}));
    renderTaskViewSelectors();
    function validName(value) {
        return value.length >= 3 && value.length <= 20 && /^[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$/.test(value);
    }
    // Profile Photo: gallery images, illustrated people avatars, motivation cards, and default.
    const builtInAvatars = [
        {name:"Alex",gender:"men",skin:"#f0c6a5",hair:"#2b211b",shirt:"#2563eb",style:"short",beard:false,glasses:false},
        {name:"Marcus",gender:"men",skin:"#9b6043",hair:"#171717",shirt:"#16a085",style:"curly",beard:true,glasses:false},
        {name:"Noah",gender:"men",skin:"#e6b48d",hair:"#754c24",shirt:"#f97316",style:"bald",beard:false,glasses:true},
        {name:"David",gender:"men",skin:"#6d422e",hair:"#171717",shirt:"#7c3aed",style:"fade",beard:true,glasses:true},
        {name:"Ethan",gender:"men",skin:"#f4d0b1",hair:"#b66a35",shirt:"#0f766e",style:"side",beard:false,glasses:false},
        {name:"Ravi",gender:"men",skin:"#c88c63",hair:"#21180f",shirt:"#dc2626",style:"wavy",beard:true,glasses:false},
        {name:"Mia",gender:"women",skin:"#f1c6a5",hair:"#4b241b",shirt:"#ec4899",style:"long",beard:false,glasses:false},
        {name:"Zara",gender:"women",skin:"#8f553d",hair:"#171717",shirt:"#8b5cf6",style:"bun",beard:false,glasses:true},
        {name:"Ava",gender:"women",skin:"#e8b18b",hair:"#b45309",shirt:"#0ea5e9",style:"ponytail",beard:false,glasses:false},
        {name:"Lina",gender:"women",skin:"#f5d3b7",hair:"#5a3526",shirt:"#14b8a6",style:"bob",beard:false,glasses:false},
        {name:"Nia",gender:"women",skin:"#5c382b",hair:"#191919",shirt:"#f59e0b",style:"coils",beard:false,glasses:false},
        {name:"Mei",gender:"women",skin:"#edc29e",hair:"#2c201b",shirt:"#6366f1",style:"fringe",beard:false,glasses:false}
    ];
    const motivationCards = [
        ["Discipline beats motivation.","#101827","#283c63"], ["Small steps, big results.","#111827","#075985"],
        ["Focus on progress, not perfection.","#1e1b4b","#4c1d95"], ["Do it today.","#171717","#7f1d1d"],
        ["Consistency builds success.","#052e2b","#115e59"], ["Start where you are.","#312e2e","#57534e"],
        ["Make it happen.","#172554","#1d4ed8"], ["One task at a time.","#3f1d2e","#831843"]
    ];
    // Avatars: distinct inline-SVG people with subtle blinking and float motion.
    function avatarSvg(item) {
        const hairShapes = {
            short:`<path d="M27 42Q22 14 49 13Q76 12 74 41L66 31Q48 22 33 34Z" fill="${item.hair}"/>`,
            curly:`<g fill="${item.hair}"><circle cx="31" cy="28" r="10"/><circle cx="43" cy="20" r="11"/><circle cx="57" cy="20" r="11"/><circle cx="69" cy="29" r="10"/><path d="M27 29Q50 10 73 29L69 42H31Z"/></g>`,
            bald:`<path d="M29 33Q29 13 50 13Q72 13 72 34" fill="${item.hair}" opacity=".22"/>`,
            fade:`<path d="M28 35Q27 14 50 14Q73 14 72 35L64 28Q50 24 36 30Z" fill="${item.hair}"/><path d="M27 31L32 45M73 31L68 45" stroke="${item.hair}" stroke-width="4"/>`,
            side:`<path d="M27 39Q23 12 51 13Q78 13 73 39L59 24Q45 34 29 32Z" fill="${item.hair}"/>`,
            wavy:`<path d="M27 40Q20 13 44 15Q54 7 66 18Q79 25 72 43L65 30Q45 21 32 35Z" fill="${item.hair}"/>`,
            long:`<path d="M25 42Q20 11 50 12Q81 12 75 45L74 83L64 87L65 35Q48 24 33 35L35 85L25 81Z" fill="${item.hair}"/>`,
            bun:`<circle cx="63" cy="15" r="10" fill="${item.hair}"/><path d="M27 43Q23 13 49 14Q73 14 73 43L66 30Q48 24 33 34Z" fill="${item.hair}"/>`,
            ponytail:`<path d="M27 40Q23 12 50 13Q78 13 73 42L67 30Q48 23 33 33Z" fill="${item.hair}"/><path d="M70 31Q88 37 77 61Q72 67 70 53Z" fill="${item.hair}"/>`,
            bob:`<path d="M25 44Q19 11 50 12Q82 12 75 47L72 66L63 72L64 36Q47 24 33 36L34 70L26 64Z" fill="${item.hair}"/>`,
            coils:`<g fill="${item.hair}">${Array.from({length:9},(_,i)=>`<circle cx="${28+(i%5)*11}" cy="${20+Math.floor(i/5)*10}" r="9"/>`).join("")}</g><path d="M26 35L29 58M74 35L71 58" stroke="${item.hair}" stroke-width="6"/>`,
            fringe:`<path d="M26 42Q22 12 50 12Q79 12 74 43L65 30Q60 40 51 31Q42 42 33 31Z" fill="${item.hair}"/>`
        };
        const beard = item.beard ? `<path d="M34 48Q50 67 66 48L62 62Q50 76 38 62Z" fill="${item.hair}" opacity=".9"/>` : "";
        const glasses = item.glasses ? `<g fill="none" stroke="#273449" stroke-width="2.5"><rect x="34" y="35" width="13" height="10" rx="4"/><rect x="53" y="35" width="13" height="10" rx="4"/><path d="M47 39H53"/></g>` : "";
        return `<svg viewBox="0 0 100 100" class="animated-person-avatar" aria-hidden="true"><circle cx="50" cy="50" r="49" fill="#e9f1ff"/><path d="M13 100Q15 69 50 68Q85 69 87 100" fill="${item.shirt}"/><path d="M41 62H59V76Q50 83 41 76Z" fill="${item.skin}"/><ellipse cx="50" cy="39" rx="22" ry="26" fill="${item.skin}"/>${hairShapes[item.style]}<g class="avatar-blink"><ellipse cx="42" cy="40" rx="2.2" ry="3" fill="#28212a"/><ellipse cx="58" cy="40" rx="2.2" ry="3" fill="#28212a"/></g><path d="M44 51Q50 55 56 51" fill="none" stroke="#9d5550" stroke-width="2" stroke-linecap="round"/>${beard}${glasses}<path d="M12 100Q14 83 28 78L36 100M88 100Q86 83 72 78L64 100" fill="${item.shirt}"/></svg>`;
    }
    function buildProfileChoices(gender = "men") {
        const avatarRoot = $("avatarChoices"), quoteRoot = $("motivationChoices");
        if (!avatarRoot || !quoteRoot) return;
        avatarRoot.replaceChildren();
        builtInAvatars.forEach((item,index) => {
            if (item.gender !== gender) return;
            const button = document.createElement("button"); button.type="button"; button.className="avatar-choice"; button.setAttribute("aria-label",`Choose ${item.name} illustrated avatar`); button.innerHTML=avatarSvg(item);
            button.addEventListener("click",()=>{localStorage.setItem(photoKey,`avatar:${index}`);renderProfilePhoto();showToast(`${item.name} avatar selected!`);}); avatarRoot.appendChild(button);
        });
        // Quote Cards: restrained gradient cards with serif quote styling.
        if (!quoteRoot.dataset.ready) {
            quoteRoot.dataset.ready="true";
            motivationCards.forEach((item,index)=>{const button=document.createElement("button");button.type="button";button.className="motivation-card-choice";button.innerHTML=`<span class="quote-mark" aria-hidden="true">“</span><span class="quote-card-line"></span><span class="quote-card-text"></span>`;button.querySelector(".quote-card-line").style.background="var(--accent)";button.querySelector(".quote-card-text").textContent=item[0];button.style.background="linear-gradient(135deg,var(--surface-2),color-mix(in srgb,var(--accent) 42%,var(--surface)))";button.addEventListener("click",()=>{localStorage.setItem(photoKey,`quote:${index}`);renderProfilePhoto();showToast("Motivation card selected!");});quoteRoot.appendChild(button);});
        }
    }
    // Custom Quote: saved quotes are scoped to the current account and limited to five.
    const customQuotesKey=`todoDaily_customQuotes_${email}`;
    function getCustomQuotes(){try{const q=JSON.parse(localStorage.getItem(customQuotesKey)||"[]");return Array.isArray(q)?q.filter(x=>typeof x==="string").slice(0,5):[];}catch{return [];}}
    function quoteFontSize(text){const n=String(text||"").length;return n>75?10:n>55?11:n>35?12:14;}
    function buildQuoteCard(text, customIndex=null){const b=document.createElement("button");b.type="button";b.className="motivation-card-choice custom-quote-choice";b.setAttribute("aria-label",`Use quote: ${text}`);b.innerHTML='<span class="quote-mark" aria-hidden="true">“</span><span class="quote-card-line"></span><span class="quote-card-text"></span>';b.querySelector('.quote-card-line').style.background='var(--accent)';const t=b.querySelector('.quote-card-text');t.textContent=text;t.style.fontSize=`${quoteFontSize(text)}px`;b.style.background='linear-gradient(135deg,var(--surface-2),color-mix(in srgb,var(--accent) 42%,var(--surface)))';b.addEventListener('click',()=>{if(customIndex!==null)localStorage.setItem(photoKey,`customquote:${customIndex}`);else localStorage.setItem(photoKey,`quote:${motivationCards.findIndex(q=>q[0]===text)}`);renderProfilePhoto();showToast('Motivation card selected!');});if(customIndex!==null){const del=document.createElement('span');del.className='custom-quote-delete';del.textContent='✖';del.setAttribute('role','button');del.setAttribute('tabindex','0');del.setAttribute('aria-label','Delete custom quote');del.addEventListener('click',e=>{e.stopPropagation();const selected=localStorage.getItem(photoKey)||'';const selectedIndex=selected.startsWith('customquote:')?Number(selected.split(':')[1]):-1;const list=getCustomQuotes();list.splice(customIndex,1);localStorage.setItem(customQuotesKey,JSON.stringify(list));if(selectedIndex===customIndex)localStorage.removeItem(photoKey);else if(selectedIndex>customIndex)localStorage.setItem(photoKey,`customquote:${selectedIndex-1}`);renderCustomQuoteGrid();renderProfilePhoto();});del.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();del.click();}});b.appendChild(del);}return b;}
    function renderCustomQuoteGrid(){const root=$('motivationChoices');if(!root)return;root.querySelectorAll('.custom-quote-choice').forEach(n=>n.remove());getCustomQuotes().forEach((q,i)=>root.appendChild(buildQuoteCard(q,i)));}
    function openCustomQuoteForm(){let modal=$('customQuoteModal');if(!modal){modal=document.createElement('div');modal.id='customQuoteModal';modal.className='modal-overlay';modal.hidden=true;modal.innerHTML=`<section class="confirm-modal custom-quote-modal" role="dialog" aria-modal="true" aria-labelledby="customQuoteTitle" tabindex="-1"><h2 id="customQuoteTitle">Customize your quote</h2><label for="customQuoteInput">Your motivation quote</label><input id="customQuoteInput" maxlength="160" type="text" autocomplete="off" placeholder="I will win"><p id="customQuoteCounter" aria-live="polite">0/10 words</p><p id="customQuoteError" class="field-error" role="alert"></p><h3>Live preview</h3><div id="customQuotePreview" class="custom-quote-preview"><span class="quote-mark">“</span><span class="quote-card-line"></span><span id="customQuotePreviewText">Your quote appears here</span></div><div class="modal-actions"><button type="button" class="btn btn-primary" id="useCustomQuote">Use as profile picture</button><button type="button" class="btn btn-outline" id="cancelCustomQuote">Cancel</button></div></section>`;document.body.appendChild(modal);const input=modal.querySelector('#customQuoteInput'),counter=modal.querySelector('#customQuoteCounter'),err=modal.querySelector('#customQuoteError'),preview=modal.querySelector('#customQuotePreview'),previewText=modal.querySelector('#customQuotePreviewText');const update=()=>{const val=input.value.trim(),words=val?val.split(/\s+/).length:0,validChars=/^[A-Za-z0-9 .,!?'-]*$/.test(input.value);counter.textContent=`${words}/10 words`;counter.style.color=words>10?'#ef4444':'';err.textContent=words>10?'Please use 10 words or fewer.':!validChars?'Use only letters, numbers, spaces, and basic punctuation.':'';previewText.textContent=val||'Your quote appears here';previewText.style.fontSize=`${quoteFontSize(val)}px`;preview.classList.toggle('invalid-quote',words>10||!validChars);};input.addEventListener('input',update);modal.querySelector('#cancelCustomQuote').addEventListener('click',()=>modal.hidden=true);modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true;});modal.querySelector('#useCustomQuote').addEventListener('click',()=>{const val=input.value.trim(),words=val?val.split(/\s+/).length:0;update();if(!val||words>10||!/^[A-Za-z0-9 .,!?'-]+$/.test(val)){err.textContent=words>10?'Please use 10 words or fewer.':'Enter a quote using the allowed characters.';input.focus();return;}let list=getCustomQuotes();if(!list.includes(val)){if(list.length>=5){err.textContent='You can save up to 5 custom quotes. Delete one first.';return;}list.push(val);}localStorage.setItem(customQuotesKey,JSON.stringify(list));const index=list.indexOf(val);localStorage.setItem(photoKey,`customquote:${index}`);renderCustomQuoteGrid();renderProfilePhoto();modal.hidden=true;showToast('Your custom motivation card is saved!');});}modal.hidden=false;modal.querySelector('#customQuoteInput').value='';modal.querySelector('#customQuoteInput').dispatchEvent(new Event('input'));requestAnimationFrame(()=>modal.querySelector('#customQuoteInput').focus());}
    const customQuoteBtn=document.createElement('button');customQuoteBtn.type='button';customQuoteBtn.className='btn btn-outline btn-small customize-quote-btn';customQuoteBtn.textContent='Customize your quote';customQuoteBtn.addEventListener('click',openCustomQuoteForm);$('motivationChoices')?.parentElement?.insertBefore(customQuoteBtn,$('motivationChoices').nextSibling);
    function renderProfilePhoto(){const frame=$('profilePhotoFrame');if(!frame)return;const value=localStorage.getItem(photoKey)||'';frame.replaceChildren();frame.className='profile-photo-frame';frame.style.background='';if(value.startsWith('data:image/')){const img=document.createElement('img');img.src=value;img.alt=`${username}'s profile photo`;frame.appendChild(img);}else if(value.startsWith('avatar:')){const item=builtInAvatars[Number(value.split(':')[1])]||builtInAvatars[0];frame.classList.add('avatar-photo');frame.innerHTML=avatarSvg(item);}else if(value.startsWith('quote:')){const item=motivationCards[Number(value.split(':')[1])]||motivationCards[0];frame.classList.add('quote-photo');frame.style.background=`linear-gradient(135deg,var(--surface-2),color-mix(in srgb,var(--accent) 45%,var(--surface)))`;const quote=document.createElement('span');quote.textContent=item[0];quote.style.fontSize=`${quoteFontSize(item[0])}px`;frame.appendChild(quote);}else if(value.startsWith('customquote:')){const item=getCustomQuotes()[Number(value.split(':')[1])]||'I will win';frame.classList.add('quote-photo');frame.style.background='linear-gradient(135deg,var(--surface-2),color-mix(in srgb,var(--accent) 45%,var(--surface)))';const quote=document.createElement('span');quote.textContent=item;quote.style.fontSize=`${quoteFontSize(item)}px`;frame.appendChild(quote);}else{const span=document.createElement('span');span.id='profileAvatarLetter';span.textContent=username.charAt(0).toUpperCase();frame.appendChild(span);}}
    
    document.querySelectorAll("[data-avatar-tab]").forEach(tab=>tab.addEventListener("click",()=>{document.querySelectorAll("[data-avatar-tab]").forEach(other=>{const active=other===tab;other.classList.toggle("selected",active);other.setAttribute("aria-selected",String(active));});buildProfileChoices(tab.dataset.avatarTab);}));
    updateIdentity(); buildProfileChoices(); renderCustomQuoteGrid(); renderProfilePhoto();

    // Toasts and praise
    function showToast(message, icon = "✓", duration = 3000, action = null) {
        const version = ++toastVersion;
        clearTimeout(toastTimer);
        $("toastMessage").textContent = message;
        $("toastIcon").textContent = icon;
        const actionButton = $("toastAction");
        if (actionButton) {
            actionButton.hidden = typeof action !== "function";
            actionButton.textContent = action ? "Undo" : "";
            actionButton.onclick = action || null;
        }
        $("toast").classList.add("show");
        toastTimer = setTimeout(() => {
            if (version === toastVersion) {
                $("toast").classList.remove("show");
                if (actionButton) { actionButton.hidden = true; actionButton.onclick = null; }
            }
        }, duration);
    }
    function showPraise(task) {
        let index = Math.floor(Math.random() * praiseOpeners.length);
        if (index === lastPraise) index = (index + 1 + Math.floor(Math.random() * (praiseOpeners.length - 1))) % praiseOpeners.length;
        lastPraise = index;
        const activeLeft = tasks.filter(item => !item.completed).length;
        const firstLine = praiseStyles[Math.floor(Math.random() * praiseStyles.length)](praiseOpeners[index], username, task.text);
        const secondLine = activeLeft > 1 ? `There are ${activeLeft} more tasks to complete.` : activeLeft === 1 ? "Only 1 more task to complete." : `Amazing, ${username}! You have completed ALL your tasks today! 🏆`;
        showToast(`${firstLine}${String.fromCharCode(10)}${secondLine}`, "🎉", 4000);
    }

    // Weekly Data
    const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    // Pie Colors: fixed, high-contrast palette independent of the selected theme.
    const dayColors = ["#e63946", "#f4a261", "#f9c74f", "#2a9d8f", "#4361ee", "#9b5de5", "#f15bb5"];
    function dateKey(date) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    function startOfWeek(date = new Date()) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const offset = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - offset);
        return d;
    }
    function readWeeklyData() {
        try {
            const data = JSON.parse(localStorage.getItem(weeklyKey) || "{}");
            return data && typeof data === "object" && !Array.isArray(data) ? data : {};
        } catch { return {}; }
    }
    // Daily Log: completed IDs and the highest planned-task count are permanent for each date.
    function readDailyLog() {
        let parsed = {};
        try { parsed = JSON.parse(localStorage.getItem(dailyLogKey) || "{}"); } catch {}
        const log = {};
        Object.entries(parsed && typeof parsed === "object" ? parsed : {}).forEach(([day, value]) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
            if (typeof value === "number") log[day] = { completedTaskIds: Array.from({length: Math.max(0, value)}, (_,i) => `legacy-${day}-${i}`), total: Math.max(0,value), planned: Math.max(tasks.length, value) };
            else if (value && typeof value === "object") {
                const ids = Array.isArray(value.completedTaskIds) ? [...new Set(value.completedTaskIds.map(String))] : [];
                log[day] = { completedTaskIds: ids, total: Math.max(Number(value.total)||0, ids.length), planned: Math.max(Number(value.planned)||0, Number(value.tasksPlanned)||0) };
            }
        });
        return log;
    }
    function saveDailyLog(log) {
        try { localStorage.setItem(dailyLogKey, JSON.stringify(log)); } catch { showToast("Could not save progress. Check browser storage.", "!"); }
    }
    function updatePlannedCount() {
        const log = readDailyLog(); const today = dateKey(new Date());
        log[today] ||= { completedTaskIds: [], total: 0, planned: 0 };
        log[today].planned = Math.max(Number(log[today].planned)||0, allSavedTasks().length);
        log[today].total = Math.max(Number(log[today].total)||0, log[today].completedTaskIds.length);
        saveDailyLog(log);
    }
    // Completed Count: the log mirrors current ticks and never becomes negative.
    function recordDailyCompletion(task, completed) {
        const log = readDailyLog(); const today = dateKey(new Date());
        log[today] ||= { completedTaskIds: [], total: 0, planned: 0 };
        const entry = log[today]; entry.completedTaskIds ||= [];
        const id = String(task.id);
        if (completed && !entry.completedTaskIds.includes(id)) entry.completedTaskIds.push(id);
        if (!completed) entry.completedTaskIds = entry.completedTaskIds.filter(existing => existing !== id);
        entry.total = Math.max(0, entry.completedTaskIds.length);
        entry.planned = Math.max(Number(entry.planned)||0, allSavedTasks().length, entry.total);
        saveDailyLog(log);
    }
    function countForDay(entry) { return Math.max(0, Number(entry?.total)||0); }

    function saveWeeklyData() {
        const history = readWeeklyData(); const log = readDailyLog();
        const currentWeekStart = dateKey(startOfWeek());
        const weekKeys = new Set(Object.keys(history).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key)));
        Object.keys(log).forEach(day => weekKeys.add(dateKey(startOfWeek(new Date(`${day}T12:00:00`)))));
        weekKeys.add(currentWeekStart);
        [...weekKeys].sort().forEach(weekStart => {
            const daily = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
            const plannedDaily = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
            Object.entries(log).forEach(([day, entry]) => {
                if (dateKey(startOfWeek(new Date(`${day}T12:00:00`))) !== weekStart) return;
                const key = dayKeys[(new Date(`${day}T12:00:00`).getDay()+6)%7];
                daily[key] = countForDay(entry); plannedDaily[key] = Math.max(0, Number(entry.planned)||0);
            });
            const totalCompleted = Object.values(daily).reduce((a,b)=>a+b,0);
            const totalPlanned = Object.values(plannedDaily).reduce((a,b)=>a+b,0);
            history[weekStart] = { weekStart, daily, plannedDaily, totalCompleted, totalTasks: totalPlanned, completionPercent: totalPlanned ? Math.min(100, Math.round(totalCompleted/totalPlanned*100)) : 0 };
        });
        const keys = Object.keys(history).sort(); keys.slice(0, Math.max(0, keys.length-52)).forEach(key=>delete history[key]);
        try { localStorage.setItem(weeklyKey, JSON.stringify(history)); } catch { showToast("Could not save weekly progress. Check browser storage.", "!"); }
        return history;
    }
    function weekRangeLabel(weekStart) {
        const start = new Date(`${weekStart}T12:00:00`);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const fmt = date => date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return `${fmt(start)} – ${fmt(end)}`;
    }
    function currentWeekCompleted(record) {
        return record ? Number(record.totalCompleted) || 0 : 0;
    }

    // Charts: bars use the day's planned count; pie colors remain fixed across themes.
    function renderBarChart(record) {
        const todayIndex=(new Date().getDay()+6)%7;
        const counts=dayKeys.map(k=>Number(record.daily?.[k])||0), planned=dayKeys.map(k=>Number(record.plannedDaily?.[k])||0);
        $("weeklyBarChart").innerHTML=dayLabels.map((day,i)=>{const pct=planned[i]?Math.min(100,counts[i]/planned[i]*100):0;return `<div class="bar-column"><span class="bar-count">${counts[i]}/${planned[i]}</span><div class="bar-track" aria-label="${day}: ${counts[i]} of ${planned[i]} completed"><div class="bar-value ${i===todayIndex?"is-today":""}" style="height:${pct}%"></div></div><span class="bar-day">${day}</span></div>`;}).join("");
    }
    function renderDonut(record) {
        const counts=dayKeys.map(k=>Number(record.daily?.[k])||0), total=counts.reduce((a,b)=>a+b,0), r=42, circ=2*Math.PI*r; let offset=0;
        const segments=counts.map((v,i)=>{if(!v||!total)return "";const len=v/total*circ;const out=`<circle cx="50" cy="50" r="${r}" fill="none" stroke="${dayColors[i]}" stroke-width="13" stroke-dasharray="${len} ${circ-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)"/>`;offset+=len;return out;}).join("");
        $("weeklyDonutChart").innerHTML=`<svg viewBox="0 0 100 100" role="img" aria-label="Weekly completed tasks donut chart"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--border)" stroke-width="13"/>${segments}<text x="50" y="47" class="donut-center-value" text-anchor="middle">${total}</text><text x="50" y="60" class="donut-center-label" text-anchor="middle">done</text></svg>`;
        $("weeklyDonutLegend").innerHTML=dayLabels.map((d,i)=>`<div class="legend-item"><span class="legend-dot" style="background:${dayColors[i]}"></span><span>${d}</span><strong>${counts[i]}</strong></div>`).join("");
    }
    function renderPieChart(record) {
        const counts=dayKeys.map(k=>Number(record.daily?.[k])||0), total=counts.reduce((a,b)=>a+b,0);let angle=-Math.PI/2;
        const slices=counts.map((v,i)=>{if(!v||!total)return "";const next=angle+v/total*Math.PI*2,x1=50+42*Math.cos(angle),y1=50+42*Math.sin(angle),x2=50+42*Math.cos(next),y2=50+42*Math.sin(next);const large=next-angle>Math.PI?1:0;const path=total===v?`<circle cx="50" cy="50" r="42" fill="${dayColors[i]}"/>`:`<path d="M50 50 L${x1} ${y1} A42 42 0 ${large} 1 ${x2} ${y2} Z" fill="${dayColors[i]}"/>`;angle=next;return path;}).join("");
        $("weeklyDonutChart").innerHTML=`<svg viewBox="0 0 100 100" role="img" aria-label="Weekly completed tasks pie chart">${slices}</svg>`;
        $("weeklyDonutLegend").innerHTML=dayLabels.map((d,i)=>`<div class="legend-item"><span class="legend-dot" style="background:${dayColors[i]}"></span><span>${d}</span><strong>${counts[i]}</strong></div>`).join("");
    }
    // Line Chart: percentage axis, grid, smooth curve, accessible exact-value tooltips, draw animation.
    function renderProfessionalLine(target, points, label) {
        if(!target)return;const W=700,H=270,L=48,R=20,T=28,B=52,plotW=W-L-R,plotH=H-T-B;
        const coords=points.map((p,i)=>({...p,x:L+(points.length===1?plotW/2:i*plotW/(points.length-1)),y:T+(100-Math.max(0,Math.min(100,p.value)))/100*plotH}));
        const path=coords.map((p,i)=>i===0?`M ${p.x} ${p.y}`:`${i===1?'L':'L'} ${p.x} ${p.y}`).join(' ');
        const smooth=coords.length>2?coords.reduce((out,p,i)=>{if(i===0)return `M ${p.x} ${p.y}`;const prev=coords[i-1],mid=(prev.x+p.x)/2;return `${out} C ${mid} ${prev.y}, ${mid} ${p.y}, ${p.x} ${p.y}`;},''):path;
        const grid=[0,25,50,75,100].map(v=>{const y=T+(100-v)/100*plotH;return `<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" class="chart-gridline"/><text x="${L-9}" y="${y+4}" class="line-axis-label" text-anchor="end">${v}%</text>`;}).join('');
        target.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}" preserveAspectRatio="xMidYMid meet">${grid}<path d="${smooth}" class="professional-line" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/><style>.professional-line{stroke-dasharray:1200;stroke-dashoffset:1200;animation:chart-draw 1.2s ease forwards}@keyframes chart-draw{to{stroke-dashoffset:0}}</style>${coords.map(p=>`<g tabindex="0" role="img" aria-label="${p.label}: ${p.value}%"><title>${p.label}: ${p.value}%</title><circle cx="${p.x}" cy="${p.y}" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"><title>${p.label}: ${p.value}%</title></circle><text x="${p.x}" y="${Math.max(T+12,p.y-11)}" class="line-point-value" text-anchor="middle">${p.value}%</text><text x="${p.x}" y="${H-20}" class="line-point-label" text-anchor="middle">${p.label}</text></g>`).join('')}</svg>`;
    }
    function renderLineChart(records) { renderProfessionalLine($("weekLineChart"),records.map(r=>({value:Number(r.completionPercent)||0,label:new Date(`${r.weekStart}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short'})})),"Weekly completion percentages"); }
    function renderWeekDayTrend(record,target) {
        const counts=dayKeys.map(k=>Number(record.daily?.[k])||0), planned=dayKeys.map(k=>Number(record.plannedDaily?.[k])||0);
        renderProfessionalLine(target,dayLabels.map((label,i)=>({label,value:planned[i]?Math.round(counts[i]/planned[i]*100):0})),"Daily completion percentages Monday through Sunday");
    }

    function renderWeeklyProgress() {
        const history = saveWeeklyData();
        const keys = Object.keys(history).sort();
        const currentKey = dateKey(startOfWeek());
        const current = history[currentKey];
        const completed = currentWeekCompleted(current);
        const planned = Object.values(current?.plannedDaily || {}).reduce((sum,value)=>sum+(Number(value)||0),0);
        $("weekRangeLabel").textContent = weekRangeLabel(currentKey);
        $("weeklyEmpty").hidden = planned > 0;
        $("weeklyCharts").hidden = planned === 0;
        if (planned > 0) {
            renderBarChart(current);
            renderDonut(current);
            renderWeekDayTrend(current, $("weeklyTrendChart"));
            $("weekCompletedCount").textContent = completed;
            $("weekActiveCount").textContent = tasks.filter(task => !task.completed).length;
            $("weekPercentLabel").textContent = `${current.completionPercent}%`;
            $("weekPercentFill").style.width = `${current.completionPercent}%`;
        }
        const sortedRecords = keys.map(key => history[key]).filter(record => record && record.weekStart).slice(-8);
        const hasComparison = keys.length >= 2;
        $("weekComparison").hidden = !hasComparison;
        $("comparisonNote").hidden = hasComparison;
        if (hasComparison) {
            renderLineChart(sortedRecords);
            const previous = history[keys[keys.indexOf(currentKey) - 1]];
            const nowPercent = Number(current?.completionPercent) || 0;
            const previousPercent = Number(previous?.completionPercent) || 0;
            const badge = $("weekComparisonBadge");
            badge.className = "comparison-badge";
            if (nowPercent > previousPercent && previousPercent === 0) {
                badge.classList.add("neutral");
                badge.textContent = "New progress!";
            } else if (nowPercent > previousPercent) {
                const change = Math.round(((nowPercent - previousPercent) / previousPercent) * 100);
                badge.classList.add("up");
                badge.textContent = `▲ +${change}% vs last week`;
            } else if (nowPercent < previousPercent) {
                const change = Math.round(((previousPercent - nowPercent) / previousPercent) * 100);
                badge.classList.add("down");
                badge.textContent = `▼ -${change}% vs last week`;
            } else {
                badge.classList.add("neutral");
                badge.textContent = "No change vs last week";
            }
        }
        if (typeof updateWeeklyChartType === "function") updateWeeklyChartType();
    }

    // Weekly chart type and popup
    const weeklyChartType = $("weeklyChartType");
    if (weeklyChartType) {
        weeklyChartType.value = localStorage.getItem(weeklyChartKey) || "bar-pie";
        if (!['bar-pie','bar','line','pie','donut'].includes(weeklyChartType.value)) weeklyChartType.value = "bar";
        weeklyChartType.addEventListener("change", () => {
            localStorage.setItem(weeklyChartKey, weeklyChartType.value);
            updateWeeklyChartType();
        });
    }
    function updateWeeklyChartType() {
        const type = weeklyChartType?.value || "bar-pie";
        $("weeklyBarCard").hidden = !["bar-pie", "bar"].includes(type);
        $("weeklyDonutCard").hidden = !["bar-pie", "pie", "donut"].includes(type);
        $("weeklyTrendCard").hidden = type !== "line";
        const currentRecord = saveWeeklyData()[dateKey(startOfWeek())];
        if (type === "pie" || type === "bar-pie") { $("weeklyDonutChart").classList.add("pie-chart-mode"); if (currentRecord) renderPieChart(currentRecord); }
        else { $("weeklyDonutChart").classList.remove("pie-chart-mode"); if (currentRecord) renderDonut(currentRecord); }
        if (currentRecord) renderWeekDayTrend(currentRecord, $("weeklyTrendChart"));
    }
    const weeklyModal = $("weeklyModal");
    let weeklyModalReturnFocus = null;
    function openWeeklyModal() {
        weeklyModalReturnFocus = document.activeElement;
        weeklyModal.hidden = false;
        document.body.classList.add("modal-open");
        updateWeeklyChartType();
        requestAnimationFrame(() => weeklyModal.querySelector(".weekly-modal")?.focus());
    }
    function closeWeeklyModal() {
        weeklyModal.hidden = true;
        document.body.classList.remove("modal-open");
        weeklyModalReturnFocus?.focus?.();
    }
    $("viewWeeklyProgress").addEventListener("click", openWeeklyModal);
    $("closeWeeklyModal").addEventListener("click", closeWeeklyModal);
    $("closeWeeklyModalBottom").addEventListener("click", closeWeeklyModal);
    weeklyModal.addEventListener("click", event => { if (event.target === weeklyModal) closeWeeklyModal(); });

    // Profile panel
    const profileToggle = $("profileToggle");
    const profilePanel = $("profilePanel");
    const profileBackdrop = $("profileBackdrop");
    function openProfilePanel() {
        profilePanel.hidden = false;
        profileBackdrop.hidden = false;
        profilePanel.inert = false;
        profilePanel.setAttribute("aria-hidden", "false");
        profileToggle.setAttribute("aria-expanded", "true");
        profileToggle.setAttribute("aria-label", "Close profile menu");
        profileToggle.classList.add("is-open");
        requestAnimationFrame(() => {
            profilePanel.classList.add("open");
            profileBackdrop.classList.add("visible");
        });
    }
    function closeProfilePanel(returnFocus = false) {
        if (profilePanel.hidden) return;
        profilePanel.classList.remove("open");
        profileBackdrop.classList.remove("visible");
        profilePanel.setAttribute("aria-hidden", "true");
        profilePanel.inert = true;
        profileToggle.setAttribute("aria-expanded", "false");
        profileToggle.setAttribute("aria-label", "Open profile menu");
        profileToggle.classList.remove("is-open");
        setTimeout(() => {
            profilePanel.hidden = true;
            profileBackdrop.hidden = true;
        }, 220);
        if (returnFocus) profileToggle.focus();
    }
    profileToggle.addEventListener("click", () => {
        if (profilePanel.hidden) openProfilePanel();
        else closeProfilePanel();
    });
    $("closeProfilePanel").addEventListener("click", () => closeProfilePanel(true));
    profileBackdrop.addEventListener("click", () => closeProfilePanel());
    document.addEventListener("click", event => {
        if (weeklyModal && !weeklyModal.hidden) return;
        if (!$("confirmModal").hidden || !$("galleryPermissionModal").hidden || !$("reminderCalendarModal").hidden || !$("alertModal").hidden) return;
        if (!profilePanel.hidden && !profilePanel.contains(event.target) && !profileToggle.contains(event.target)) closeProfilePanel();
    });

    // Custom confirmation modals
    function closeModal() {
        $("confirmModal").hidden = true;
        modalAction = null;
        if (modalReturnToPanel) {
            modalReturnToPanel = false;
            if (profilePanel.hidden) openProfilePanel();
        }
        if (lastFocusedElement && document.contains(lastFocusedElement)) {
            lastFocusedElement.focus();
        } else if (!profilePanel.hidden) {
            $("editProfileBtn")?.focus();
        } else {
            profileToggle.focus();
        }
    }
    function openModal({ title, description, buttons, returnToPanel = true }) {
        lastFocusedElement = document.activeElement;
        modalReturnToPanel = returnToPanel;
        $("modalTitle").textContent = title;
        $("modalDescription").textContent = description;
        const confirmDialog = $("confirmModal").querySelector(".confirm-modal");
        confirmDialog.classList.toggle("clear-data-confirm-modal", title === "Clear data?");
        $("modalError").textContent = "";
        const actions = $("modalActions");
        actions.replaceChildren();
        buttons.forEach(item => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `btn ${item.primary ? "btn-primary" : "btn-outline"} modal-action`;
            button.textContent = item.label;
            button.addEventListener("click", () => item.action());
            actions.appendChild(button);
        });
        $("confirmModal").hidden = false;
        requestAnimationFrame(() => {
            const dialog = $("confirmModal").querySelector(".confirm-modal");
            dialog.focus();
            actions.querySelector("button")?.focus();
        });
    }
    $("confirmModal").addEventListener("click", event => {
        if (event.target === $("confirmModal")) closeModal();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if (!$("galleryPermissionModal").hidden) closeGalleryPermission();
            else if (!$("reminderCalendarModal").hidden) closeCalendar();
            else if (!$("alertModal").hidden) $("alertModal").hidden = true;
            else if (!$("confirmModal").hidden) closeModal();
            else if (weeklyModal && !weeklyModal.hidden) closeWeeklyModal();
            else if ($("taskAlarmModal") && !$("taskAlarmModal").hidden) closeAlarmModal("stop");
            else if ($("taskAlarmEditModal") && !$("taskAlarmEditModal").hidden) $("taskAlarmEditModal").hidden = true;
            else if ($("customQuoteModal") && !$("customQuoteModal").hidden) $("customQuoteModal").hidden = true;
            else if (!profilePanel.hidden) closeProfilePanel(true);
        }
        if (event.key === "Tab") {
            const overlays = [$("confirmModal"), $("galleryPermissionModal"), $("reminderCalendarModal"), $("alertModal"), weeklyModal, $("customQuoteModal"), $("taskAlarmEditModal"), $("taskAlarmModal")];
            const activeOverlay = overlays.find(overlay => overlay && !overlay.hidden);
            if (!activeOverlay) return;
            const dialog = activeOverlay.querySelector('[role="dialog"]');
            const focusable = dialog ? [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter(el => !el.hidden) : [];
            if (!focusable.length) return;
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });

    // Profile name and photo editor
    $("editProfileBtn").addEventListener("click", () => {
        const view = $("profileEditView");
        view.hidden = !view.hidden;
        if (!view.hidden) { $("newProfileName").value = username; $("nameEditError").textContent = ""; $("newProfileName").focus(); }
    });
    $("cancelNameEdit").addEventListener("click", () => {
        $("profileEditView").hidden = true;
        $("nameEditError").textContent = "";
    });
    $("nameEditForm").addEventListener("submit", event => {
        event.preventDefault();
        const newName = normalizeName($("newProfileName").value);
        if (!validName(newName)) {
            $("nameEditError").textContent = "Use 3–20 characters: letters and numbers, with single spaces between words. Symbols and underscores aren't allowed.";
            $("newProfileName").focus(); return;
        }
        const freshAccounts = getAccounts();
        if (!freshAccounts[email]) { $("nameEditError").textContent = "Could not find this account. Please sign in again."; return; }
        freshAccounts[email].username = newName; setAccounts(freshAccounts); accounts = freshAccounts; account = freshAccounts[email];
        $("profileEditView").hidden = true; updateIdentity(); renderTasks(); showToast("Profile name updated.", "✓");
    });
    // Gallery Permission: ask once per user before opening the browser file picker.
    const galleryPermissionKey = `todoDaily_galleryPermission_${email}`;
    const galleryPermissionModal = $("galleryPermissionModal");
    function closeGalleryPermission() { galleryPermissionModal.hidden = true; $("chooseGalleryBtn").focus(); }
    $("chooseGalleryBtn").addEventListener("click", () => {
        if (localStorage.getItem(galleryPermissionKey) === "allowed") { $("profilePhotoFile").click(); return; }
        galleryPermissionModal.hidden = false;
        requestAnimationFrame(() => galleryPermissionModal.querySelector("[role=dialog]")?.focus());
    });
    $("allowGalleryBtn").addEventListener("click", () => { localStorage.setItem(galleryPermissionKey, "allowed"); galleryPermissionModal.hidden = true; $("profilePhotoFile").click(); });
    $("denyGalleryBtn").addEventListener("click", () => { closeGalleryPermission(); showToast("Gallery access denied", "!"); });
    $("resetGalleryPermission").addEventListener("click", event => { event.preventDefault(); localStorage.removeItem(galleryPermissionKey); showToast("Gallery permission reset."); });
    galleryPermissionModal.addEventListener("click", event => { if (event.target === galleryPermissionModal) closeGalleryPermission(); });

    $("profilePhotoFile").addEventListener("change", event => {
        const file = event.target.files?.[0]; if (!file) return;
        if (!file.type.startsWith("image/")) { $("photoError").textContent = "Please choose a valid image file."; event.target.value = ""; return; }
        $("photoError").textContent = "";
        const reader = new FileReader();
        reader.onerror = () => { $("photoError").textContent = "Could not read this image. Please try another file."; };
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => { $("photoError").textContent = "This image could not be opened."; };
            image.onload = () => {
                const canvas = document.createElement("canvas"); canvas.width = 200; canvas.height = 200;
                const ctx = canvas.getContext("2d");
                const side = Math.min(image.width, image.height); const sx = (image.width - side) / 2; const sy = (image.height - side) / 2;
                ctx.drawImage(image, sx, sy, side, side, 0, 0, 200, 200);
                try { localStorage.setItem(photoKey, canvas.toDataURL("image/jpeg", .82)); renderProfilePhoto(); showToast("Profile photo updated!"); }
                catch { $("photoError").textContent = "This photo is too large for browser storage. Try a smaller image."; }
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
    $("removeProfilePhoto").addEventListener("click", () => { localStorage.removeItem(photoKey); renderProfilePhoto(); showToast("Profile photo removed."); });

    // Account page
    $("openAccountPage").addEventListener("click", () => { window.location.href = "account.html"; });

    // Calendar: monthly date picker and reminder editor.
    // Reminders: user-scoped reminders with one-time alerts and missed alerts.
    const remindersKey = `todoDaily_reminders_${email}`;
    const reminderPageOpenedAt = Date.now();
    let reminders = [];
    let calendarCursor = new Date(); calendarCursor.setDate(1);
    let selectedReminderDate = dateKey(new Date());
    let editingReminderId = null;
    function loadReminders() {
        try { const parsed=JSON.parse(localStorage.getItem(remindersKey)||"[]"); reminders=Array.isArray(parsed)?parsed.filter(r=>r&&typeof r.id==="string"&&typeof r.title==="string"&&Number.isFinite(Number(r.timestamp))).map(r=>({...r})):[]; }
        catch { reminders=[]; }
    }
    function saveReminders() { try { localStorage.setItem(remindersKey,JSON.stringify(reminders)); return true; } catch { showToast("Could not save reminder. Browser storage may be full.","!"); return false; } }
    function reminderDateTime(dateString) {
        const parts=selectedTimeParts("reminderHour","reminderMinute","reminderAmPm");
        const [y,m,d]=dateString.split("-").map(Number); return new Date(y,m-1,d,parts.hours,parts.minutes,0,0);
    }
    function openCalendar() {
        $("reminderCalendarModal").hidden=false; renderCalendar(); renderReminderLists();
        requestAnimationFrame(()=>$("reminderCalendarModal").querySelector("[role=dialog]")?.focus());
    }
    function closeCalendar() { $("reminderCalendarModal").hidden=true; $("openReminderCalendar").focus(); }
    function renderCalendar() {
        const year=calendarCursor.getFullYear(), month=calendarCursor.getMonth();
        $("calendarMonthTitle").textContent=calendarCursor.toLocaleDateString(undefined,{month:"long",year:"numeric"});
        const grid=$("calendarGrid"); grid.replaceChildren();
        const firstDay=new Date(year,month,1).getDay(), daysInMonth=new Date(year,month+1,0).getDate();
        for(let i=0;i<firstDay;i++){const blank=document.createElement("span");blank.className="calendar-blank";blank.setAttribute("aria-hidden","true");grid.appendChild(blank);}
        const today=dateKey(new Date());
        for(let day=1;day<=daysInMonth;day++){
            const date=new Date(year,month,day,12); const key=dateKey(date); const button=document.createElement("button");button.type="button";button.className="calendar-day";button.textContent=String(day);button.setAttribute("role","gridcell");button.setAttribute("aria-label",date.toLocaleDateString(undefined,{dateStyle:"full"}));
            if(key===today)button.classList.add("today");if(key===selectedReminderDate)button.classList.add("selected");if(reminders.some(r=>dateKey(new Date(Number(r.timestamp)))===key))button.classList.add("has-reminder");
            button.addEventListener("click",()=>{selectedReminderDate=key;$("reminderDateInput").value=key;$("reminderEditor").hidden=false;editingReminderId=null;$("reminderFormTitle").textContent="Add reminder";$("reminderTitleInput").value="";$("reminderError").textContent="";renderCalendar();renderReminderLists();$("reminderTitleInput").focus();});grid.appendChild(button);
        }
    }
    function renderReminderRow(reminder) {
        const row=document.createElement("div");row.className="reminder-row";
        const date=new Date(Number(reminder.timestamp));const details=document.createElement("div");details.className="reminder-row-copy";const title=document.createElement("strong");title.textContent=reminder.title;const meta=document.createElement("small");meta.textContent=date.toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});details.append(title,meta);
        const actions=document.createElement("div");actions.className="reminder-row-actions";const edit=document.createElement("button");edit.type="button";edit.className="btn btn-outline btn-small";edit.textContent="Edit";edit.addEventListener("click",()=>editReminder(reminder));const del=document.createElement("button");del.type="button";del.className="btn btn-outline btn-small";del.textContent="Delete";del.addEventListener("click",()=>{reminders=reminders.filter(r=>r.id!==reminder.id);saveReminders();renderCalendar();renderReminderLists();showToast("Reminder deleted.");});actions.append(edit,del);row.append(details,actions);return row;
    }
    function renderReminderLists() {
        const selected=$("selectedDateReminders"), upcoming=$("upcomingReminders");selected.replaceChildren();upcoming.replaceChildren();
        $("selectedDateReminderTitle").textContent=`Reminders for ${new Date(`${selectedReminderDate}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}`;
        const todaySelected=reminders.filter(r=>dateKey(new Date(Number(r.timestamp)))===selectedReminderDate).sort((a,b)=>a.timestamp-b.timestamp);
        todaySelected.forEach(r=>selected.appendChild(renderReminderRow(r)));if(!todaySelected.length)selected.innerHTML='<p class="panel-subtitle">No reminders for this date.</p>';
        const upcomingItems=reminders.filter(r=>Number(r.timestamp)>=Date.now()&&!r.notified).sort((a,b)=>a.timestamp-b.timestamp).slice(0,8);upcomingItems.forEach(r=>upcoming.appendChild(renderReminderRow(r)));if(!upcomingItems.length)upcoming.innerHTML='<p class="panel-subtitle">No upcoming reminders.</p>';
    }
    function editReminder(reminder) {
        editingReminderId=reminder.id;const date=new Date(Number(reminder.timestamp));selectedReminderDate=dateKey(date);calendarCursor=new Date(date.getFullYear(),date.getMonth(),1);$("reminderEditor").hidden=false;$("reminderFormTitle").textContent="Edit reminder";$("reminderTitleInput").value=reminder.title;$("reminderDateInput").value=selectedReminderDate;
        let hour=date.getHours()%12;if(!hour)hour=12;$("reminderHour").value=String(hour);$("reminderMinute").value=String(date.getMinutes()).padStart(2,"0");$("reminderAmPm").value=date.getHours()>=12?"PM":"AM";$("reminderError").textContent="";renderCalendar();$("reminderTitleInput").focus();
    }
    function askNotificationPermissionThenCalendar() {
        const askedKey=`todoDaily_notificationPrompt_${email}`;
        if(localStorage.getItem(askedKey)==="yes" || !("Notification" in window) || Notification.permission!=="default") { openCalendar(); return; }
        openModal({title:"Reminder notifications",description:"Would you like TO DO Daily to ask your browser for notification permission? You can still use reminders without browser notifications.",returnToPanel:false,buttons:[
            {label:"Allow notifications",primary:true,action:()=>{localStorage.setItem(askedKey,"yes");closeModal();if("Notification" in window){try{const request=Notification.requestPermission();if(request&&typeof request.catch==="function")request.catch(()=>{});}catch{}}openCalendar();}},
            {label:"Not now",action:()=>{localStorage.setItem(askedKey,"yes");closeModal();openCalendar();}}
        ]});
    }
    $("openReminderCalendar").addEventListener("click",askNotificationPermissionThenCalendar);
    $("closeReminderCalendar").addEventListener("click",closeCalendar);
    $("reminderCalendarModal").addEventListener("click",event=>{if(event.target===$("reminderCalendarModal"))closeCalendar();});
    $("calendarPrev").addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()-1);renderCalendar();});
    $("calendarNext").addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()+1);renderCalendar();});
    $("cancelReminderEdit").addEventListener("click",()=>{$("reminderEditor").hidden=true;editingReminderId=null;$("reminderError").textContent="";});
    fillTimeSelects("reminderHour","reminderMinute",false);
    $("reminderForm").addEventListener("submit",event=>{
        event.preventDefault();const title=$("reminderTitleInput").value.trim();const dateValue=$("reminderDateInput").value;const stamp=dateValue?reminderDateTime(dateValue):new Date(NaN);
        if(!title){$("reminderError").textContent="Please enter a reminder title.";return;}
        if(!dateValue||Number.isNaN(stamp.getTime())){$("reminderError").textContent="Please choose a valid date and time.";return;}
        if(stamp.getTime()<=Date.now()&&editingReminderId===null){$("reminderError").textContent="Choose a time in the future.";return;}
        if(stamp.getTime()<=Date.now()&&editingReminderId!==null){$("reminderError").textContent="Choose a future date and time.";return;}
        const old=reminders.find(r=>r.id===editingReminderId);const item={id:editingReminderId||`r-${Date.now()}-${Math.random().toString(36).slice(2)}`,title,timestamp:stamp.getTime(),notified:false,missedNotified:false};
        if(old)reminders=reminders.map(r=>r.id===editingReminderId?item:r);else reminders.push(item);
        if(saveReminders()){selectedReminderDate=dateValue;calendarCursor=new Date(stamp.getFullYear(),stamp.getMonth(),1);$("reminderEditor").hidden=true;editingReminderId=null;renderCalendar();renderReminderLists();showToast("Reminder saved.","✓");}
    });
    function checkReminders() {
        const now=Date.now();let changed=false;
        for(const reminder of reminders){if(reminder.notified||reminder.missedNotified)continue;const when=Number(reminder.timestamp);if(when>now)continue;
            if(when>=reminderPageOpenedAt){reminder.notified=true;changed=true;notifyBrowser(`Reminder: ${reminder.title}`,"It's time for your reminder.");$("alertModalTitle").textContent=`Reminder: ${reminder.title}`;$("alertModalDescription").textContent="It's time for your reminder.";$("alertModalActions").replaceChildren();const close=document.createElement("button");close.type="button";close.className="btn btn-primary modal-action";close.textContent="Got it";close.addEventListener("click",()=>{$("alertModal").hidden=true;});$("alertModalActions").appendChild(close);$("alertModal").hidden=false;alertBeep();requestAnimationFrame(()=>close.focus());}
            else {reminder.missedNotified=true;reminder.notified=true;changed=true;showToast(`Missed reminder: ${reminder.title}`,"⏰",5000);}
        }
        if(changed){saveReminders();if(!$("reminderCalendarModal").hidden)renderReminderLists();}
    }
    loadReminders();renderReminderLists();setInterval(checkReminders,1000);

    // Daily Progress: every metric comes from the permanent daily log, not current task ticks.
    function renderDailyProgress() {
        const card=$("dailyProgressCard");if(!card)return;card.hidden=selectedView!=='daily';if(card.hidden)return;
        const log=readDailyLog(),dates=[];for(let i=6;i>=0;i--){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);dates.push(d);}
        const entries=dates.map(d=>log[dateKey(d)]||{completedTaskIds:[],total:0,planned:0}),counts=entries.map(countForDay),planned=entries.map(e=>Number(e.planned)||0),todayEntry=entries[6],todayCount=counts[6],todayPlanned=planned[6];
        const pct=todayPlanned?Math.min(100,Math.round(todayCount/todayPlanned*100)):0;
        $("dailyCompletedToday").textContent=todayCount;$("dailyPercentToday").textContent=`${pct}%`;$("dailyPercentFill").style.width=`${pct}%`;
        const yesterdayCount=counts[5],badge=$("dailyComparisonBadge");badge.className="comparison-badge";
        if(todayCount>yesterdayCount&&yesterdayCount===0){badge.classList.add("neutral");badge.textContent="New progress!";}else if(todayCount>yesterdayCount){badge.classList.add("up");badge.textContent=`▲ +${Math.round((todayCount-yesterdayCount)/yesterdayCount*100)}% vs yesterday`;}else if(todayCount<yesterdayCount){badge.classList.add("down");badge.textContent=`▼ -${Math.round((yesterdayCount-todayCount)/Math.max(1,yesterdayCount)*100)}% vs yesterday`;}else{badge.classList.add("neutral");badge.textContent="No change";}
        const type=$("dailyChartType").value||"bar",target=$("dailyChart"),labels=dates.map(d=>d.toLocaleDateString(undefined,{weekday:"short"}));
        if(type==="line") {renderProfessionalLine(target,dates.map((d,i)=>({label:labels[i],value:planned[i]?Math.round(counts[i]/planned[i]*100):0})),"Daily completion percentages for the last seven days");return;}
        if(type==="pie"||type==="donut"){
            const total=counts.reduce((a,b)=>a+b,0),r=38,circ=2*Math.PI*r;let offset=0,angle=-Math.PI/2;
            const arcs=counts.map((v,i)=>{if(!v||!total)return "";if(type==="pie"){const next=angle+v/total*Math.PI*2,x1=60+r*Math.cos(angle),y1=60+r*Math.sin(angle),x2=60+r*Math.cos(next),y2=60+r*Math.sin(next),large=next-angle>Math.PI?1:0;const path=total===v?`<circle cx="60" cy="60" r="${r}" fill="${dayColors[i]}"/>`:`<path d="M60 60 L${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${dayColors[i]}"/>`;angle=next;return path;}const len=v/total*circ,el=`<circle cx="60" cy="60" r="${r}" fill="none" stroke="${dayColors[i]}" stroke-width="14" stroke-dasharray="${len} ${circ-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"/>`;offset+=len;return el;}).join("");
            target.innerHTML=`<div class="daily-pie-wrap"><svg viewBox="0 0 120 120" role="img" aria-label="Last seven days completion ${type} chart">${arcs}${type==='donut'?`<text x="60" y="57" text-anchor="middle" class="donut-center-value">${total}</text><text x="60" y="69" text-anchor="middle" class="donut-center-label">done</text>`:""}</svg><div class="daily-pie-legend">${labels.map((l,i)=>`<span><i style="background:${dayColors[i]}"></i>${l}: ${counts[i]}</span>`).join("")}</div></div>`;return;
        }
        // Bar Chart: empty full-height track is the uncompleted share; filled height is done/planned.
        target.innerHTML=`<div class="daily-bars">${counts.map((v,i)=>{const p=planned[i],height=p?Math.min(100,v/p*100):0;return `<div class="daily-bar-col"><strong>${v}/${p}</strong><div class="daily-bar-track" aria-label="${labels[i]} ${v} of ${p} completed"><i class="${i===6?'is-today':''}" style="height:${height}%"></i></div><small>${labels[i]}</small></div>`;}).join("")}</div>`;
    }
    $("dailyChartType").value=localStorage.getItem(dailyChartKey)||"bar";if(!["bar","line","pie","donut"].includes($("dailyChartType").value))$("dailyChartType").value="bar";
    $("dailyChartType").addEventListener("change",()=>{localStorage.setItem(dailyChartKey,$("dailyChartType").value);renderDailyProgress();});

    // Tasks
    function saveTasks() {
        try {
            localStorage.setItem(activeListKey(), JSON.stringify(tasks));
            taskError.textContent = "";
            return true;
        } catch {
            taskError.textContent = "Could not save tasks. Check your browser storage.";
            return false;
        }
    }
    function loadTasks() {
        try {
            const saved = JSON.parse(localStorage.getItem(activeListKey()) || "[]");
            tasks = Array.isArray(saved) ? saved.filter(task =>
                task && typeof task.id === "string" && typeof task.text === "string" && typeof task.completed === "boolean"
            ).map(task => ({ ...task })) : [];
        } catch { tasks = []; }
    }
    // Daily Reset: local-calendar date check on load and every 30 seconds.
    const lastResetKey=`todoDaily_lastResetDate_${email}`;
    function resetWeekdayTasksForToday() {
        const today=dateKey(new Date()), key=`${weekTasksKey}_${todayId}`, resetKey=`${lastResetKey}_${todayId}`;
        if(!dayIds.includes(todayId))return false;
        const last=localStorage.getItem(resetKey);
        if(!last){localStorage.setItem(resetKey,today);return false;}
        if(last===today)return false;
        const list=readTaskArray(key);let changed=false;
        list.forEach(task=>{if(task.completed){task.completed=false;delete task.completedAt;changed=true;}});
        if(changed)localStorage.setItem(key,JSON.stringify(list));
        localStorage.setItem(resetKey,today);
        if(selectedView!=='daily'&&selectedDay===todayId){tasks=list;renderTasks();}
        if(changed)showToast(`New day, ${username}! Your ${dayNames[todayId]} tasks are fresh again. 💪`,'💪',4000);
        return changed;
    }
    function resetForNewDay(showToastAfter=true) {
        const now=new Date(),today=dateKey(now),resetKey=selectedView==='daily'?lastResetKey:`${lastResetKey}_${selectedDay}`;
        if(selectedView!=='daily' && todayId!==selectedDay)return false;
        const last=localStorage.getItem(resetKey);
        if(!last){localStorage.setItem(resetKey,today);updatePlannedCount();return false;}
        if(last===today)return false;
        let changed=false;tasks.forEach(task=>{if(task.completed){task.completed=false;delete task.completedAt;changed=true;}});
        localStorage.setItem(resetKey,today);
        if(changed)saveTasks();
        updatePlannedCount();
        renderTasks();
        if(showToastAfter)showToast(`New day, ${username}! Your tasks are fresh again. Let's go! 💪`,"💪",4500);
        return true;
    }
    function positionAddBar() {
        const previousRect = addWrap.getBoundingClientRect();
        if (tasks.length === 0) panel.insertBefore(addWrap, toolbar);
        else panel.insertBefore(addWrap, panel.querySelector(".list-footer"));
        const nextRect = addWrap.getBoundingClientRect();
        if (previousRect.width && nextRect.width && Math.abs(previousRect.top - nextRect.top) > 1) {
            addWrap.animate([
                { transform: `translateY(${previousRect.top - nextRect.top}px)` },
                { transform: "translateY(0)" }
            ], { duration: 300, easing: "ease-out" });
        }
    }
    function renderTasks() {
        const total = tasks.length;
        const completed = tasks.filter(task => task.completed).length;
        const remaining = total - completed;
        const percentage = total ? Math.round(completed / total * 100) : 0;
        $("totalStat").textContent = total;
        $("remainingStat").textContent = remaining;
        $("completedStat").textContent = percentage;
        $("taskCount").textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} left`;
        $("progressLabel").textContent = `${percentage}% completed`;
        $("progressFill").style.width = `${percentage}%`;
        $("progressTrack").setAttribute("aria-valuenow", percentage);
        $("allFilterCount").textContent = total;
        $("activeFilterCount").textContent = remaining;
        $("completedFilterCount").textContent = completed;
        $("clearCompleted").disabled = completed === 0;
        document.querySelectorAll("[data-filter]").forEach(button => {
            const active = button.dataset.filter === filter;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
        const ordered = [...tasks.filter(task => !task.completed), ...tasks.filter(task => task.completed)];
        const visible = ordered.filter(task => filter === "active" ? !task.completed : filter === "completed" ? task.completed : true);
        const list = taskListElement;
        const previousRects = new Map([...list.children].map(item => [item.dataset.taskId, item.getBoundingClientRect()]));
        list.replaceChildren();
        visible.forEach(task => {
            const li = document.createElement("li");
            li.className = "task-item";
            li.dataset.taskId = task.id;
            if (task.completed) li.classList.add("completed");
            const check = document.createElement("button");
            check.type = "button";
            check.className = "task-check";
            check.textContent = task.completed ? "✔" : "";
            check.setAttribute("aria-pressed", String(task.completed));
            check.setAttribute("aria-label", task.completed ? `Mark ${task.text} active` : `Complete ${task.text}`);
            const copy = document.createElement("div");
            copy.className = "task-copy";
            const text = document.createElement("span");
            text.className = "task-text";
            text.textContent = task.text;
            copy.appendChild(text);
            if (Number.isFinite(Number(task.scheduledAt))) {
                const timerBadge = document.createElement("small"); timerBadge.className="task-time-badge"; timerBadge.textContent=`⏰ ${timeLabel(new Date(Number(task.scheduledAt)))}`; copy.appendChild(timerBadge);
                if (Number(task.scheduledAt) > Date.now() && new Date(Number(task.scheduledAt)).toDateString() !== new Date().toDateString()) { const tomorrowNote=document.createElement("small"); tomorrowNote.className="task-reset-countdown"; tomorrowNote.textContent=`Set for tomorrow, ${timeLabel(new Date(Number(task.scheduledAt)))}`; copy.appendChild(tomorrowNote); }
            }

            if (task.alarm && Number.isInteger(task.alarm.hour) && Number.isInteger(task.alarm.minute)) {
                const alarmBadge=document.createElement("small");alarmBadge.className="task-time-badge task-alarm-badge";alarmBadge.textContent=`⏰ ${formatAlarmTime(task.alarm)}${task.alarm.repeatDaily?" · Daily":""}`;copy.appendChild(alarmBadge);
            }
            const alarmButton=document.createElement("button");alarmButton.type="button";alarmButton.className="task-alarm-button";alarmButton.textContent="⏰";alarmButton.setAttribute("aria-label",`Set alarm for ${task.text}`);alarmButton.title="Set or change alarm";alarmButton.addEventListener("click",()=>openAlarmEditor(task.id));
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "delete-task";
            remove.textContent = "✖";
            remove.setAttribute("aria-label", `Delete ${task.text}`);
            check.addEventListener("click", () => toggleTask(task.id));
            text.addEventListener("click", () => toggleTask(task.id));
            remove.addEventListener("click", () => deleteTask(task.id, li));
            li.append(check, copy, alarmButton, remove);
            list.appendChild(li);
            const old = previousRects.get(task.id);
            if (old) {
                const next = li.getBoundingClientRect();
                const deltaY = old.top - next.top;
                if (Math.abs(deltaY) > 1) li.animate([{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }], { duration: 260, easing: "ease-out" });
            }
        });
        positionAddBar();
        $("emptyState").hidden = visible.length !== 0;
        if (total === 0) {
            $("emptyTitle").textContent = "A fresh start.";
            $("emptyDescription").textContent = "Add your first task and make today count.";
        } else if (visible.length === 0 && filter === "active") {
            $("emptyTitle").textContent = "All caught up!";
            $("emptyDescription").textContent = "No active tasks. Enjoy your progress.";
        } else if (visible.length === 0 && filter === "completed") {
            $("emptyTitle").textContent = "Nothing completed yet.";
            $("emptyDescription").textContent = "Complete a task and it will show up here.";
        }
        if (selectedView !== 'daily' && total === 0 && filter === 'all') {
            $('emptyTitle').textContent = `No tasks for ${dayNames[selectedDay]} yet.`;
            $('emptyDescription').textContent = `Add your first task for ${dayNames[selectedDay]}!`;
        }
        if (selectedView !== 'daily') {
            const dayPct = total ? Math.round(completed / total * 100) : 0;
            $('selectedDaySummaryText').textContent = `${completed}/${total} tasks completed · ${dayPct}%`;
            $('selectedDaySummaryFill').style.width = `${dayPct}%`;
        }
        $('taskCount').textContent = selectedView === 'daily' ? `${remaining} ${remaining === 1 ? 'task' : 'tasks'} left` : `${dayNames[selectedDay]} · ${remaining} left`;
        $('footerSummary').textContent = total ? `${completed} of ${total} tasks completed.` : (selectedView === 'daily' ? 'Nothing on the list just yet.' : `No tasks for ${dayNames[selectedDay]} yet.`);
        updatePlannedCount();
        renderWeeklyProgress();
        renderDailyProgress();
    }
    function toggleTask(id) {
        const task = tasks.find(item => item.id === id);
        if (!task) return;
        const wasCompleted = task.completed;
        const oldCompletedAt = task.completedAt;
        const oldTimeNotified = task.timeNotified;
        const oldAlarmCancelledDate = task.alarmCancelledDate;
        task.completed = !task.completed;
        if (task.completed) { task.completedAt = Date.now(); if (Number.isFinite(Number(task.scheduledAt))) task.timeNotified = true; if(task.alarm)task.alarmCancelledDate=dateKey(new Date()); }
        else delete task.completedAt;
        if (!saveTasks()) {
            task.completed = wasCompleted;
            if (oldCompletedAt === undefined) delete task.completedAt;
            else task.completedAt = oldCompletedAt;
            if (oldTimeNotified === undefined) delete task.timeNotified; else task.timeNotified = oldTimeNotified;
            if (oldAlarmCancelledDate === undefined) delete task.alarmCancelledDate; else task.alarmCancelledDate = oldAlarmCancelledDate;
            return;
        }
        recordDailyCompletion(task, task.completed);
        renderTasks();
        if (task.completed) showPraise(task);
    }
    function deleteTask(id, element) {
        if (element.classList.contains("removing")) return;
        element.classList.add("removing");
        setTimeout(() => {
            const previous = tasks;
            const deleting = tasks.find(task => task.id === id);
            tasks = tasks.filter(task => task.id !== id);
            if (!saveTasks()) tasks = previous;
            else if (deleting?.completed) recordDailyCompletion(deleting, false);
            renderTasks();
        }, 220);
    }
    taskForm.addEventListener("submit", event => {
        event.preventDefault();
        const text = taskInput.value.trim();
        if (!text) {
            taskError.textContent = "Please enter a task first.";
            taskInput.focus();
            return;
        }
        if (text.length > 200) {
            taskError.textContent = "Tasks can have up to 200 characters.";
            return;
        }
        taskError.textContent = "";
        const id = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const newTask = { id, text, completed: false };
        if (!$("taskTimeOptions").hidden) {
            const schedule = getTaskSchedule(); newTask.scheduledAt = schedule.scheduledAt; newTask.timeNotified = false;
            $("taskTomorrowNote").textContent = schedule.tomorrow ? `Set for tomorrow, ${schedule.label}` : `Reminder set for ${schedule.label}`;
        }
        tasks.push(newTask);
        if (!saveTasks()) { tasks.pop(); return; }
        filter = "all";
        renderTasks();
        taskInput.value = "";
        taskInput.focus();
    });
    taskInput.addEventListener("input", () => { taskError.textContent = ""; });

    // Clock: one-line local date and 12-hour time, updated every second.
    function updateLiveClock() {
        const now = new Date();
        const date = now.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
        const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
        $("clockLine").textContent = `${date}  |  ${time}`;
    }
    updateLiveClock(); setInterval(updateLiveClock, 1000);

    // Task Timer: optional local-time notification for a task.
    function fillTimeSelects(hourId, minuteId, defaultNextHour = false) {
        const hour = $(hourId), minute = $(minuteId); if (!hour || !minute) return;
        hour.replaceChildren(); minute.replaceChildren();
        for (let i=1;i<=12;i++) { const option=document.createElement("option"); option.value=String(i); option.textContent=String(i); hour.appendChild(option); }
        for (let i=0;i<60;i++) { const option=document.createElement("option"); option.value=String(i).padStart(2,"0"); option.textContent=String(i).padStart(2,"0"); minute.appendChild(option); }
        if (defaultNextHour) { const next = new Date(); next.setHours(next.getHours()+1,0,0,0); let h=next.getHours()%12; if(!h)h=12; hour.value=String(h); minute.value="00"; $("taskAmPm").value=next.getHours()>=12?"PM":"AM"; }
    }
    fillTimeSelects("taskHour","taskMinute",true);
    $("taskTimeToggle").addEventListener("click", () => { const show=$("taskTimeOptions").hidden; $("taskTimeOptions").hidden=!show; $("taskTimeToggle").setAttribute("aria-expanded",String(show)); });
    function selectedTimeParts(hourId, minuteId, ampmId) { let h=Number($(hourId).value)%12; if($(ampmId).value==="PM")h+=12; return {hours:h,minutes:Number($(minuteId).value)}; }
    function timeLabel(date) { return date.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit",hour12:true}); }
    function getTaskSchedule() {
        const parts=selectedTimeParts("taskHour","taskMinute","taskAmPm"); const now=new Date();
        let scheduled=new Date(now.getFullYear(),now.getMonth(),now.getDate(),parts.hours,parts.minutes,0,0);
        const tomorrow=scheduled.getTime()<=now.getTime(); if(tomorrow)scheduled.setDate(scheduled.getDate()+1);
        return {scheduledAt:scheduled.getTime(), tomorrow, label:timeLabel(scheduled)};
    }
    function notifyBrowser(title, body) {
        if ("Notification" in window && Notification.permission === "granted") { try { new Notification(title,{body}); } catch {} }
    }
    function alertBeep() {
        try { const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx)return; const ctx=new Ctx(); const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.type="sine"; osc.frequency.value=880; gain.gain.value=.08; osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+.24); osc.onended=()=>ctx.close(); } catch {}
    }
    function showTimedAlert(title, description, actions) {
        $("alertModalTitle").textContent=title; $("alertModalDescription").textContent=description; const root=$("alertModalActions"); root.replaceChildren();
        actions.forEach(item=>{const b=document.createElement("button");b.type="button";b.className=`btn ${item.primary?"btn-primary":"btn-outline"} modal-action`;b.textContent=item.label;b.addEventListener("click",()=>{ $("alertModal").hidden=true; item.action(); });root.appendChild(b);});
        $("alertModal").hidden=false; alertBeep(); requestAnimationFrame(()=>root.querySelector("button")?.focus());
    }
    function checkTaskTimers() {
        const now=Date.now();
        tasks.forEach(task=>{
            if(task.completed || !Number.isFinite(Number(task.scheduledAt))) return;
            const due=Number(task.snoozeUntil)||Number(task.scheduledAt);
            if(due>now || task.timeNotified && !task.snoozeUntil) return;
            task.timeNotified=true; delete task.snoozeUntil; saveTasks();
            notifyBrowser("TO DO Daily",`Time to start: ${task.text}, ${username}!`);
            showTimedAlert(`Time to start: ${task.text}, ${username}! ⏰`,"Your scheduled task is ready.",[
                {label:"Done",primary:true,action:()=>{const found=tasks.find(t=>t.id===task.id);if(found&&!found.completed)toggleTask(found.id);}},
                {label:"Snooze 5 min",action:()=>{const found=tasks.find(t=>t.id===task.id);if(found&&!found.completed){found.snoozeUntil=Date.now()+5*60*1000;saveTasks();showToast("Task snoozed for 5 minutes.","⏰");}}},
                {label:"Close",action:()=>{}}
            ]);
        });
    }
    // Task Alarm: per-task local-time alarms with repeating Web Audio and one-fire-per-day guards.
    let alarmAudioContext=null, alarmOscillators=[], alarmPulse=null, alarmSafetyTimer=null, activeAlarmTaskId=null;
    function formatAlarmTime(a){const h=((Number(a.hour)||0)%12)||12;return `${h}:${String(Number(a.minute)||0).padStart(2,'0')} ${Number(a.hour)>=12?'PM':'AM'}`;}
    function alarmParts(a){return {hour:Number(a.hour)||0,minute:Number(a.minute)||0};}
    function stopAlarmSound(){if(alarmPulse)clearInterval(alarmPulse);if(alarmSafetyTimer)clearTimeout(alarmSafetyTimer);alarmSafetyTimer=null;alarmPulse=null;alarmOscillators.forEach(o=>{try{o.stop();}catch{}});alarmOscillators=[];}
    function ringAlarmSound(){stopAlarmSound();try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;if(!alarmAudioContext)alarmAudioContext=new Ctx();const ctx=alarmAudioContext;ctx.resume?.().catch(()=>{});const beep=()=>{if(!alarmAudioContext)return;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=880;gain.gain.value=.16;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.38);alarmOscillators.push(osc);};beep();alarmPulse=setInterval(beep,650);alarmSafetyTimer=setTimeout(()=>{if(activeAlarmTaskId)stopAlarmSound();},60000);}catch{}}
    function showAlarmModal(task, missed=false){activeAlarmTaskId=task.id;const overlay=$('taskAlarmModal');overlay.hidden=false;$('taskAlarmTitle').textContent=missed?`Missed alarm: ${task.text}`:`⏰ Time for: ${task.text}, ${username}!`;$('taskAlarmDescription').textContent=missed?'This alarm time passed while TO DO Daily was closed.':'Your task alarm is ringing.';ringAlarmSound();notifyBrowser('TO DO Daily alarm',`Time for: ${task.text}, ${username}!`);requestAnimationFrame(()=>$('taskAlarmStop').focus());}
    function closeAlarmModal(action){const task=tasks.find(t=>t.id===activeAlarmTaskId);stopAlarmSound();$('taskAlarmModal').hidden=true;activeAlarmTaskId=null;if(!task)return;if(action==='snooze'){task.alarmSnoozeUntil=Date.now()+5*60*1000;task.alarmSnoozeDate=dateKey(new Date());if(task.alarm)task.alarm.lastFiredDate=dateKey(new Date());}else if(action==='done'){if(!task.completed)toggleTask(task.id);}else if(action==='stop'){task.alarmStoppedDate=dateKey(new Date());}if(task.alarm&&!task.alarm.repeatDaily&&action!=='snooze')delete task.alarm;saveTasks();renderTasks();}
    function openAlarmEditor(taskId){const task=tasks.find(t=>t.id===taskId);if(!task)return;const modal=$('taskAlarmEditModal');modal.hidden=false;modal.dataset.taskId=taskId;const a=task.alarm;let h=a?Number(a.hour):((new Date().getHours()+1)%24),m=a?Number(a.minute):0;const hour=((h%12)||12);$('alarmHour').value=String(hour);$('alarmMinute').value=String(m).padStart(2,'0');$('alarmAmPm').value=h>=12?'PM':'AM';$('alarmRepeatDaily').checked=a?a.repeatDaily!==false:true;requestAnimationFrame(()=>$('alarmHour').focus());}
    function initializeTaskAlarms(){let modal=$('taskAlarmEditModal');if(!modal){modal=document.createElement('div');modal.id='taskAlarmEditModal';modal.className='modal-overlay';modal.hidden=true;modal.innerHTML=`<section class="confirm-modal" role="dialog" aria-modal="true" aria-label="Set task alarm" tabindex="-1"><h2>⏰ Task alarm</h2><div class="alarm-fields"><label>Hour<select id="alarmHour">${Array.from({length:12},(_,i)=>`<option>${i+1}</option>`).join('')}</select></label><label>Minute<select id="alarmMinute">${Array.from({length:60},(_,i)=>`<option value="${String(i).padStart(2,'0')}">${String(i).padStart(2,'0')}</option>`).join('')}</select></label><label>AM/PM<select id="alarmAmPm"><option>AM</option><option>PM</option></select></label></div><label class="alarm-repeat"><input id="alarmRepeatDaily" type="checkbox" checked> Repeat every day</label><div class="modal-actions"><button type="button" class="btn btn-primary" id="saveTaskAlarm">Save</button><button type="button" class="btn btn-outline" id="removeTaskAlarm">Remove alarm</button><button type="button" class="btn btn-outline" id="cancelTaskAlarm">Cancel</button></div></section>`;document.body.appendChild(modal);modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true;});$('cancelTaskAlarm').addEventListener('click',()=>modal.hidden=true);$('saveTaskAlarm').addEventListener('click',()=>{try{const Ctx=window.AudioContext||window.webkitAudioContext;if(Ctx){if(!alarmAudioContext)alarmAudioContext=new Ctx();alarmAudioContext.resume?.().catch(()=>{});}}catch{}const task=tasks.find(t=>t.id===modal.dataset.taskId);if(!task)return;let hour=Number($('alarmHour').value)%12;if($('alarmAmPm').value==='PM')hour+=12;task.alarm={hour,minute:Number($('alarmMinute').value),repeatDaily:$('alarmRepeatDaily').checked,lastFiredDate:'',missedDate:'',createdAt:Date.now()};delete task.alarmSnoozeUntil;delete task.alarmStoppedDate;saveTasks();modal.hidden=true;renderTasks();});$('removeTaskAlarm').addEventListener('click',()=>{const task=tasks.find(t=>t.id===modal.dataset.taskId);if(task){delete task.alarm;delete task.alarmSnoozeUntil;saveTasks();renderTasks();}modal.hidden=true;});}}
    function activateListForAlarm(key){
        storageKey=key;
        if(key===dailyStorageKey){selectedView='daily';}
        else {const day=dayIds.find(d=>key===`${weekTasksKey}_${d}`);if(day){selectedDay=day;selectedView=['sat','sun'].includes(day)?'weekend':'weekdays';}}
        localStorage.setItem(selectedViewKey,selectedView);localStorage.setItem(selectedDayKey,selectedDay);
        tasks=readTaskArray(key);renderTaskViewSelectors();renderTasks();
    }
    // Task Alarm: check daily tasks and the task list for the current weekday/weekend day.
    function checkTaskAlarms(){
        const now=new Date(),today=dateKey(now),minuteOfDay=now.getHours()*60+now.getMinutes();if(activeAlarmTaskId)return;
        const keys=[dailyStorageKey,`${weekTasksKey}_${todayId}`];
        for(const key of keys){const list=readTaskArray(key);for(const task of list){const a=task.alarm;if(!a||!Number.isFinite(Number(a.hour))||!Number.isFinite(Number(a.minute)))continue;if(task.completed||task.alarmCancelledDate===today)continue;
            let shouldRing=false,missed=false;
            if(task.alarmSnoozeUntil&&task.alarmSnoozeDate===today&&Date.now()>=task.alarmSnoozeUntil){delete task.alarmSnoozeUntil;a.lastFiredDate=today;shouldRing=true;}
            const target=Number(a.hour)*60+Number(a.minute);
            if(!shouldRing&&a.lastFiredDate!==today&&task.alarmStoppedDate!==today&&minuteOfDay===target){a.lastFiredDate=today;shouldRing=true;}
            if(!shouldRing&&minuteOfDay>target&&a.missedDate!==today&&a.lastFiredDate!==today&&a.createdAt&&a.createdAt<new Date(now.getFullYear(),now.getMonth(),now.getDate(),Number(a.hour),Number(a.minute)).getTime()){a.missedDate=today;shouldRing=true;missed=true;}
            if(shouldRing){activateListForAlarm(key);const liveTask=tasks.find(t=>t.id===task.id);if(!liveTask)continue;saveTasks();showAlarmModal(liveTask,missed);return;}
        }}
    }
    function requestAlarmNotifications(){if(!('Notification'in window)||Notification.permission!=='default')return;const key=`todoDaily_alarmNotifPrompt_${email}`;if(localStorage.getItem(key))return;localStorage.setItem(key,'asked');openModal({title:'Allow alarm notifications?',description:'TO DO Daily can show a browser notification when a task alarm rings. You can still use alarms without notifications.',returnToPanel:false,buttons:[{label:'Allow notifications',primary:true,action:()=>{closeModal();Notification.requestPermission().catch(()=>{});}},{label:'Not now',action:()=>closeModal()}]});}
    $('taskAlarmModal')||(()=>{const el=document.createElement('div');el.id='taskAlarmModal';el.className='modal-overlay alarm-ringing-overlay';el.hidden=true;el.innerHTML=`<section class="confirm-modal alarm-ringing-modal" role="dialog" aria-modal="true" aria-labelledby="taskAlarmTitle" tabindex="-1"><div class="alarm-ring-icon">⏰</div><h2 id="taskAlarmTitle">Time for your task!</h2><p id="taskAlarmDescription">Your task alarm is ringing.</p><div class="modal-actions"><button id="taskAlarmStop" type="button" class="btn btn-outline">Stop</button><button id="taskAlarmSnooze" type="button" class="btn btn-outline">Snooze 5 min</button><button id="taskAlarmDone" type="button" class="btn btn-primary">Mark as done</button></div></section>`;document.body.appendChild(el);$('taskAlarmStop').addEventListener('click',()=>closeAlarmModal('stop'));$('taskAlarmSnooze').addEventListener('click',()=>closeAlarmModal('snooze'));$('taskAlarmDone').addEventListener('click',()=>closeAlarmModal('done'));})();

    document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
        filter = button.dataset.filter;
        renderTasks();
    }));
    $("clearCompleted").addEventListener("click", () => {
        const previous = tasks;
        const removed = tasks.filter(task => task.completed);
        tasks = tasks.filter(task => !task.completed);
        if (!saveTasks()) { tasks = previous; return; }
        removed.forEach(task => recordDailyCompletion(task, false));
        renderTasks();
        showToast(`Completed tasks cleared, ${username}!`);
    });

    storageKey = activeListKey();
    loadTasks();
    const resetHappened = resetForNewDay(false);
    resetWeekdayTasksForToday();
    const testResetButton = $("testDailyReset");
    const undoResetButton = $("undoDailyReset");
    function resetSnapshotKeys() {
        return [...new Set([
            dailyStorageKey,
            ...dayIds.map(day => `${weekTasksKey}_${day}`),
            dailyLogKey,
            weeklyKey,
            lastResetKey,
            ...dayIds.map(day => `${lastResetKey}_${day}`)
        ])];
    }
    function clearDailyResetUndoSnapshot() {
        clearTimeout(resetUndoTimer);
        resetUndoTimer = null;
        dailyResetUndoSnapshot = null;
        localStorage.removeItem(resetUndoSnapshotKey);
        if (undoResetButton) undoResetButton.hidden = true;
    }
    function expireDailyResetUndoSnapshot() {
        clearDailyResetUndoSnapshot();
        const actionButton = $("toastAction");
        if (actionButton) { actionButton.hidden = true; actionButton.onclick = null; }
    }
    function showUndoResetButton() {
        if (undoResetButton) undoResetButton.hidden = !dailyResetUndoSnapshot;
    }
    function restoreDailyResetSnapshot() {
        const snapshot = dailyResetUndoSnapshot;
        if (!snapshot || Date.now() > snapshot.expiresAt) {
            expireDailyResetUndoSnapshot();
            return;
        }
        clearTimeout(resetUndoTimer);
        Object.entries(snapshot.values).forEach(([key, value]) => {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
        });
        clearDailyResetUndoSnapshot();
        storageKey = activeListKey();
        loadTasks();
        renderTasks();
        renderDailyProgress();
        renderWeeklyProgress();
        showToast("Daily reset undone", "↶", 3000);
    }
    function beginDailyResetTest() {
        // Remove any previous undo window before taking a fresh, exact snapshot.
        clearDailyResetUndoSnapshot();
        const values = {};
        resetSnapshotKeys().forEach(key => { values[key] = localStorage.getItem(key); });
        dailyResetUndoSnapshot = { createdAt: Date.now(), expiresAt: Date.now() + 10000, values };
        localStorage.setItem(resetUndoSnapshotKey, JSON.stringify(dailyResetUndoSnapshot));
        showUndoResetButton();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        localStorage.setItem(lastResetKey, dateKey(yesterday));
        resetForNewDay(false);
        renderDailyProgress();
        showToast("Daily reset done", "✓", 10000, restoreDailyResetSnapshot);
        resetUndoTimer = setTimeout(expireDailyResetUndoSnapshot, 10000);
    }
    // Preserve the Undo window if the user refreshes within its ten-second lifetime.
    try {
        const savedSnapshot = JSON.parse(localStorage.getItem(resetUndoSnapshotKey) || "null");
        if (savedSnapshot && savedSnapshot.values && savedSnapshot.expiresAt > Date.now()) {
            dailyResetUndoSnapshot = savedSnapshot;
            showUndoResetButton();
            resetUndoTimer = setTimeout(expireDailyResetUndoSnapshot, savedSnapshot.expiresAt - Date.now());
        } else if (savedSnapshot) {
            localStorage.removeItem(resetUndoSnapshotKey);
        }
    } catch { localStorage.removeItem(resetUndoSnapshotKey); }
    testResetButton?.addEventListener("click", beginDailyResetTest);
    undoResetButton?.addEventListener("click", restoreDailyResetSnapshot);
    renderTasks();
    if (resetHappened) showToast(`New day, ${username}! Your tasks are fresh again. Let's go! 💪`, "💪", 4500);
    setInterval(() => { todayId = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]; renderTaskViewSelectors(); resetForNewDay(true); resetWeekdayTasksForToday(); }, 30000);
    setInterval(checkTaskTimers, 1000);
    initializeTaskAlarms(); requestAlarmNotifications(); setInterval(checkTaskAlarms,1000);

    // Clear Data: remove only this user's task/progress/reminder state, preserving account, photo, theme, permissions, and session.
    function clearUserData() {
        // Preserve a custom quote currently used as the profile photo by converting its card into a self-contained SVG image.
        const selectedPhoto = localStorage.getItem(photoKey) || "";
        if (selectedPhoto.startsWith("customquote:")) {
            const quote = getCustomQuotes()[Number(selectedPhoto.split(":")[1])];
            if (quote) {
                const safeQuote = quote.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const safeAccent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#e50914";
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#171717"/><stop offset="1" stop-color="${safeAccent}" stop-opacity=".72"/></linearGradient></defs><rect width="320" height="320" rx="30" fill="url(#bg)"/><text x="26" y="74" font-family="Georgia,serif" font-size="82" fill="${safeAccent}">“</text><rect x="28" y="104" width="46" height="4" rx="2" fill="${safeAccent}"/><foreignObject x="26" y="122" width="268" height="150"><div xmlns="http://www.w3.org/1999/xhtml" style="height:100%;display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;font-family:Inter,Arial,sans-serif;font-size:24px;font-weight:800;overflow-wrap:anywhere;">${safeQuote}</div></foreignObject></svg>`;
                localStorage.setItem(photoKey, `data:image/svg+xml,${encodeURIComponent(svg)}`);
            }
        }

        const keysToRemove = [
            dailyStorageKey, weekTasksKey, ...dayIds.map(day => `${weekTasksKey}_${day}`),
            weeklyKey, dailyLogKey, selectedViewKey, selectedDayKey,
            weeklyChartKey, dailyChartKey, remindersKey, customQuotesKey,
            lastResetKey, ...dayIds.map(day => `${lastResetKey}_${day}`),
            `todoDaily_alarmNotifPrompt_${email}`, `todoDaily_notificationPrompt_${email}`
        ];
        keysToRemove.forEach(key => localStorage.removeItem(key));
        // Also clear any additional reset-date variants for this exact account only.
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith(`${lastResetKey}_`)) localStorage.removeItem(key);
        }

        // Stop active audio and dismiss any alert surfaces before the page reloads.
        stopAlarmSound();
        activeAlarmTaskId = null;
        if ($("taskAlarmModal")) $("taskAlarmModal").hidden = true;
        $("alertModal").hidden = true;
        $("reminderCalendarModal").hidden = true;
        if (typeof reminders !== "undefined") reminders = [];
        tasks = [];
        lastPraise = -1;
        sessionStorage.setItem(`todoDaily_clearDataToast_${email}`, username);
        closeModal();
        closeProfilePanel();
        window.location.reload();
    }

    $("openClearData").addEventListener("click", () => openModal({
        title: "Clear data?",
        description: `${username}, are you sure you want to clear your data? All your tasks, progress, reminders and alarms will be removed. Your account and profile details will stay.`,
        returnToPanel: true,
        buttons: [
            { label: "Yes", primary: true, action: clearUserData },
            { label: "No", action: closeModal }
        ]
    }));

    const clearedUsername = sessionStorage.getItem(`todoDaily_clearDataToast_${email}`);
    if (clearedUsername !== null) {
        sessionStorage.removeItem(`todoDaily_clearDataToast_${email}`);
        showToast(`Your data has been cleared, ${clearedUsername}. Your account is still here.`, "✓", 4500);
    }
}
