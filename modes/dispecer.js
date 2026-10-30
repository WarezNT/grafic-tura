// ===========================================================================
// MOD: Dispecer — constante, funcții și logică specifice acestui mod.
// Se încarcă ÎNAINTEA js/core.js; nu apela funcții din core la încărcare (doar la evenimente).
// ===========================================================================

const STORAGE_KEY = 'graficTura_dispecer';

const VERSION_KEY = 'graficTura_dispecer_version';

const ORG_KEY = 'graficTura_dispecer_org';

const APP_VERSION = 'V2026.10.15';

const DB_NAME = 'GraficTuraDispecerDB';

// ── Configurația modului: citită de nucleu (js/core.js). Vezi modes/_template.js pentru ghid. ──
const MODE = {
  id: 'dispecer',
  dbKey: 'main_dispecer',        // cheia în IndexedDB
  stateModule: 'dispecer',       // etichetă salvată în state.module (garda la import)
  words: {
    employee: 'dispecer', Employee: 'Dispecer', employeeGen: 'dispecerului', employeesPl: 'dispeceri',
    keptLong: 'CO, CM, IL, EMP, Z și A', keptShort: 'CO/CM/IL/EMP/Z/A'
  },
  keepOnClear: [5, 6, 7, 8, 9, 10],
  leaveTypes: { 5: 'CO', 6: 'CM', 7: 'IL', 8: 'EMP', 9: 'Z', 10: 'A' },
  leaveSkipWeekend: [7, 8, 9, 10],       // la „pe interval", IL/EMP/Z/A sar peste sâmbete/duminici
  weekendNoCount: [5, 6],                // doar CO/CM nu se contorizează în weekend; IL/EMP/Z/A da (6h)
  leaveHoursPerDay() { return NORM_H_PER_DAY; },
  isWorkShift(v) { return v > 0 && (SHIFT_HOURS[v] || 0) > 0; },
  // Norma lunară a unui dispecer = zile lucrătoare (L–V, fără sărbători legale) × 6h. Tura standard are 6h
  // (T2/T3); T1+T4 = 12h = două ture. NU se calculează pe zile calendaristice: acoperirea 24h/zi e asigurată
  // de echipă, nu de fiecare om (vezi nota de la avgHoursPerDay și din DISPECER.md §5).
  expectedHours(y, m) { const wd = workingDays(y, m); return wd !== null ? wd * NORM_H_PER_DAY : null; },
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
  foreignFileMessage: 'Fișierul provine din aplicația Exploatare — nu poate fi încărcat în Dispecer.',
  // ── generare ──
  initGenStats() { return {}; },   // marcaj „generare în curs”: ciclul nu depinde de statistici acumulate
  assignDay({ dk, day, year, month, emps, hasCOCM, assigned }) {
    assignDispecerShifts(emps.filter(e => !hasCOCM.includes(String(e.id))), dk, assigned, year, month, day);
  },
  afterDay({ dk, day, year, month }) { rebalanceCoverage(dk, year, month, day); },
  // ── tabel și legendă ──
  legend: [
    ['pill-t1', 'T1+T4 &nbsp;06:00–10:00 + 22:00–06:00 (12h)'],
    ['pill-t2', 'T2 &nbsp;10:00–16:00 (6h)'],
    ['pill-t3', 'T3 &nbsp;16:00–22:00 (6h)'],
    ['pill-t4', 'T4 &nbsp;22:00–06:00 (8h) — doar manual'],
    ['pill-co', 'CO — Concediu Odihnă'],
    ['pill-cm', 'CM — Concediu Medical'],
    ['pill-il', 'IL — Instruire lunară (6h)'],
    ['pill-emp', 'EMP — Examinare medicală periodică (6h)'],
    ['pill-z', 'Z — Program de zi 08–14 (6h)'],
    ['pill-a', 'A — Autorizare anuală (6h)'],
    ['', 'L — Liber', 'background:var(--shift0-bg);color:var(--shift0-text)']
  ],
  afterTableHead(y, m) { renderGapList(y, m); },
  adjustMonthHours(empId, y, m, hours) { return t4SplitAdjust(empId, y, m, hours); },
  table: {
    extraHeader: '',
    fixedCols: 4,
    weekendHide: [5, 6],                   // CO/CM nu se oferă în dropdown pe S/D
    weekendDisplayL: [5, 6],               // și se afișează ca L
    sections(emps) { return [{ emps, cls: '', header: null }]; },
    rowHead(emp) {
      const eid = Number(emp.id) || 0;
      // Numele e și buton de editare: se poate deschide din tastatură (Enter/Space), nu doar cu mouse-ul.
      return '<td class="emp-name-cell" tabindex="0" role="button" aria-label="Editează ' + escAttr(emp.name) + '"'
        + ' onclick="openEditModal(' + eid + ')"'
        + ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openEditModal(' + eid + ')}">'
        + esc(emp.name) + '</td>';
    },
    // ziua de după T4: cele 6h de la 00:00 la 06:00 aparțin acestei zile calendaristice — se vede „T4” sub celulă
    cellExtra(emp, dk) {
      return prevDayIsT4(emp.id, dk) ? '<span class="t4-spill" data-tooltip="' + T4_SPILL_TIP + '">T4</span>' : '';
    }
  },
  // ── carduri și statistici ──
  summary: {
    info(expected, mn) {
      if (expected === null) return '';
      return '<div style="font-size:13px;color:var(--text);padding:6px 10px;background:var(--ctrl-bg);border-radius:6px;display:inline-block">📅 ' + mn + ' ' + state.currentYear + ' — <strong>' + expected + 'h</strong> normă/dispecer</div>';
    },
    cardHeader(emp) { return '<span class="emp-card-name">' + esc(emp.name) + '</span>'; },
    cardPills(emp, st, holCount) {
      const pillCls = ['', 'pill-t1', 'pill-t2', 'pill-t3', 'pill-t4', 'pill-co', 'pill-cm', 'pill-il', 'pill-emp', 'pill-z', 'pill-a'];
      const pills = [];
      for (let i = 1; i <= 4; i++) { if (st.counts[i]) pills.push('<span class="shift-pill ' + pillCls[i] + '">' + SHIFT_NAMES[i] + ' ×' + st.counts[i] + '</span>'); }
      if (st.co) pills.push('<span class="shift-pill pill-co">CO ×' + st.co + '</span>');
      if (st.cm) pills.push('<span class="shift-pill pill-cm">CM ×' + st.cm + '</span>');
      for (let i = 7; i <= 10; i++) { if (st.counts[i]) pills.push('<span class="shift-pill ' + pillCls[i] + '">' + SHIFT_NAMES[i] + ' ×' + st.counts[i] + '</span>'); }
      const holYear = holidayShiftsYear(emp.id, state.currentYear, state.currentMonth);
      if (holCount || holYear) pills.push('<span class="shift-pill" style="background:var(--holiday-bg);color:var(--holiday-text)" data-tooltip="Ture lucrate în sărbători legale: în luna afișată și de la 1 ianuarie până la sfârșitul ei">🎉 Sărb.: ' + holCount + ' lună · ' + holYear + ' an</span>');
      return pills;
    },
    // Linia „An YYYY: ore / normă” — norma perioadei generate până la luna afișată, minus CO/CM luat.
    // Fără ea, cifra pe lună pare „sub normă” fără motiv: 20 de zile de CO legal = 120h mai puțin pe an.
    cardExtra(emp) {
      const t = ytdTotals(emp.id);
      if (!t.norm) return '';
      const pct = Math.round((100 * t.hours) / t.norm);
      const year = state.currentYear;
      const scope = t.from === 1 ? 'An ' + year : year + ' (din ' + getMonthName(t.from).slice(0, 3) + ')';
      const deLa = t.from === 1 ? '1 ianuarie' : 'prima lună generată (' + getMonthName(t.from) + ')';
      return '<div style="font-size:11px;color:var(--text-muted);margin:-3px 0 6px;cursor:help" data-tooltip="'
        + 'Ore lucrate de la ' + deLa + ' până la sfârșitul lunii afișate, față de norma aceleiași perioade minus CO/CM (6h pe zi lucrătoare). '
        + 'Anul întreg are ' + ytdNormYear() + 'h de normă; fiecare zi de CO sau CM scade 6h.">'
        + scope + ': <strong>' + t.hours + 'h</strong> / ' + t.norm + 'h (' + pct + '%)'
        + (t.coDays ? ' · CO/CM ' + t.coDays + ' z' : '') + '</div>';
    },
    statsTable(expected) {
      let html = '<table class="stat-table"><thead><tr>'
        + '<th style="text-align:left">Nume Prenume</th>'
        + '<th title="Tura 1 (06:00–10:00)">T1+T4</th><th title="Tura 2 (10:00–16:00)">T2</th>'
        + '<th title="Tura 3 (16:00–22:00)">T3</th><th title="Tura 4 (22:00–06:00)">T4</th>'
        + '<th title="Concediu Odihnă">CO</th><th title="Concediu Medical">CM</th>'
        + '<th title="Instruire lunară (6h)">IL</th><th title="Examinare medicală periodică (6h)">EMP</th>'
        + '<th title="Program de zi 08–14 (6h)">Z</th><th title="Autorizare anuală (6h)">A</th>'
        + '<th title="Ture lucrate în zile de sărbătoare legală, în luna curentă">🎉 Sărb.</th>'
        + '<th title="Ture lucrate în sărbători legale de la 1 ianuarie până la sfârșitul lunii afișate">🎉 Sărb. an</th>'
        + '<th title="Ore lucrate efectiv">Lucrate</th>'
        + '<th title="Normă lunară">Normă</th>'
        + '<th title="Diferență față de normă">±</th>'
        + '</tr></thead><tbody>';
      state.employees.forEach(emp => {
        const { st, effExpected, diffStr, rowCls, hoursCls, holCount } = statRowInfo(emp, expected);
        html += '<tr class="' + rowCls + '">'
          + '<td>' + esc(emp.name) + '</td>'
          + '<td>' + (st.counts[1] || '—') + '</td>'
          + '<td>' + (st.counts[2] || '—') + '</td>'
          + '<td>' + (st.counts[3] || '—') + '</td>'
          + '<td>' + (st.counts[4] || '—') + '</td>'
          + '<td>' + (st.co || '—') + '</td>'
          + '<td>' + (st.cm || '—') + '</td>'
          + '<td>' + (st.counts[7] || '—') + '</td>'
          + '<td>' + (st.counts[8] || '—') + '</td>'
          + '<td>' + (st.counts[9] || '—') + '</td>'
          + '<td>' + (st.counts[10] || '—') + '</td>'
          + '<td' + (holCount ? ' style="color:var(--holiday-text);font-weight:700"' : '') + '>' + (holCount || '—') + '</td>'
          + '<td style="color:var(--text-muted)">' + (holidayShiftsYear(emp.id, state.currentYear, state.currentMonth) || '—') + '</td>'
          + '<td class="' + hoursCls + '">' + st.hours + 'h</td>'
          + '<td style="color:var(--text-muted)">' + (effExpected !== null ? effExpected + 'h' : '—') + '</td>'
          + '<td class="' + hoursCls + '">' + diffStr + '</td>'
          + '</tr>';
      });
      return html + '</tbody></table>';
    }
  },
  // ── export Excel ──
  excel: {
    extraHeaders: [],
    extraWidths: [],
    title: (mn, y) => 'Grafic dispecer — ' + mn + ' ' + y,
    subtitle: org => orgSubtitle(org),
    normLine: (mn, y, expected) => mn + ' ' + y + ' — ' + (expected !== null ? expected + 'h' : '? h') + ' normă/dispecer',
    weekendToL: [5, 6],
    extraCells() { return []; },
    dayText: (emp, dk, sv) => SHIFT_NAMES[sv] + (prevDayIsT4(emp.id, dk) ? '\nT4' : ''),
    cellNote: (emp, dk) => prevDayIsT4(emp.id, dk) ? T4_SPILL_TIP : '',   // comentariu pe celulă, ca sfatul din pagină
    legend: [['T1+T4  06-10 + 22-06 (12h)', 'D6EAF8', '1A5276'], ['T2  10-16 (6h)', 'FDEBD0', '935116'], ['T3  16-22 (6h)', 'AED6F1', '154360'],
             ['T4  22-06 manual (8h)', 'FAD7A0', '7E4D0E'], ['CO  Concediu', 'E8D5F5', '6C3483'], ['CM  Medical', 'E8E8E8', '555555'],
             ['IL  Instruire lunară', 'F0F4F8', '2C3E50'], ['EMP  Exam. medicală', 'D5F5E3', '1A7A3A'], ['Z  Program zi 08-14', 'FFF3B0', '7D6608'],
             ['A  Autorizare anuală', 'FADBD8', '922B21'], ['L  Liber', 'F0F0F0', '666666']],
    signatures: () => orgSignatures(getOrg()).map(s => [s.label, s.name || '—'])
  },
  helpMode: 'disp',                // modul de manual deschis implicit (cheia din MANUALS),
  // ── markup specific modului (inserat în șablonul din js/shell.js) ──
  shell: {
    titleLine: `      <span>Grafic dispecer — <span id="month-title"></span></span>`,
    controlsAndAddModal: `      <span style="font-size:11px;font-weight:600;color:var(--text-muted);padding:4px 10px;border-radius:6px;background:var(--ctrl-bg)" data-tooltip="Acoperirea celor 4 ture (24h) este asigurată automat prin rotația T3→T2→T1+T4→liber.">🔁 Acoperire 24h automată — T1+T4 (06–10 și 22–06), T2 (10–16), T3 (16–22)</span>
      <span style="flex:1"></span>
      <button class="btn btn-primary btn-sm" onclick="startGeneration()" data-tooltip="Pornește generarea graficului pentru luna și anul selectate">▶ Generare</button>
      <button class="btn btn-primary btn-sm" onclick="generateSixMonths()" data-tooltip="Generează dintr-odată 6 luni, începând cu luna afișată; lunile deja generate se păstrează">▶▶ 6 luni</button>
      <button class="btn btn-outline btn-sm" id="btn-prev-day" onclick="prevDay()" style="display:none" data-tooltip="Întoarce cu o zi înapoi, pentru a regenera ultima zi dacă rezultatul nu e satisfăcător">←</button>
      <button class="btn btn-outline btn-sm" id="btn-next-day" onclick="generateNextDay()" style="display:none" data-tooltip="Generează doar ziua curentă și avansează — verificare pas cu pas">Ziua →</button>
      <button class="btn btn-success btn-sm" id="btn-generate-all" onclick="generateAll()" style="display:none" data-tooltip="Generează dintr-odată toate zilele rămase din lună">Generare totală →</button>
      <button class="btn btn-warning btn-sm" onclick="clearSchedule()" data-tooltip="Șterge turele generate pentru luna curentă; CO, CM, IL, EMP, Z și A introduse se păstrează (dispecerii rămân)">✕ Curăță</button>
      <button class="btn btn-success btn-sm" id="add-emp-btn" onclick="openAddEmployeeModal()" data-tooltip="Adaugă un dispecer nou">+ Dispecer</button>
    </div>
  </div>

  <!-- Modal adăugare dispecer -->
  <div id="add-emp-modal" class="modal-overlay" style="display:none" onclick="if(event.target===this)closeAddEmployeeModal()">
    <div class="modal-content">
      <h3>Adaugă dispecer</h3>
      <label data-tooltip="Numele complet al dispecerului — apare în tabel, carduri și exporturi.">Nume<input type="text" id="new-emp" placeholder="Nume dispecer" onkeydown="if(event.key==='Enter')addEmployee()"></label>`,
    orgAndExtraModals: `  <!-- Modal setări organizație: denumirile câmpurilor sunt editabile, iar fiecare câmp se poate dezactiva -->
  <div id="org-modal" class="modal-overlay" style="display:none" onclick="if(event.target===this)closeOrgModal()">
    <div class="modal-content" style="max-width:460px;max-height:90vh;overflow-y:auto">
      <h3>⚙️ Setări organizație</h3>
      <label>Entitate (apare în antet, titlu și Excel)
        <input type="text" id="org-entitate" placeholder="ex: Delgaz Grid S.A">
      </label>
      <div class="org-hint">Bifa din stânga fiecărui câmp îl activează / dezactivează (dezactivat = nu apare în antet, print și Excel). Denumirea câmpului se poate edita.</div>
      <div id="org-fields"></div>
      <div class="modal-buttons">
        <button class="btn btn-outline" onclick="closeOrgModal()">Anulează</button>
        <button class="btn btn-success" onclick="saveOrgSettings()">Salvează</button>`,
    gapList: `    <div id="gap-list" class="no-print" style="padding:0 0 8px;font-size:12px;color:#b45309;font-weight:600"></div>`,
    exportTooltips: `        <button onclick="closeTbDropdowns();exportMonthJSON()" data-tooltip="Exportă DOAR luna afișată acum (grafic + dispeceri) într-un fișier mic, ușor de trimis cuiva">💾 Descarcă doar luna curentă <span class="tb-dd-hint">JSON</span></button>
        <button onclick="closeTbDropdowns();exportFullJSON()" data-tooltip="Exportă TOATE lunile salvate, toți dispecerii și toate setările — backup complet al aplicației">💿 Descarcă tot (backup complet) <span class="tb-dd-hint">JSON</span></button>
        <div class="tb-dd-sep"></div>
        <button onclick="closeTbDropdowns();loadJSON()" data-tooltip="Deschide un fișier JSON exportat de aici — recunoaște automat dacă e o lună sau un backup complet">📂 Încarcă fișier (lună sau backup)</button>
        <button onclick="closeTbDropdowns();importEmployees()" data-tooltip="Adaugă electricieni dintr-un alt fișier JSON, fără să șteargă graficul sau dispecerii existenți">👥 Adaugă dispeceri din fișier</button>`,
    devNote: ``,
    leaveInstOption: `          <option value="7">IL — Instruire lunară</option>
          <option value="8">EMP — Examinare medicală periodică</option>
          <option value="9">Z — Program de zi 08–14</option>
          <option value="10">A — Autorizare anuală</option>`,
    editModalBody: `    <h3>Editează dispecer</h3>
    <label data-tooltip="Numele complet al dispecerului — apare în tabel, carduri și exporturi.">Nume: <input type="text" id="modal-emp-name"></label>
    <div id="leave-interval-section" style="margin-bottom:12px">
      <div data-tooltip="Setează CO sau CM pentru toate zilele din interval dintr-o dată, în loc să dai click pe fiecare celulă. Suprascrie orice era setat înainte în acele zile." style="font-size:13px;font-weight:600;margin-bottom:6px;color:#374151;cursor:help;display:inline-block">🏖️ CO / CM pe interval: ℹ️</div>`
  }
};

