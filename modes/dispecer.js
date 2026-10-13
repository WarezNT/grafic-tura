// ===========================================================================
// MOD: Dispecer — constante, funcții și logică specifice acestui mod.
// Se încarcă ÎNAINTEA js/core.js; nu apela funcții din core la încărcare (doar la evenimente).
// ===========================================================================

const STORAGE_KEY = 'graficTura_dispecer';

const VERSION_KEY = 'graficTura_dispecer_version';

const ORG_KEY = 'graficTura_dispecer_org';

const APP_VERSION = 'V2026.10.8';

const DB_NAME = 'GraficTuraDispecerDB';

// ── Configurația modului: citită de nucleu (js/core.js). Vezi modes/_template.js pentru ghid. ──
const MODE = {
  id: 'dispecer',
  dbKey: 'main_dispecer',        // cheia în IndexedDB
  stateModule: 'dispecer',       // etichetă salvată în state.module (garda la import)
  words: {
    employee: 'dispecer', Employee: 'Dispecer', employeeGen: 'dispecerului', employeesPl: 'dispeceri',
    keptLong: 'CO și CM', keptShort: 'CO/CM'
  },
  keepOnClear: [5, 6],
  leaveTypes: { 5: 'CO', 6: 'CM' },
  leaveSkipWeekend: [],
  leaveHoursPerDay() { return avgHoursPerDay(); },
  isWorkShift(v) { return v > 0 && (SHIFT_HOURS[v] || 0) > 0; },
  expectedHours(y, m) { return Math.round(daysInMonth(y, m) * avgHoursPerDay()); },
  readAddForm() { return { category: 'dispecer' }; },
  resetAddForm() {},
  afterAdd() {},
  addedMessage(name) { return 'Dispecer adăugat: ' + name; },
  fillEditForm(emp) {},
  readEditForm() { return null; },
  applyEditForm(emp, f) {},
  importEmployee(e) { return { category: 'dispecer' }; },
  looksForeign: looksLikeExploatare,
  foreignMessage: 'Fișierul conține electricieni din aplicația Exploatare — nu poate fi importat în Dispecer.',
  // ── generare ──
  initGenStats() { return {}; },   // marcaj „generare în curs”: ciclul nu depinde de statistici acumulate
  assignDay({ dk, day, year, month, emps, hasCOCM, assigned }) {
    assignDispecerShifts(emps.filter(e => !hasCOCM.includes(String(e.id))), dk, assigned, year, month, day);
  },
  afterDay({ dk, day, year, month }) { rebalanceCoverage(dk, year, month, day); }
};

const CHANGELOG = {
  'V2026.10.8': {
    title: 'Distribuție echitabilă, setări editabile, manual în două moduri',
    items: [
      { icon: '⚖️', text: 'Cine începe un bloc T3→T2→T1→T4 se alege echitabil (ore în an, apoi weekenduri și sărbători) — nu mai lucrează nimeni mereu aceleași zile ale săptămânii; la 7 dispeceri weekendurile au ajuns de la 0–104 la ~60 pentru fiecare' },
      { icon: '🔁', text: 'Mai puține zile cu ture neacoperite la concedii suprapuse (redistribuire pe blocuri)' },
      { icon: '✏️', text: 'Setări organizație: denumirile câmpurilor sunt editabile, fiecare câmp are bifă activ/inactiv, plus câmpul Entitate' },
      { icon: '📖', text: 'Manualul are două moduri: „Mod Electricieni (Exploatare)” și „Mod Dispecer”' }
    ]
  },
  'V2026.10.6': {
    title: 'Cel mult un dispecer pe tură + redistribuire la concedii',
    items: [
      { icon: '1️⃣', text: 'În fiecare zi, fiecare tură (T1–T4) are cel mult un dispecer — cu mai mult de 5 dispeceri, cei în plus au zile libere, nu dublează o tură' },
      { icon: '🧮', text: 'Norma lunară se calculează acum la 24h împărțite la numărul de dispeceri (minim 5); CO/CM reduc norma la fel' },
      { icon: '🔁', text: 'Când CO/CM lasă o tură neacoperită, aplicația caută lanțuri de mutări (cu 11h odihnă și max. 4 zile la rând) și ține orele din an cât mai uniforme' },
      { icon: '⚠️', text: 'Avertisment sub tabel pentru ture neacoperite și pentru ture cu mai mulți dispeceri introduse manual' },
      { icon: '🧹', text: 'Datele salvate mai vechi sunt curățate automat de câmpurile rămase din Exploatare' }
    ]
  },
  'V2026.10.4': {
    title: 'Sărbători legale: decizi tu',
    items: [
      { icon: '🧹', text: 'Scoasă raționalizarea/echilibrarea automată din sărbători (și comutatorul ei) — graficul rămâne exact pe ciclul fix' },
      { icon: '🎉', text: 'Pe carduri apare acum câte ture de sărbătoare legală a lucrat fiecare, în lună și în an, ca să poți decide manual' }
    ]
  },
  'V2026.10.3': {
    title: 'Sărbători legale: raționalizare și echilibrare',
    items: [
      { icon: '🎉', text: 'În sărbătorile legale lucrează doar minimul necesar (câte unul pe tură); ceilalți dispeceri au zi liberă' },
      { icon: '⚖️', text: 'Cine lucrează în sărbători se alege automat după orele acumulate în an (report între luni), ca orele să fie cât mai uniforme între dispeceri' },
      { icon: '🎚️', text: 'Comutator „Raționalizare sărbători” în bara de sus: activ = minim de personal în sărbători, oprit = ore perfect egale (toți lucrează după ciclu)' },
      { icon: '📊', text: 'Coloană nouă „Sărb. an” în Statistici; antetul „Dispeceri — N dispeceri” a fost scos din tabel și din Excel' }
    ]
  },
  'V2026.10.2': {
    title: 'Curățenie și corecturi Dispecer',
    items: [
      { icon: '🧹', text: 'Eliminate din aplicație restul funcțiilor din Exploatare (echipaje, Urban/Rural, analiză moduri) — fișier mai mic și mai simplu' },
      { icon: '🏷️', text: 'Titlul paginii și previzualizările de link spun acum „Grafic dispecer”; coloana „Funcția” (mereu „Electrician”) a dispărut din tabel' },
      { icon: '🔁', text: 'Redistribuire automată când CO/CM lasă o tură neacoperită (cu 11h odihnă și max. 4 zile la rând); ce rămâne gol apare ca avertisment sub tabel' },
      { icon: '🛡️', text: 'Fișierele exportate din aplicația Exploatare sunt refuzate la import, ca să nu strice graficul dispecerilor' },
      { icon: '🔢', text: 'Orele de CO/CM se afișează corect rotunjite (ex. 14,4h) și la fel în tabel, în Excel și după modificarea unei celule' }
    ]
  },
  'V2026.10.1': {
    title: 'Aplicația Dispecer',
    items: [
      { icon: '🆕', text: 'Aplicație nouă, separată, pentru graficul dispecerilor — ture de 4/6/6/8 ore (T1, T2, T3, T4)' },
      { icon: '🔄', text: 'Generare automată pe ciclul T3→T2→T1→T4→liber, cu acoperire 24h' },
      { icon: '🔗', text: 'Selector de modul în antet (Exploatare / Dispecer)' }
    ]
  }
};

