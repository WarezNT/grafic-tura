// ===========================================================================
// NUCLEU COMUN (toate modurile). Încărcat DUPĂ modes/<mod>.js, care definește constantele
// modului (STORAGE_KEY, APP_VERSION, SHIFT_NAMES ...) și funcțiile lui specifice.
// Modificările de aici se aplică tuturor modurilor — nu duplica în fișierele de mod.
// ===========================================================================

// Construiește markup-ul paginii (antet, controale, modale, manual) din șablon + MODE.shell.
document.body.insertAdjacentHTML('afterbegin', buildShell());

const COMMIT_COUNT = 125;

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
  showHelpMode(mode || MODE.helpMode);
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

async function initStateFromDB() {
  try {
    const saved = await dbGet(MODE.dbKey);
    if (saved && saved.employees && Array.isArray(saved.employees)) {
      migrateState(saved);
      state = saved;
      genDay = state.genDay || 0;
      genStats = state.genStats || null;
      genCOCM = state.preservedCOCM || {};
      genYear = state.genYear || 0;
      genMonth = state.genMonth || 0;
      genDim = state.genDim || 0;
      return true;
    }
  } catch (e) { console.warn('IndexedDB load failed, using localStorage:', e); }
  return false;
}

async function saveState() {
  try {
    if (MODE.stateModule) state.module = MODE.stateModule;
    state.preservedCOCM = genCOCM;
    state.genDay = genDay;
    state.genStats = genStats;
    state.genYear = genYear;
    state.genMonth = genMonth;
    state.genDim = genDim;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    await dbPut(MODE.dbKey, state);
    const dbEl = document.getElementById('db-status');
    if (dbEl) dbEl.textContent = '💾 IndexedDB: salvat ' + new Date().toLocaleTimeString('ro');
  } catch (e) {
    console.warn('IndexedDB save failed:', e);
    const dbEl = document.getElementById('db-status');
    if (dbEl) dbEl.textContent = '💾 IndexedDB: eroare salvare';
  }
}

function addEmployee() {
  const inp = document.getElementById('new-emp');
  const name = inp.value.trim();
  if (!name) { setStatus('Introdu numele ' + MODE.words.employeeGen + '.', 'warn'); return; }
  const fields = MODE.readAddForm();
  const maxId = state.employees.reduce((m, e) => Math.max(m, e.id), 0);
  state.employees.push(Object.assign({ id: maxId + 1, name }, fields));
  inp.value = '';
  MODE.afterAdd();
  inp.focus();
  saveState();
  closeAddEmployeeModal();
  render();
  setStatus(MODE.addedMessage(name, fields), 'success');
}