const CHANGELOG = {
  'V2026.10.15': {
    title: 'Tastatură, modale și salvare mai rară',
    items: [
      { icon: '⌨️', text: 'Modalele se închid cu Escape și au rol de dialog (pentru cititoarele de ecran); numele unui dispecer se poate deschide din tastatură cu Enter sau Spațiu, nu doar cu mouse-ul' },
      { icon: '💾', text: 'Salvarea care însoțea fiecare redesărire se face acum o dată la 300 ms; acțiunile care schimbă date (adăugare, ștergere, generare, import) salvează în continuare imediat, iar la închiderea filei se scrie tot ce era în coadă' },
      { icon: '⚡', text: 'Statisticile fiecărui dispecer se calculează o singură dată pe redesărire, nu de trei ori (tabel, carduri, statistici)' }
    ]
  },
  'V2026.10.14': {
    title: 'Fișiere importate: verificate',
    items: [
      { icon: '🛡️', text: 'Angajații dintr-un fișier importat sunt validați: un id care nu e număr întreg (sau un nume care nu e text) putea rupe pagina și chiar executa cod la hover/click — acum se normalizează' },
      { icon: '✅', text: 'Turele din fișier sunt verificate: valorile care nu există („abc", 99, -5) se ignoră, iar mesajul spune câte au fost aruncate — înainte apăreau celule goale și ore 0, fără explicație' },
      { icon: '⚠️', text: 'Importul unei luni care are deja zile în grafic cere confirmare — înainte înlocuia luna definitiv, fără întrebare și fără posibilitatea de undo' }
    ]
  },
  'V2026.10.13': {
    title: 'Norma = zile lucrătoare × 6h',
    items: [
      { icon: '📏', text: 'Norma lunară se calculează acum ca pentru un dispecer în ture: zile lucrătoare (luni–vineri, fără sărbătorile legale) × 6h. Octombrie 2026 (22 zile) = 132h, ianuarie (18 zile, 5 sărbători) = 108h, anul 2026 = 1500h' },
      { icon: '🧮', text: 'CO/CM reduc norma cu 6h pe zi lucrătoare, iar coloana CO/CM arată aceleași ore — înainte se folosea media de 24h împărțită la numărul de dispeceri' },
      { icon: '📊', text: 'Se vede acum cât acoperă graficul din normă: cu 7 dispeceri orele programate ajung la ~82–85% (1250h din 1500h), cu 6 la ~100%, cu 5 peste normă' },
      { icon: '📅', text: 'Pe fiecare card apare și situația pe an: ore de la 1 ianuarie până la luna afișată, față de norma acelorași luni minus CO/CM luat (6h pe zi). Cu 20 de zile de CO legal norma anului scade de la 1500h la 1380h, iar graficul ajunge la ~88–92%' }
    ]
  },
  'V2026.10.12': {
    title: 'Zi liberă după tura de noapte',
    items: [
      { icon: '🛌', text: 'După T1+T4, dimineața 00:00–06:00 a zilei următoare nu mai e tratată ca „zi liberă”: nu se mai începe un bloc nou imediat după ea, așa că nimeni nu mai ajunge să lucreze 5–24 de zile la rând (regula e maximum 4)' },
      { icon: '⚖️', text: 'Orele se împart mai uniform, ca efect secundar: la 5 dispeceri diferența dintre cel mai încărcat și cel mai puțin încărcat a scăzut de la 48h la 6h pe lună și de la 30h la 6h pe an; la 7 dispeceri, de la 72h la 48h pe an' },
      { icon: '🚨', text: 'Când nu sunt 5 dispeceri disponibili (efectiv mic sau concedii suprapuse), acoperirea 24h rămâne prioritară — sub tabel apare o notă care spune cine a lucrat mai mult de 4 zile la rând și de ce' }
    ]
  },
  'V2026.10.11': {
    title: 'Coloana cu nume nu mai dispare pe ecrane mici',
    items: [
      { icon: '🖥️', text: 'Coloana cu numele dispecerilor se comprima la lățime 0 sub ~1700px (laptop, zoom >100%) și numele se revărsau peste coloana următoare; acum are lățime fixă, iar tabelul face scroll orizontal' }
    ]
  },
  'V2026.10.10': {
    title: 'IL/EMP/Z/A, weekend liber, generare 6 luni',
    items: [
      { icon: '🗓️', text: 'Zile noi în dropdown: IL (instruire lunară), EMP (examinare medicală periodică), Z (program de zi 08–14) și A (autorizare anuală) — fiecare contează 6h lucrate, nu acoperă ture și se păstrează la regenerare' },
      { icon: '🏷️', text: 'Tura T1 devine T1+T4: aceeași persoană face T1 (06–10) și T4 (22–06) în aceeași zi; blocul devine T3→T2→T1+T4 (3 zile), cu 3 dispeceri pe zi' },
      { icon: '🛌', text: 'Pe cât posibil, fiecare dispecer are cel puțin un weekend liber legat (sâmbătă + duminică) pe lună; dacă nu se poate (concedii, acoperire), apare avertisment sub tabel' },
      { icon: '🌙', text: 'T4 (22–06) se împarte pe zile calendaristice: 2h în ziua de start și 6h în ziua următoare (ziua de după T4 arată „T4” sub celulă, cu explicație la hover), cu trecere corectă peste granița dintre luni; T1+T4 = 6h în ziua de start + 6h a doua zi' },
      { icon: '▶▶', text: 'Buton nou „6 luni": generează dintr-odată 6 luni, începând cu luna afișată (lunile deja generate se păstrează)' }
    ]
  },
  'V2026.10.9': {
    title: 'Cod modular',
    items: [
      { icon: '🧱', text: 'Cod reorganizat (nucleu comun + fișier pe mod); fără schimbări de comportament — adăugarea unui mod nou devine mult mai simplă' },
      { icon: '🔒', text: 'Exploatarea refuză acum fișierele exportate din Dispecer (și invers)' }
    ]
  },
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
const SHIFT_NAMES = ['L', 'T1+T4', 'T2', 'T3', 'T4', 'CO', 'CM', 'IL', 'EMP', 'Z', 'A'];

// T1+T4 = T1 (06–10, 4h) + T4 (22–06, 8h) în aceeași zi de start = 12h. T4 singur (valoarea 4) rămâne doar pentru
// introducere manuală (8h). IL/EMP/Z/A (manuale) = 6h lucrate fiecare și NU acoperă nicio tură T1–T4.
const SHIFT_HOURS = [0, 12, 6, 6, 8, 0, 0, 6, 6, 6, 6];

// T4 (22:00–06:00), inclusiv cel din T1+T4, se împarte pe zile calendaristice: 2h în ziua de start, 6h în ziua
// următoare (inclusiv când ziua de start e ultima din lună — cele 6h cad în prima zi a lunii următoare).
// Deci T1+T4 = 6h în ziua de start (4h T1 + 2h T4) + 6h în ziua următoare.
const T4_SPILL_H = 6;

const T4_SPILL_TIP = 'Continuarea turei T4 începute ieri la 22:00 (00:00–06:00): 6h lucrate în această zi';

const hasT4 = v => v === 1 || v === 4;   // T1+T4 și T4 singur încheie tura a doua zi la 06:00

function prevDayIsT4(empId, dk) {
  const d = new Date(+dk.slice(0, 4), +dk.slice(5, 7) - 1, +dk.slice(8, 10) - 1);
  return hasT4((state.schedule[dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate())] || {})[String(empId)] || 0);
}