// ── Ture (Dispecer) ──────────────────────────────────────────────────────
const SHIFT_NAMES = ['L', 'T1', 'T2', 'T3', 'T4', 'CO', 'CM'];

const SHIFT_HOURS = [0, 4, 6, 6, 8, 0, 0];

const WEEKEND_HIDE = [5, 6]; // CO/CM nu se oferă în dropdown pe S/D (se afișează ca L)

// Un bloc = T3 → T2 → T1 → T4 (4 zile la rând), apoi cel puțin o zi liberă. În fiecare zi începe exact un
// bloc nou (T3), deci fiecare tură are CEL MULT UN dispecer pe zi, iar ceilalți sunt liberi. Cine începe
// blocul se alege echitabil (ore în an, apoi weekenduri + sărbători) — nu un ciclu fix pe zilele săptămânii.
const MIN_CYCLE_LEN = 5; // cel puțin 5 dispeceri pentru acoperire completă (4 lucrează + 1 liber)

function cycleLength() { return Math.max(MIN_CYCLE_LEN, state.employees.length); }

// Ore medii pe zi ale unui dispecer = 24h împărțite la numărul de dispeceri (min. 5); folosit la normă și CO/CM.
function avgHoursPerDay() { return 24 / cycleLength(); }

function defaultState() {
  const now = new Date();
  return {
    module: 'dispecer',
    schedule: {},
    preservedCOCM: {},
    genDay: 0, genStats: null, genYear: 0, genMonth: 0, genDim: 0,
    currentMonth: now.getMonth() + 1,
    currentYear: now.getFullYear(),
    org: { formatia: '', sefFOL: '', responsabilTehnic: '', aprobat: '', judet: '' },
    employees: [{ id: 1, name: 'Dispecer 1', category: 'dispecer' }]
  };
}

function migrateState(s) {
  s.module = 'dispecer';
  // Câmpuri rămase din vechea copie a Exploatării (config Urban/Rural, mod de generare, echipaje).
  ['config', 'genMode', 'customCrews', 'holidayBalance'].forEach(k => { delete s[k]; });
  s.employees.forEach(e => {
    e.category = 'dispecer';
    ['functia', 'crew', 'forced8', 'crewOverrides'].forEach(k => { delete e[k]; });
  });
  if (!s.schedule) s.schedule = {};
  if (!s.preservedCOCM) s.preservedCOCM = {};
  if (s.genDay === undefined) s.genDay = 0;
  if (s.genStats === undefined) s.genStats = null;
  if (s.genYear === undefined) s.genYear = 0;
  if (s.genMonth === undefined) s.genMonth = 0;
  if (s.genDim === undefined) s.genDim = 0;
  if (!s.org) s.org = { formatia: '', sefFOL: '', responsabilTehnic: '', aprobat: '', judet: '' };
}

// Selector de modul: Dispecer rămâne aici, Exploatare redirecționează la index.html.
function switchApp(v) {
  if (v === 'exploatare') window.location.href = 'index.html';
}

// Dispecer: blocuri T3 → T2 → T1 → T4, un bloc nou în fiecare zi (vezi nota de la constante).
const BLOCK_NEXT = { 3: 2, 2: 1, 1: 4, 4: 0 };        // tura de azi, dat fiind că ieri a fost cheia

const BLOCK_REMAINING = { 3: 3, 2: 2, 1: 1, 4: 0 };   // zile rămase în bloc după tura respectivă

const BLOCK_HOURS = 24;                                // un bloc T3+T2+T1+T4 = 6+6+4+8 ore

// Ture T1–T4 lucrate în sâmbete/duminici/sărbători legale, în același an, ÎNAINTE de `dk` (report între luni).
function weekendHolidayShifts(empId, dk) {
  const year = dk.slice(0, 4);
  const hol = new Set(getLegalHolidays(parseInt(year, 10)).map(h => h.date));
  let n = 0;
  for (const k in state.schedule) {
    if (k.slice(0, 4) !== year || k >= dk) continue;
    const v = state.schedule[k][String(empId)];
    if (!(v >= 1 && v <= 4)) continue;
    const dow = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)).getDay();
    if (dow === 0 || dow === 6 || hol.has(k)) n++;
  }
  return n;
}

