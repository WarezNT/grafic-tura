// ===========================================================================
// ȘABLON PENTRU UN MOD NOU — copiază acest fișier în modes/<mod>.js și completează.
// (Nu este încărcat de nicio pagină; e doar ghid. Vezi CLAUDE.md, secțiunea „Cum adaug un mod”.)
//
// Pașii, în ordine:
//   1. js/modes-registry.js  → adaugă {id, label, page} în APP_MODES.
//   2. modes/<mod>.js        → acest fișier (constante + MODE + funcțiile specifice).
//   3. js/manual-<mod>.js    → manualul (MANUALS.<cheie> = {label, panels}); adaugă-l în toate paginile.
//   4. <mod>.html            → copie a dispecer.html cu fișierul de mod schimbat (30 de linii).
//   5. tests/snapshot.js     → un scenariu nou; generează tests/_baseline-<mod>.json din versiunea de referință.
//
// Ordinea scripturilor în pagină: logo → modes-registry → manual-* → modes/<mod> → shell → core.
// Fișierul de mod NU apelează funcții din core la încărcare (doar în hook-uri, la evenimente).
// ===========================================================================

// ── chei de persistență (unice pe mod, ca datele să nu se amestece) ──
const STORAGE_KEY = 'graficTura_<mod>';
const VERSION_KEY = 'graficTura_<mod>_version';
const ORG_KEY = 'graficTura_<mod>_org';
const APP_VERSION = 'V2026.MM.1';
const DB_NAME = 'GraficTura<Mod>DB';

// ── istoricul versiunilor (popup „Ce e nou”): cheia = APP_VERSION ──
const CHANGELOG = {
  'V2026.MM.1': { title: 'Mod nou', items: [{ icon: '🆕', text: 'Descriere' }] }
};

// ── ture: valorile numerice stocate în state.schedule[zi][idAngajat] ──
const SHIFT_NAMES = ['L', 'T1', 'T2', 'CO', 'CM'];       // indexul = valoarea
const SHIFT_HOURS = [0, 8, 8, 0, 0];                      // ore pe valoare (CO/CM = 0, creditat la normă)