// Ore lunare (y, m) ale unui dispecer: T4 de pe ultima zi a lunii dă doar 2h în această lună (cele 6h cad
// în luna următoare), iar un T4 început în ultima zi a lunii precedente aduce 6h în prima zi de acum.
function t4SplitAdjust(empId, y, m, hours) {
  const at = (yy, mm, dd) => (state.schedule[dateKey(yy, mm, dd)] || {})[String(empId)] || 0;
  const dim = daysInMonth(y, m);
  const prev = new Date(y, m - 2, 1), pdim = daysInMonth(prev.getFullYear(), prev.getMonth() + 1);
  let adj = 0;
  if (hasT4(at(y, m, dim))) adj -= T4_SPILL_H;
  if (hasT4(at(prev.getFullYear(), prev.getMonth() + 1, pdim))) adj += T4_SPILL_H;
  return hours + adj;
}

// Norma întregului an afișat (12 luni × zile lucrătoare × 6h) — 1500h pentru 2026.
// Memorată pe an: se cere pentru fiecare card la fiecare desenare, iar workingDays() nu e gratis.
let _ytdYear = { y: 0, norm: 0 };
function ytdNormYear() {
  if (_ytdYear.y === state.currentYear) return _ytdYear.norm;
  let t = 0;
  for (let m = 1; m <= 12; m++) t += MODE.expectedHours(state.currentYear, m) || 0;
  _ytdYear = { y: state.currentYear, norm: t };
  return t;
}