// 1) continuă blocurile în curs (ieri T3 → azi T2 ș.a.m.d.); 2) alege, dintre cei odihniți, cine începe
// un bloc nou azi (T3): cel mai puțin încărcat în an (ore cu credit CO/CM), apoi cu cele mai puține
// weekenduri/sărbători, apoi id-ul. Nu începe un bloc cine are CO/CM în următoarele 3 zile (l-ar rupe).
function assignDispecerShifts(emps, dk, assigned, year, month, day) {
  const ctx = dayContext(year, month, day);
  const prev = state.schedule[ctx.prevKey] || {};
  const hasHistory = state.employees.some(e => prev[String(e.id)] >= 1 && prev[String(e.id)] <= 4);
  // Fără istoric (prima zi generată): „ieri" virtual (T1, T2, T3 la primii trei) ca să pornească toate
  // cele 4 ture din prima zi, nu abia după 3 zile.
  const virtual = {};
  if (!hasHistory) {
    emps.slice().sort((a, b) => a.id - b.id).slice(0, 3).forEach((e, i) => { virtual[e.id] = i + 1; });
  }
  const yesterday = e => hasHistory ? (prev[String(e.id)] || 0) : (virtual[e.id] || 0);
  const today = state.schedule[dk];
  emps.forEach(e => {
    const next = BLOCK_NEXT[yesterday(e)] || 0;
    if (next > 0) {
      today[String(e.id)] = next;
      if (!assigned.includes(e.id)) assigned.push(e.id);
    }
  });
  // fără CO/CM în următoarele 3 zile
  const leaveSoon = e => [1, 2, 3].some(off => {
    const v = (state.schedule[ctx.key(off)] || {})[String(e.id)];
    return v === 5 || v === 6;
  });
  let pool = emps.filter(e => !assigned.includes(e.id) && yesterday(e) !== 4);
  const rested = pool.filter(e => !leaveSoon(e));
  if (rested.length) pool = rested;
  if (!pool.length) return;
  const hrs = {}, we = {};
  pool.forEach(e => { hrs[e.id] = ctx.yearHours(e); we[e.id] = weekendHolidayShifts(e.id, dk); });
  // Orele contează doar la nivel de bloc (24h): cine e cu cel mult un bloc peste cel mai puțin încărcat
  // rămâne în joc, iar între ei decid weekendurile/sărbătorile. Altfel diferențe mici de ore ar impune o
  // ordine fixă (coadă), care la 7 dispeceri se blochează pe aceleași zile ale săptămânii.
  const minH = Math.min(...pool.map(e => hrs[e.id]));
  const near = pool.filter(e => hrs[e.id] <= minH + BLOCK_HOURS);
  near.sort((a, b) => we[a.id] - we[b.id] || hrs[a.id] - hrs[b.id] || a.id - b.id);
  today[String(near[0].id)] = 3;
  assigned.push(near[0].id);
}

// Orele de început/sfârșit ale turelor (față de miezul nopții zilei de start; T4 trece în ziua următoare).
const SHIFT_SPAN = { 1: [6, 10], 2: [10, 16], 3: [16, 22], 4: [22, 30] };

const MIN_REST_H = 11; // odihnă minimă între două ture consecutive

const MAX_CONSEC_DAYS = 4; // maxim zile lucrate la rând (ca ciclul T3→T2→T1→T4)

// Odihna dintre două ture din zile consecutive (prev ieri → cur azi). 0/CO/CM = fără constrângere.
function restBetween(prev, cur) {
  if (!SHIFT_SPAN[prev] || !SHIFT_SPAN[cur]) return Infinity;
  return 24 + SHIFT_SPAN[cur][0] - SHIFT_SPAN[prev][1];
}

// La fel, dar de la 1 ianuarie până la sfârșitul lunii `uptoMonth` (pt. coloana din statistici).
function holidayShiftsYear(empId, y, uptoMonth) {
  let n = 0;
  getLegalHolidays(y).forEach(h => {
    if (parseInt(h.date.slice(5, 7), 10) > uptoMonth) return;
    const v = (state.schedule[h.date] || {})[String(empId)];
    if (v >= 1 && v <= 4) n++;
  });
  return n;
}

// Context pentru o zi: chei de dată vecine, ore și zile consecutive acumulate până azi.
function dayContext(year, month, day) {
  const dayDate = new Date(year, month - 1, day);
  const key = off => { const d = new Date(dayDate); d.setDate(d.getDate() + off); return dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  return {
    key,
    prevKey: key(-1), nextKey: key(1),
    // Ore acumulate de la 1 ianuarie până ieri (report între luni): ture lucrate + credit CO/CM
    // pe zile lucrătoare (media ciclului). Folosit ca să alegem uniform cine preia / cine e liber.
    yearHours(e) {
      const dk = dateKey(year, month, day);
      let h = 0;
      for (const k in state.schedule) {
        if (k.slice(0, 4) !== String(year) || k >= dk) continue;
        const v = state.schedule[k][String(e.id)] || 0;
        if (v >= 1 && v <= 4) h += SHIFT_HOURS[v];
        else if (v === 5 || v === 6) {
          const dow = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)).getDay();
          if (dow !== 0 && dow !== 6) h += avgHoursPerDay();
        }
      }
      return h;
    },
    runBefore(e) {
      let r = 0;
      for (let off = -1; off >= -MAX_CONSEC_DAYS; off--) {
        const v = (state.schedule[key(off)] || {})[String(e.id)] || 0;
        if (v >= 1 && v <= 4) r++; else break;
      }
      return r;
    },
    // Dacă `e` ar lucra tura t azi (și apoi restul blocului): seria lui încape în maxim de zile la rând?
    consecOk(e, t) {
      return this.runBefore(e) + 1 + (BLOCK_REMAINING[t] || 0) <= MAX_CONSEC_DAYS;
    },
    // Poate `e` lucra tura t azi, respectând odihna minimă față de tura de ieri (reală)? Ziua următoare e
    // continuarea blocului (T3→T2→T1→T4→L), care respectă mereu odihna.
    restOk(e, t) {
      const y = (state.schedule[this.prevKey] || {})[String(e.id)] || 0;
      return restBetween(y, t) >= MIN_REST_H;
    }
  };
}