function openAddEmployeeModal() {
  document.getElementById('new-emp').value = '';
  MODE.resetAddForm();
  document.getElementById('add-emp-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('new-emp').focus(), 50);
}

function openEditModal(id) {
  modalEmpId = id;
  const emp = state.employees.find(e => e.id === id);
  if (!emp) return;
  document.getElementById('modal-emp-name').value = emp.name;
  MODE.fillEditForm(emp);
  // Inputurile de dată pornesc goale -> calendarul browserului deschide pe luna curentă REALĂ
  // (azi), nu pe luna afișată în grafic, ceea ce confundă userul dacă navighează în alte luni.
  // Le pre-completăm cu prima zi a lunii selectate în grafic, ca să deschidă unde trebuie.
  const firstOfMonth = dateKey(state.currentYear, state.currentMonth, 1);
  document.getElementById('leave-from').value = firstOfMonth;
  document.getElementById('leave-to').value = firstOfMonth;
  document.getElementById('emp-modal').style.display = 'flex';
}

function saveModalEmployee() {
  const name = document.getElementById('modal-emp-name').value.trim();
  if (!name) { setStatus('Numele nu poate fi gol.', 'warn'); return; }
  const form = MODE.readEditForm();
  const emp = state.employees.find(e => e.id === modalEmpId);
  if (emp) { emp.name = name; MODE.applyEditForm(emp, form); saveState(); }
  closeModal();
  render();
  setStatus(MODE.words.Employee + ' actualizat.', 'success');
}

function deleteModalEmployee() {
  const emp = state.employees.find(e => e.id === modalEmpId);
  if (!emp) return;
  state.employees = state.employees.filter(e => e.id !== modalEmpId);
  for (const dk in state.schedule) {
    delete state.schedule[dk][modalEmpId];
  }
  closeModal();
  saveState();
  render();
  setStatus(MODE.words.Employee + ' șters: ' + emp.name, 'info');
}

function clearSchedule() {
  const m = state.currentMonth, y = state.currentYear;
  const keysToDelete = Object.keys(state.schedule).filter(k => {
    const parts = k.split('-');
    return +parts[0] === y && +parts[1] === m;
  });
  if (keysToDelete.length === 0) return;
  const mn = ['','Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'][m];
  if (!confirm('Ștergeți turele generate pentru ' + mn + ' ' + y + '? (' + MODE.words.keptLong + ' introduse se păstrează.)')) return;
  keysToDelete.forEach(k => {
    const day = state.schedule[k];
    for (const eid in day) { if (!MODE.keepOnClear.includes(day[eid])) delete day[eid]; }
    if (Object.keys(day).length === 0) delete state.schedule[k];
  });
  // Reset atât pe state.gen* CÂT ȘI pe variabilele de modul — saveState() de mai jos suprascrie
  // necondiționat state.gen* cu variabilele de modul, deci un reset doar pe state.* era anulat
  // instant (bug găsit la audit: după Curăță, butoanele de generare rămâneau active, iar un
  // "Ziua →" scria o zi orfană într-o lună altfel goală).
  state.genDay = 0; state.genStats = null; state.genYear = 0; state.genMonth = 0; state.genDim = 0;
  genDay = 0; genStats = null; genYear = 0; genMonth = 0; genDim = 0;
  updateButtons();
  saveState();
  render();
  setStatus('Ture generate ' + mn + ' ' + y + ' șterse (' + MODE.words.keptShort + ' păstrate).', 'info');
}

function applyLeaveInterval() {
  const from = document.getElementById('leave-from').value;
  const to = document.getElementById('leave-to').value;
  const type = parseInt(document.getElementById('leave-type').value);
  if (!from || !to) { setStatus('Completează data de început și data de sfârșit.', 'warn'); return; }
  if (to < from) { setStatus('Data de sfârșit e înainte de data de început.', 'warn'); return; }
  if (modalEmpId === null) return;
  // 'T00:00:00' evită bug-ul de fus orar: new Date('YYYY-MM-DD') fără oră se interpretează ca
  // UTC miezul nopții, iar getDate()/getMonth() locale pot da o zi în minus/plus în funcție de fus.
  const start = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  let count = 0, skippedWeekend = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Tipurile din MODE.leaveSkipWeekend (ex. INST) nu sunt permise în weekend (aceeași regulă ca la
    // selecția manuală pe celulă) — se sare peste acele zile, fără să atingă ce era deja acolo.
    // CO/CM pot acoperi și weekendul (se afișează ca L acolo, dar valoarea rămâne CO/CM, la fel ca
    // extensia automată de vineri).
    if (MODE.leaveSkipWeekend.includes(type) && (d.getDay() === 0 || d.getDay() === 6)) { skippedWeekend++; continue; }
    const dk = dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
    if (!state.schedule[dk]) state.schedule[dk] = {};
    state.schedule[dk][String(modalEmpId)] = type;
    count++;
  }
  saveState();
  render();
  document.getElementById('leave-from').value = '';
  document.getElementById('leave-to').value = '';
  const typeLabel = MODE.leaveTypes[type] || String(type);
  let msg = 'Setat ' + typeLabel + ' pentru ' + count + ' zile (' + from + ' → ' + to + ').';
  if (skippedWeekend > 0) msg += ' (' + skippedWeekend + ' zile de weekend sărite — ' + typeLabel + ' nu e permis acolo)';
  setStatus(msg, 'success');
}

function importEmployeesJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      let employees = [];
      if (Array.isArray(data)) employees = data;
      else if (data.employees && Array.isArray(data.employees)) employees = data.employees;
      else { setStatus('Format JSON invalid. Aștept array de ' + MODE.words.employeesPl + '.', 'err'); return; }
      if (MODE.looksForeign({ employees })) { setStatus(MODE.foreignMessage, 'err'); return; }
      const existingNames = new Set(state.employees.map(e => e.name.toLowerCase()));
      let added = 0;
      employees.forEach(emp => {
        if (!emp.name) return;
        if (existingNames.has(emp.name.toLowerCase())) return;
        const maxId = state.employees.reduce((m, e) => Math.max(m, e.id), 0);
        state.employees.push(Object.assign({ id: maxId + 1, name: emp.name }, MODE.importEmployee(emp)));
        existingNames.add(emp.name.toLowerCase());
        added++;
      });
      if (added > 0) {
        saveState();
        render();
        setStatus('Importat ' + added + ' ' + MODE.words.employeesPl + ' noi.', 'success');
      } else {
        setStatus('Niciun ' + MODE.words.employee + ' nou de importat (toți există deja).', 'warn');
      }
    } catch (err) {
      setStatus('Eroare la parsarea JSON: ' + err.message, 'err');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function onShiftChange(dk, empId, sel) {
  const v = parseInt(sel.value);
  const existing = getShift(dk, empId);
  if (existing !== null && existing !== v && existing !== 0 && v !== 0) {
    if (!confirm('Angajatul are deja tura ' + SHIFT_NAMES[existing] + ' în această zi. Schimbi în ' + SHIFT_NAMES[v] + '?')) {
      sel.value = existing;
      sel.parentElement.className = sel.parentElement.className.replace(/\bshift-\d+\b/, 'shift-' + existing);
      return;
    }
  }
  setShift(dk, empId, v);
  const td = sel.parentElement;
  td.className = td.className.replace(/\bshift-\d+\b/, 'shift-' + v);
  const span = sel.parentElement.querySelector('.print-shift');
  if (span) { span.className = 'print-shift shift-' + v; span.textContent = SHIFT_NAMES[v]; }
  const st = getEmployeeStats(empId);
  const row = sel.closest('tr');
  const cells = row.cells;
  const hourCell = cells[cells.length - 3];
  const cocmCell = cells[cells.length - 2];
  const expected = expectedHours(state.currentYear, state.currentMonth);
  hourCell.className = hoursCellClass(st.hours, expected, st) + ' hours-cell';
  hourCell.textContent = st.hours + 'h';
  cocmCell.textContent = leaveHours(st) + 'h';
  renderSummary();
}

// Câte ture a lucrat efectiv un angajat în zile de sărbătoare legală, într-o lună — informativ,
// pentru statistici (cerere: oamenii trebuie să poată vedea câte ture au avut în sărbători).
function holidayShiftsCount(empId, y, m) {
  const dim = daysInMonth(y, m);
  const prefix = y + '-' + pad(m);
  const holidaySet = new Set(getLegalHolidays(y).filter(h => h.date.startsWith(prefix)).map(h => h.date));
  if (holidaySet.size === 0) return 0;
  let count = 0;
  for (let d = 1; d <= dim; d++) {
    const dk = dateKey(y, m, d);
    if (!holidaySet.has(dk)) continue;
    const v = state.schedule[dk] ? state.schedule[dk][String(empId)] : undefined;
    if (MODE.isWorkShift(v)) count++;
  }
  return count;
}

// Norma așteptată pt. o lună. `null` doar dacă anul e în afara intervalului 1900-2099 (gardă
// a algoritmului Paștelui — selectorul de an al aplicației merge 2020-2040, deci în practică
// nu se atinge). Înainte, consumatorii foloseau un fallback INVENTAT (184h) pt. anii în afara
// unui tabel hardcodat 2025-2028, afișat ca normă reală în carduri/sumar, în timp ce coloana
// „Normă" din tabel arăta corect „—" — aceeași informație, contradictorie în două locuri
// (găsit la audit). Acum practic mereu un număr real, calculat corect.
function expectedHours(y, m) {
  return MODE.expectedHours(y, m);
}

// Ore de concediu (CO/CM) ale unui angajat, la media pe zi a modului, rotunjite la 0,1h.
function leaveHours(st) {
  return Math.round((st.co + st.cm) * MODE.leaveHoursPerDay() * 10) / 10;
}

// CO/CM aprobate reduc legitim norma așteptată — un angajat cu concediu nu ar trebui să apară
// „sub normă" doar pentru zilele în care a fost în concediu (bug găsit la audit: cineva cu 4 zile
// CO + restul lucrat corect apărea cu „-32h", card roșu, deși nu are nicio problemă reală).
function effectiveExpected(expected, st) {
  return expected === null ? null : Math.max(0, Math.round((expected - (st.co + st.cm) * MODE.leaveHoursPerDay()) * 10) / 10);
}

function startGeneration() {
  const year = parseInt(document.getElementById('sel-year').value);
  const month = parseInt(document.getElementById('sel-month').value);
  const emps = state.employees;
  if (emps.length === 0) { setStatus('Adaugă cel puțin un ' + MODE.words.employee + '.', 'warn'); return; }
  // cârlig de mod: validări înainte de pornire (ex. configurația per tură); `false` = anulat
  const genCtx = MODE.beginGeneration ? MODE.beginGeneration(emps) : {};
  if (genCtx === false) return;
  if (Object.keys(state.schedule).length > 0) {
    if (!confirm('Continuați generarea din următoarea zi liberă? (Zilele deja generate se păstrează.)')) return;
  }
  // save CO/CM — merge with existing preserved CO
  for (const dk in state.schedule) {
    for (const eid in state.schedule[dk]) {
      const v = state.schedule[dk][eid];
      if (v === 5 || v === 6) {
        if (!genCOCM[dk]) genCOCM[dk] = {};
        genCOCM[dk][eid] = v;
      }
    }
  }
  // preserve existing generated days — find first day not yet fully generated.
  // generateDay() always writes an entry (chiar și 0/L) pentru FIECARE electrician — deci o zi
  // deja generată are câte o intrare per electrician, indiferent dacă rezultatul a fost o zi cu
  // toată lumea pe L (capacitate 0, sau toți blocați de MAX_CONSEC/cap săptămânal). Verificarea
  // veche ("există vreo tură lucrată") trata greșit o astfel de zi ca negenerată și o rescria
  // silențios la fiecare click pe Generare (bug găsit la audit).
  const dim = daysInMonth(year, month);
  let firstEmpty = dim + 1;
  for (let d = 1; d <= dim; d++) {
    const dk = dateKey(year, month, d);
    const dayData = state.schedule[dk];
    if (!dayData || Object.keys(dayData).length < emps.length) {
      firstEmpty = d;
      break;
    }
  }
  // restore CO from genCOCM on days that have none yet — NU crea obiect gol pt. zile fără CO de
  // restaurat: umplea silențios toate cele ~30 zile ale lunii cu `{}`, ceea ce făcea ca
  // `Object.keys(state.schedule).length > 0` (mai sus) să fie mereu adevărat la orice click
  // ulterior pe „Generare", chiar dacă nimic nu fusese de fapt generat — confirmarea „Continuați
  // generarea?" apărea mereu, inutil (bug găsit la audit).
  for (let d = 1; d <= dim; d++) {
    const dk = dateKey(year, month, d);
    if (genCOCM[dk]) {
      if (!state.schedule[dk]) state.schedule[dk] = {};
      for (const eid in genCOCM[dk]) {
        if (!(eid in state.schedule[dk])) { state.schedule[dk][eid] = genCOCM[dk][eid]; }
      }
    }
  }
  // weekend extension: if a weekday has CO, adjacent Sat/Sun also get it
  for (let d = 1; d <= dim; d++) {
    const dk = dateKey(year, month, d);
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 6) {
      const fk = dateKey(year, month, d - 1);
      if (genCOCM[fk]) { for (const eid in genCOCM[fk]) { if (!state.schedule[dk]) state.schedule[dk] = {}; if (!(eid in (state.schedule[dk]||{}))) state.schedule[dk][eid] = genCOCM[fk][eid]; } }
    } else if (dow === 0) {
      const fk = dateKey(year, month, d - 2);
      const mk = dateKey(year, month, d + 1);
      [fk, mk].forEach(k => { if (genCOCM[k]) { for (const eid in genCOCM[k]) { if (!state.schedule[dk]) state.schedule[dk] = {}; if (!(eid in (state.schedule[dk]||{}))) state.schedule[dk][eid] = genCOCM[k][eid]; } } });
    }
  }
  state.currentMonth = month;
  state.currentYear = year;
  if (MODE.commitGeneration) MODE.commitGeneration(genCtx);
  genDim = dim;
  genStats = MODE.initGenStats(year, month, firstEmpty, emps);
  genDay = firstEmpty;
  genYear = year;
  genMonth = month;
  updateButtons();
  if (firstEmpty > dim) {
    setStatus('Toate zilele sunt deja generate.', 'info');
  } else {
    setStatus('Generare pornită. Ziua ' + firstEmpty + '/' + genDim + '. Apasă „Ziua următoare" sau „Generare grafic totală"', 'info');
  }
  render();
}