// Situația pe an, de la PRIMA lună generată din an până la sfârșitul lunii afișate: ore lucrate + norma
// aceleiași perioade, minus CO/CM luat (6h pe zi lucrătoare). E cifra care răspunde la „cât mai are de
// lucrat anul ăsta" — cu 20 de zile de CO legal, norma anuală de 1500h scade la 1380h.
// Se iau doar lunile care au date: altfel, dacă e generată doar octombrie, s-ar compara orele unei luni cu
// norma a 10 luni și ar ieși un procent fals (9% în loc de 82%).
// Orele se însumează ca în getEmployeeStats: T4 din ultima zi a perioadei dă doar 2h aici (6h cad în luna
// următoare), la fel ca t4SplitAdjust.
function ytdTotals(empId) {
  const y = state.currentYear, m = state.currentMonth;
  let hours = 0, coDays = 0, norm = 0;
  const months = new Set();
  for (const dk in state.schedule) {
    if (+dk.slice(0, 4) !== y) continue;
    const mm = +dk.slice(5, 7);
    if (mm > m) continue;
    months.add(mm);
    const v = state.schedule[dk][String(empId)] || 0;
    hours += SHIFT_HOURS[v] || 0;
    if (v === 5 || v === 6) {
      const dow = new Date(y, mm - 1, +dk.slice(8, 10)).getDay();
      if (dow !== 0 && dow !== 6) coDays++;
    }
  }
  if (hasT4((state.schedule[dateKey(y, m, daysInMonth(y, m))] || {})[String(empId)] || 0)) hours -= T4_SPILL_H;
  months.forEach(mm => { norm += MODE.expectedHours(y, mm) || 0; });
  norm -= coDays * NORM_H_PER_DAY;
  return { hours, norm, coDays, from: months.size ? Math.min(...months) : m, to: m, months: months.size };
}