// Redistribuire automată: când CO/CM (sau prea puțini dispeceri) lasă o tură T1–T4 fără nimeni
// într-o zi, se caută cea mai bună reasignare a turelor zilei. Fiecare tură are cel mult UN dispecer.
// Se evaluează TOATE variantele legale (cel mult 4 ture × câțiva dispeceri) și se alege, în ordine:
//   1. cât mai multe ture T1–T4 acoperite;
//   2. orele acumulate în an cât mai uniforme între dispeceri (suma pătratelor orelor, după azi);
//   3. cât mai puține schimbări față de alocarea inițială a zilei.
// Un dispecer poate prelua o tură doar dacă respectă odihna minimă (11h) față de ziua anterioară și
// seria lui (zile lucrate înainte + restul blocului) nu depășește zilele consecutive. CO/CM nu se ating. Ce nu se poate acoperi legal rămâne gol
// (afișat ca avertisment sub tabel — se corectează manual din dropdown).
function rebalanceCoverage(dk, year, month, day) {
  const emps = state.employees;
  const today = state.schedule[dk];
  const val = e => today[String(e.id)] || 0;
  if ([1, 2, 3, 4].every(t => emps.filter(e => val(e) === t).length === 1)) return;
  const ctx = dayContext(year, month, day);
  const avail = emps.filter(e => val(e) !== 5 && val(e) !== 6);
  const hrs = {};
  avail.forEach(e => { hrs[e.id] = ctx.yearHours(e); });
  const can = {}; // can[e.id][t]: poate `e` lucra tura t azi? (tura lui curentă — întotdeauna)
  avail.forEach(e => {
    can[e.id] = {};
    [1, 2, 3, 4].forEach(t => {
      can[e.id][t] = val(e) === t || (ctx.restOk(e, t) && ctx.consecOk(e, t));
    });
  });
  const holderOf = {};
  [1, 2, 3, 4].forEach(t => { holderOf[t] = avail.find(e => val(e) === t) || null; });
  let best = null;
  const pick = {}, used = new Set();
  const evaluate = () => {
    const final = {};
    avail.forEach(e => { final[e.id] = 0; });
    const taken = new Set();
    for (const t of [1, 2, 3, 4]) {
      if (pick[t]) { final[pick[t].id] = t; taken.add(pick[t].id); }
    }
    for (const t of [1, 2, 3, 4]) {            // tura nereasignată rămâne la titularul ei, dacă nu a plecat
      const h = holderOf[t];
      if (!pick[t] && h && !taken.has(h.id)) { final[h.id] = t; taken.add(h.id); }
    }
    const covered = [1, 2, 3, 4].filter(t => avail.some(e => final[e.id] === t)).length;
    let sq = 0, changes = 0;
    avail.forEach(e => {
      const h = hrs[e.id] + (SHIFT_HOURS[final[e.id]] || 0);
      sq += h * h;
      if (final[e.id] !== val(e)) changes++;
    });
    const key = [4 - covered, sq, changes];
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && key[2] < best.key[2])))) {
      best = { key, final: Object.assign({}, final) };
    }
  };
  const rec = t => {
    if (t > 4) { evaluate(); return; }
    pick[t] = null;
    rec(t + 1);                                // tura t: nereasignată
    for (const e of avail) {
      if (used.has(e.id) || !can[e.id][t]) continue;
      used.add(e.id); pick[t] = e;
      rec(t + 1);
      used.delete(e.id); pick[t] = null;
    }
  };
  rec(1);
  if (!best) return;
  avail.forEach(e => {
    if (best.final[e.id] !== val(e)) today[String(e.id)] = best.final[e.id];
  });
}

// Zilele (deja generate) din luna dată în care cel puțin o tură T1–T4 nu are pe nimeni.
function coverageGaps(year, month) {
  const gaps = [];
  const emps = state.employees;
  if (!emps.length) return gaps;
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const day = state.schedule[dateKey(year, month, d)];
    if (!day || Object.keys(day).length < emps.length) continue;
    const miss = [1, 2, 3, 4].filter(t => !emps.some(e => day[String(e.id)] === t));
    if (miss.length) gaps.push({ day: d, shifts: miss.map(t => SHIFT_NAMES[t]) });
  }
  return gaps;
}

const HELP_DEFAULT_MODE = 'disp';

function renderTable() {
  const thead = document.getElementById('table-head');
  const tbody = document.getElementById('table-body');
  const emptyEl = document.getElementById('empty-msg');
  const m = state.currentMonth;
  const y = state.currentYear;
  const dim = daysInMonth(y, m);
  const emps = state.employees;
  // Sărbători legale ale lunii curente — Map<ziua, nume>, calculat o dată per randare, folosit
  // atât pentru marcajul pe coloane cât și pentru lista de sub tabel (renderHolidayList). Doar
  // informativ — nu influențează alocarea (dispeceratul lucrează 24/7).
  const prefix = y + '-' + pad(m);
  const monthHolidays = getLegalHolidays(y).filter(h => h.date.startsWith(prefix));
  const holidayByDay = new Map(monthHolidays.map(h => [parseInt(h.date.slice(-2), 10), h.name]));

  let hhtml = '<tr><th style="min-width:180px;white-space:nowrap">Nume Prenume</th>';
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
  renderGapList(y, m);
  if (emps.length === 0) {
    tbody.innerHTML = '';
    emptyEl.innerHTML = 'Adaugă dispeceri și generează graficul.';
    return;
  }
  emptyEl.innerHTML = '';

  const expected = expectedHours(y, m);
  let bhtml = '';
  emps.forEach(emp => {
    const st = getEmployeeStats(emp.id);
    const cls = hoursCellClass(st.hours, expected, st);
    bhtml += '<tr><td class="emp-name-cell" onclick="openEditModal(' + emp.id + ')">' + esc(emp.name) + '</td>';
    for (let d = 1; d <= dim; d++) {
      const dow = new Date(y, m - 1, d).getDay();
      const dk = dateKey(y, m, d);
      let v = getShift(dk, emp.id);
      if (v === null || v === undefined) v = 0;
      const weekend = (dow === 0 || dow === 6);
      // CO/CM în weekend: se afișează ca L (nu se contorizează), valoarea reală rămâne în state.
      const displayV = (weekend && WEEKEND_HIDE.includes(v)) ? 0 : v;
      const tdCls = ['shift-' + displayV, weekend ? 'td-weekend' : '', holidayByDay.get(d) ? 'td-holiday' : ''].filter(Boolean).join(' ');
      bhtml += '<td class="' + tdCls + '"><select onchange="onShiftChange(\'' + dk + '\',' + emp.id + ',this)">';
      for (let si = 0; si < SHIFT_NAMES.length; si++) {
        if (weekend && WEEKEND_HIDE.includes(si)) continue;
        bhtml += '<option value="' + si + '"' + (si === displayV ? ' selected' : '') + '>' + SHIFT_NAMES[si] + '</option>';
      }
      bhtml += '</select><span class="print-shift shift-' + displayV + '">' + SHIFT_NAMES[displayV] + '</span></td>';
    }
    bhtml += '<td class="' + cls + ' hours-cell">' + st.hours + 'h</td>';
    bhtml += '<td class="hours" style="font-size:12px">' + leaveHours(st) + 'h</td>';
    bhtml += '<td class="hours" style="font-size:12px;color:var(--text-muted)">' + (expected !== null ? expected + 'h' : '—') + '</td></tr>';
  });
  tbody.innerHTML = bhtml;
}

// Ture cu mai mulți dispeceri în aceeași zi (regula: cel mult unul pe tură) — apar doar din editare manuală.
function duplicateShifts(year, month) {
  const out = [];
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const day = state.schedule[dateKey(year, month, d)];
    if (!day) continue;
    const dup = [1, 2, 3, 4].filter(t => state.employees.filter(e => day[String(e.id)] === t).length > 1);
    if (dup.length) out.push({ day: d, shifts: dup.map(t => SHIFT_NAMES[t]) });
  }
  return out;
}