function generateDay(day) {
  if (day < 1 || day > genDim) return;
  const year = genYear, month = genMonth;
  const dk = dateKey(year, month, day);
  // preserve CO/CM from both saved snapshot and any manual edits
  const preserved = {...(genCOCM[dk] || {})};
  if (state.schedule[dk]) {
    for (const eid in state.schedule[dk]) {
      const v = state.schedule[dk][eid];
      if (MODE.keepOnClear.includes(v) && !(eid in preserved)) preserved[eid] = v;
    }
  }
  // extend CO/CM to weekend days if adjacent weekday has CO
  const dt = new Date(year, month - 1, day);
  const weekend = dt.getDay() === 0 || dt.getDay() === 6;
  if (weekend) {
    const dow = dt.getDay();
    const adjKeys = [];
    if (dow === 6) adjKeys.push(dateKey(year, month, day - 1));
    else if (dow === 0) { adjKeys.push(dateKey(year, month, day - 2)); adjKeys.push(dateKey(year, month, day + 1)); }
    adjKeys.forEach(k => {
      if (genCOCM[k]) { for (const eid in genCOCM[k]) { if (!(eid in preserved)) preserved[eid] = genCOCM[k][eid]; } }
      if (state.schedule && state.schedule[k]) { for (const eid in state.schedule[k]) { const v2 = state.schedule[k][eid]; if ((v2 === 5 || v2 === 6) && !(eid in preserved)) preserved[eid] = v2; } }
    });
  }
  state.schedule[dk] = {};
  for (const eid in preserved) state.schedule[dk][eid] = preserved[eid];
  const hasCOCM = Object.keys(preserved);
  const assigned = hasCOCM.map(Number);
  const emps = state.employees;
  const ctx = { dk, day, year, month, weekend, emps, hasCOCM, assigned };
  MODE.assignDay(ctx);                      // alocarea specifică modului
  emps.forEach(e => {
    if (!assigned.includes(e.id)) state.schedule[dk][String(e.id)] = 0;
  });
  if (MODE.afterDay) MODE.afterDay(ctx);   // ex. statistici de generare / redistribuire
  saveState();
}

function generateNextDay() {
  if (genDay < 1 || genDay > genDim) return;
  const day = genDay;
  if (MODE.resyncGenStats) genStats = MODE.resyncGenStats(genYear, genMonth, day);   // vezi nota din MODE
  generateDay(genDay);
  genDay++;
  if (genDay > genDim) {
    genDay = genDim;
    updateButtons();
    setStatus('Grafic generat complet pentru ' + getMonthName(genMonth) + ' ' + genYear + '.', 'success');
  } else {
    updateButtons();
    setStatus('Generată ziua ' + day + '/' + genDim + '. Apasă „Ziua ' + genDay + ' →"', 'info');
  }
  render();
}