const WEEKEND_HIDE = [5, 6]; // CO/CM nu se oferă în dropdown pe S/D (se afișează ca L)

// Un bloc = T3 → T2 → T1+T4 (3 zile la rând) + dimineața de 6h a zilei următoare (00:00–06:00, când se
// termină T4), apoi o zi liberă ÎNTREAGĂ. Ziua cu 6h NU e zi liberă (vezi isWorkedDay: nu contează ca weekend
// liber), deci un bloc nou nu începe imediat după ea — altfel seria ajungea la 5–24 de zile lucrate la rând.
// În fiecare zi începe exact un bloc nou (T3), deci T1, T2, T3 și T4 au CEL MULT UN dispecer pe zi (T1 și T4
// la aceeași persoană), iar ceilalți sunt liberi. Cine începe blocul se alege echitabil (ore în an, apoi
// weekenduri + sărbători), nu un ciclu fix.
const MIN_CYCLE_LEN = 4; // 4 dispeceri = acoperire completă a zilei (3 lucrează + 1 liber)
// 5 = minimul pentru acoperire completă ȘI zi liberă întreagă după T4 (ciclu: T3, T2, T1+T4, dimineața de 6h, liber).
// Sub 5 acoperirea rămâne prioritară (fallback în assignDispecerShifts + notă în renderGapList).
const MIN_DAYOFF_LEN = 5;