// Avertismente sub tabel: ture neacoperite (după redistribuirea automată) și ture cu mai mulți dispeceri.
function renderGapList(y, m) {
  const el = document.getElementById('gap-list');
  if (!el) return;
  const gaps = coverageGaps(y, m);
  const dups = duplicateShifts(y, m);
  const lines = [];
  if (gaps.length) lines.push('⚠️ Ture neacoperite (nu se pot acoperi respectând odihna minimă de ' + MIN_REST_H + 'h): '
    + gaps.map(g => g.day + '.' + pad(m) + ' (' + g.shifts.join(', ') + ')').join(' • ') + ' — corectează manual din dropdown.');
  if (dups.length) lines.push('⚠️ Ture cu mai mulți dispeceri (regula: cel mult unul pe tură): '
    + dups.map(g => g.day + '.' + pad(m) + ' (' + g.shifts.join(', ') + ')').join(' • ') + '.');
  el.innerHTML = lines.map(esc).join('<br>');
}

function renderLegend() {
  const legendEl = document.getElementById('table-legend');
  if (!legendEl) return;
  const pill = (cls, txt, style) => '<span class="shift-pill ' + cls + '" style="padding:2px 8px;font-size:11px;' + (style || '') + '">' + txt + '</span> ';
  legendEl.innerHTML = '<span style="font-weight:700;color:var(--text-muted);margin-right:4px">Legendă:</span>'
    + pill('pill-t1', 'T1 &nbsp;06:00–10:00 (4h)')
    + pill('pill-t2', 'T2 &nbsp;10:00–16:00 (6h)')
    + pill('pill-t3', 'T3 &nbsp;16:00–22:00 (6h)')
    + pill('pill-t4', 'T4 &nbsp;22:00–06:00 (8h)')
    + pill('pill-co', 'CO — Concediu Odihnă')
    + pill('pill-cm', 'CM — Concediu Medical')
    + pill('', 'L — Liber', 'background:var(--shift0-bg);color:var(--shift0-text)');
}

function renderSummary() {
  const container = document.getElementById('summary');
  if (state.employees.length === 0) { container.innerHTML = ''; return; }
  const expected = expectedHours(state.currentYear, state.currentMonth);
  const mn = getMonthName(state.currentMonth);
  const sectionStyle = 'display:flex;align-items:center;gap:8px;margin:14px 0 6px;cursor:pointer;user-select:none';
  const btnStyle = 'background:none;border:none;font-size:12px;cursor:pointer;color:var(--text-muted);padding:2px 6px;border-radius:4px;border:1px solid var(--border)';
  const pillCls = ['', 'pill-t1', 'pill-t2', 'pill-t3', 'pill-t4'];
  let html = '';
  if (expected !== null) {
    html += '<div style="font-size:13px;color:var(--text);padding:6px 10px;background:var(--ctrl-bg);border-radius:6px;display:inline-block">📅 ' + mn + ' ' + state.currentYear + ' — <strong>' + expected + 'h</strong> normă/dispecer</div>';
  }
  // Secțiunea Carduri
  const cardsOpen = summaryCardsOpen;
  html += '<div style="' + sectionStyle + '" onclick="toggleSummarySection(\'sum-cards\')">'
    + '<button id="sum-cards-btn" style="' + btnStyle + '">' + (cardsOpen ? '▼' : '▶') + '</button>'
    + '<span style="font-size:14px;font-weight:700;color:var(--heading)">Carduri dispeceri</span>'
    + '</div>';
  html += '<div id="sum-cards" style="display:' + (cardsOpen ? '' : 'none') + '">';
  html += '<div class="summary-grid">';
  state.employees.forEach(emp => {
    const st = getEmployeeStats(emp.id);
    const effExpected = effectiveExpected(expected, st);
    const verdict = classifyHours(st.hours, effExpected);
    const pct = effExpected ? Math.min(100, Math.round((st.hours / effExpected) * 100)) : null;
    let cardCls = 'emp-card';
    if (verdict === 'warn') cardCls += ' warn';
    else if (verdict === 'over' || verdict === 'under') cardCls += ' bad';
    const pills = [];
    for (let i = 1; i <= 4; i++) { if (st.counts[i]) pills.push('<span class="shift-pill ' + pillCls[i] + '">' + SHIFT_NAMES[i] + ' ×' + st.counts[i] + '</span>'); }
    if (st.co) pills.push('<span class="shift-pill pill-co">CO ×' + st.co + '</span>');
    if (st.cm) pills.push('<span class="shift-pill pill-cm">CM ×' + st.cm + '</span>');
    const holCount = holidayShiftsCount(emp.id, state.currentYear, state.currentMonth);
    const holYear = holidayShiftsYear(emp.id, state.currentYear, state.currentMonth);
    if (holCount || holYear) pills.push('<span class="shift-pill" style="background:var(--holiday-bg);color:var(--holiday-text)" data-tooltip="Ture lucrate în sărbători legale: în luna afișată și de la 1 ianuarie până la sfârșitul ei">🎉 Sărb.: ' + holCount + ' lună · ' + holYear + ' an</span>');
    html += '<div class="' + cardCls + '">'
      + '<div class="emp-card-header"><span class="emp-card-name">' + esc(emp.name) + '</span></div>'
      + '<div class="emp-card-hours"><strong>' + st.hours + 'h</strong>' + (effExpected !== null ? ' / ' + effExpected + 'h (' + pct + '%)' : ' — normă necunoscută') + '</div>'
      + '<div class="shift-pills">' + (pills.length ? pills.join('') : '<span style="color:var(--empty);font-size:11px">—</span>') + '</div>'
      + '</div>';
  });
  html += '</div></div>'; // închide summary-grid + sum-cards

  // Tabel statistici detaliate
  const tableOpen = summaryTableOpen;
  html += '<div style="' + sectionStyle + '" onclick="toggleSummarySection(\'sum-table\')">'
    + '<button id="sum-table-btn" style="' + btnStyle + '">' + (tableOpen ? '▼' : '▶') + '</button>'
    + '<span style="font-size:14px;font-weight:700;color:var(--heading)">Statistici ture — ' + mn + ' ' + state.currentYear + '</span>'
    + '</div>';
  html += '<div id="sum-table" style="display:' + (tableOpen ? '' : 'none') + '">';
  html += '<table class="stat-table"><thead><tr>'
    + '<th style="text-align:left">Nume Prenume</th>'
    + '<th title="Tura 1 (06:00–10:00)">T1</th><th title="Tura 2 (10:00–16:00)">T2</th>'
    + '<th title="Tura 3 (16:00–22:00)">T3</th><th title="Tura 4 (22:00–06:00)">T4</th>'
    + '<th title="Concediu Odihnă">CO</th><th title="Concediu Medical">CM</th>'
    + '<th title="Ture lucrate în zile de sărbătoare legală, în luna curentă">🎉 Sărb.</th>'
    + '<th title="Ture lucrate în sărbători legale de la 1 ianuarie până la sfârșitul lunii afișate">🎉 Sărb. an</th>'
    + '<th title="Ore lucrate efectiv">Lucrate</th>'
    + '<th title="Normă lunară">Normă</th>'
    + '<th title="Diferență față de normă">±</th>'
    + '</tr></thead><tbody>';
  state.employees.forEach(emp => {
    const st = getEmployeeStats(emp.id);
    const effExpected = effectiveExpected(expected, st);
    const diff = effExpected !== null ? st.hours - effExpected : null;
    const diffStr = diff === null ? '—' : (diff === 0 ? '=' : (diff > 0 ? '+'+diff+'h' : diff+'h'));
    const verdict = classifyHours(st.hours, effExpected);
    const rowCls = verdict === 'over' || verdict === 'under' ? 'stat-row-bad' : verdict === 'warn' ? 'stat-row-warn' : 'stat-row-ok';
    const hoursCls = verdict === 'over' || verdict === 'under' ? 'stat-hours-bad' : verdict === 'warn' ? 'stat-hours-warn' : 'stat-hours-ok';
    const holCount = holidayShiftsCount(emp.id, state.currentYear, state.currentMonth);
    html += '<tr class="' + rowCls + '">'
      + '<td>' + esc(emp.name) + '</td>'
      + '<td>' + (st.counts[1]||'—') + '</td>'
      + '<td>' + (st.counts[2]||'—') + '</td>'
      + '<td>' + (st.counts[3]||'—') + '</td>'
      + '<td>' + (st.counts[4]||'—') + '</td>'
      + '<td>' + (st.co||'—') + '</td>'
      + '<td>' + (st.cm||'—') + '</td>'
      + '<td' + (holCount ? ' style="color:var(--holiday-text);font-weight:700"' : '') + '>' + (holCount||'—') + '</td>'
      + '<td style="color:var(--text-muted)">' + (holidayShiftsYear(emp.id, state.currentYear, state.currentMonth) || '—') + '</td>'
      + '<td class="' + hoursCls + '">' + st.hours + 'h</td>'
      + '<td style="color:var(--text-muted)">' + (effExpected !== null ? effExpected + 'h' : '—') + '</td>'
      + '<td class="' + hoursCls + '">' + diffStr + '</td>'
      + '</tr>';
  });
  html += '</tbody></table></div>'; // închide sum-table

  container.innerHTML = html;
}