function generateAll() {
  if (!genStats || genDay < 1 || genDay > genDim) return;
  const from = genDay;
  document.getElementById('btn-next-day').style.display = 'none';
  document.getElementById('btn-generate-all').style.display = 'none';
  if (MODE.resyncGenStats) genStats = MODE.resyncGenStats(genYear, genMonth, from);
  for (let d = from; d <= genDim; d++) {
    generateDay(d);
    genDay = d + 1;
  }
  genDay = genDim;
  updateButtons();
  setStatus('Generare grafic totală completă: zilele ' + from + '–' + genDim + ' generate.', 'success');
  render();
}

function prevDay() {
  if (genDay <= 1) return;
  genDay--;
  if (MODE.resyncGenStats) genStats = MODE.resyncGenStats(genYear, genMonth, genDay);
  generateDay(genDay);
  updateButtons();
  setStatus('Regenerată ziua ' + genDay + '/' + genDim + '.', 'info');
  render();
}

function getEmployeeStats(empId) {
  const counts = SHIFT_NAMES.map(() => 0);
  const prefix = state.currentYear + '-' + pad(state.currentMonth);
  for (const dk in state.schedule) {
    if (!dk.startsWith(prefix)) continue;
    const v = state.schedule[dk][String(empId)];
    if (v === null || v === undefined) continue;
    const parts = dk.split('-');
    const dow = new Date(+parts[0], +parts[1]-1, +parts[2]).getDay();
    const isWeekend = dow === 0 || dow === 6;
    if (isWeekend && (MODE.weekendNoCount ? MODE.weekendNoCount.includes(v) : v >= 5)) continue; // CO/CM nu se contorizează în weekend (MODE.weekendNoCount le poate restrânge)
    if (v >= 0 && v < counts.length) counts[v]++;
  }
  let hours = 0, worked = 0;
  for (let i = 0; i < counts.length; i++) { const h = SHIFT_HOURS[i] || 0; hours += counts[i] * h; if (h > 0) worked += counts[i]; }
  // cârlig de mod: ajustări de ore la graniță (ex. tura de noapte care trece în luna următoare)
  if (MODE.adjustMonthHours) hours = MODE.adjustMonthHours(empId, state.currentYear, state.currentMonth, hours);
  const co = counts[5] || 0, cm = counts[6] || 0;
  const st = { counts, co, cm, hours, worked, total: worked + co };
  if (MODE.decorateStats) MODE.decorateStats(st);   // câmpuri denumite specifice modului
  return st;
}

function renderTable() {
  const thead = document.getElementById('table-head');
  const tbody = document.getElementById('table-body');
  const emptyEl = document.getElementById('empty-msg');
  const T = MODE.table;
  const m = state.currentMonth;
  const y = state.currentYear;
  const dim = daysInMonth(y, m);
  const emps = state.employees;
  const labels = SHIFT_NAMES;
  const colspan = dim + T.fixedCols;
  // Sărbători legale ale lunii curente — Map<ziua, nume>, calculat o dată per randare, folosit
  // atât pentru marcajul pe coloane cât și pentru lista de sub tabel (renderHolidayList). Doar
  // informativ — nu influențează alocarea automată.
  const prefix = y + '-' + pad(m);
  const monthHolidays = getLegalHolidays(y).filter(h => h.date.startsWith(prefix));
  const holidayByDay = new Map(monthHolidays.map(h => [parseInt(h.date.slice(-2), 10), h.name]));

  let hhtml = '<tr><th style="min-width:180px;white-space:nowrap">Nume Prenume</th>' + (T.extraHeader || '');
  for (let d = 1; d <= dim; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    const dayName = ['D','L','M','M','J','V','S'][dow];
    const holidayName = holidayByDay.get(d);
    const cls = ['day-col', dow === 0 || dow === 6 ? 'th-weekend' : '', holidayName ? 'th-holiday' : ''].filter(Boolean).join(' ');
    const tip = holidayName ? ' data-tooltip="' + escAttr(holidayName) + '"' : '';
    hhtml += '<th class="' + cls + '"' + tip + '>' + d + '<br><small>' + dayName + '</small></th>';
  }
  hhtml += '<th style="min-width:48px;width:48px">Lucrate</th><th style="min-width:36px;width:36px;line-height:1.2">CO<br>CM</th><th style="min-width:44px;width:44px">Normă</th></tr>';
  thead.innerHTML = hhtml;

  renderLegend();
  renderHolidayList(monthHolidays, y, m);
  if (MODE.afterTableHead) MODE.afterTableHead(y, m);   // ex. avertismente sub tabel
  if (emps.length === 0) {
    tbody.innerHTML = '';
    emptyEl.innerHTML = 'Adaugă ' + MODE.words.employeesPl + ' și generează graficul.';
    return;
  }
  emptyEl.innerHTML = '';

  const expected = expectedHours(y, m);
  let bhtml = '';
  T.sections(emps).forEach(sec => {
    if (sec.emps.length === 0) return;
    if (sec.header) bhtml += '<tr class="group-header ' + sec.cls + '"><td colspan="' + colspan + '">' + sec.header + '</td></tr>';
    sec.emps.forEach(emp => {
      const st = getEmployeeStats(emp.id);
      const cls = hoursCellClass(st.hours, expected, st);
      bhtml += '<tr>' + T.rowHead(emp, sec);
      for (let d = 1; d <= dim; d++) {
        const dow = new Date(y, m - 1, d).getDay();
        const dk = dateKey(y, m, d);
        let v = getShift(dk, emp.id);
        if (v === null || v === undefined) v = 0;
        const weekend = (dow === 0 || dow === 6);
        // Valorile din weekendDisplayL (CO/CM etc.) se afișează ca L în weekend; valoarea reală rămâne în state.
        const displayV = (weekend && T.weekendDisplayL.includes(v)) ? 0 : v;
        const tdCls = ['shift-' + displayV, weekend ? 'td-weekend' : '', holidayByDay.get(d) ? 'td-holiday' : ''].filter(Boolean).join(' ');
        // sfat opțional pe celulă (MODE.table.cellTip), afișat la hover — fără text vizibil în celulă
        const cellTip = T.cellTip ? T.cellTip(emp, dk, v) : '';
        bhtml += '<td class="' + tdCls + '"' + (cellTip ? ' data-tooltip="' + escAttr(cellTip) + '"' : '') + '><select onchange="onShiftChange(\'' + dk + '\',' + emp.id + ',this)">';
        for (let si = 0; si < labels.length; si++) {
          if (weekend && T.weekendHide.includes(si)) continue;
          bhtml += '<option value="' + si + '"' + (si === displayV ? ' selected' : '') + '>' + labels[si] + '</option>';
        }
        bhtml += '</select><span class="print-shift shift-' + displayV + '">' + labels[displayV] + '</span>'
          + (T.cellExtra ? T.cellExtra(emp, dk, v, sec) : '') + '</td>';
      }
      bhtml += '<td class="' + cls + ' hours-cell">' + st.hours + 'h</td>';
      bhtml += '<td class="hours" style="font-size:12px">' + leaveHours(st) + 'h</td>';
      bhtml += '<td class="hours" style="font-size:12px;color:var(--text-muted)">' + (expected !== null ? expected + 'h' : '—') + '</td></tr>';
    });
  });
  tbody.innerHTML = bhtml;
}