function cycleLength() { return Math.max(MIN_CYCLE_LEN, state.employees.length); }

// Ore medii pe zi ale unui dispecer = 24h împărțite la numărul de dispeceri (min. 4). ATENȚIE: nu e norma
// (norma = zile lucrătoare × 6h, vezi MODE.expectedHours). Se folosește doar ca „credit" de echitate când
// cineva e în CO/CM: câte ore ar fi lucrat în medie în acea zi dacă nu era în concediu.
function avgHoursPerDay() { return 24 / cycleLength(); }

// Norma de lucru a dispecerului: 6h pentru fiecare zi lucrătoare (L–V, fără sărbători legale).
// Tura T1+T4 = 12h se socotește două ture de 6h, deci norma rămâne pe „ture standard".
const NORM_H_PER_DAY = 6;

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

// Dispecer: blocuri T3 → T2 → T1+T4, un bloc nou în fiecare zi (vezi nota de la constante).
const BLOCK_NEXT = { 3: 2, 2: 1, 1: 0, 4: 0 };        // tura de azi, dat fiind că ieri a fost cheia

const BLOCK_REMAINING = { 3: 2, 2: 1, 1: 0, 4: 0 };   // zile rămase în bloc după tura respectivă

const BLOCK_HOURS = 24;                                // un bloc T3+T2+T1+T4 = 6+6+4+8 ore

// Sloturile de acoperire ale unei zile: T1 (06–10), T2, T3, T4 (22–06). Valorile care acoperă fiecare slot:
// T1+T4 (valoarea 1) acoperă T1 ȘI T4; T4 singur (valoarea 4, doar manual) acoperă doar T4.
const COVER_SLOTS = [1, 2, 3];                        // ce alocă generatorul (T1 și T4 merg împreună)
const SLOT_VALUES = { 1: [1], 2: [2], 3: [3], 4: [1, 4] };
const SLOT_LABELS = ['', 'T1', 'T2', 'T3', 'T4'];

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
// weekenduri/sărbători, apoi id-ul. Nu începe un bloc cine are CO/CM în următoarele 2 zile (l-ar rupe).
function assignDispecerShifts(emps, dk, assigned, year, month, day) {
  const ctx = dayContext(year, month, day);
  const prev = state.schedule[ctx.prevKey] || {};
  const hasHistory = state.employees.some(e => prev[String(e.id)] >= 1 && prev[String(e.id)] <= 4);
  // Fără istoric (prima zi generată): „ieri" virtual (T2 și T3 la primii doi) ca să pornească toate turele
  // din prima zi (T1+T4 și T2 din blocurile în curs + T3 nou), nu abia după 2 zile.
  const virtual = {};
  if (!hasHistory) {
    emps.slice().sort((a, b) => a.id - b.id).slice(0, 2).forEach((e, i) => { virtual[e.id] = i === 0 ? 2 : 3; });
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
  // fără CO/CM în următoarele 2 zile (restul blocului)
  const leaveSoon = e => [1, 2].some(off => {
    const v = (state.schedule[ctx.key(off)] || {})[String(e.id)];
    return v >= 5;                       // CO/CM/IL/EMP/Z/A — zi în care nu poate lucra într-un bloc
  });
  // Cine a terminat azi la 06:00 un T1+T4/T4 (ieri T4) NU poate începe T3 (16:00 = doar 10h odihnă).
  // Cine a lucrat 00:00–06:00 azi (dimineața de după T4) ar trebui să aibă ziua liberă: aceea NU e zi
  // liberă (vezi isWorkedDay), deci un bloc nou azi ar însemna 5+ zile lucrate la rând, nu 4.
  // Se preferă cineva cu ziua de ieri complet liberă; dacă nu există (sub 5 dispeceri, concedii),
  // acoperirea turei rămâne prioritară și se acceptă și continuarea imediată.
  const notT4Today = e => !hasT4(yesterday(e));
  const realRest = e => notT4Today(e) && !prevDayIsT4(e.id, ctx.prevKey);
  let pool = emps.filter(e => !assigned.includes(e.id) && realRest(e));
  if (!pool.length) pool = emps.filter(e => !assigned.includes(e.id) && notT4Today(e));
  const rested = pool.filter(e => !leaveSoon(e));
  if (rested.length) pool = rested;
  if (!pool.length) return;
  const hrs = {}, we = {};
  pool.forEach(e => { hrs[e.id] = ctx.yearHours(e); we[e.id] = weekendHolidayShifts(e.id, dk); });
  // Orele contează doar la nivel de bloc (24h): cine e cu cel mult un bloc peste cel mai puțin încărcat
  // rămâne în joc, iar între ei decid weekendurile/sărbătorile. Altfel diferențe mici de ore ar impune o
  // ordine fixă (coadă), care la 7 dispeceri se blochează pe aceleași zile ale săptămânii.
  const minH = Math.min(...pool.map(e => hrs[e.id]));
  let near = pool.filter(e => hrs[e.id] <= minH + BLOCK_HOURS);
  // Weekend liber legat (sâmbătă + duminică) cel puțin o dată pe lună, „pe cât posibil": nu începe blocul
  // cine și-ar pierde astfel ultimul weekend liber posibil din lună, dacă există alternativă.
  const keepWeekend = near.filter(e => !weekendUnsafe(e, year, month, day));
  if (keepWeekend.length) near = keepWeekend;
  else {
    const anySafe = pool.filter(e => !weekendUnsafe(e, year, month, day));
    if (anySafe.length) near = anySafe;
  }
  near.sort((a, b) => we[a.id] - we[b.id] || hrs[a.id] - hrs[b.id] || a.id - b.id);
  today[String(near[0].id)] = 3;
  assigned.push(near[0].id);
}

// ── Weekend liber legat (sâmbătă + duminică, ambele fără tură) — cel puțin unul pe dispecer pe lună ──
// Pe cât posibil: CO/CM, puțini dispeceri sau acoperirea obligatorie pot face regula imposibilă.
// Doar weekendurile complete din aceeași lună (sâmbăta și duminica din luna respectivă).
function monthWeekends(year, month) {
  const out = [], dim = daysInMonth(year, month);
  for (let d = 1; d < dim; d++) {
    if (new Date(year, month - 1, d).getDay() === 6) out.push([dateKey(year, month, d), dateKey(year, month, d + 1)]);
  }
  return out;
}

// Zi lucrată (T1–T4, IL, EMP, Z, A, sau ziua în care se termină la 06:00 un T4 de ieri); CO/CM și L nu contează
// ca lucrate pentru weekendul liber.
function isWorkedDay(empId, dk) {
  const v = (state.schedule[dk] || {})[String(empId)] || 0;
  return (v >= 1 && v <= 4) || v >= 7 || prevDayIsT4(empId, dk);
}

// Are `e` cel puțin un weekend complet liber în luna dată (după graficul existent)?
function hasFreeWeekend(emp, year, month) {
  return monthWeekends(year, month).some(w => !isWorkedDay(emp.id, w[0]) && !isWorkedDay(emp.id, w[1]));
}

// Ar pierde `e` ultimul weekend liber posibil al lunii dacă ar începe azi un bloc (azi..azi+2, plus ziua
// azi+3 în care T4 se termină la 06:00)?
// Nu contează dacă are deja un weekend liber încheiat, sau dacă nu mai are niciunul posibil oricum.
function weekendUnsafe(emp, year, month, day) {
  const dk = dateKey(year, month, day);
  const ws = monthWeekends(year, month);
  if (ws.some(w => w[1] < dk && !isWorkedDay(emp.id, w[0]) && !isWorkedDay(emp.id, w[1]))) return false; // deja satisfăcut
  const dayDate = new Date(year, month - 1, day);
  const block = new Set();
  for (let off = 0; off < 4; off++) { const d = new Date(dayDate); d.setDate(d.getDate() + off); block.add(dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate())); }
  const freeable = hit => ws.filter(w => w[1] >= dk && !isWorkedDay(emp.id, w[0]) && !isWorkedDay(emp.id, w[1]) && !(hit && (block.has(w[0]) || block.has(w[1]))));
  return freeable(false).length > 0 && freeable(true).length === 0;
}