// Fișierele din aplicația Exploatare (electricieni urban/rural, ture T1A/T2A/8/INST) au alt
// înțeles al valorilor de tură — importate aici ar produce un grafic fără sens. Se refuză.
function looksLikeExploatare(data) {
  if (data.module && data.module !== 'dispecer') return true;
  const emps = Array.isArray(data.employees) ? data.employees : [];
  if (emps.some(e => e && (e.category === 'urban' || e.category === 'rural' || e.category === '8ore' || e.forced8 || e.crew))) return true;
  if (data.config && (data.config.urban || data.config.rural)) return true;
  return false;
}

function applyJSON(text) {
  try {
    const data = JSON.parse(text);
    if (looksLikeExploatare(data)) { setStatus('Fișierul provine din aplicația Exploatare — nu poate fi încărcat în Dispecer.', 'err'); return; }
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
      // Coliziune de id: dacă fișierul are un dispecer cu ACELAȘI id dar NUME diferit față de
      // cineva local, turele din fișier i s-ar aplica silențios persoanei greșite (bug găsit la
      // audit — id-urile pornesc de la 1 în orice instalare nouă, coliziunea e foarte plauzibilă
      // exact în fluxul publicitar al aplicației: "trimite doar luna curentă cuiva").
      if (Array.isArray(data.employees)) {
        const localById = new Map(state.employees.map(e => [e.id, e.name]));
        const conflicts = data.employees.filter(e => localById.has(e.id) && localById.get(e.id) !== e.name).map(e => e.name + ' (local: ' + localById.get(e.id) + ')');
        if (conflicts.length && !confirm('Fișierul conține electricieni cu alt nume dar același id ca cei locali:\n' + conflicts.join(', ') + '\nTurele lor din fișier ar putea ajunge pe persoana greșită. Continuați?')) return;
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
      // altfel un import de lună mai veche ștergea silențios orice dispecer adăugat de atunci
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
    saveState();
    document.getElementById('sel-month').value = state.currentMonth || 1;
    document.getElementById('sel-year').value = state.currentYear || new Date().getFullYear();
      render();
    updateButtons();
    setStatus('Baza de date restaurată din fișier.', 'success');
  } catch (err) {
    setStatus('Eroare la citirea fișierului.', 'err');
  }
}

function exportExcel() {
  if (typeof ExcelJS === 'undefined') { setStatus('Biblioteca Excel nu este disponibilă.', 'err'); return; }
  const emps = state.employees;
  const m = state.currentMonth, y = state.currentYear;
  const dim = daysInMonth(y, m);
  const mn = getMonthName(m);
  if (emps.length === 0) { setStatus('Niciun dispecer de exportat.', 'warn'); return; }
  const expected = expectedHours(y, m);
  const DAY_NAMES = ['D','L','M','M','J','V','S'];
  const shiftFill = {
    0:{bg:'F0F0F0',fg:'666666'}, 1:{bg:'D6EAF8',fg:'1A5276'}, 2:{bg:'FDEBD0',fg:'935116'},
    3:{bg:'AED6F1',fg:'154360'}, 4:{bg:'FAD7A0',fg:'7E4D0E'}, 5:{bg:'E8D5F5',fg:'6C3483'},
    6:{bg:'E8E8E8',fg:'555555'}, 7:{bg:'F0F4F8',fg:'2C3E50'}, 8:{bg:'D5F5E3',fg:'1A7A3A'}
  };
  const argb = c => 'FF' + c;
  const fill = bg => ({ type:'pattern', pattern:'solid', fgColor:{ argb: argb(bg) } });
  const fnt = (fg, bold, sz, italic) => ({ color:{ argb: argb(fg) }, bold:!!bold, size: sz||10, italic:!!italic });
  const aln = (h, v, wrap) => ({ horizontal: h||'center', vertical: v||'middle', wrapText:!!wrap });
  const firstDay = 1, lastDay = firstDay + dim - 1;
  const colLucrate = lastDay + 1, colCOCM = lastDay + 2, colHoliday = lastDay + 3, colNorma = lastDay + 4;
  const totalCols = colNorma + 1;
  (async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(mn + ' ' + y, { pageSetup:{ paperSize:13, orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:0 } });
    ws.getColumn(1).width = 22;
    for (let d = 1; d <= dim; d++) ws.getColumn(firstDay + d).width = 4.5;
    ws.getColumn(colLucrate+1).width = 9; ws.getColumn(colCOCM+1).width = 7; ws.getColumn(colHoliday+1).width = 7; ws.getColumn(colNorma+1).width = 7;
    // Logo
    const logoId = wb.addImage({ base64: LOGO_B64, extension: 'png' });
    ws.addImage(logoId, { tl:{ col:0, row:0 }, ext:{ width:160, height:52 } });
    ws.getRow(1).height = 42;
    // Title
    const tc = ws.getCell(1, 2); tc.value = 'Grafic dispecer — ' + mn + ' ' + y;
    tc.font = fnt('2C3E50', true, 16); tc.alignment = aln('left','middle');
    ws.mergeCells(1, 2, 1, totalCols);
    // Subtitle
    ws.getRow(2).height = 16;
    const org = getOrg();
    const sc = ws.getCell(2, 2); sc.value = orgSubtitle(org);
    sc.font = fnt('7F8C8D', false, 10, true); sc.alignment = aln('left','middle');
    ws.mergeCells(2, 2, 2, totalCols);
    // Norm
    ws.getRow(3).height = 14;
    const nc0 = ws.getCell(3, 1); nc0.value = mn + ' ' + y + ' — ' + (expected!==null?expected+'h':'? h') + ' normă/dispecer';
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
    const yearHolidays = new Set(getLegalHolidays(y).map(h => h.date));
    for (let d = 1; d <= dim; d++) {
      const dow = new Date(y, m-1, d).getDay();
      setHdr(HDR, firstDay + d, d + '\n' + DAY_NAMES[dow], dow===0||dow===6, yearHolidays.has(dateKey(y,m,d)));
    }
    setHdr(HDR, colLucrate+1, 'Lucrate'); setHdr(HDR, colCOCM+1, 'CO/CM'); setHdr(HDR, colHoliday+1, 'Sărb.'); setHdr(HDR, colNorma+1, 'Normă');
    // Rows
    let R = HDR + 1;
    const gEmpsX = emps;
    if (gEmpsX.length) {
      gEmpsX.forEach(emp => {
        const st = getEmployeeStats(emp.id);
        const effExpected = effectiveExpected(expected, st);
        const diff = effExpected !== null ? st.hours - effExpected : 0;
        const hBg = effExpected===null?'F8F9FB':diff===0?'E8F8F0':diff>0?'FDE8E8':diff>=-16?'FFF8E1':'FDE8E8';
        const hFg = effExpected===null?'555555':diff===0?'1A7A3A':diff>0?'C0392B':diff>=-16?'B7770D':'C0392B';
        ws.getRow(R).height = 15;
        const c1=ws.getCell(R,1); c1.value=emp.name; c1.font=fnt('1A1A2E',true,9); c1.fill=fill('FFFFFF'); c1.alignment=aln('left','middle');
        for (let d = 1; d <= dim; d++) {
          const dow = new Date(y,m-1,d).getDay(), isW = dow===0||dow===6;
          const dk = dateKey(y,m,d);
          const v = getShift(dk, emp.id), rawSv = v!==null?v:0;
          const sv = (isW && (rawSv===5||rawSv===6)) ? 0 : rawSv;
          const ss = shiftFill[sv], bg = isW&&sv===0?'FCE4E4':ss.bg, fg = isW&&sv===0?'999999':ss.fg;
          const dc = ws.getCell(R, firstDay+d);
          dc.value=SHIFT_NAMES[sv]; dc.font=fnt(fg,true,8); dc.fill=fill(bg); dc.alignment=aln('center','middle');
          if (yearHolidays.has(dk)) { const hb = { style:'thick', color:{argb:'FFD4A017'} }; dc.border = { top:hb, bottom:hb, left:hb, right:hb }; }
        }
        const lc=ws.getCell(R,colLucrate+1); lc.value=st.hours; lc.font=fnt(hFg,true,9); lc.fill=fill(hBg); lc.alignment=aln('center','middle');
        const cc=ws.getCell(R,colCOCM+1); cc.value=leaveHours(st); cc.font=fnt('6C3483',false,9); cc.fill=fill('F5EEF8'); cc.alignment=aln('center','middle');
        const holCount1 = holidayShiftsCount(emp.id, y, m);
        const hcc=ws.getCell(R,colHoliday+1); hcc.value=holCount1||0; hcc.font=fnt(holCount1?'8A6510':'AAAAAA', !!holCount1, 9); hcc.fill=fill(holCount1?'FDF3D0':'F8F9FB'); hcc.alignment=aln('center','middle');
        const nc=ws.getCell(R,colNorma+1); nc.value=expected!==null?expected:'—'; nc.font=fnt('7F8C8D',false,9); nc.fill=fill('F8F9FB'); nc.alignment=aln('center','middle');
        R++;
      });
    }
    R++;
    ws.getRow(R).height = 22;
    var lc=ws.getCell(R,1); lc.value='Legendă:'; lc.font=fnt('2C3E50',true,10);
    ws.mergeCells(R,1,R,2);
    var li=[['T1  06-10 (4h)','D6EAF8','1A5276'],['T2  10-16 (6h)','FDEBD0','935116'],['T3  16-22 (6h)','AED6F1','154360'],['T4  22-06 (8h)','FAD7A0','7E4D0E'],['CO  Concediu','E8D5F5','6C3483'],['CM  Medical','E8E8E8','555555'],['L  Liber','F0F0F0','666666']];
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
    const sigs = orgSignatures(getOrg()).map(s => [s.label, s.name || '—']);
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

// Câmpurile organizației. `sig` = apare ca semnătură (print/Excel). Denumirile (`labels`) sunt editabile
// de utilizator, iar fiecare câmp poate fi dezactivat (`off`) — dispecerii au alte entități/funcții.
const ORG_FIELDS = [
  { key: 'formatia', label: 'Formația / Unitatea', valPh: 'ex: Formația Dispecerat Piatra Neamț' },
  { key: 'sefFOL', label: 'Șef FOL EM', valPh: 'Nume Prenume', sig: 'sig-sef' },
  { key: 'responsabilTehnic', label: 'Responsabil Tehnic', valPh: 'Nume Prenume', sig: 'sig-resp' },
  { key: 'judet', label: 'Județ (pentru Șef CORE)', valPh: 'ex: Neamț' },
  { key: 'aprobat', label: 'Aprobat Șef CORE', valPh: 'Nume Prenume', sig: 'sig-aprobat' }
];

const ORG_DEFAULT_ENTITY = 'Delgaz Grid S.A';

function getOrg() {
  const stored = loadOrg() || state.org || {};
  const org = Object.assign({ formatia: '', sefFOL: '', responsabilTehnic: '', aprobat: '', judet: '', entitate: ORG_DEFAULT_ENTITY }, stored);
  org.labels = Object.assign({}, stored.labels || {});
  org.off = Object.assign({}, stored.off || {});
  if (typeof org.entitate !== 'string') org.entitate = ORG_DEFAULT_ENTITY;
  return org;
}

function orgLabel(org, key) {
  const f = ORG_FIELDS.find(x => x.key === key);
  const v = (org.labels[key] || '').trim();
  return v || (f ? f.label : key);
}

function orgOn(org, key) { return !org.off[key]; }

// „Formația — Entitatea” pentru subtitlu / Excel; câmpurile dezactivate sau goale se omit.
function orgSubtitle(org) {
  return [orgOn(org, 'formatia') ? org.formatia : '', org.entitate].map(s => (s || '').trim()).filter(Boolean).join(' — ');
}

// Semnăturile active, în ordine: [{key, label, name}]; la „Aprobat” se adaugă județul (dacă e activ).
function orgSignatures(org) {
  return ORG_FIELDS.filter(f => f.sig && orgOn(org, f.key)).map(f => {
    let label = orgLabel(org, f.key);
    if (f.key === 'aprobat' && orgOn(org, 'judet') && (org.judet || '').trim()) label += ' ' + org.judet.trim();
    return { key: f.key, id: f.sig, label, name: (org[f.key] || '').trim() };
  });
}

function applyOrgToDOM() {
  const org = getOrg();
  const sub = orgSubtitle(org);
  const subtitle = document.getElementById('org-subtitle');
  if (subtitle) subtitle.textContent = sub;
  document.title = 'Grafic dispecer' + (orgOn(org, 'formatia') && org.formatia ? ' — ' + org.formatia : '') + (org.entitate ? ' - ' + org.entitate : '');
  // esc(): org.* poate veni dintr-un fișier JSON importat de la altcineva — fără escape, innerHTML
  // nesigur = XSS stocat la reload (bug găsit la audit: applyJSON poate seta ORG_KEY din data.org).
  const active = new Map(orgSignatures(org).map(s => [s.id, s]));
  ORG_FIELDS.filter(f => f.sig).forEach(f => {
    const el = document.getElementById(f.sig);
    if (!el) return;
    const box = el.closest('.signature-box') || el;
    const s = active.get(f.sig);
    box.style.display = s ? '' : 'none';
    if (s) el.innerHTML = esc(s.label) + '<br>' + esc(s.name || '—');
  });
}

function openOrgModal() {
  const org = getOrg();
  document.getElementById('org-entitate').value = org.entitate;
  const box = document.getElementById('org-fields');
  box.innerHTML = ORG_FIELDS.map(f =>
    '<div class="org-row' + (orgOn(org, f.key) ? '' : ' off') + '" id="org-row-' + f.key + '">'
    + '<div class="org-row-head">'
    + '<input type="checkbox" id="org-on-' + f.key + '" onchange="orgFieldToggled(\'' + f.key + '\')"' + (orgOn(org, f.key) ? ' checked' : '') + ' title="Câmp activ — debifat: nu apare în antet, print și Excel">'
    + '<input type="text" class="org-lbl" id="org-lbl-' + f.key + '" value="' + escAttr(orgLabel(org, f.key)) + '" placeholder="' + escAttr(f.label) + '" title="Denumirea câmpului (editabilă)">'
    + '</div>'
    + '<input type="text" class="org-val" id="org-val-' + f.key + '" style="width:100%" value="' + escAttr(org[f.key] || '') + '" placeholder="' + escAttr(f.valPh) + '"' + (orgOn(org, f.key) ? '' : ' disabled') + '>'
    + '</div>'
  ).join('');
  document.getElementById('org-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('org-entitate').focus(), 50);
}

function orgFieldToggled(key) {
  const on = document.getElementById('org-on-' + key).checked;
  document.getElementById('org-val-' + key).disabled = !on;
  document.getElementById('org-row-' + key).classList.toggle('off', !on);
}

function saveOrgSettings() {
  const prev = getOrg();
  const org = { entitate: document.getElementById('org-entitate').value.trim(), labels: {}, off: {}, configured: true };
  ORG_FIELDS.forEach(f => {
    org[f.key] = document.getElementById('org-val-' + f.key).value.trim();
    const lbl = document.getElementById('org-lbl-' + f.key).value.trim();
    if (lbl && lbl !== f.label) org.labels[f.key] = lbl;
    if (!document.getElementById('org-on-' + f.key).checked) {
      org.off[f.key] = true;
      if (!org[f.key]) org[f.key] = prev[f.key] || ''; // valoarea rămâne memorată cât timp câmpul e dezactivat
    }
  });
  saveOrg(org);
  state.org = org;
  saveState();
  applyOrgToDOM();
  closeOrgModal();
  setStatus('Setări organizație salvate.', 'success');
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
    // migrate org from state to dedicated ORG_KEY if not yet migrated
    if (!loadOrg() && state.org && state.org.sefFOL) saveOrg(state.org);
    applyOrgToDOM();
      render();
    updateButtons();
    if (dbEl) dbEl.textContent = loaded ? '💾 IndexedDB: date încărcate' : '💾 IndexedDB: date noi';
    checkVersion();
    const org = getOrg();
    if (!org.configured && !org.sefFOL && !org.responsabilTehnic && !org.aprobat) openOrgModal();
  }).catch(e => {
    render();
    updateButtons();
    applyOrgToDOM();
      if (dbEl) dbEl.textContent = '💾 IndexedDB: eroare';
  });
});
