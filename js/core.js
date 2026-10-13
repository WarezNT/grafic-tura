// ===========================================================================
// NUCLEU COMUN (toate modurile). Încărcat DUPĂ modes/<mod>.js, care definește constantele
// modului (STORAGE_KEY, APP_VERSION, SHIFT_NAMES ...) și funcțiile lui specifice.
// Modificările de aici se aplică tuturor modurilor — nu duplica în fișierele de mod.
// ===========================================================================

const COMMIT_COUNT = 112;

const DB_VERSION = 1;

const DB_STORE = 'state';

let db = null;

let stateLoadCorrupted = false;

let state = loadState();

let savedFileHandle = null;

let genDay = state.genDay || 0, genStats = state.genStats || null, genCOCM = state.preservedCOCM || {}, genYear = state.genYear || 0, genMonth = state.genMonth || 0, genDim = state.genDim || 0;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE);
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = e => reject(e.target.error);
  });
}

function dbGet(key) {
  return openDB().then(d => new Promise((resolve, reject) => {
    const tx = d.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}

function dbPut(key, value) {
  return openDB().then(d => new Promise((resolve, reject) => {
    const tx = d.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.employees && Array.isArray(s.employees)) {
        migrateState(s);
        return s;
      }
      // JSON valid dar formă neașteptată (fără employees[]) — tot corupt din perspectiva
      // aplicației, tratat la fel ca eșecul de parsare de mai jos.
      throw new Error('shape invalid: missing employees[]');
    }
  } catch (e) {
    console.warn('loadState: date corupte în localStorage, pornesc de la zero.', e);
    // Salvează raw-ul corupt sub o cheie separată — nu se pierde, doar nu se folosește direct.
    // Înainte, eroarea era înghițită silențios (catch gol) și aplicația repornea cu stare nouă
    // fără nicio urmă a ce s-a întâmplat — userul afla abia când observa că lipsesc date
    // (bug găsit la audit).
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem(STORAGE_KEY + '_corrupt_backup', raw);
    } catch (e2) {}
    stateLoadCorrupted = true;
  }
  return defaultState();
}

function closeAddEmployeeModal() {
  document.getElementById('add-emp-modal').style.display = 'none';
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function pad(n) { return String(n).padStart(2, '0'); }

function dateKey(year, month, day) {
  return year + '-' + pad(month) + '-' + pad(day);
}

function getMonthName(m) {
  const names = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
  return names[m - 1];
}

function setShift(dateKey, empId, type) {
  if (!state.schedule[dateKey]) state.schedule[dateKey] = {};
  state.schedule[dateKey][String(empId)] = type;
  saveState();
}

function getShift(dateKey, empId) {
  if (!state.schedule[dateKey]) return null;
  const v = state.schedule[dateKey][String(empId)];
  return v !== undefined ? v : null;
}

function prevMonth() {
  let m = state.currentMonth - 1, y = state.currentYear;
  if (m < 1) { m = 12; y--; }
  state.currentMonth = m; state.currentYear = y;
  document.getElementById('sel-month').value = m;
  document.getElementById('sel-year').value = y;
  render();
}

function nextMonth() {
  let m = state.currentMonth + 1, y = state.currentYear;
  if (m > 12) { m = 1; y++; }
  state.currentMonth = m; state.currentYear = y;
  document.getElementById('sel-month').value = m;
  document.getElementById('sel-year').value = y;
  render();
}

// generation state globals — now declared at top of script

function updateButtons() {
  const nextBtn = document.getElementById('btn-next-day');
  const prevBtn = document.getElementById('btn-prev-day');
  const allBtn = document.getElementById('btn-generate-all');
  if (!genStats || genDay === 0) { nextBtn.style.display = 'none'; prevBtn.style.display = 'none'; allBtn.style.display = 'none'; return; }
  if (genDay > genDim) {
    nextBtn.style.display = 'none'; allBtn.style.display = 'none';
    prevBtn.style.display = genDim > 1 ? 'inline-block' : 'none';
    prevBtn.textContent = '← Ziua ' + (genDim - 1);
    return;
  }
  const lastDayData = state.schedule && state.schedule[dateKey(genYear, genMonth, genDim)];
  const completed = genDay >= genDim && lastDayData && Object.keys(lastDayData).length >= state.employees.length;
  if (completed) {
    nextBtn.style.display = 'none'; allBtn.style.display = 'none';
    prevBtn.style.display = genDim > 1 ? 'inline-block' : 'none';
    prevBtn.textContent = '← Ziua ' + (genDim - 1);
  } else {
    nextBtn.style.display = 'inline-block';
    allBtn.style.display = genDay < genDim ? 'inline-block' : 'none';
    const remain = genDim - genDay + 1;
    allBtn.textContent = 'Generare grafic totală (' + remain + ') →';
    nextBtn.textContent = 'Ziua ' + genDay + ' →';
    prevBtn.style.display = genDay > 1 ? 'inline-block' : 'none';
    prevBtn.textContent = '← Ziua ' + (genDay - 1);
  }
}

function render() {
  const m = parseInt(document.getElementById('sel-month').value);
  const y = parseInt(document.getElementById('sel-year').value);
  state.currentMonth = m;
  state.currentYear = y;
  saveState();

  document.getElementById('month-title').textContent = getMonthName(m) + ' ' + y;

  renderTable();
  renderSummary();
}

let modalEmpId = null;

let _deleteConfirmTimer = null;

function deleteConfirmStep() {
  const btn = document.getElementById('modal-btn-delete');
  if (btn.dataset.confirm !== '1') {
    btn.dataset.confirm = '1';
    btn.textContent = '⚠ Confirmă ștergerea';
    btn.style.background = '#b91c1c';
    btn.style.outline = '2px solid #fca5a5';
    clearTimeout(_deleteConfirmTimer);
    _deleteConfirmTimer = setTimeout(resetDeleteBtn, 3000);
  } else {
    clearTimeout(_deleteConfirmTimer);
    resetDeleteBtn();
    deleteModalEmployee();
  }
}

function resetDeleteBtn() {
  const btn = document.getElementById('modal-btn-delete');
  if (!btn) return;
  btn.dataset.confirm = '0';
  btn.textContent = '🗑 Șterge';
  btn.style.background = '';
  btn.style.outline = '';
}

function closeModal() {
  document.getElementById('emp-modal').style.display = 'none';
  modalEmpId = null;
  clearTimeout(_deleteConfirmTimer);
  resetDeleteBtn();
}

function openHelp(mode) {
  document.getElementById('help-modal').style.display = 'flex';
  showHelpMode(mode || HELP_DEFAULT_MODE);
}

function closeHelp() {
  document.getElementById('help-modal').style.display = 'none';
}

// Manualul are două moduri (exp = Electricieni/Exploatare, disp = Dispecer), fiecare cu filele lui.
function showHelpMode(mode) {
  ['exp', 'disp'].forEach(m => {
    const wrap = document.getElementById('help-mode-' + m);
    if (wrap) wrap.style.display = m === mode ? 'flex' : 'none';
  });
  document.querySelectorAll('.help-mode').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const first = document.querySelector('#help-mode-' + mode + ' .help-tab');
  if (first) showHelpTab(mode, 'start', first);
}

function showHelpTab(mode, name, btn) {
  const wrap = document.getElementById('help-mode-' + mode);
  wrap.querySelectorAll('.help-tab-panel').forEach(el => el.style.display = 'none');
  wrap.querySelectorAll('.help-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('help-' + mode + '-' + name).style.display = '';
  btn.classList.add('active');
}

// Listă informativă — sărbătorile legale ale lunii afișate curent, mereu vizibilă sub tabel
// (nu doar la hover pe coloană). Nu afectează alocarea echipajelor în niciun fel; se
// actualizează automat la orice navigare lună/an, pentru că renderTable() o apelează la fiecare
// randare, cu lista deja filtrată pe luna curentă.
function renderHolidayList(monthHolidays, y, m) {
  const el = document.getElementById('holiday-list');
  if (!el) return;
  if (!monthHolidays.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<span style="font-weight:700;color:var(--text-muted);margin-right:4px">🎉 Sărbători legale — ' + getMonthName(m) + ' ' + y + ':</span>'
    + monthHolidays.map(h => '<span class="shift-pill" style="padding:2px 8px;font-size:11px;background:var(--holiday-bg);color:var(--holiday-text)" data-tooltip="' + escAttr(h.name) + '">'
      + parseInt(h.date.slice(-2), 10) + ' ' + getMonthName(m).slice(0, 3) + ' — ' + esc(h.name) + '</span>').join(' ');
}

// Paștele ortodox — algoritmul Meeus (calendar iulian), convertit la gregorian (+13 zile,
// valabil pt. anii 1900-2099). Verificat împotriva calendarelor publice pentru 2025-2030 —
// coincide exact, an de an (Vinerea Mare/Paște/Rusalii calculate din el, mai jos).
function orthodoxEaster(y) {
  const a = y % 4, b = y % 7, c = y % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const dt = new Date(y, month - 1, day);
  dt.setDate(dt.getDate() + 13);
  return dt;
}

// Sărbători legale fixe (Codul Muncii, Art. 139) — verificate pe surse publice curente
// (inclusiv Boboteaza/Sf. Ioan/Unirea Principatelor, adăugate legal în ultimii ani — un tabel
// mai vechi din aplicație le omitea pentru unele luni viitoare, subestimând norma).
const FIXED_HOLIDAYS = [
  ['01-01', 'Anul Nou'], ['01-02', 'Anul Nou'], ['01-06', 'Boboteaza'],
  ['01-07', 'Sf. Ioan Botezătorul'], ['01-24', 'Unirea Principatelor Române'],
  ['05-01', 'Ziua Muncii'], ['06-01', 'Ziua Copilului'], ['08-15', 'Adormirea Maicii Domnului'],
  ['11-30', 'Sf. Andrei'], ['12-01', 'Ziua Națională'], ['12-25', 'Crăciunul'], ['12-26', 'Crăciunul']
];

// Toate zilele de sărbătoare legală ale unui an — fixe + mobile (calculate din Paștele
// ortodox). Funcționează pt. orice an rezonabil (nu doar 2025-2030) — nu mai necesită
// întreținere manuală an de an, ca vechiul tabel hardcodat.
function getLegalHolidays(y) {
  if (y < 1900 || y > 2099) return [];
  const addDays = (dt, n) => { const r = new Date(dt); r.setDate(r.getDate() + n); return r; };
  const mk = (dt, name) => ({ date: y + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()), name });
  const easter = orthodoxEaster(y);
  const list = FIXED_HOLIDAYS.map(([md, name]) => ({ date: y + '-' + md, name }));
  list.push(mk(addDays(easter, -2), 'Vinerea Mare'));
  list.push(mk(easter, 'Paștele'));
  list.push(mk(addDays(easter, 1), 'A doua zi de Paște'));
  list.push(mk(addDays(easter, 49), 'Rusaliile'));
  list.push(mk(addDays(easter, 50), 'A doua zi de Rusalii'));
  list.sort((a, b) => a.date.localeCompare(b.date));
  return list;
}

// Un singur loc care decide culoarea/verdictul — folosit ȘI de tabel ȘI de sumar (înainte,
// tabelul folosea praguri ABSOLUTE fixe 150h/184h indiferent de luna afișată, iar sumarul compara
// cu norma reală a lunii ± 16h — aceeași valoare putea ieși „ok" verde în tabel și „warn" galben
// în sumar pt. o lună cu normă diferită de 184h, ex. Februarie; bug găsit la audit).
function classifyHours(hours, effExpected) {
  if (effExpected === null) return 'unknown';
  if (hours === effExpected) return 'ok';
  if (hours > effExpected) return 'over';
  if (hours >= effExpected - 16) return 'warn';
  return 'under';
}

// Tabelul are stiluri doar pt. under/over/ok (td.hours.*) — 'warn' (aproape de normă) folosește
// tot stilul 'under', ca să nu introducem o paletă nouă doar pt. tabel; 'unknown' rămâne fără
// clasă suplimentară (neutru), în loc să pretindă fals "ok" (verde) când norma nu e cunoscută.
function hoursCellClass(hours, expected, st) {
  const v = classifyHours(hours, effectiveExpected(expected, st));
  if (v === 'unknown') return 'hours';
  if (v === 'warn') return 'hours under';
  return 'hours ' + v;
}

let summaryCardsOpen = true;

let summaryTableOpen = false;

function toggleSummarySection(id) {
  const el = document.getElementById(id);
  const btn = document.getElementById(id + '-btn');
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : '';
  btn.textContent = open ? '▶' : '▼';
  if (id === 'sum-cards') summaryCardsOpen = !open;
  if (id === 'sum-table') summaryTableOpen = !open;
}

let statusTimeout = null;

function setStatus(msg, type) {
  const el = document.getElementById('status');
  if (!msg) { el.style.display = 'none'; return; }
  el.textContent = msg;
  el.className = 'status-msg ' + (type || 'info');
  el.style.display = 'block';
  clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// esc() NU escapează ghilimele (verificat: textContent->innerHTML nu codifică " sau ' — sunt
// irelevante într-un nod de TEXT, dar critice într-o valoare de ATRIBUT). Pt. interpolare în
// interiorul unui atribut HTML (ex. data-*="..."), e nevoie de escAttr(), care adaugă și &quot;/
// &#39; peste esc() — altfel un `"` din date neîncrezute (ex. un câmp importat dintr-un JSON)
// rupe atributul (bug audit: XSS posibil în renderOverridesList prin cheile din crewOverrides).
function escAttr(s) {
  return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function saveFileWithPicker(data, suggestedName) {
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await showSaveFilePicker({ suggestedName, types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      setStatus('Fișier salvat: ' + suggestedName, 'success');
      return handle;
    }
    throw new Error('fallback');
  } catch (e) {
    if (e.name === 'AbortError') return null;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = suggestedName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus('Fișier descărcat: ' + suggestedName, 'success');
    return null;
  }
}

async function exportFullJSON() {
  state.preservedCOCM = genCOCM;
  state.genDay = genDay;
  state.genStats = genStats;
  state.genYear = genYear;
  state.genMonth = genMonth;
  state.genDim = genDim;
  const data = JSON.stringify({ type: 'full', version: 1, ...state }, null, 2);
  const suggestedName = 'grafic_ture_backup_full.json';
  if (savedFileHandle) {
    try {
      const writable = await savedFileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      setStatus('Backup salvat în ' + savedFileHandle.name, 'success');
      return;
    } catch (e) { savedFileHandle = null; }
  }
  const handle = await saveFileWithPicker(data, suggestedName);
  if (handle) savedFileHandle = handle;
}

async function exportMonthJSON() {
  const year = parseInt(document.getElementById('sel-year').value);
  const month = parseInt(document.getElementById('sel-month').value);
  const prefix = year + '-' + pad(month);
  const monthSchedule = {};
  const monthCOCM = {};
  for (const dk in state.schedule) {
    if (dk.startsWith(prefix)) monthSchedule[dk] = state.schedule[dk];
  }
  for (const dk in genCOCM) {
    if (dk.startsWith(prefix)) monthCOCM[dk] = genCOCM[dk];
  }
  const data = JSON.stringify({
    type: 'month', version: 1, year, month,
    employees: state.employees, config: state.config, org: getOrg(),
    schedule: monthSchedule, preservedCOCM: monthCOCM
  }, null, 2);
  const suggestedName = 'grafic_ture_' + year + '_' + pad(month) + '.json';
  await saveFileWithPicker(data, suggestedName);
}

async function loadJSON() {
  try {
    if ('showOpenFilePicker' in window) {
      // mode:'readwrite' — fără el, handle-ul e read-only, deci "Descarcă tot" nu poate scrie
      // înapoi în același fișier (createWritable() eșuează silențios, redeschide dialogul de
      // salvare de fiecare dată, chiar dacă userul a ales explicit fișierul respectiv la import).
      const [handle] = await showOpenFilePicker({ types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }], mode: 'readwrite' });
      savedFileHandle = handle;
      const file = await handle.getFile();
      const text = await file.text();
      applyJSON(text);
    } else {
      document.getElementById('import-file').click();
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    document.getElementById('import-file').click();
  }
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) { applyJSON(e.target.result); };
  reader.readAsText(file);
  event.target.value = '';
}

function importEmployees() {
  document.getElementById('import-employees-file').click();
}

// Printarea / exportul PDF folosește mereu tema deschisă,
// indiferent de modul întunecat activ pe ecran.
function enterPrintTheme() {
  const h = document.documentElement;
  if (h.getAttribute('data-theme') === 'dark') {
    h.setAttribute('data-theme', 'light');
    h.dataset.printDark = '1';
  }
}

function exitPrintTheme() {
  const h = document.documentElement;
  if (h.dataset.printDark) {
    h.setAttribute('data-theme', 'dark');
    delete h.dataset.printDark;
  }
}

window.addEventListener('beforeprint', enterPrintTheme);

window.addEventListener('afterprint', exitPrintTheme);

function printSchedule() {
  window.print();
}

function loadOrg() {
  try {
    const raw = localStorage.getItem(ORG_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function saveOrg(org) {
  localStorage.setItem(ORG_KEY, JSON.stringify(org));
}

function closeOrgModal() {
  document.getElementById('org-modal').style.display = 'none';
}

function showChangelog() {
  const log = CHANGELOG[APP_VERSION];
  if (!log) return;
  document.getElementById('cl-version').textContent = APP_VERSION;
  document.getElementById('cl-title').textContent = log.title;
  document.getElementById('cl-items').innerHTML = log.items.map(it =>
    '<li><span class="cl-icon">' + it.icon + '</span><span>' + it.text + '</span></li>'
  ).join('');
  document.getElementById('changelog-modal').style.display = 'flex';
}

function closeChangelog() {
  document.getElementById('changelog-modal').style.display = 'none';
}

function checkVersion() {
  const lastSeen = localStorage.getItem(VERSION_KEY);
  if (lastSeen !== APP_VERSION) {
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    setTimeout(showChangelog, 600);
  }
}

function toggleTbDropdown(id) {
  const el = document.getElementById(id);
  const wasOpen = el.classList.contains('open');
  closeTbDropdowns();
  if (!wasOpen) el.classList.add('open');
}

function closeTbDropdowns() {
  document.querySelectorAll('.tb-dd').forEach(d => d.classList.remove('open'));
}

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const btn = document.getElementById('dark-toggle-btn');
  if (btn) btn.textContent = isDark ? '🌙' : '☀️';
}

document.addEventListener('click', e => {
  if (!e.target.closest('.tb-dd-wrap')) closeTbDropdowns();
});