// Orele de început/sfârșit ale turelor (față de miezul nopții zilei de start; T4 trece în ziua următoare).
// T1+T4 începe la 06:00 și se termină a doua zi la 06:00 (30); între T1 și T4 are 12h pauză.
const SHIFT_SPAN = { 1: [6, 30], 2: [10, 16], 3: [16, 22], 4: [22, 30] };

const MIN_REST_H = 11; // odihnă minimă între două ture consecutive

const MAX_CONSEC_DAYS = 4; // maxim zile lucrate la rând (blocul T3→T2→T1+T4 are 3)

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
        if ((v >= 1 && v <= 4) || v >= 7) h += SHIFT_HOURS[v];
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
        const k = key(off);
        const v = (state.schedule[k] || {})[String(e.id)] || 0;
        // zi lucrată = tură T1–T4 SAU dimineața de 6h de după un T4 (00:00–06:00 din aceeași zi)
        if ((v >= 1 && v <= 4) || prevDayIsT4(e.id, k)) r++; else break;
      }
      return r;
    },
    // Dacă `e` ar lucra tura t azi (și apoi restul blocului): seria lui încape în maxim de zile la rând?
    consecOk(e, t) {
      return this.runBefore(e) + 1 + (BLOCK_REMAINING[t] || 0) <= MAX_CONSEC_DAYS;
    },
    // Poate `e` lucra tura t azi, respectând odihna minimă față de tura de ieri (reală)? Ziua următoare e
    // continuarea blocului (T3→T2→T1+T4→L), care respectă mereu odihna.
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
  if (COVER_SLOTS.every(t => emps.filter(e => val(e) === t).length === 1)) return;
  const ctx = dayContext(year, month, day);
  const avail = emps.filter(e => val(e) < 5);
  const hrs = {};
  avail.forEach(e => { hrs[e.id] = ctx.yearHours(e); });
  const can = {}; // can[e.id][t]: poate `e` lucra tura t azi? (tura lui curentă — întotdeauna)
  avail.forEach(e => {
    can[e.id] = {};
    COVER_SLOTS.forEach(t => {
      can[e.id][t] = val(e) === t || (ctx.restOk(e, t) && ctx.consecOk(e, t));
    });
  });
  const holderOf = {};
  COVER_SLOTS.forEach(t => { holderOf[t] = avail.find(e => val(e) === t) || null; });
  let best = null;
  const pick = {}, used = new Set();
  const evaluate = () => {
    const final = {};
    avail.forEach(e => { final[e.id] = 0; });
    const taken = new Set();
    for (const t of COVER_SLOTS) {
      if (pick[t]) { final[pick[t].id] = t; taken.add(pick[t].id); }
    }
    for (const t of COVER_SLOTS) {            // tura nereasignată rămâne la titularul ei, dacă nu a plecat
      const h = holderOf[t];
      if (!pick[t] && h && !taken.has(h.id)) { final[h.id] = t; taken.add(h.id); }
    }
    const covered = COVER_SLOTS.filter(t => avail.some(e => final[e.id] === t)).length;
    let sq = 0, changes = 0;
    avail.forEach(e => {
      const h = hrs[e.id] + (SHIFT_HOURS[final[e.id]] || 0);
      sq += h * h;
      if (final[e.id] !== val(e)) changes++;
    });
    const key = [COVER_SLOTS.length - covered, sq, changes];
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && key[2] < best.key[2])))) {
      best = { key, final: Object.assign({}, final) };
    }
  };
  const rec = t => {
    if (t > COVER_SLOTS.length) { evaluate(); return; }
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
    const miss = [1, 2, 3, 4].filter(t => !emps.some(e => SLOT_VALUES[t].includes(day[String(e.id)])));
    if (miss.length) gaps.push({ day: d, shifts: miss.map(t => SLOT_LABELS[t]) });
  }
  return gaps;
}