function renderLegend() {
  const legendEl = document.getElementById('table-legend');
  if (!legendEl) return;
  legendEl.innerHTML = '<span style="font-weight:700;color:var(--text-muted);margin-right:4px">Legendă:</span>'
    + MODE.legend.map(([cls, txt, style]) =>
      '<span class="shift-pill' + (cls ? ' ' + cls : '') + '" style="padding:2px 8px;font-size:11px' + (style ? ';' + style : '') + '">' + txt + '</span>'
    ).join(' ');
}

function renderSummary() {
  const container = document.getElementById('summary');
  if (state.employees.length === 0) { container.innerHTML = ''; return; }
  const expected = expectedHours(state.currentYear, state.currentMonth);
  const mn = getMonthName(state.currentMonth);
  const sectionStyle = 'display:flex;align-items:center;gap:8px;margin:14px 0 6px;cursor:pointer;user-select:none';
  const btnStyle = 'background:none;border:none;font-size:12px;cursor:pointer;color:var(--text-muted);padding:2px 6px;border-radius:4px;border:1px solid var(--border)';
  let html = MODE.summary.info(expected, mn);   // linia „📅 luna — normă” (specifică modului)
  // Secțiunea Carduri
  const cardsOpen = summaryCardsOpen;
  html += '<div style="' + sectionStyle + '" onclick="toggleSummarySection(\'sum-cards\')">'
    + '<button id="sum-cards-btn" style="' + btnStyle + '">' + (cardsOpen ? '▼' : '▶') + '</button>'
    + '<span style="font-size:14px;font-weight:700;color:var(--heading)">Carduri ' + MODE.words.employeesPl + '</span>'
    + '</div>';
  html += '<div id="sum-cards" style="display:' + (cardsOpen ? '' : 'none') + '">';
  html += '<div class="summary-grid">';
  state.employees.forEach(emp => {
    const st = getEmployeeStats(emp.id);
    const effExpected = effectiveExpected(expected, st);
    const verdict = classifyHours(st.hours, effExpected);
    const pct = effExpected !== null ? Math.min(100, Math.round((st.hours / effExpected) * 100)) : null;
    let cardCls = 'emp-card';
    if (verdict === 'warn') cardCls += ' warn';
    else if (verdict === 'over' || verdict === 'under') cardCls += ' bad';
    const holCount = holidayShiftsCount(emp.id, state.currentYear, state.currentMonth);
    const pills = MODE.summary.cardPills(emp, st, holCount);
    html += '<div class="' + cardCls + '">'
      + '<div class="emp-card-header">' + MODE.summary.cardHeader(emp) + '</div>'
      + '<div class="emp-card-hours"><strong>' + st.hours + 'h</strong>' + (effExpected !== null ? ' / ' + effExpected + 'h (' + pct + '%)' : ' — normă necunoscută') + '</div>'
      + '<div class="shift-pills">' + (pills.length ? pills.join('') : '<span style="color:var(--empty);font-size:11px">—</span>') + '</div>'
      + '</div>';
  });
  html += '</div></div>'; // închide summary-grid + sum-cards

  // Tabel statistici detaliate (coloanele sunt specifice modului)
  const tableOpen = summaryTableOpen;
  html += '<div style="' + sectionStyle + '" onclick="toggleSummarySection(\'sum-table\')">'
    + '<button id="sum-table-btn" style="' + btnStyle + '">' + (tableOpen ? '▼' : '▶') + '</button>'
    + '<span style="font-size:14px;font-weight:700;color:var(--heading)">Statistici ture — ' + mn + ' ' + state.currentYear + '</span>'
    + '</div>';
  html += '<div id="sum-table" style="display:' + (tableOpen ? '' : 'none') + '">';
  html += MODE.summary.statsTable(expected);
  html += '</div>'; // închide sum-table

  container.innerHTML = html;
}

// Calcule comune pentru un rând din tabelul de statistici (verdict, diferență, clase).
function statRowInfo(emp, expected) {
  const st = getEmployeeStats(emp.id);
  // effExpected scade orele de CO/CM din normă (bug audit: un angajat cu concediu aprobat
  // apărea "-32h" roșu, deși nu are nicio problemă reală) — un singur helper (classifyHours),
  // aceleași reguli ca în tabel și în carduri.
  const effExpected = effectiveExpected(expected, st);
  const diff = effExpected !== null ? st.hours - effExpected : null;
  const diffStr = diff === null ? '—' : (diff === 0 ? '=' : (diff > 0 ? '+' + diff + 'h' : diff + 'h'));
  const verdict = classifyHours(st.hours, effExpected);
  const rowCls = verdict === 'over' || verdict === 'under' ? 'stat-row-bad' : verdict === 'warn' ? 'stat-row-warn' : 'stat-row-ok';
  const hoursCls = verdict === 'over' || verdict === 'under' ? 'stat-hours-bad' : verdict === 'warn' ? 'stat-hours-warn' : 'stat-hours-ok';
  const holCount = holidayShiftsCount(emp.id, state.currentYear, state.currentMonth);
  return { st, effExpected, diffStr, rowCls, hoursCls, holCount };
}