// ── contractul modului față de nucleu (js/core.js) ──
const MODE = {
  id: '<mod>',                  // = id din APP_MODES
  dbKey: 'main_<mod>',          // cheia în IndexedDB
  stateModule: '<mod>',         // etichetă în state.module (garda la import între moduri)
  helpMode: '<cheie>',          // cheia din MANUALS deschisă implicit
  words: {                      // cuvinte din mesajele nucleului
    employee: 'angajat', Employee: 'Angajat', employeeGen: 'angajatului', employeesPl: 'angajați',
    keptLong: 'CO și CM', keptShort: 'CO/CM'               // ce păstrează „Curăță”
  },
  keepOnClear: [3, 4],          // valori păstrate la „Curăță” (CO, CM)
  leaveTypes: { 3: 'CO', 4: 'CM' },
  leaveSkipWeekend: [],
  leaveHoursPerDay() { return 8; },                         // ore creditate pe zi de CO/CM
  isWorkShift(v) { return v > 0 && (SHIFT_HOURS[v] || 0) > 0; },   // contează ca tură lucrată (sărbători)
  expectedHours(y, m) { return 8 * 21; },                   // norma lunară (null = necunoscută)

  // organizația: scheletul (titlu, subtitlu, semnături, modal, salvare) e în nucleu.
  // Fiecare mod are propriul ORG_KEY → setările celor două aplicații sunt independente.
  org: {
    defaults() { return { formatia: '', sefFOL: '', responsabilTehnic: '', aprobat: '', judet: '' }; },
    subtitle(org) { return [org.formatia, 'Entitatea S.A'].filter(Boolean).join(' — '); },
    title(org) { return 'Grafic' + (org.formatia ? ' — ' + org.formatia : ''); },
    signatures(org) {
      return [
        { id: 'sig-sef', html: 'Șef FOL EM<br>' + esc(org.sefFOL || '—') },
        { id: 'sig-resp', html: 'Responsabil Tehnic<br>' + esc(org.responsabilTehnic || '—') },
        { id: 'sig-aprobat', html: 'Aprobat<br>' + esc(org.aprobat || '—') }
      ];
    },
    fillForm(org) { /* completează inputurile modalului (id-uri din MODE.shell) */ },
    readForm(prev) { return prev; },   // întoarce obiectul org citit din formular
    focusId: 'org-formatia'
  },

  // formulare angajat (adăugare / editare / import)
  readAddForm() { return { category: '<mod>' }; },
  resetAddForm() {}, afterAdd() {},
  addedMessage(name) { return 'Angajat adăugat: ' + name; },
  fillEditForm(emp) {}, readEditForm() { return null; }, applyEditForm(emp, f) {},
  importEmployee(e) { return { category: '<mod>' }; },
  looksForeign(data) { return data.module && data.module !== '<mod>'; },
  foreignMessage: 'Fișierul provine din alt mod — nu poate fi importat aici.',
  foreignFileMessage: 'Fișierul provine din alt mod — nu poate fi încărcat aici.',

  // generare (opțional resyncGenStats/afterDay etc.)
  initGenStats() { return {}; },                            // marcaj „generare în curs”
  assignDay({ dk, day, year, month, weekend, emps, hasCOCM, assigned }) {
    // Scrie în state.schedule[dk][String(emp.id)] = valoarea turei pentru fiecare angajat disponibil
    // și adaugă id-ul în `assigned`. Cei neasignați primesc automat 0 (liber).
  },

  // tabel, legendă, statistici
  legend: [['pill-t1', 'T1 08–16'], ['', 'L — Liber', 'background:var(--shift0-bg);color:var(--shift0-text)']],
  table: {
    extraHeader: '', fixedCols: 4,
    weekendHide: [3, 4], weekendDisplayL: [3, 4],
    sections(emps) { return [{ emps, cls: '', header: null }]; },
    rowHead(emp) {
      const eid = Number(emp.id) || 0;
      return '<td class="emp-name-cell" tabindex="0" role="button" aria-label="Editează ' + escAttr(emp.name) + '"'
        + ' onclick="openEditModal(' + eid + ')"'
        + ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openEditModal(' + eid + ')}">'
        + esc(emp.name) + '</td>';
    }
  },
  summary: {
    info(expected, mn) { return ''; },
    cardHeader(emp) { return '<span class="emp-card-name">' + esc(emp.name) + '</span>'; },
    cardPills(emp, st, holCount) { return []; },
    statsTable(expected) { return '<table class="stat-table"></table>'; }
  },
  excel: {
    extraHeaders: [], extraWidths: [],
    title: (mn, y) => 'Grafic — ' + mn + ' ' + y,
    subtitle: org => orgSubtitle(org),
    normLine: (mn, y, expected) => mn + ' ' + y + ' — ' + expected + 'h normă',
    weekendToL: [3, 4], extraCells() { return []; }, dayText: (emp, dk, sv) => SHIFT_NAMES[sv],
    legend: [['T1  08-16', 'D6EAF8', '1A5276'], ['L  Liber', 'F0F0F0', '666666']],
    signatures: () => []
  },

  // markup specific (inserat în șablonul din js/shell.js; slot lipsă = linia dispare)
  shell: {
    // titleLine, controlsAndAddModal, orgAndExtraModals, gapList, exportTooltips, toolbarExtra,
    // editModalBody, leaveInstOption, forced8Field — copiază din modes/dispecer.js și adaptează.
  }
};

// ── funcții obligatorii ale modului (apelate de nucleu) ──
function defaultState() {
  const now = new Date();
  return {
    module: '<mod>', schedule: {}, preservedCOCM: {},
    genDay: 0, genStats: null, genYear: 0, genMonth: 0, genDim: 0,
    currentMonth: now.getMonth() + 1, currentYear: now.getFullYear(),
    org: { formatia: '', sefFOL: '', responsabilTehnic: '', aprobat: '', judet: '' },
    employees: [{ id: 1, name: 'Angajat 1', category: '<mod>' }]
  };
}
function migrateState(s) {                // normalizează date salvate mai vechi
  if (!s.schedule) s.schedule = {};
  if (!s.preservedCOCM) s.preservedCOCM = {};
  ['genDay', 'genYear', 'genMonth', 'genDim'].forEach(k => { if (s[k] === undefined) s[k] = 0; });
  if (s.genStats === undefined) s.genStats = null;
  if (!s.org) s.org = { formatia: '', sefFOL: '', responsabilTehnic: '', aprobat: '', judet: '' };
}
// Organizația (getOrg/applyOrgToDOM/openOrgModal/saveOrgSettings): copiază din modes/dispecer.js
// (variantă configurabilă) sau din modes/exploatare.js (câmpuri fixe).