// Ture cu mai mulți dispeceri în aceeași zi (regula: cel mult unul pe tură) — apar doar din editare manuală.
function duplicateShifts(year, month) {
  const out = [];
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const day = state.schedule[dateKey(year, month, d)];
    if (!day) continue;
    const dup = [1, 2, 3, 4].filter(t => state.employees.filter(e => SLOT_VALUES[t].includes(day[String(e.id)])).length > 1);
    if (dup.length) out.push({ day: d, shifts: dup.map(t => SLOT_LABELS[t]) });
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
  // Weekend liber legat: doar pentru luni generate complet (toate zilele au intrări pentru toți dispecerii)
  const dim = daysInMonth(y, m);
  const complete = state.employees.length && Array.from({ length: dim }, (_, i) => state.schedule[dateKey(y, m, i + 1)])
    .every(day => day && Object.keys(day).length >= state.employees.length);
  if (complete && state.employees.length > 1) {
    const noWe = state.employees.filter(e => !hasFreeWeekend(e, y, m));
    if (noWe.length) lines.push('⚠️ Fără weekend liber legat (sâmbătă + duminică) în această lună: ' + noWe.map(e => e.name).join(', ') + ' — nu s-a putut din cauza concediilor/acoperirii; corectează manual dacă e nevoie.');
  }
  // Sub 5 dispeceri disponibili nu încape și zi liberă întreagă după T4: 24h/zi, cu 11h odihnă, cer 5 oameni
  // într-un ciclu de 5 zile (T3, T2, T1+T4, dimineața de 6h, liber). Aplicația ține acoperirea, deci seriile
  // depășesc 4 zile — consecință matematică, nu bug. Se detectează din grafic (nu din numărul de angajați),
  // ca să prindă și cazul „7 dispeceri, dar 3 în concediu" — acolo e cel mai probabil să apară.
  if (complete) {
    let worst = 0;
    const names = [];
    state.employees.forEach(e => {
      let run = 0;
      for (let d = 1; d <= dim; d++) {
        const dk = dateKey(y, m, d);
        const v = (state.schedule[dk] || {})[String(e.id)] || 0;
        if ((v >= 1 && v <= 4) || prevDayIsT4(e.id, dk)) run++; else run = 0;
        if (run > worst) { worst = run; names.length = 0; }
        if (run === worst && run > MAX_CONSEC_DAYS && !names.includes(e.name)) names.push(e.name);
      }
    });
    if (worst > MAX_CONSEC_DAYS) {
      lines.push('ℹ️ Serii de peste ' + MAX_CONSEC_DAYS + ' zile lucrate la rând (până la ' + worst + '), cu dimineața de 6h socotită: '
        + names.join(', ') + '. Așa se întâmplă când nu sunt ' + MIN_DAYOFF_LEN + ' dispeceri disponibili (concedii, efectiv mic) — acoperirea 24h are prioritate; corectează manual dacă nu e acceptabil.');
    }
  }
  el.innerHTML = lines.map(esc).join('<br>');
}

// Generează dintr-odată 6 luni, începând cu luna afișată. Lunile deja generate complet se păstrează
// (pentru regenerare: „Curăță" luna respectivă). Ciclul curge continuu peste granițele lunilor.
function generateSixMonths() {
  if (!state.employees.length) { setStatus('Adaugă cel puțin un dispecer.', 'warn'); return; }
  const y0 = state.currentYear, m0 = state.currentMonth;
  if (!confirm('Generezi 6 luni, începând cu ' + getMonthName(m0) + ' ' + y0 + '? Lunile deja generate se păstrează; CO, CM, IL, EMP, Z și A introduse se respectă.')) return;
  const realConfirm = window.confirm;
  window.confirm = () => true;               // fără întrebarea „Continuați generarea?" la fiecare lună
  const gaps = [];
  try {
    for (let i = 0; i < 6; i++) {
      let m = m0 + i, y = y0;
      while (m > 12) { m -= 12; y++; }
      document.getElementById('sel-year').value = y;
      document.getElementById('sel-month').value = m;
      state.currentYear = y; state.currentMonth = m;
      startGeneration();
      generateAll();
      const g = coverageGaps(y, m).length;
      if (g) gaps.push(getMonthName(m) + ' (' + g + ' zile)');
    }
  } finally {
    window.confirm = realConfirm;
  }
  // gata cu generarea: ascunde butoanele pas-cu-pas (ca după „Curăță")
  state.genDay = 0; state.genStats = null; state.genYear = 0; state.genMonth = 0; state.genDim = 0;
  genDay = 0; genStats = null; genYear = 0; genMonth = 0; genDim = 0;
  document.getElementById('sel-year').value = y0;
  document.getElementById('sel-month').value = m0;
  updateButtons();
  render();
  setStatus('Generate 6 luni, începând cu ' + getMonthName(m0) + ' ' + y0 + '.' + (gaps.length ? ' ⚠️ Ture neacoperite în: ' + gaps.join(', ') + '.' : ''), gaps.length ? 'warn' : 'success');
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