function exportExcel() {
  if (typeof ExcelJS === 'undefined') { setStatus('Biblioteca Excel nu este disponibilă.', 'err'); return; }
  const X = MODE.excel;
  const emps = state.employees;
  const m = state.currentMonth, y = state.currentYear;
  const dim = daysInMonth(y, m);
  const mn = getMonthName(m);
  if (emps.length === 0) { setStatus('Niciun ' + MODE.words.employee + ' de exportat.', 'warn'); return; }
  const expected = expectedHours(y, m);
  const DAY_NAMES = ['D','L','M','M','J','V','S'];
  const shiftFill = {
    0:{bg:'F0F0F0',fg:'666666'}, 1:{bg:'D6EAF8',fg:'1A5276'}, 2:{bg:'FDEBD0',fg:'935116'},
    3:{bg:'AED6F1',fg:'154360'}, 4:{bg:'FAD7A0',fg:'7E4D0E'}, 5:{bg:'E8D5F5',fg:'6C3483'},
    6:{bg:'E8E8E8',fg:'555555'}, 7:{bg:'F0F4F8',fg:'2C3E50'}, 8:{bg:'D5F5E3',fg:'1A7A3A'},
    9:{bg:'FFF3B0',fg:'7D6608'}, 10:{bg:'FADBD8',fg:'922B21'}
  };
  const argb = c => 'FF' + c;
  const fill = bg => ({ type:'pattern', pattern:'solid', fgColor:{ argb: argb(bg) } });
  const fnt = (fg, bold, sz, italic) => ({ color:{ argb: argb(fg) }, bold:!!bold, size: sz||10, italic:!!italic });
  const aln = (h, v, wrap) => ({ horizontal: h||'center', vertical: v||'middle', wrapText:!!wrap });
  const nExtra = X.extraHeaders.length;          // coloane fixe după nume (ex. Funcția, Echipaj)
  const firstDay = 1 + nExtra, lastDay = firstDay + dim - 1;
  const colLucrate = lastDay + 1, colCOCM = lastDay + 2, colHoliday = lastDay + 3, colNorma = lastDay + 4;
  const totalCols = colNorma + 1;
  (async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(mn + ' ' + y, { pageSetup:{ paperSize:13, orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:0 } });
    ws.getColumn(1).width = 22;
    X.extraWidths.forEach((w, i) => { ws.getColumn(2 + i).width = w; });
    for (let d = 1; d <= dim; d++) ws.getColumn(firstDay + d).width = 4.5;
    ws.getColumn(colLucrate+1).width = 9; ws.getColumn(colCOCM+1).width = 7; ws.getColumn(colHoliday+1).width = 7; ws.getColumn(colNorma+1).width = 7;
    // Logo
    const logoId = wb.addImage({ base64: LOGO_B64, extension: 'png' });
    ws.addImage(logoId, { tl:{ col:0, row:0 }, ext:{ width:160, height:52 } });
    ws.getRow(1).height = 42;
    // Title
    const tc = ws.getCell(1, firstDay + 1); tc.value = X.title(mn, y);
    tc.font = fnt('2C3E50', true, 16); tc.alignment = aln('left','middle');
    ws.mergeCells(1, firstDay + 1, 1, totalCols);
    // Subtitle
    ws.getRow(2).height = 16;
    const org = getOrg();
    const sc = ws.getCell(2, firstDay + 1); sc.value = X.subtitle(org);
    sc.font = fnt('7F8C8D', false, 10, true); sc.alignment = aln('left','middle');
    ws.mergeCells(2, firstDay + 1, 2, totalCols);
    // Norm
    ws.getRow(3).height = 14;
    const nc0 = ws.getCell(3, 1); nc0.value = X.normLine(mn, y, expected);
    nc0.font = fnt('555555', false, 9); nc0.alignment = aln('left','middle');
    ws.mergeCells(3, 1, 3, totalCols);
    ws.getRow(4).height = 6;
    // Headers
    const HDR = 5; ws.getRow(HDR).height = 28;
    // Antetul de sărbătoare folosea auriul pastel vechi (FDF3D0), rămas neactualizat când am
    // întărit culoarea pe web/print (era prea „spălăcit" — feedback direct pe fișierul real
    // exportat). Acum fundal auriu-bronz saturat + text alb, ca weekend-ul (4A2C2C+alb).
    const setHdr = (r, c, v, wknd, holiday) => {
      const cl = ws.getCell(r, c);
      cl.value = v; cl.font = fnt('FFFFFF', true, 9);
      cl.fill = fill(holiday ? '8A6510' : (wknd ? '4A2C2C' : '2C3E50'));
      cl.alignment = aln('center','middle', true);
    };
    setHdr(HDR, 1, 'Nume Prenume');
    X.extraHeaders.forEach((h, i) => setHdr(HDR, 2 + i, h));
    const yearHolidays = new Set(getLegalHolidays(y).map(h => h.date));
    for (let d = 1; d <= dim; d++) {
      const dow = new Date(y, m-1, d).getDay();
      setHdr(HDR, firstDay + d, d + '\n' + DAY_NAMES[dow], dow===0||dow===6, yearHolidays.has(dateKey(y,m,d)));
    }
    setHdr(HDR, colLucrate+1, 'Lucrate'); setHdr(HDR, colCOCM+1, 'CO/CM'); setHdr(HDR, colHoliday+1, 'Sărb.'); setHdr(HDR, colNorma+1, 'Normă');
    // Rows
    let R = HDR + 1;
    MODE.table.sections(emps).forEach(sec => {
      if (!sec.emps.length) return;
      if (sec.header) {            // rând de grup (ex. Urban / Rural / Program 8 ore)
        ws.getRow(R).height = 16;
        for (let c = 1; c <= totalCols; c++) {
          const cell = ws.getCell(R, c);
          cell.fill = fill(sec.xls.bg); cell.font = fnt(sec.xls.fg, true, 9);
          cell.alignment = aln(c===1?'left':'center','middle');
          if (c === 1) cell.value = sec.header;
        }
        ws.mergeCells(R, 1, R, totalCols); R++;
      }
      sec.emps.forEach(emp => {
        const st = getEmployeeStats(emp.id);
        const effExpected = effectiveExpected(expected, st);
        const diff = effExpected !== null ? st.hours - effExpected : 0;
        const hBg = effExpected===null?'F8F9FB':diff===0?'E8F8F0':diff>0?'FDE8E8':diff>=-16?'FFF8E1':'FDE8E8';
        const hFg = effExpected===null?'555555':diff===0?'1A7A3A':diff>0?'C0392B':diff>=-16?'B7770D':'C0392B';
        ws.getRow(R).height = 15;
        const c1=ws.getCell(R,1); c1.value=emp.name; c1.font=fnt('1A1A2E',true,9); c1.fill=fill('FFFFFF'); c1.alignment=aln('left','middle');
        X.extraCells(emp, sec).forEach((spec, i) => {
          const cx = ws.getCell(R, 2 + i); cx.value = spec.value; cx.font = fnt(spec.fg, false, 8); cx.fill = fill('F8F9FB'); cx.alignment = aln('center','middle');
        });
        for (let d = 1; d <= dim; d++) {
          const dow = new Date(y,m-1,d).getDay(), isW = dow===0||dow===6;
          const dk = dateKey(y,m,d);
          const v = getShift(dk, emp.id), rawSv = v!==null?v:0;
          // CO/CM/INST în weekend se afișează ca L (aceeași regulă ca în grafic)
          const sv = (isW && X.weekendToL.includes(rawSv)) ? 0 : rawSv;
          const ss = shiftFill[sv], bg = isW&&sv===0?'FCE4E4':ss.bg, fg = isW&&sv===0?'999999':ss.fg;
          const dc = ws.getCell(R, firstDay+d);
          dc.value = X.dayText(emp, dk, sv, sec); dc.font=fnt(fg,true,8); dc.fill=fill(bg);
          if (X.cellNote) { const nt = X.cellNote(emp, dk, sv); if (nt) dc.note = nt; }   // comentariu Excel (echivalentul sfatului din pagină)
          // text pe două rânduri (ex. marcajul „+6h” de după T4): celula se împachetează, rândul se înalță
          const twoLines = typeof dc.value === 'string' && dc.value.includes('\n');
          dc.alignment = aln('center','middle', twoLines);
          if (twoLines) ws.getRow(R).height = 24;
          // Chenar auriu pe celulele din zilele de sărbătoare — mirror al td.td-holiday din grafic
          if (yearHolidays.has(dk)) { const hb = { style:'thick', color:{argb:'FFD4A017'} }; dc.border = { top:hb, bottom:hb, left:hb, right:hb }; }
        }
        const lc=ws.getCell(R,colLucrate+1); lc.value=st.hours; lc.font=fnt(hFg,true,9); lc.fill=fill(hBg); lc.alignment=aln('center','middle');
        const cc=ws.getCell(R,colCOCM+1); cc.value=leaveHours(st); cc.font=fnt('6C3483',false,9); cc.fill=fill('F5EEF8'); cc.alignment=aln('center','middle');
        const holCount1 = holidayShiftsCount(emp.id, y, m);
        const hcc=ws.getCell(R,colHoliday+1); hcc.value=holCount1||0; hcc.font=fnt(holCount1?'8A6510':'AAAAAA', !!holCount1, 9); hcc.fill=fill(holCount1?'FDF3D0':'F8F9FB'); hcc.alignment=aln('center','middle');
        const nc=ws.getCell(R,colNorma+1); nc.value=expected!==null?expected:'—'; nc.font=fnt('7F8C8D',false,9); nc.fill=fill('F8F9FB'); nc.alignment=aln('center','middle');
        R++;
      });
    });
    R++;
    ws.getRow(R).height = 22;
    var lc=ws.getCell(R,1); lc.value='Legendă:'; lc.font=fnt('2C3E50',true,10);
    ws.mergeCells(R,1,R,2);
    var li = X.legend;
    for(var i=0,ci=3;i<li.length;i++,ci+=3){ws.mergeCells(R,ci,R,ci+2);var cw=ws.getCell(R,ci);cw.value=li[i][0];cw.font=fnt(li[i][2],true,9);cw.fill=fill(li[i][1]);cw.alignment=aln('center','middle');}
    // Sărbătorile legale ale lunii — lipseau complet din legenda Excel (bug raportat: „zilele
    // nu apar în legendă"), deși coloanele respective erau deja marcate pe grafic (chenar auriu).
    const monthHolidaysXls = getLegalHolidays(y).filter(h => h.date.startsWith(y+'-'+pad(m)));
    if (monthHolidaysXls.length) {
      R++;
      ws.getRow(R).height = 18;
      const hl = ws.getCell(R, 1); hl.value = '🎉 Sărbători ' + mn + ':'; hl.font = fnt('8A6510', true, 9);
      ws.mergeCells(R, 1, R, 2);
      const hv = ws.getCell(R, 3); hv.value = monthHolidaysXls.map(h => parseInt(h.date.slice(-2),10) + ' — ' + h.name).join('   •   ');
      hv.font = fnt('8A6510', false, 9); hv.fill = fill('FDF3D0'); hv.alignment = aln('left', 'middle', true);
      ws.mergeCells(R, 3, R, totalCols);
    }
    R += 2;
    const sigs = X.signatures();     // [[denumire, nume], ...] — doar cele active
    const step = sigs.length ? Math.floor(totalCols / sigs.length) : 0;
    sigs.forEach((sig,i) => {
      const c = 1 + i*step;
      const r1=ws.getCell(R,c); r1.value=sig[0]; r1.font=fnt('2C3E50',true,9); r1.alignment=aln('center','middle');
      ws.mergeCells(R,c,R,c+step-1);
      const r2=ws.getCell(R+1,c); r2.value=sig[1]; r2.font=fnt('555555',false,9); r2.alignment=aln('center','middle');
      ws.mergeCells(R+1,c,R+1,c+step-1);
    });
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='grafic_ture_'+y+'_'+pad(m)+'.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setStatus('Excel generat cu logo și stiluri.', 'success');
  })().catch(e => setStatus('Eroare Excel: ' + e.message, 'err'));
}

function applyJSON(text) {
  try {
    const data = JSON.parse(text);
    if (MODE.looksForeign(data)) { setStatus(MODE.foreignFileMessage, 'err'); return; }
    // Detecția de tip nu se poate baza STRICT pe data.type==='month' — fișiere vechi legitime
    // (dinainte de introducerea câmpului type, ex. exporturi cu {employees,config,schedule,
    // currentMonth,currentYear}) nu au deloc type și cădeau pe ramura "backup complet" (state =
    // data), ștergând toate celelalte luni + org (bug găsit la audit). Doar
    // backup-urile REALE (exportFullJSON) au genStats/genDay ca chei top-level — exportMonthJSON
    // nu le include niciodată — deci prezența lor e semnalul de încredere pt. "backup complet".
    const looksLikeFullBackup = data.type === 'full' || 'genStats' in data || 'genDay' in data;
    const looksLikeMonth = data.type === 'month' || (!looksLikeFullBackup && data.schedule && typeof data.schedule === 'object' && Array.isArray(data.employees));
    if (looksLikeMonth) {
      // Suportă și numele vechi de câmpuri (currentYear/currentMonth) din fișierele legacy fără type.
      const year = data.year ?? data.currentYear;
      const month = data.month ?? data.currentMonth;
      if (!year || !month) { setStatus('Fișier invalid — lipsește luna/anul.', 'err'); return; }
      // Fără schedule valid, ștergerea de mai jos ar goli luna țintă și tot ar raporta succes
      // (bug găsit la audit: for...in undefined nu aruncă eroare, doar nu adaugă nimic).
      if (!data.schedule || typeof data.schedule !== 'object') { setStatus('Fișier invalid — lipsește graficul (schedule).', 'err'); return; }
      // Coliziune de id: dacă fișierul are un angajat cu ACELAȘI id dar NUME diferit față de
      // cineva local, turele din fișier i s-ar aplica silențios persoanei greșite (bug găsit la
      // audit — id-urile pornesc de la 1 în orice instalare nouă, coliziunea e foarte plauzibilă
      // exact în fluxul publicitar al aplicației: "trimite doar luna curentă cuiva").
      if (Array.isArray(data.employees)) {
        const localById = new Map(state.employees.map(e => [e.id, e.name]));
        const conflicts = data.employees.filter(e => localById.has(e.id) && localById.get(e.id) !== e.name).map(e => e.name + ' (local: ' + localById.get(e.id) + ')');
        if (conflicts.length && !confirm('Fișierul conține ' + MODE.words.employeesPl + ' cu alt nume dar același id ca cei locali:\n' + conflicts.join(', ') + '\nTurele lor din fișier ar putea ajunge pe persoana greșită. Continuați?')) return;
      }
      // Month-save: overwrite only schedule for the specified year+month
      const prefix = year + '-' + pad(month);
      for (const dk in state.schedule) {
        if (dk.startsWith(prefix)) delete state.schedule[dk];
      }
      for (const dk in data.schedule) {
        state.schedule[dk] = data.schedule[dk];
      }
      // Merge COCM for this month
      for (const dk in data.preservedCOCM) {
        if (dk.startsWith(prefix)) genCOCM[dk] = data.preservedCOCM[dk];
      }
      // MERGE electricienii (adaugă după id pe cei lipsă din state curent), NU înlocui lista —
      // altfel un import de lună mai veche ștergea silențios orice angajat adăugat de atunci
      // (electricienii/config-ul sunt setări GLOBALE, nu specifice unei luni — un fișier de lună
      // nu ar trebui să le poată suprascrie complet; bug găsit la audit).
      if (Array.isArray(data.employees)) {
        const existingIds = new Set(state.employees.map(e => e.id));
        data.employees.forEach(emp => { if (!existingIds.has(emp.id)) state.employees.push(emp); });
      }
      // config NU se atinge la import de lună — e o setare curentă, nu ține de luna importată.
      // org lives in ORG_KEY — only migrate from file if ORG_KEY is empty
      if (data.org && data.org.sefFOL && !loadOrg()) saveOrg(data.org);
      state.currentMonth = month;
      state.currentYear = year;
      document.getElementById('sel-month').value = month;
      document.getElementById('sel-year').value = year;
      genDay = 0; genStats = null; genYear = 0; genMonth = 0; genDim = 0;
      migrateState(state);
      saveState();
      render();
      updateButtons();
      setStatus('Luna ' + getMonthName(month) + ' ' + year + ' încărcată din fișier.', 'success');
      return;
    }
    // Full backup (data.type==='full' sau conține genStats/genDay top-level)
    if (!data.employees || !Array.isArray(data.employees)) {
      setStatus('Fișier JSON invalid.', 'err');
      return;
    }
    state = data;
    genCOCM = data.preservedCOCM || {};
    genDay = data.genDay || 0; genStats = data.genStats || null; genYear = data.genYear || 0; genMonth = data.genMonth || 0; genDim = data.genDim || 0;
    migrateState(state);
    // org lives in ORG_KEY — only migrate from file if ORG_KEY is empty
    if (data.org && data.org.sefFOL && !loadOrg()) saveOrg(data.org);
    if (MODE.beforeRestoreSave) MODE.beforeRestoreSave();
    saveState();
    document.getElementById('sel-month').value = state.currentMonth || 1;
    document.getElementById('sel-year').value = state.currentYear || new Date().getFullYear();
    if (MODE.afterRestoreUI) MODE.afterRestoreUI();
    render();
    updateButtons();
    setStatus('Baza de date restaurată din fișier.', 'success');
  } catch (err) {
    setStatus('Eroare la citirea fișierului.', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const logoEl = document.getElementById('header-logo');
  if (logoEl) logoEl.src = 'data:image/png;base64,' + LOGO_B64;
  const vBadge = document.getElementById('app-version-badge');
  if (vBadge) vBadge.textContent = APP_VERSION;
  const cBadge = document.getElementById('commit-badge');
  if (cBadge) cBadge.textContent = '#' + COMMIT_COUNT;
  if (typeof ExcelJS === 'undefined') {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#fff3cd;color:#856404;border:1px solid #ffc107;border-radius:8px;padding:12px 20px;font-size:13px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,.15);max-width:480px;text-align:center;line-height:1.5';
    banner.innerHTML = '⚠️ <strong>Fără conexiune la internet</strong><br>Exportul în Excel nu va funcționa în această sesiune. Toate celelalte funcții sunt disponibile offline.<br><button onclick="this.parentElement.remove()" style="margin-top:8px;border:none;background:#856404;color:#fff;padding:4px 14px;border-radius:6px;cursor:pointer;font-size:12px">OK</button>';
    document.body.appendChild(banner);
  }
  if (stateLoadCorrupted) {
    const banner2 = document.createElement('div');
    banner2.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#fde8e8;color:#c0392b;border:1px solid #e74c3c;border-radius:8px;padding:12px 20px;font-size:13px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,.15);max-width:480px;text-align:center;line-height:1.5';
    banner2.innerHTML = '⚠️ <strong>Date corupte găsite la pornire</strong><br>S-a pornit cu o stare nouă, goală. Datele vechi (corupte) au fost păstrate sub o cheie separată în browser, pentru cazul în care vrei să le recuperezi manual.<br><button onclick="this.parentElement.remove()" style="margin-top:8px;border:none;background:#c0392b;color:#fff;padding:4px 14px;border-radius:6px;cursor:pointer;font-size:12px">OK</button>';
    document.body.appendChild(banner2);
  }
  const now = new Date();
  document.getElementById('sel-year').value = state.currentYear || now.getFullYear();
  document.getElementById('sel-month').value = state.currentMonth || (now.getMonth() + 1);
  const dbEl = document.getElementById('db-status');
  if (dbEl) dbEl.textContent = '💾 IndexedDB: inițializare...';
  initStateFromDB().then(loaded => {
    if (loaded) {
      document.getElementById('sel-year').value = state.currentYear;
      document.getElementById('sel-month').value = state.currentMonth;
    }
    if (MODE.afterLoad) MODE.afterLoad(loaded);
    // migrate org from state to dedicated ORG_KEY if not yet migrated
    if (!loadOrg() && state.org && state.org.sefFOL) saveOrg(state.org);
    if (MODE.syncConfigUI) MODE.syncConfigUI();
    applyOrgToDOM();
    render();
    updateButtons();
    if (dbEl) dbEl.textContent = loaded ? '💾 IndexedDB: date încărcate' : '💾 IndexedDB: date noi';
    checkVersion();
    const org = getOrg();
    if (!org.configured && !org.sefFOL && !org.responsabilTehnic && !org.aprobat) openOrgModal();
  }).catch(e => {
    if (MODE.syncConfigUI) MODE.syncConfigUI();
    render();
    updateButtons();
    applyOrgToDOM();
    if (dbEl) dbEl.textContent = '💾 IndexedDB: eroare';
  });
});

// Selectorul „Modul” din antet: deschide pagina modului ales (vezi APP_MODES din js/modes-registry.js).
function switchApp(v) {
  const target = APP_MODES.find(m => m.id === v);
  if (target && target.id !== MODE.id) window.location.href = target.page;
}
