// ===========================================================================
// MOD: Exploatare (electricieni) — constante, funcții și logică specifice acestui mod.
// Se încarcă ÎNAINTEA js/core.js; nu apela funcții din core la încărcare (doar la evenimente).
// ===========================================================================

const STORAGE_KEY = 'graficTura';

const VERSION_KEY = 'graficTura_version';

const ORG_KEY = 'graficTura_org';

const APP_VERSION = 'V2026.10.2';

const DB_NAME = 'GraficTuraDB';

// ── Configurația modului: citită de nucleu (js/core.js). Vezi modes/_template.js pentru ghid. ──
const MODE = {
  id: 'exploatare',
  dbKey: 'main',                 // cheia în IndexedDB
  words: {                       // cuvinte folosite în mesajele nucleului
    employee: 'electrician', Employee: 'Electrician', employeeGen: 'electricianului', employeesPl: 'electricieni',
    keptLong: 'CO, CM și Instruire', keptShort: 'CO/CM/Instruire'    // ce păstrează „Curăță”
  },
  keepOnClear: [5, 6, 8],        // valori de tură păstrate la „Curăță” (CO, CM, INST)
  leaveTypes: { 5: 'CO', 6: 'CM', 8: 'INST' },   // tipuri aplicabile pe interval
  leaveSkipWeekend: [8],         // tipuri care sar peste weekend la „pe interval”
  leaveHoursPerDay() { return 8; },
  isWorkShift(v) { return (v >= 1 && v <= 4) || v === 7 || v === 8; },   // contează ca tură lucrată (sărbători)
  expectedHours(y, m) { const wd = workingDays(y, m); return wd !== null ? wd * 8 : null; },
  // formularul „Adaugă electrician”
  readAddForm() {
    const cat = document.getElementById('new-emp-cat').value;
    const fn = document.getElementById('new-emp-fn').value;
    const crew = document.getElementById('new-emp-crew').value.trim();
    const forced8 = document.getElementById('new-emp-forced').checked;
    addCrewToCustom(crew);
    return { category: cat, functia: fn, crew: crew || '', forced8, crewOverrides: {} };
  },
  resetAddForm() {
    document.getElementById('new-emp-crew-custom').value = '';
    document.getElementById('new-emp-forced').checked = false;
    populateCrewSelect('new-emp-crew', '');
  },
  afterAdd() { document.getElementById('new-emp-forced').checked = false; },
  addedMessage(name, f) { const catNames = { urban: 'Urban', rural: 'Rural' }; return 'Electrician adăugat: ' + name + ' (' + (catNames[f.category] || f.category) + ')'; },
  // modalul „Editează electrician”
  fillEditForm(emp) {
    document.getElementById('modal-emp-cat').value = emp.category || 'urban';
    document.getElementById('modal-emp-fn').value = emp.functia || 'emitent';
    document.getElementById('modal-emp-forced').checked = emp.forced8 || false;
    pendingOverrides = Object.assign({}, emp.crewOverrides || {});
    populateCrewSelect('modal-emp-crew', emp.crew || '');
    populateCrewDatalist('crew-datalist-override');
    renderOverridesList();
  },
  readEditForm() {
    return {
      cat: document.getElementById('modal-emp-cat').value,
      fn: document.getElementById('modal-emp-fn').value,
      crew: document.getElementById('modal-emp-crew').value.trim(),
      forced8: document.getElementById('modal-emp-forced').checked
    };
  },
  applyEditForm(emp, f) {
    emp.category = f.cat; emp.functia = f.fn; emp.crew = f.crew || ''; emp.forced8 = f.forced8;
    emp.crewOverrides = Object.assign({}, pendingOverrides); addCrewToCustom(f.crew);
  },
  importEmployee(e) {
    return { category: e.category || 'urban', functia: e.functia || 'emitent', crew: e.crew || '', forced8: e.forced8 || false, crewOverrides: e.crewOverrides || {} };
  },
  // fișiere din alt mod (Dispecer) nu se importă aici
  looksForeign(data) {
    const emps = Array.isArray(data.employees) ? data.employees : [];
    return data.module === 'dispecer' || emps.some(e => e && e.category === 'dispecer');
  },
  foreignMessage: 'Fișierul provine din aplicația Dispecer — nu poate fi încărcat în Exploatare.',
  // ── generare ──
  beginGeneration(emps) {
    const groups = GROUPS;
    const cfgs = {};
    groups.forEach(g => { cfgs[g] = readConfig(g); });
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const ge = emps.filter(e => e.category === g);
      const c = cfgs[g];
      if (c.t1 + c.t1a + c.t2 + c.t2a + c.c8 > ge.length) {
        if (!confirm(catLabel(g) + ': nr. pe tură (' + (c.t1 + c.t1a + c.t2 + c.t2a + c.c8) + ') depășește totalul (' + ge.length + '). Unii nu vor avea zile libere. Continuați?')) return false;
      }
    }
    return { cfgs };
  },
  commitGeneration(ctx) { GROUPS.forEach(g => { state.config[g] = ctx.cfgs[g]; }); },
  initGenStats(year, month, firstEmpty, emps) {
    genStats = rebuildGenStats(year, month, firstEmpty);
    // Seed yesterday/consec from previous month's last day for month transition
    let prevMonth = month - 1, prevYear = year;
    if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }
    const prevDim = daysInMonth(prevYear, prevMonth);
    const prevDk = dateKey(prevYear, prevMonth, prevDim);
    if (state.schedule[prevDk]) {
      emps.forEach(e => {
        const s = genStats[e.id];
        if (!s) return;
        const prevV = state.schedule[prevDk][String(e.id)];
        if (prevV !== undefined && prevV !== null) {
          if (s.yesterday === null) s.yesterday = prevV;
          if (s.consec === 0 && (prevV >= 1 && prevV <= 4 || prevV === 7 || prevV === 8)) {
            let c = 1;
            for (let d = prevDim - 1; d >= 1; d--) {
              const pd = dateKey(prevYear, prevMonth, d);
              const pv = state.schedule[pd]?.[String(e.id)];
              if (pv >= 1 && pv <= 4 || pv === 7 || pv === 8) c++; else break;
            }
            s.consec = c;
          }
        }
      });
    }
    return genStats;
  },
  // Resincronizează genStats din date reale înainte de a genera — dacă ziua curentă a fost deja
  // regenerată (ex. imediat după prevDay(), care lasă genDay pe ziua tocmai refăcută), vechiul
  // subtractDayStats() nu reseta `consec`/`yesterday` (doar orele), ducând la dublă-numărare a
  // zilelor consecutive lucrate la fiecare ciclu ←/→ — regula MAX_CONSEC ajungea încălcată
  // silențios (bug găsit la audit, confirmat cu teste automate — echipa ajungea la 5+ zile
  // consecutive deși limita e 4).
  resyncGenStats(year, month, uptoDay) { return rebuildGenStats(year, month, uptoDay); },
  assignDay({ dk, day, weekend, emps, hasCOCM, assigned }) {
    const groups = GROUPS;
    const cfgs = {};
    groups.forEach(g => { cfgs[g] = readConfig(g); });
    if (state.genMode === 'rotation') {
      assignRotationShifts(emps, dk, assigned, day, weekend, cfgs, [1, 3, 2, 0, 1, 4, 2, 0]);
    } else if (state.genMode === 'rotation3') {
      assignRotationShifts(emps, dk, assigned, day, weekend, cfgs, [1, 2, 0]);
    } else {
      groups.forEach(g => assignCategoryShifts(emps.filter(e => e.category === g && !hasCOCM.includes(String(e.id)) && !e.forced8), genStats, cfgs[g], dk, assigned, weekend, day, state.genMode !== 'full'));
    }
    if (!weekend) {
      // Forced 8h employees ALWAYS get shift 8 (value 7), never T1/T2/T1A/T2A
      emps.filter(e => e.forced8 && !hasCOCM.includes(String(e.id)) && !(state.schedule[dk][String(e.id)] > 0)).forEach(e => {
        state.schedule[dk][String(e.id)] = 7;
        if (!assigned.includes(e.id)) assigned.push(e.id);
      });
    } else {
      // On weekends, forced8 employees get free day (L)
      emps.filter(e => e.forced8 && !hasCOCM.includes(String(e.id)) && !assigned.includes(e.id)).forEach(e => {
        state.schedule[dk][String(e.id)] = 0;
        if (!assigned.includes(e.id)) assigned.push(e.id);
      });
    }
  },
  afterDay({ dk, emps }) {
    emps.forEach(e => {
      const v = state.schedule[dk][String(e.id)];
      genStats[e.id].yesterday = v;
      if (v === 1) { genStats[e.id].t1++; genStats[e.id].total++; }
      else if (v === 2) { genStats[e.id].t2++; genStats[e.id].total++; }
      else if (v === 3) { genStats[e.id].t1a++; genStats[e.id].total++; }
      else if (v === 4) { genStats[e.id].t2a++; genStats[e.id].total++; }
      else if (v === 7) { genStats[e.id].c8++; genStats[e.id].total++; }
      else if (v === 8) { genStats[e.id].inst++; genStats[e.id].total++; }
      // Update consecutive working days count
      if (v >= 1 && v <= 4 || v === 7 || v === 8) { genStats[e.id].consec++; } else { genStats[e.id].consec = 0; }
    });
  },
  decorateStats(st) {
    st.t1 = st.counts[1] || 0; st.t2 = st.counts[2] || 0; st.t1a = st.counts[3] || 0; st.t2a = st.counts[4] || 0;
    st.c8 = st.counts[7] || 0; st.inst = st.counts[8] || 0;
  },
  // ── tabel și legendă ──
  legend: [   // [clasă, text, stil suplimentar]
    ['pill-t1', 'T1 / T1A &nbsp;06:00–14:00'],
    ['pill-t2', 'T2 / T2A &nbsp;14:00–22:00'],
    ['pill-c8', '8h &nbsp;08:00–16:00'],
    ['', 'INST — Instruire', 'background:#d5f5e3;color:#1a7a3a'],
    ['pill-co', 'CO — Concediu Odihnă'],
    ['pill-cm', 'CM — Concediu Medical'],
    ['', 'L — Liber', 'background:var(--shift0-bg);color:var(--shift0-text)']
  ],
  table: {
    extraHeader: '<th style="text-align:left;padding-left:4px;width:62px;min-width:62px;max-width:62px;overflow:hidden">Funcția</th>',
    fixedCols: 5,                          // nume + funcție + 3 coloane finale
    weekendHide: [3, 4, 5, 6, 7, 8],       // valori neoferite în dropdown pe S/D
    weekendDisplayL: [5, 6, 7, 8],         // valori afișate ca L pe S/D
    // secțiunile tabelului: grupuri Urban/Rural (sortate pe echipaj) + „Program 8 ore”
    sections(emps) {
      const out = [];
      GROUPS.forEach(g => {
        const gEmps = emps.filter(e => (e.category || 'urban') === g && !e.forced8);
        gEmps.sort((a, b) => (a.crew || '').localeCompare(b.crew || ''));
        out.push({ emps: gEmps, cls: 'group-' + g, header: catLabel(g) + ' — ' + gEmps.length + ' electricieni' });
      });
      const f8 = emps.filter(e => e.forced8);
      out.push({ emps: f8, cls: 'group-f8', f8: true, header: 'Program 8 ore — ' + f8.length + ' electricieni' });
      return out;
    },
    rowHead(emp, sec) {
      const fnLabel = FUNC_NAMES[emp.functia || 'emitent'];
      const fnCls = 'fn-' + (emp.functia || 'emitent');
      let crewLabel = '';
      if (!sec.f8 && emp.crew) crewLabel = '<span style="font-size:11px;font-weight:700;color:#555;display:block;text-align:center">' + esc(emp.crew) + '</span>';
      return '<td class="emp-name-cell" onclick="openEditModal(' + emp.id + ')">' + esc(emp.name) + ((sec.f8 || emp.forced8) ? ' <span class="forced-badge">F</span>' : '') + '</td><td class="' + fnCls + '" style="text-align:center;padding:0 2px;font-size:12px;font-weight:600">' + fnLabel + crewLabel + '</td>';
    },
    cellExtra(emp, dk, v, sec) {   // indicator de echipaj când diferă de cel de bază (override pe dată)
      if (sec.f8) return '';
      const effectiveCrew = getCrewForDay(emp, dk);
      if (v > 0 && v !== 5 && v !== 6 && v !== 8 && effectiveCrew && effectiveCrew !== (emp.crew || '')) {
        return '<span class="crew-indicator">' + esc(effectiveCrew) + '</span>';
      }
      return '';
    }
  }
};

const CHANGELOG = {
  'V2026.10.2': {
    title: 'Manualul, împărțit în două moduri',
    items: [
      { icon: '📖', text: 'Manualul are acum două moduri: „Mod Electricieni (Exploatare)” și „Mod Dispecer”, fiecare cu filele lui; se deschide pe modul aplicației curente' }
    ]
  },
  'V2026.10.1': {
    title: 'Modul Dispecer + selector de modul',
    items: [
      { icon: '🔗', text: 'Selector „Modul” în antet: comută între Exploatare și noua aplicație Dispecer (grafic separat, cu date proprii)' },
      { icon: '🕐', text: 'Dispecer: ture T1 (4h), T2 (6h), T3 (6h), T4 (8h) cu acoperire 24h automată, CO/CM, statistici, Excel și print' }
    ]
  },
  'V2026.09.23': {
    title: 'Print/PDF mereu pe temă deschisă',
    items: [
      { icon: '🖨️', text: 'Exportul PDF și printarea folosesc acum mereu tema deschisă — modul întunecat nu mai afecta culorile documentului tipărit' }
    ]
  },
  'V2026.09.22': {
    title: 'Manual: Început rapid modernizat',
    items: [
      { icon: '✨', text: 'Tab-ul „Început rapid" are acum o prezentare vizuală: bandă de titlu și o listă cu ce poate face aplicația, pe carduri' },
      { icon: '🚀', text: 'Cei 6 pași pentru un grafic nou sunt afișați ca pași numerotați, mai ușor de urmărit' }
    ]
  },
  'V2026.09.21': {
    title: 'Manual complet rescris',
    items: [
      { icon: '📖', text: 'Manualul acoperă acum toate funcțiile aplicației, pe 7 secțiuni: Început rapid, Configurare, Generare, Reguli, Editare, Statistici și Fișiere & Export' },
      { icon: '🆕', text: 'Explicat în detaliu: Curăță (păstrează CO/CM/INST), CO/CM/Instruire pe interval, împerecherea temporară a electricienilor rămași fără pereche, Analiză moduri, importul de lună vs. backup complet, versiuni și „Ce e nou"' }
    ]
  },
  'V2026.09.20': {
    title: 'Curăță păstrează CO / CM / Instruire',
    items: [
      { icon: '🧹', text: '„✕ Curăță" șterge acum doar turele generate — CO, CM și Instruire deja introduse rămân în grafic' },
      { icon: '🔧', text: 'Instruirea introdusă manual nu mai este ștearsă nici la regenerarea zilelor (înainte se păstrau doar CO/CM)' }
    ]
  },
  'V2026.09.19': {
    title: 'Tooltipuri în Analiză moduri',
    items: [
      { icon: '💬', text: 'Tabelul din „Analiză moduri" are acum tooltip pe fiecare coloană (Echipaje active/zi, Utilizare, Zile cu toate echipajele, Ore min–max, Spread, Conflicte) — explică ce înseamnă fiecare valoare, la trecerea cu cursorul' }
    ]
  },
  'V2026.09.18': {
    title: 'Fix: antet sărbătoare în Excel era tot pastel',
    items: [
      { icon: '🔧', text: 'Antetul coloanelor de sărbătoare din Excel rămăsese pe auriul pastel vechi (nu fusese actualizat când am întărit culoarea pe ecran) — acum auriu-bronz saturat + text alb, verificat pe fișierul real exportat' }
    ]
  },
  'V2026.09.17': {
    title: 'Manual actualizat + sărbători în legenda Excel',
    items: [
      { icon: '📖', text: 'Manual: secțiune nouă „Sărbători legale" (tab Generare) — explică marcajul pe grafic, lista lunară și coloana din Statistici; corectată o frază învechită care mai spunea „2025-2028"' },
      { icon: '📊', text: 'Export Excel: legenda de la finalul foii afișează acum și sărbătorile lunii (dată + nume) — lipseau complet, deși coloanele erau deja marcate pe grafic' }
    ]
  },
  'V2026.09.16': {
    title: 'Sărbători și în Excel — grafic + coloană statistici',
    items: [
      { icon: '📊', text: 'Export Excel: coloanele zilelor de sărbătoare sunt marcate cu chenar auriu pe grafic, la fel ca pe ecran — nu doar antetul, uitasem inițial celulele' },
      { icon: '📊', text: 'Export Excel: coloană nouă „Sărb." — câte ture a lucrat fiecare electrician în zile de sărbătoare legală, alături de Lucrate/CO-CM/Normă' }
    ]
  },
  'V2026.09.15': {
    title: 'Sărbători: chenar pe celule + ture în statistici',
    items: [
      { icon: '🖍️', text: 'Chenarul auriu pe celulele din coloanele de sărbătoare a rămas (ajută la citit turele repede), doar antetul e colorat mai puternic' },
      { icon: '📊', text: 'Nou: coloană „🎉 Sărb." în Statistici ture + pastilă pe cardul fiecărui electrician — câte ture a lucrat efectiv în zile de sărbătoare legală, în luna curentă' }
    ]
  },
  'V2026.09.14': {
    title: 'Sărbători legale pe grafic — calendar extins nelimitat',
    items: [
      { icon: '🎉', text: 'Zilele de sărbătoare legală din România (Anul Nou, Boboteaza, Paște, Ziua Muncii, Rusalii, Sf. Maria, Crăciun etc.) apar acum evidențiate direct pe grafic — coloana zilei respective, indiferent de tură sau weekend' },
      { icon: '📋', text: 'Listă nouă sub tabel, mereu vizibilă — sărbătorile lunii afișate curent, cu data și numele fiecăreia' },
      { icon: '📅', text: 'Calendarul de zile lucrătoare (folosit pt. normă) nu mai e limitat la 2025-2028 — calculat acum pentru orice an, inclusiv Paștele ortodox (dată mobilă, calculată automat, nu mai necesită actualizare manuală)' },
      { icon: '🔧', text: 'Corectat: normă subestimată pentru Ianuarie 2027, Ianuarie 2028 și Iunie 2027 — tabelul vechi omitea Boboteaza/Sf. Ioan Botezătorul din calcul pentru acei ani' },
      { icon: '📊', text: 'Export Excel: coloana zilei de sărbătoare e marcată la fel ca pe ecran' },
      { icon: 'ℹ️', text: 'Sărbătorile sunt strict informative — nu influențează în niciun fel alocarea automată a echipajelor' }
    ]
  },
  'V2026.09.13': {
    title: 'Curățenie repo',
    items: [
      { icon: '🧹', text: 'Șterse fișierele JSON de test lăsate în rădăcina repo-ului (nu erau parte din aplicație, ignorate deja de git)' }
    ]
  },
  'V2026.06.12': {
    title: 'Audit runda 4: securitate, curățenie și corecții minore',
    items: [
      { icon: '🔒', text: 'Securitate: nume de echipaj custom cu ghilimele puteau injecta cod în pagină (select-ul de echipaj) — descoperit și fixat un gol în funcția de escapare folosită în toată aplicația (esc() nu proteja atribute HTML, doar text)' },
      { icon: '🔒', text: 'Securitate: aceeași clasă de problemă fixată și la lista de schimbări de echipaj din modalul de editare' },
      { icon: '🐛', text: '„8h" (program normal) setat manual pe weekend nu se mai numără la ore lucrate și se afișează corect ca L, la fel ca CO/CM/Instruire' },
      { icon: '🐛', text: '„✕ Curăță" nu mai lasă graficul într-o stare „pe jumătate generată" care declanșa mereu confirmarea de continuare la următorul „Generare"' },
      { icon: '🐛', text: '„Încarcă fișier" păstrează acum permisiunea de scriere pe fișierul ales — „Descarcă tot" poate salva înapoi în același fișier fără să redeschidă dialogul' },
      { icon: '🐛', text: 'La date corupte în browser, aplicația nu mai pornește tăcut cu o stare goală — arată un avertisment și păstrează o copie a datelor vechi' },
      { icon: '🐛', text: 'Modul de generare implicit e acum consecvent (2 — Zilnic T1/T2) în toate situațiile, nu doar la instalare nouă' },
      { icon: '🐛', text: 'Exportul lunii curente salvează datele de organizație corecte, nu o copie posibil învechită' },
      { icon: '📊', text: '„Analiză moduri": un echipaj integral în concediu nu mai scade artificial procentul de utilizare; un echipaj cu membri pe ture diferite e recunoscut corect ca activ; verifică și săptămâna de la granița lunii anterioare' },
      { icon: '🎨', text: 'Antetele de grup (Urban/Rural) își păstrează culoarea corectă pe toate rândurile, inclusiv cele pare' },
      { icon: '🖨️', text: 'Semnăturile la print apar acum direct sub tabelul de grafic, pe aceeași pagină, nu după cardurile de sumar' },
      { icon: '🧹', text: 'Curățenie: cod CSS/HTML mort eliminat (grafic neimplementat, clase nefolosite), ExcelJS nu mai blochează încărcarea paginii, favicon adăugat' }
    ]
  },
  'V2026.06.11': {
    title: 'Audit runda 3: rotație cu T1A/T2A=0 nu mai pierde zile lucrătoare',
    items: [
      { icon: '⚖️', text: 'Modul „Rotație 8 zile" cu T1A/T2A=0 (configurația implicită) pierdea ~56h/lună/persoană — faza care cerea T1A/T2A rămânea liberă (L) chiar și în zilele lucrătoare, cu T1/T2 configurate și capacitate disponibilă. Acum se redirecționează automat la echivalentul principal (T1A→T1, T2A→T2), în fiecare zi, nu doar weekend' },
      { icon: '✅', text: 'Verificat pe 1-5 echipaje, Urban și Rural, ambele moduri de rotație — nicio încălcare de regulă (max 4 zile consecutive, gap T2→T1, max 5 zile/săptămână) introdusă de acest fix' }
    ]
  },
  'V2026.06.10': {
    title: 'Audit runda 2: normă corectă + câmp 8h + export Excel',
    items: [
      { icon: '🟡', text: 'Câmpul „8h" configurat în modul „2) Zilnic T1/T2" acum chiar se alocă (era ignorat silențios); rămâne ascuns doar în modurile de rotație, unde nu e implementat' },
      { icon: '🟡', text: 'Culoarea orelor lucrate (verde/roșu) e acum aceeași în tabel și în sumar — înainte tabelul folosea un prag fix 150-184h, indiferent de norma reală a lunii afișate' },
      { icon: '🟡', text: 'CO/CM aprobate se scad acum din norma așteptată — un angajat cu concediu nu mai apare fals „sub normă" (card roșu) pentru zilele în care a fost în concediu' },
      { icon: '🟡', text: 'Pentru ani în afara tabelului de sărbători legale (2025-2028), nu se mai afișează o normă inventată (184h) — apare „normă necunoscută" consecvent, în loc de cifre contradictorii între tabel și sumar' },
      { icon: '🟡', text: 'Export Excel: rândurile „Program 8 ore" aplică acum corect maparea de weekend (CO/CM/INST → L), la fel ca restul tabelului' }
    ]
  },
  'V2026.06.9': {
    title: 'Audit: corecții critice generare + import + securitate',
    items: [
      { icon: '🔴', text: 'Dublă alocare aceeași persoană (T1↔T2) în aceeași zi, care lăsa ture neumplute în modurile 1/2 — fixat la sursă' },
      { icon: '🟠', text: '„✕ Curăță" nu mai lasă generarea „agățată" — butoanele de generare dispar corect, nu se mai poate scrie o zi orfană' },
      { icon: '🟠', text: 'Import fișier de lună: nu mai poate șterge accidental toate celelalte luni/electricieni/echipaje (fișiere vechi fără câmpul „type" erau tratate greșit ca backup complet)' },
      { icon: '🟠', text: 'Import fișier de lună fără grafic valid e respins cu eroare, în loc să golească luna țintă raportând „succes"' },
      { icon: '🟠', text: 'Import fișier de lună: avertisment dacă fișierul conține electricieni cu alt nume dar același id ca cei locali (risc de tură atribuită persoanei greșite)' },
      { icon: '🔒', text: 'Securitate: setările organizației (Șef FOL, Responsabil Tehnic, Aprobat, Județ) sunt acum escapate — eliminat un risc de cod injectat prin fișier JSON partajat' }
    ]
  },
  'V2026.06.8': {
    title: 'Preview link generic, fără nume de formație',
    items: [
      { icon: '🔗', text: 'Link-ul partajat (WhatsApp/Facebook/Telegram) arăta uneori numele formației tale, luat din titlul paginii setat la runtime — acum preview-ul folosește mereu un titlu generic, static' }
    ]
  },
  'V2026.06.7': {
    title: 'Analiza moduri respectă CO/CM reale + fix config la reload',
    items: [
      { icon: '🏖️', text: 'Analiza moduri ținea cont greșit doar de electricieni disponibili integral — acum respectă CO/CM deja introduse manual în graficul lunii curente, inclusiv extensia de weekend' },
      { icon: '🐛', text: 'Câmpurile de configurare T1/T1A/T2/T2A/8h reveneau la valorile implicite din pagină la fiecare reîncărcare, chiar dacă graficul afișat fusese generat cu altă capacitate — acum se restaurează corect din ultima configurare salvată' }
    ]
  },
  'V2026.06.6': {
    title: 'Analiză moduri de generare',
    items: [
      { icon: '📈', text: 'Buton nou „Analiză moduri" — compară cele 4 moduri de generare pe baza echipajelor detectate automat și a configurației curente, arată care mod utilizează cel mai bine echipajele pe lună (fără să modifice graficul real)' }
    ]
  },
  'V2026.06.5': {
    title: 'Corecții export Excel + fairness rotație',
    items: [
      { icon: '📊', text: 'Exportul Excel afișează acum corect L în weekend pentru zilele cu CO/CM/Instruire, la fel ca pe ecran' },
      { icon: '⚖️', text: 'Fairness-ul din modurile de Rotație nu mai poate citi ore din altă lună dacă schimbi selectorul de lună/an în timpul generării pas cu pas' }
    ]
  },
  'V2026.06.4': {
    title: 'Rotații echitabile + mod nou + împerechere',
    items: [
      { icon: '⚖️', text: 'Alocare mult mai echitabilă în modurile de Rotație — corectate mai multe surse de dezechilibru (coliziuni de tură, T1A/T2A pierdute în weekend, reziduu de lună favorizând mereu același echipaj)' },
      { icon: '🔄', text: 'Mod nou de generare: Rotație T1-T2-L (3 zile) — ciclu simplu, simetric' },
      { icon: '🤝', text: 'Electricienii rămași fără pereche (partenerul e în CO/CM) sunt împerecheați automat între ei, în loc să lucreze singuri sau pe ture diferite' },
      { icon: '📅', text: 'Selector de interval pentru CO / CM / Instruire — alegi data de început și sfârșit, în loc să setezi zi cu zi' },
      { icon: '🏷️', text: 'Moduri de generare redenumite și numerotate (1–4) pentru claritate' },
      { icon: '👁️', text: 'Câmpurile T1A/T2A din configurare apar doar când modul selectat le poate folosi' },
      { icon: '🚫', text: 'Instruirea (INST) nu mai poate fi setată în weekend, la fel ca CO/CM' },
      { icon: '💬', text: 'Tooltipuri noi pe bara de sus și pe meniul Fișiere, cu denumiri clarificate' }
    ]
  },
  'V2026.06.3': {
    title: 'Instruire (INST) + reorganizare',
    items: [
      { icon: '🟢', text: 'Tură nouă INST (Instruire) — culoare verde, disponibilă în toate zilele, se contorizează în orele lucrate' },
      { icon: '📋', text: 'Electricienii cu program forțat 8h sunt grupați separat, sub „Program 8 ore", după Rural' },
      { icon: '🎨', text: 'Contrast îmbunătățit pe numele electricienilor — rânduri alternative și text bold' },
      { icon: '📖', text: 'Legendă actualizată cu INST și 8h — atât în manual cât și în subsolul tabelului' }
    ]
  },
  'V2026.06.2': {
    title: 'Actualizare iunie 2026 (2)',
    items: [
      { icon: '🏢', text: 'Date organizație persistente — setările (formație, șef FOL, responsabil tehnic) nu se mai pierd la actualizări sau import de grafic' },
      { icon: '👥', text: 'Echipaje flexibile — poți muta un electrician în alt echipaj de la o dată specifică, cu oricâte schimbări pe lună' },
      { icon: '✏️', text: 'Echipaje custom — pe lângă U1–U5 și R1–R5, poți crea echipaje cu orice denumire' },
      { icon: '💬', text: 'Explicații la hover — câmpurile din ferestre afișează acum o descriere când ții mouse-ul deasupra' },
      { icon: '📖', text: 'Manual reorganizat pe secțiuni (tab-uri): Configurare, Generare, Editare, Export' },
      { icon: '🛡️', text: 'Ștergerea unui electrician necesită acum confirmare în doi pași — nu mai poți șterge accidental' },
      { icon: '🌙', text: 'Corecții vizuale în modul întunecat pentru butoane și liste' }
    ]
  },
  'V2026.06.1': {
    title: 'Actualizare iunie 2026',
    items: [
      { icon: '👥', text: 'Echipaje flexibile — poți muta un electrician în alt echipaj de la o dată specifică, cu oricâte schimbări pe lună' },
      { icon: '✏️', text: 'Echipaje custom — pe lângă U1–U5 și R1–R5, poți crea echipaje cu orice denumire' },
      { icon: '💬', text: 'Explicații la hover — câmpurile din ferestre afișează acum o descriere când ții mouse-ul deasupra' },
      { icon: '📖', text: 'Manual reorganizat pe secțiuni (tab-uri): Configurare, Generare, Editare, Export' },
      { icon: '🛡️', text: 'Ștergerea unui electrician necesită acum confirmare în doi pași — nu mai poți șterge accidental' },
      { icon: '🌙', text: 'Corecții vizuale în modul întunecat pentru butoane și liste' }
    ]
  }
};

const GROUPS = ['urban', 'rural'];

const SHIFT_NAMES = ['L', 'T1', 'T2', 'T1A', 'T2A', 'CO', 'CM', '8', 'INST'];

const SHIFT_HOURS = [0, 8, 8, 8, 8, 0, 0, 8, 8];   // ore pe valoarea turei (T1/T2/T1A/T2A/8/INST = 8h)

const FUNC_NAMES = { emitent: 'Emitent', admitent: 'Admitent', electrician: 'Electrician', seftura: 'Șef tură' };

const PREDEFINED_CREWS = ['U1','U2','U3','U4','U5','R1','R2','R3','R4','R5'];

function defaultState() {
  const now = new Date();
  return {
    employees: [{ id: 1, name: 'Electrician 1', category: 'urban', functia: 'emitent', crew: '', forced8: false, crewOverrides: {} }],
    config: { urban: { t1: 2, t1a: 0, t2: 2, t2a: 0, c8: 0 }, rural: { t1: 2, t1a: 0, t2: 2, t2a: 0, c8: 0 } },
    customCrews: [],
    schedule: {},
    preservedCOCM: {},
    genDay: 0, genStats: null, genYear: 0, genMonth: 0, genDim: 0,
    currentMonth: now.getMonth() + 1,
    currentYear: now.getFullYear(),
    org: { formatia: '', sefFOL: '', responsabilTehnic: '', aprobat: '', judet: '' },
    genMode: 't12'
  };
}

function getCrewForDay(emp, dk) {
  if (!emp.crewOverrides || Object.keys(emp.crewOverrides).length === 0) return emp.crew || '';
  const dates = Object.keys(emp.crewOverrides).filter(d => d <= dk).sort();
  if (dates.length === 0) return emp.crew || '';
  return emp.crewOverrides[dates[dates.length - 1]] || emp.crew || '';
}

function addCrewToCustom(crew) {
  if (!crew || PREDEFINED_CREWS.includes(crew)) return;
  if (!state.customCrews) state.customCrews = [];
  if (!state.customCrews.includes(crew)) state.customCrews.push(crew);
}

function populateCrewSelect(selectId, currentVal) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  // Nume de echipaj custom = text liber introdus de user (sau importat dintr-un JSON) — atât
  // atributul value="..." CÂT ȘI textul vizibil al opțiunii trebuie escapate separat: esc() nu
  // codifică ghilimelele (irelevante în conținut text, dar critice într-un atribut), de-asta
  // există escAttr() pt. value="..." — text-ul vizibil (era complet NEescapat înainte, gap
  // găsit acum) folosește esc() (bug latent, reproductibil prin UI normal: un nume de echipaj
  // cu `"` sau `<script>` rupea atributul / injecta cod la fiecare randare a select-ului).
  const all = ['', ...PREDEFINED_CREWS, ...(state.customCrews || [])];
  sel.innerHTML = all.map(c => '<option value="' + escAttr(c) + '"' + (c === (currentVal||'') ? ' selected' : '') + '>' + (c ? esc(c) : '—') + '</option>').join('');
}

function populateCrewDatalist(datalistId) {
  const dl = document.getElementById(datalistId);
  if (!dl) return;
  const all = [...PREDEFINED_CREWS, ...(state.customCrews || [])];
  dl.innerHTML = all.map(c => '<option value="' + escAttr(c) + '">').join('');
}

function addCustomCrewToList() {
  const inp = document.getElementById('modal-emp-crew-custom');
  const crew = inp.value.trim();
  if (!crew) return;
  addCrewToCustom(crew);
  const currentVal = document.getElementById('modal-emp-crew').value;
  populateCrewSelect('modal-emp-crew', currentVal);
  document.getElementById('modal-emp-crew').value = crew;
  populateCrewDatalist('crew-datalist-override');
  populateCrewSelect('new-emp-crew', '');
  inp.value = '';
  saveState();
}

let pendingOverrides = {};

function renderOverridesList() {
  const container = document.getElementById('crew-overrides-list');
  if (!container) return;
  const sorted = Object.keys(pendingOverrides).sort();
  if (sorted.length === 0) {
    container.innerHTML = '<span style="font-size:12px;color:#888">Nicio schimbare setată.</span>';
    return;
  }
  // `d` (cheia de dată din crewOverrides) poate veni dintr-un angajat IMPORTAT dintr-un fișier
  // JSON — nevalidat, potențial arbitrar, nu neapărat un format de dată curat. Interpolarea
  // directă în onclick="...('+d+')" (fost cod) era vulnerabilă la XSS dacă d conținea ghilimele.
  // Fix: atribut data-* (escapat de esc() ca orice alt text) + citire din dataset la click —
  // nu se mai construiește deloc un literal JS din date neîncrezute.
  container.innerHTML = sorted.map(d =>
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:13px">'
    + '<span style="color:var(--text-muted);min-width:90px">' + esc(d) + '</span>'
    + '<span style="font-weight:700;color:var(--text)">→ ' + esc(pendingOverrides[d]) + '</span>'
    + '<button data-override-date="' + escAttr(d) + '" onclick="removeCrewOverride(this.dataset.overrideDate)" style="background:none;border:none;color:#e53e3e;cursor:pointer;font-size:16px;line-height:1;padding:0 4px">✕</button>'
    + '</div>'
  ).join('');
}

function addCrewOverride() {
  const date = document.getElementById('override-date').value;
  const crew = document.getElementById('override-crew').value.trim();
  if (!date || !crew) { setStatus('Completează data și echipajul.', 'warn'); return; }
  pendingOverrides[date] = crew;
  addCrewToCustom(crew);
  document.getElementById('override-date').value = '';
  document.getElementById('override-crew').value = '';
  const currentCrewVal = document.getElementById('modal-emp-crew') ? document.getElementById('modal-emp-crew').value : '';
  populateCrewSelect('modal-emp-crew', currentCrewVal);
  populateCrewDatalist('crew-datalist-override');
  populateCrewSelect('new-emp-crew', '');
  renderOverridesList();
}

function removeCrewOverride(date) {
  delete pendingOverrides[date];
  renderOverridesList();
}

function migrateState(s) {
  s.employees.forEach(e => { if (!e.category || e.category === '8ore') e.category = 'urban'; if (!e.functia) e.functia = 'emitent'; if (!e.crew) e.crew = ''; if (!('forced8' in e)) e.forced8 = false; if (!e.crewOverrides) e.crewOverrides = {}; });
  if (!s.customCrews) s.customCrews = [];
  if (!s.config) s.config = { urban: { t1: 2, t1a: 0, t2: 2, t2a: 0, c8: 0 }, rural: { t1: 2, t1a: 0, t2: 2, t2a: 0, c8: 0 } };
  if (s.config.tura1Count !== undefined) {
    s.config = { urban: { t1: s.config.tura1Count || 2, t1a: 0, t2: s.config.tura2Count || 2, t2a: 0, c8: 0 }, rural: { t1: s.config.tura1Count || 2, t1a: 0, t2: s.config.tura2Count || 2, t2a: 0, c8: 0 } };
  }
  GROUPS.forEach(g => { const c = s.config[g] || {}; if (c.t1a === undefined) c.t1a = 0; if (c.t2a === undefined) c.t2a = 0; if (c.c8 === undefined) c.c8 = 0; });
  if (!s.schedule) s.schedule = {};
  if (!s.preservedCOCM) s.preservedCOCM = {};
  if (s.genDay === undefined) s.genDay = 0;
  if (s.genStats === undefined) s.genStats = null;
  if (s.genStats) Object.values(s.genStats).forEach(st => { if (st.inst === undefined) st.inst = 0; });
  if (s.genYear === undefined) s.genYear = 0;
  if (s.genMonth === undefined) s.genMonth = 0;
  if (s.genDim === undefined) s.genDim = 0;
  if (!s.org) s.org = { formatia: '', sefFOL: '', responsabilTehnic: '', aprobat: '', judet: '' };
  // Consecvent cu defaultState() (t12) — era 'full' aici, inconsistent (bug găsit la audit).
  if (!s.genMode) s.genMode = 't12';
}

function addCustomCrewFromAdd() {
  const inp = document.getElementById('new-emp-crew-custom');
  const crew = inp.value.trim();
  if (!crew) return;
  addCrewToCustom(crew);
  populateCrewSelect('new-emp-crew', crew);
  populateCrewSelect('modal-emp-crew', document.getElementById('modal-emp-crew') ? document.getElementById('modal-emp-crew').value : '');
  populateCrewDatalist('crew-datalist-override');
  inp.value = '';
  saveState();
}

function readConfig(g) {
  const el = id => document.getElementById('cfg-' + g + '-' + id);
  return { t1: Math.max(0, parseInt(el('t1').value) || 0), t1a: Math.max(0, parseInt(el('t1a').value) || 0), t2: Math.max(0, parseInt(el('t2').value) || 0), t2a: Math.max(0, parseInt(el('t2a').value) || 0), c8: Math.max(0, parseInt(el('c8').value) || 0) };
}

function assignCategoryShifts(catEmps, stats, cfg, dk, assigned, weekend, day, skipTA) {
  const t1c = cfg.t1 || 0, t1ac = cfg.t1a || 0, t2c = cfg.t2 || 0, t2ac = cfg.t2a || 0, c8c = cfg.c8 || 0;
  if (catEmps.length === 0 || (t1c + t1ac + t2c + t2ac + c8c === 0)) return;

  // Rule: max 4 consecutive working days — employees with consec >= 4 MUST get a free day (L)
  const MAX_CONSEC = 4;
  // Rule: max 5 zile lucrate pe săptămâna calendaristică (Luni-Duminică) — se aplică la TOATE
  // turele (T1/T2/T1A/T2A/8h) de la această etapă, nu doar la T1A/T2A/8h cum era înainte (bug
  // audit: cineva putea lucra 6+ zile pe T1/T2 fără nicio protecție săptămânală).
  // new Date normalizează automat zilele ≤0 spre luna anterioară, ca săptămânile de la
  // început de lună să se calculeze corect peste graniță.
  const dkPartsW = dk.split('-');
  const yrW = parseInt(dkPartsW[0]), moW = parseInt(dkPartsW[1]);
  const dowW = new Date(yrW, moW - 1, day).getDay();
  const weekStartW = day + (dowW === 0 ? -6 : 1 - dowW);
  function weekCount(empId) {
    let wc = 0;
    for (let dd = weekStartW; dd < day; dd++) {
      const realDate = new Date(yrW, moW - 1, dd);
      const cdk = dateKey(realDate.getFullYear(), realDate.getMonth() + 1, realDate.getDate());
      const v = state.schedule[cdk]?.[String(empId)];
      if (v >= 1 && v <= 4 || v === 7 || v === 8) wc++;
    }
    return wc;
  }
  const available = catEmps.filter(e => (!stats[e.id] || stats[e.id].consec < MAX_CONSEC) && weekCount(e.id) < 5);

  // group available employees by crew (non-crew each get solo group)
  const groups = {};
  available.forEach(e => {
    const key = getCrewForDay(e, dk) || '__' + e.id;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  // Cei rămași fără pereche azi (partenerul e în CO/CM, sau angajatul n-are echipaj setat deloc)
  // sunt împerecheați TEMPORAR între ei, determinist după id — practic (electricienii nu
  // lucrează singuri) și mai corect pentru fairness decât tratarea ca indivizi separați, care
  // putea duce la doi orfani lucrând pe ture DIFERITE în aceeași zi (unul T1, altul T2).
  // Aceeași logică ca în assignRotationShifts, pt. modurile de rotație.
  const rawCrews = Object.values(groups);
  const soloGroups = rawCrews.filter(c => c.length === 1).sort((a, b) => a[0].id - b[0].id);
  const pairedGroups = rawCrews.filter(c => c.length >= 2);
  const tempPairs = [];
  for (let i = 0; i + 1 < soloGroups.length; i += 2) tempPairs.push([...soloGroups[i], ...soloGroups[i + 1]]);
  const leftoverSolo = soloGroups.length % 2 ? [soloGroups[soloGroups.length - 1]] : [];
  const crews = [...pairedGroups, ...tempPairs, ...leftoverSolo];

  function avg(c, field) {
    return c.reduce((s, e) => s + stats[e.id][field], 0) / c.length;
  }

  function assignShift(crewsArr, count, shiftVal, sortField, softPrefer, hardBlock) {
    // Doar echipaje ÎNCĂ complet neasignate azi — verificat direct în state.schedule (sursa de
    // adevăr), nu prin lista `remaining` întoarsă de apelul anterior. `remaining` exclude doar
    // echipajele plasate INTEGRAL (`result`); un echipaj din care fallback-ul individual a tras
    // UN singur membru (mai jos) rămâne totuși în `remaining` cu ambii membri — la tura URMĂTOARE
    // din aceeași zi putea fi plasat din nou integral, suprascriind membrul deja asignat (bug găsit
    // la audit: persoana "sare" din T1 în T2, tura inițială rămâne neacoperită).
    const unassignedToday = crewsArr.filter(c => c.every(e => state.schedule[dk][String(e.id)] === undefined));
    // Hard block: regulă reală de siguranță (T2 ieri → nu T1/T1A azi) — niciun echipaj/individ
    // care o încalcă nu poate fi folosit pt. acest slot, nici măcar ca rezervă de completare.
    const candidates = (hardBlock && hardBlock.length)
      ? unassignedToday.filter(c => c.every(e => stats[e.id].yesterday === null || !hardBlock.includes(stats[e.id].yesterday)))
      : unassignedToday;
    // Fairness (ore acumulate) e ÎNTOTDEAUNA criteriul principal — softPrefer (evită repetarea
    // aceleiași ture ieri, doar variație) intervine STRICT ca departajare la egalitate de ore,
    // niciodată nu suprascrie fairness-ul. Înainte, softPrefer înlocuia complet lista de
    // candidați (excludea pe oricine a lucrat ieri tura respectivă, chiar și pe cel cu cele mai
    // puține ore din toată luna) — bug găsit de user: un echipaj rămânea mereu ultimul, oricât
    // de mult rămânea în urmă la ore, pentru că "preferința de varietate" îl exclude sistematic.
    const pool = [...candidates];
    pool.sort((a, b) => {
      const da = avg(a, 'total'), db = avg(b, 'total');
      if (da !== db) return da - db;
      if (softPrefer && softPrefer.length) {
        const aOK = a.every(e => stats[e.id].yesterday === null || !softPrefer.includes(stats[e.id].yesterday));
        const bOK = b.every(e => stats[e.id].yesterday === null || !softPrefer.includes(stats[e.id].yesterday));
        if (aOK !== bOK) return aOK ? -1 : 1;
      }
      return avg(a, sortField) - avg(b, sortField);
    });
    let placed = 0;
    const result = [];
    for (const c of pool) {
      if (placed + c.length > count) continue;
      c.forEach(e => { state.schedule[dk][String(e.id)] = shiftVal; assigned.push(e.id); });
      placed += c.length;
      result.push(c);
    }
    // fill remaining slots with individuals from unused crews (doar dintre candidates — cei
    // hard-blocați rămân excluși și aici, dar softPrefer e doar preferință, nu excludere: dacă
    // TOȚI cei rămași ar fi altfel excluși, capacitatea configurată tot se umple cât se poate —
    // bug găsit de user: T1=4 configurat, dar umplut doar cu 2 în multe zile pt. că fallback-ul
    // vechi excludea definitiv pe oricine lucrase ieri, chiar și când nu exista nicio alternativă.
    if (placed < count) {
      const indiv = [];
      candidates.filter(c => !result.includes(c)).forEach(c => c.forEach(e => indiv.push(e)));
      // Fairness (total ore) e criteriul principal; softPrefer doar departajează la egalitate —
      // al doilea .sort() de mai jos NU mai suprascrie complet ordinea (bug: cele două sortări
      // separate anulau reciproc efectul softPrefer, dar asta nu era cauza principală a
      // dezechilibrului, doar o inconsistență cu partea de echipaje, corectată acum la fel).
      indiv.sort((a, b) => {
        const ta = stats[a.id].total, tb = stats[b.id].total;
        if (ta !== tb) return ta - tb;
        if (softPrefer && softPrefer.length) {
          const aOK = stats[a.id].yesterday === null || !softPrefer.includes(stats[a.id].yesterday);
          const bOK = stats[b.id].yesterday === null || !softPrefer.includes(stats[b.id].yesterday);
          if (aOK !== bOK) return aOK ? -1 : 1;
        }
        return 0;
      });
      for (const e of indiv) {
        if (placed >= count) break;
        state.schedule[dk][String(e.id)] = shiftVal;
        assigned.push(e.id);
        placed++;
      }
    }
    const deficit = count - placed;
    return { remaining: crewsArr.filter(c => !result.includes(c)), deficit: deficit > 0 ? deficit : 0 };
  }

  let remaining = [...crews];
  let r;
  if (day % 2 === 0) {
    r = assignShift(remaining, t2c, 2, 't2', [2]); remaining = r.remaining;
    r = assignShift(remaining, t1c, 1, 't1', [1], [2]); remaining = r.remaining;
  } else {
    r = assignShift(remaining, t1c, 1, 't1', [1], [2]); remaining = r.remaining;
    r = assignShift(remaining, t2c, 2, 't2', [2]); remaining = r.remaining;
  }
  if (!weekend && !skipTA) {
    // Cap-ul de 5 zile/săptămână e deja aplicat mai sus, la `available` — acoperă acum T1/T2
    // ȘI T1A/T2A/8h uniform, nu mai e nevoie de un filtru separat aici (era dublură/bug audit:
    // înainte se aplica DOAR aici, lăsând T1/T2 complet neprotejate de regula săptămânală).
    r = assignShift(remaining, t1ac, 3, 't1a', false, [2]); remaining = r.remaining;
    r = assignShift(remaining, t2ac, 4, 't2a', false); remaining = r.remaining;
  }
  // c8 (8h) e independent de T1A/T2A — nu ar trebui legat de `skipTA`. Înainte era alocat DOAR în
  // modul „full", deși câmpul de configurare rămâne vizibil (și editabil) și în „t12" (nu are
  // clasa .ta-field) — userul îl configura, aplicația îl ignora silențios (bug găsit la audit).
  if (!weekend) {
    r = assignShift(remaining, c8c, 7, 'c8', false); remaining = r.remaining;
  }
}

function assignRotationShifts(emps, dk, assigned, day, weekend, cfgs, ROTATION) {
  if (!ROTATION) ROTATION = [1, 3, 2, 0, 1, 4, 2, 0];
  const CYCLE_LEN = ROTATION.length;
  const eligible = emps.filter(e => !e.forced8 && !assigned.includes(e.id));
  // Group by effective crew
  const crews = {};
  eligible.forEach(e => {
    const key = getCrewForDay(e, dk) || '__' + e.id;
    if (!crews[key]) crews[key] = [];
    crews[key].push(e);
  });
  // Full crews (≥2) rotate as a block; partial crews (ex. partenerul e în CO/CM) feed the
  // individual pool
  const fullCrews = [];
  let individuals = [];
  Object.values(crews).forEach(c => {
    if (c.length >= 2) { fullCrews.push(c); }
    else { individuals.push(c[0]); }
  });
  individuals.sort((a, b) => a.id - b.id);
  // Cei rămași fără pereche (de obicei partenerul e în CO/CM) sunt împerecheați TEMPORAR între
  // ei, din echipaje diferite dar aceeași categorie — practic (electricienii nu lucrează
  // singuri) și mai corect pentru fairness: un „echipaj temporar" de 2 concurează normal pentru
  // capacitate, în loc să rămână individ solo (capacitate 1), ușor blocat de echipajele complete.
  const tempPairs = [];
  GROUPS.forEach(cat => {
    const catIndiv = individuals.filter(e => (e.category || 'urban') === cat);
    for (let i = 0; i + 1 < catIndiv.length; i += 2) tempPairs.push([catIndiv[i], catIndiv[i + 1]]);
  });
  const pairedIds = new Set(tempPairs.flat().map(e => e.id));
  individuals = individuals.filter(e => !pairedIds.has(e.id));
  fullCrews.push(...tempPairs);
  fullCrews.sort((a, b) => a[0].id - b[0].id);
  const limits = {}, used = {};
  GROUPS.forEach(g => {
    const c = cfgs[g];
    limits[g] = { t1: c.t1||0, t1a: (weekend ? 0 : c.t1a||0), t2: c.t2||0, t2a: (weekend ? 0 : c.t2a||0) };
    used[g] = { t1:0, t1a:0, t2:0, t2a:0 };
  });
  const MAX_CONSEC = 4;
  // Max 5 zile lucrate pe săptămâna calendaristică (Luni-Duminică) — aceeași regulă ca în
  // full/t12, lipsea complet din modul de rotație (bug găsit la audit). new Date normalizează
  // automat zilele <1 spre luna anterioară, ca să conteze corect și săptămânile de la
  // început de lună.
  const dkParts0 = dk.split('-');
  const yr0 = parseInt(dkParts0[0]), mo0 = parseInt(dkParts0[1]);
  const dow0 = new Date(yr0, mo0 - 1, day).getDay();
  const weekStart = day + (dow0 === 0 ? -6 : 1 - dow0);
  function weekCount(empId) {
    let wc = 0;
    for (let dd = weekStart; dd < day; dd++) {
      const realDate = new Date(yr0, mo0 - 1, dd);
      const cdk = dateKey(realDate.getFullYear(), realDate.getMonth() + 1, realDate.getDate());
      const v = state.schedule[cdk]?.[String(empId)];
      if (v >= 1 && v <= 4 || v === 7 || v === 8) wc++;
    }
    return wc;
  }
  function doAssign(list, sv) {
    if (sv === 0) return;
    const key = sv === 1 ? 't1' : sv === 2 ? 't2' : sv === 3 ? 't1a' : sv === 4 ? 't2a' : null;
    if (!key) return;
    // Max 4 zile consecutive lucrate — dacă oricare membru al echipajului/individul e deja
    // la limită, tot grupul primește L în loc de tura dorită (aceeași regulă ca în full/t12).
    if (list.some(e => genStats[e.id] && genStats[e.id].consec >= MAX_CONSEC)) return;
    // Max 5 zile lucrate pe săptămână — vezi mai sus.
    if (list.some(e => weekCount(e.id) >= 5)) return;
    // T2 blochează T1/T1A a doua zi (gap de 8h între ture) — aceeași regulă ca în full/t12.
    // Ciclul propriu (8 sau 3 zile) nu produce natural T2→T1, dar rotația de bloc poate crea
    // un salt de fază la granița dintre blocuri; verificarea explicită acoperă și acel caz.
    if ((sv === 1 || sv === 3) && list.some(e => genStats[e.id] && genStats[e.id].yesterday === 2)) return;
    const cat = list[0].category || 'urban';
    if (!limits[cat] || used[cat][key] + list.length > limits[cat][key]) return;
    list.forEach(e => { state.schedule[dk][String(e.id)] = sv; assigned.push(e.id); });
    used[cat][key] += list.length;
  }
  // Fiecare echipaj/individ urmează ciclul de 8 zile T1→T1A→T2→L→..., dar cu 2 particularități:
  // 1. Fairness: când mai multe echipaje vor ACEEAȘI tură în ACEEAȘI zi și limita numerică nu ajunge
  //    pentru toate, câștigă cel cu mai puține ore acumulate luna curentă — nu mai câștigă mereu id-ul mai mic.
  // 2. Rotație de bloc: dacă sunt mai mult de 4 echipaje/grup, ciclul ROTATION are o simetrie de
  //    perioadă 4 (T1/T2/L se repetă, doar T1A/T2A diferă) — cu 5+ echipaje, cel puțin o pereche va
  //    cere mereu aceeași tură în aceeași zi. Ca să nu cadă mereu pe aceeași pereche (ex. mereu U1↔U5),
  //    poziția fiecărui echipaj în ciclu se decalează la fiecare bloc de 8 zile, astfel încât perechea
  //    care „se ciocnește" se rotește printre toate echipajele pe parcursul lunii.
  // genStats direct, nu getEmployeeStats(id).hours — acela citește din state.currentYear/Month
  // (setate de dropdown-urile lună/an din DOM), nu din luna generată efectiv (genYear/genMonth).
  // Dacă userul schimbă dropdown-ul lună/an în timpul unei generări pas-cu-pas, fairness-ul
  // ajungea să citească silent orele altei luni (bug găsit la audit).
  const hoursOf = list => genStats[list[0].id] ? genStats[list[0].id].total : 0;
  // Faza ciclului se calculează din numărul ABSOLUT de zile (de la epoca Unix), nu din ziua
  // lunii (care se resetează la 1 în fiecare lună). Astfel ciclul curge CONTINUU peste granițele
  // dintre luni — nu mai există un salt de fază la trecerea lună→lună care putea produce un
  // T2→T1 ilegal chiar pe ziua 1 (blocat de regula de gap → tura rămânea complet neacoperită).
  // Reziduul lunilor cu 31 de zile se rotește oricum natural între echipaje, pentru că lungimile
  // de lună diferă (31 % CYCLE_LEN ≠ 0), deci fiecare lună începe într-un punct diferit al ciclului
  // — nu mai e nevoie de `monthSeed`.
  const absDay = Math.round(new Date(dk + 'T00:00:00Z').getTime() / 86400000);
  const blockAbs = Math.floor(absDay / CYCLE_LEN);
  // Detectează dacă n echipaje pot exista fără coliziune de tură pe acest ROTATION — nu e
  // suficient n<=CYCLE_LEN (idx unic nu garantează valoare unică: ROTATION poate avea aceeași
  // tură pe poziții diferite, ex. T1 la poz. 0 ȘI 4 în ciclul de 8 zile). Verifică direct: există
  // vreo zi în care două idx din [0,n) cer aceeași tură reală (L exclus, nu produce conflict)?
  // IMPORTANT: verifică și varianta cu phaseFallback aplicat (T1A→T1, T2A→T2) — o poziție din
  // ciclu poate cădea pe orice zi a săptămânii de-a lungul lunii, deci fallback-ul poate crea
  // coliziuni noi (ex. T1 la poz. 0 ȘI 1 dacă poz. 1 era T1A) pe care varianta de bază nu le
  // arată. `remapPossible` e adevărat ori de câte ori fallback-ul de mai jos ar putea remapa
  // vreodată poziția respectivă (fie pt. că T1A e folosit activ — remap doar în weekend — fie
  // pt. că T1A e dezactivat complet dar T1 are capacitate — remap ÎN FIECARE zi, nu doar weekend);
  // verificarea conservativă (worst-case) e sigură chiar dacă remap-ul nu se întâmplă chiar în
  // fiecare zi din lună — la fel ca înainte, doar cu condiția de declanșare extinsă.
  function hasCollision(n, cat) {
    const c = cfgs[cat] || {};
    const remapPossibleT1A = (c.t1a || 0) > 0 || (c.t1 || 0) > 0;
    const remapPossibleT2A = (c.t2a || 0) > 0 || (c.t2 || 0) > 0;
    const remapped = ROTATION.map(v => (v === 3 && remapPossibleT1A) ? 1 : (v === 4 && remapPossibleT2A) ? 2 : v);
    function check(arr) {
      for (let D = 0; D < CYCLE_LEN; D++) {
        const seen = new Set();
        for (let idx = 0; idx < n; idx++) {
          const v = arr[(idx + D) % CYCLE_LEN];
          if (v === 0) continue;
          if (seen.has(v)) return true;
          seen.add(v);
        }
      }
      return false;
    }
    return check(ROTATION) || check(remapped);
  }

  // Două motive DISTINCTE pt. care o fază T1A/T2A nu poate rămâne T1A/T2A, tratate separat:
  // 1. Formația NU folosește deloc T1A/T2A (config = 0) — atunci acea tură pur și simplu nu
  //    există în programul real al formației, indiferent de zi. Faza cade mereu pe echivalentul
  //    principal (T1A→T1), în FIECARE zi (nu doar weekend) — altfel echipajul pierde o zi
  //    lucrătoare întreagă de fiecare dată când ciclul îi cere o tură care nu există (bug găsit
  //    la audit: cu T1A/T2A=0 — configurația implicită a aplicației — modul „Rotație 8 zile"
  //    pierdea ~56h/lună/persoană, cu T1/T2 configurate și capacitate liberă).
  // 2. Formația FOLOSEȘTE T1A/T2A în timpul săptămânii (config > 0), dar tura e blocată STRUCTURAL
  //    doar sâmbătă/duminică (regulă de business, independentă de config) — faza cade pe
  //    echivalentul principal DOAR în weekend, ca înainte.
  // În ambele cazuri, fallback-ul nu inventează cerere unde nu exista una reală: dacă și T1A ȘI T1
  // sunt 0, rămâne L (nimic de redirecționat spre).
  const phaseFallback = (sv, cat) => {
    const c = cfgs[cat] || {};
    if (sv === 3) {
      if ((c.t1a || 0) === 0) return (c.t1 || 0) > 0 ? 1 : sv;
      if (weekend) return 1;
    }
    if (sv === 4) {
      if ((c.t2a || 0) === 0) return (c.t2 || 0) > 0 ? 2 : sv;
      if (weekend) return 2;
    }
    return sv;
  };

  // Rotația de fază (idx/block) se calculează SEPARAT per categorie (urban/rural). Limitele
  // numerice sunt per-categorie — dacă idx s-ar calcula pe lista combinată urban+rural, numărul
  // de „competitori" (nCrews) ar fi greșit (ex. 10 în loc de 5) și ar strica matematica de
  // anti-coliziune derivată pentru dimensiunea reală a fiecărui grup.

  // Rotația de bloc e necesară DOAR când există coliziune structurală reală (`ROTATION` repetă
  // aceeași tură pe poziții din intervalul [0,n) — vezi `hasCollision`). Când NU există coliziune,
  // idx rămâne fix (i) — fiecare echipaj ține un ciclu perfect continuu T1→T2→L→..., iar `absDay`
  // asigură continuitatea peste granițele de lună. Când EXISTĂ coliziune, blocul (bazat tot pe
  // `absDay`, continuu) se decalează la fiecare CYCLE_LEN zile, rotind perechea care se ciocnește.
  function blockFor(n, cat) { return hasCollision(n, cat) ? blockAbs : 0; }

  // Pass 1: complete crews by crew rotation, prioritizate după ore acumulate la conflict
  const crewWants = [];
  GROUPS.forEach(cat => {
    const catCrews = fullCrews.filter(c => (c[0].category || 'urban') === cat);
    const n = catCrews.length;
    const catBlock = blockFor(n, cat);
    catCrews.forEach((crew, i) => {
      const idx = n > 0 ? (i + catBlock) % n : i;
      crewWants.push({ crew, sv: phaseFallback(ROTATION[(idx + absDay) % CYCLE_LEN], cat) });
    });
  });
  crewWants.sort((a, b) => hoursOf(a.crew) - hoursOf(b.crew) || a.crew[0].id - b.crew[0].id);
  crewWants.forEach(w => doAssign(w.crew, w.sv));

  // Spillover: dacă un echipaj/individ a vrut T1 sau T2 dar a fost respins (capacitatea acelei
  // ture era deja ocupată), încearcă tura alternativă (T1↔T2) înainte să rămână fără nimic.
  // Necesar când T1/T2 au capacități ASIMETRICE (ex. T1=4, T2=2) — ciclul de rotație poate
  // trimite într-o zi mai multe echipaje spre T2 decât încape, lăsând T1 parțial gol în timp ce
  // echipajele respinse de la T2 rămân pe L, deși ar fi putut umple T1. `doAssign` verifică
  // oricum toate regulile (capacitate, gap, MAX_CONSEC), deci încercarea e sigură.
  function spillover(list, sv) {
    if (sv !== 1 && sv !== 2) return;
    if (state.schedule[dk][String(list[0].id)] !== undefined) return;
    doAssign(list, sv === 1 ? 2 : 1);
  }
  crewWants.forEach(w => spillover(w.crew, w.sv));

  // Pass 2: individuals by individual rotation, aceeași regulă de fairness, tot separat per categorie
  const indivWants = [];
  GROUPS.forEach(cat => {
    const catIndiv = individuals.filter(e => (e.category || 'urban') === cat);
    const n = catIndiv.length;
    const catBlock = blockFor(n, cat);
    catIndiv.forEach((emp, i) => {
      const idx = n > 0 ? (i + catBlock) % n : i;
      indivWants.push({ emp, sv: phaseFallback(ROTATION[(idx + absDay) % CYCLE_LEN], cat) });
    });
  });
  indivWants.sort((a, b) => hoursOf([a.emp]) - hoursOf([b.emp]) || a.emp.id - b.emp.id);
  indivWants.forEach(w => doAssign([w.emp], w.sv));
  indivWants.forEach(w => spillover([w.emp], w.sv));
}

// Reconstruiește genStats DIRECT din state.schedule (sursa de adevăr), pentru zilele
// 1..uptoDayExclusive-1 ale lunii date. Unică sursă folosită de startGeneration/prevDay/
// generateNextDay/generateAll — înainte exista logica DUPLICATĂ, ușor divergentă (varianta din
// startGeneration seta `yesterday` doar dacă `v>0`, lăsând-o stale pe zilele L; varianta din
// prevDay era corectă). Iterează TOȚI angajații curenți (nu doar cheile prezente în ziua
// respectivă), ca o zi lipsă/incompletă să reseteze corect `consec`, nu doar s-o sară.
function rebuildGenStats(year, month, uptoDayExclusive) {
  const gs = {};
  state.employees.forEach(e => { gs[e.id] = { total: 0, t1: 0, t2: 0, t1a: 0, t2a: 0, c8: 0, inst: 0, yesterday: null, consec: 0 }; });
  for (let d = 1; d < uptoDayExclusive; d++) {
    const dk = dateKey(year, month, d);
    const dayData = state.schedule[dk] || {};
    state.employees.forEach(e => {
      const v = dayData[String(e.id)];
      const s = gs[e.id];
      if (v === 1) { s.t1++; s.total++; }
      else if (v === 2) { s.t2++; s.total++; }
      else if (v === 3) { s.t1a++; s.total++; }
      else if (v === 4) { s.t2a++; s.total++; }
      else if (v === 7) { s.c8++; s.total++; }
      else if (v === 8) { s.inst++; s.total++; }
      s.yesterday = v !== undefined ? v : null;
      if (v >= 1 && v <= 4 || v === 7 || v === 8) { s.consec++; } else { s.consec = 0; }
    });
  }
  return gs;
}

function catLabel(c) { return { urban: 'Urban', rural: 'Rural' }[c] || c; }

function catShort(c) { return { urban: 'U', rural: 'R' }[c] || '?'; }

const HELP_DEFAULT_MODE = 'exp';

function workingDays(y, m) {
  const dim = daysInMonth(y, m);
  const prefix = y + '-' + pad(m);
  const holidaySet = new Set(getLegalHolidays(y).filter(h => h.date.startsWith(prefix)).map(h => h.date));
  if (holidaySet.size === 0 && getLegalHolidays(y).length === 0) return null; // y în afara 1900-2099
  let wd = 0;
  for (let d = 1; d <= dim; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow === 0 || dow === 6) continue;
    if (holidaySet.has(dateKey(y, m, d))) continue;
    wd++;
  }
  return wd;
}

function renderSummary() {
  const container = document.getElementById('summary');
  if (state.employees.length === 0) { container.innerHTML = ''; return; }
  const wd = workingDays(state.currentYear, state.currentMonth);
  const expected = expectedHours(state.currentYear, state.currentMonth);
  const mn = getMonthName(state.currentMonth);
  const sectionStyle = 'display:flex;align-items:center;gap:8px;margin:14px 0 6px;cursor:pointer;user-select:none';
  const btnStyle = 'background:none;border:none;font-size:12px;cursor:pointer;color:var(--text-muted);padding:2px 6px;border-radius:4px;border:1px solid var(--border)';
  let html = '';
  if (wd !== null) {
    html += '<div style="font-size:13px;color:var(--text);padding:6px 10px;background:var(--ctrl-bg);border-radius:6px;display:inline-block">📅 ' + mn + ' ' + state.currentYear + ' — <strong>' + wd + ' zile lucrătoare</strong> = <strong>' + expected + 'h</strong> normă/electrician</div>';
  }
  // Secțiunea Carduri
  const cardsOpen = summaryCardsOpen;
  html += '<div style="' + sectionStyle + '" onclick="toggleSummarySection(\'sum-cards\')">'
    + '<button id="sum-cards-btn" style="' + btnStyle + '">' + (cardsOpen ? '▼' : '▶') + '</button>'
    + '<span style="font-size:14px;font-weight:700;color:var(--heading)">Carduri electricieni</span>'
    + '</div>';
  html += '<div id="sum-cards" style="display:' + (cardsOpen ? '' : 'none') + '">';
  html += '<div class="summary-grid">';
  state.employees.forEach(emp => {
    const st = getEmployeeStats(emp.id);
    const cat = emp.category || 'urban';
    const effExpected = effectiveExpected(expected, st);
    const verdict = classifyHours(st.hours, effExpected);
    const pct = effExpected !== null ? Math.min(100, Math.round((st.hours / effExpected) * 100)) : null;
    let cardCls = 'emp-card';
    if (verdict === 'warn') cardCls += ' warn';
    else if (verdict === 'over' || verdict === 'under') cardCls += ' bad';
    const pills = [];
    if (st.t1)  pills.push('<span class="shift-pill pill-t1">T1 ×' + st.t1 + '</span>');
    if (st.t2)  pills.push('<span class="shift-pill pill-t2">T2 ×' + st.t2 + '</span>');
    if (st.t1a) pills.push('<span class="shift-pill pill-t1a">T1A ×' + st.t1a + '</span>');
    if (st.t2a) pills.push('<span class="shift-pill pill-t2a">T2A ×' + st.t2a + '</span>');
    if (st.c8)  pills.push('<span class="shift-pill pill-c8">8h ×' + st.c8 + '</span>');
    if (st.inst) pills.push('<span class="shift-pill" style="padding:2px 6px;font-size:10px;border-radius:4px;background:#d5f5e3;color:#1a7a3a;font-weight:600">INST ×' + st.inst + '</span>');
    if (st.co)  pills.push('<span class="shift-pill pill-co">CO ×' + st.co + '</span>');
    if (st.cm)  pills.push('<span class="shift-pill pill-cm">CM ×' + st.cm + '</span>');
    const holCount = holidayShiftsCount(emp.id, state.currentYear, state.currentMonth);
    if (holCount) pills.push('<span class="shift-pill" style="background:var(--holiday-bg);color:var(--holiday-text)">🎉 Sărb. ×' + holCount + '</span>');
    html += '<div class="' + cardCls + '">'
      + '<div class="emp-card-header"><span class="cat-badge cat-' + cat + '" style="margin-left:0">' + catShort(cat) + '</span><span class="emp-card-name">' + esc(emp.name) + (emp.forced8 ? ' <span class="forced-badge">F</span>' : '') + '</span></div>'
      + '<div class="emp-card-hours"><strong>' + st.hours + 'h</strong>' + (effExpected !== null ? ' / ' + effExpected + 'h (' + pct + '%)' : ' — normă necunoscută') + '</div>'
      + '<div class="shift-pills">' + (pills.length ? pills.join('') : '<span style="color:var(--empty);font-size:11px">—</span>') + '</div>'
      + '</div>';
  });
  html += '</div></div>'; // închide summary-grid + sum-cards

  // Tabel statistici detaliate
  const fnLabel = e => FUNC_NAMES[e.functia||'emitent'];
  const groups = GROUPS;
  const tableOpen = summaryTableOpen;
  html += '<div style="' + sectionStyle + '" onclick="toggleSummarySection(\'sum-table\')">'
    + '<button id="sum-table-btn" style="' + btnStyle + '">' + (tableOpen ? '▼' : '▶') + '</button>'
    + '<span style="font-size:14px;font-weight:700;color:var(--heading)">Statistici ture — ' + mn + ' ' + state.currentYear + '</span>'
    + '</div>';
  html += '<div id="sum-table" style="display:' + (tableOpen ? '' : 'none') + '">';
  html += '<table class="stat-table"><thead><tr>'
    + '<th style="text-align:left">Nume Prenume</th>'
    + '<th>Funcția</th><th>Echipaj</th>'
    + '<th title="Tura 1">T1</th><th title="Tura 2">T2</th>'
    + '<th title="Tura 1 Alternativă">T1A</th><th title="Tura 2 Alternativă">T2A</th>'
    + '<th title="8 ore">8h</th>'
    + '<th title="Instruire">INST</th>'
    + '<th title="Concediu Odihnă (zile lucrătoare)">CO</th>'
    + '<th title="Concediu Medical (zile lucrătoare)">CM</th>'
    + '<th title="Ture lucrate în zile de sărbătoare legală">🎉 Sărb.</th>'
    + '<th title="Ore lucrate efectiv">Lucrate</th>'
    + '<th title="Ore CO+CM">CO/CM</th>'
    + '<th title="Normă lunară">Normă</th>'
    + '<th title="Diferență față de normă">±</th>'
    + '</tr></thead><tbody>';
  groups.forEach(g => {
    const gEmps = state.employees.filter(e => (e.category||'urban') === g && !e.forced8);
    if (!gEmps.length) return;
    html += '<tr class="stat-group-header"><td colspan="16">' + (g==='urban'?'Urban':'Rural') + ' — ' + gEmps.length + ' electricieni</td></tr>';
    gEmps.forEach(emp => {
      const st = getEmployeeStats(emp.id);
      // effExpected scade orele de CO/CM din normă (bug audit: un angajat cu concediu aprobat
      // apărea "-32h" roșu, deși nu are nicio problemă reală) — un singur helper (classifyHours),
      // aceleași reguli ca în tabel și în carduri.
      const effExpected = effectiveExpected(expected, st);
      const diff = effExpected !== null ? st.hours - effExpected : null;
      const diffStr = diff === null ? '—' : (diff === 0 ? '=' : (diff > 0 ? '+'+diff+'h' : diff+'h'));
      const verdict = classifyHours(st.hours, effExpected);
      const rowCls = verdict === 'over' || verdict === 'under' ? 'stat-row-bad' : verdict === 'warn' ? 'stat-row-warn' : 'stat-row-ok';
      const hoursCls = verdict === 'over' || verdict === 'under' ? 'stat-hours-bad' : verdict === 'warn' ? 'stat-hours-warn' : 'stat-hours-ok';
      const cocmH = (st.co + st.cm) * 8;
      const holCount = holidayShiftsCount(emp.id, state.currentYear, state.currentMonth);
      html += '<tr class="' + rowCls + '">'
        + '<td>' + esc(emp.name) + '</td>'
        + '<td><span class="fn-' + (emp.functia||'emitent') + '" style="font-size:11px;padding:1px 6px;border-radius:4px;font-weight:600">' + fnLabel(emp) + '</span></td>'
        + '<td style="font-size:11px;color:var(--text-muted)">' + (emp.crew || '—') + '</td>'
        + '<td>' + (st.t1||'—') + '</td>'
        + '<td>' + (st.t2||'—') + '</td>'
        + '<td>' + (st.t1a||'—') + '</td>'
        + '<td>' + (st.t2a||'—') + '</td>'
        + '<td>' + (st.c8||'—') + '</td>'
        + '<td>' + (st.inst||'—') + '</td>'
        + '<td>' + (st.co||'—') + '</td>'
        + '<td>' + (st.cm||'—') + '</td>'
        + '<td' + (holCount ? ' style="color:var(--holiday-text);font-weight:700"' : '') + '>' + (holCount||'—') + '</td>'
        + '<td class="' + hoursCls + '">' + st.hours + 'h</td>'
        + '<td style="color:var(--text-muted)">' + cocmH + 'h</td>'
        + '<td style="color:var(--text-muted)">' + (effExpected !== null ? effExpected + 'h' : '—') + '</td>'
        + '<td class="' + hoursCls + '">' + diffStr + '</td>'
        + '</tr>';
    });
  });
  const f8Emps = state.employees.filter(e => e.forced8);
  if (f8Emps.length) {
    html += '<tr class="stat-group-header"><td colspan="16">Program 8 ore — ' + f8Emps.length + ' electricieni</td></tr>';
    f8Emps.forEach(emp => {
      const st = getEmployeeStats(emp.id);
      const effExpected = effectiveExpected(expected, st);
      const diff = effExpected !== null ? st.hours - effExpected : null;
      const diffStr = diff === null ? '—' : (diff === 0 ? '=' : (diff > 0 ? '+'+diff+'h' : diff+'h'));
      const verdict = classifyHours(st.hours, effExpected);
      const rowCls = verdict === 'over' || verdict === 'under' ? 'stat-row-bad' : verdict === 'warn' ? 'stat-row-warn' : 'stat-row-ok';
      const hoursCls = verdict === 'over' || verdict === 'under' ? 'stat-hours-bad' : verdict === 'warn' ? 'stat-hours-warn' : 'stat-hours-ok';
      const cocmH = (st.co + st.cm) * 8;
      const holCount = holidayShiftsCount(emp.id, state.currentYear, state.currentMonth);
      html += '<tr class="' + rowCls + '">'
        + '<td>' + esc(emp.name) + '</td>'
        + '<td><span class="fn-' + (emp.functia||'emitent') + '" style="font-size:11px;padding:1px 6px;border-radius:4px;font-weight:600">' + fnLabel(emp) + '</span></td>'
        + '<td style="font-size:11px;color:var(--text-muted)">—</td>'
        + '<td>' + (st.t1||'—') + '</td>'
        + '<td>' + (st.t2||'—') + '</td>'
        + '<td>' + (st.t1a||'—') + '</td>'
        + '<td>' + (st.t2a||'—') + '</td>'
        + '<td>' + (st.c8||'—') + '</td>'
        + '<td>' + (st.inst||'—') + '</td>'
        + '<td>' + (st.co||'—') + '</td>'
        + '<td>' + (st.cm||'—') + '</td>'
        + '<td' + (holCount ? ' style="color:var(--holiday-text);font-weight:700"' : '') + '>' + (holCount||'—') + '</td>'
        + '<td class="' + hoursCls + '">' + st.hours + 'h</td>'
        + '<td style="color:var(--text-muted)">' + cocmH + 'h</td>'
        + '<td style="color:var(--text-muted)">' + (effExpected !== null ? effExpected + 'h' : '—') + '</td>'
        + '<td class="' + hoursCls + '">' + diffStr + '</td>'
        + '</tr>';
    });
  }
  html += '</tbody></table></div>'; // închide sum-table

  container.innerHTML = html;
}

function applyJSON(text) {
  try {
    const data = JSON.parse(text);
    // Detecția de tip nu se poate baza STRICT pe data.type==='month' — fișiere vechi legitime
    // (dinainte de introducerea câmpului type, ex. exporturi cu {employees,config,schedule,
    // currentMonth,currentYear}) nu au deloc type și cădeau pe ramura "backup complet" (state =
    // data), ștergând toate celelalte luni + echipaje custom + org (bug găsit la audit). Doar
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
      // Coliziune de id: dacă fișierul are un electrician cu ACELAȘI id dar NUME diferit față de
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
      // altfel un import de lună mai veche ștergea silențios orice electrician adăugat de atunci
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
    document.getElementById('gen-mode').value = state.genMode || 'full';
    updateModeFieldVisibility();
    saveState();
    document.getElementById('sel-month').value = state.currentMonth || 1;
    document.getElementById('sel-year').value = state.currentYear || new Date().getFullYear();
    GROUPS.forEach(g => {
      const c = state.config[g] || {};
      document.getElementById('cfg-' + g + '-t1').value = c.t1 || 0;
      document.getElementById('cfg-' + g + '-t1a').value = c.t1a || 0;
      document.getElementById('cfg-' + g + '-t2').value = c.t2 || 0;
      document.getElementById('cfg-' + g + '-t2a').value = c.t2a || 0;
      document.getElementById('cfg-' + g + '-c8').value = c.c8 || 0;
    });
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
  if (emps.length === 0) { setStatus('Niciun electrician de exportat.', 'warn'); return; }
  const wd = workingDays(y, m);
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
  const firstDay = 3, lastDay = firstDay + dim - 1;
  const colLucrate = lastDay + 1, colCOCM = lastDay + 2, colHoliday = lastDay + 3, colNorma = lastDay + 4;
  const totalCols = colNorma + 1;
  (async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(mn + ' ' + y, { pageSetup:{ paperSize:13, orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:0 } });
    ws.getColumn(1).width = 22; ws.getColumn(2).width = 11; ws.getColumn(3).width = 7;
    for (let d = 1; d <= dim; d++) ws.getColumn(firstDay + d).width = 4.5;
    ws.getColumn(colLucrate+1).width = 9; ws.getColumn(colCOCM+1).width = 7; ws.getColumn(colHoliday+1).width = 7; ws.getColumn(colNorma+1).width = 7;
    // Logo
    const logoId = wb.addImage({ base64: LOGO_B64, extension: 'png' });
    ws.addImage(logoId, { tl:{ col:0, row:0 }, ext:{ width:160, height:52 } });
    ws.getRow(1).height = 42;
    // Title
    const tc = ws.getCell(1, 4); tc.value = 'Grafic de tură — ' + mn + ' ' + y;
    tc.font = fnt('2C3E50', true, 16); tc.alignment = aln('left','middle');
    ws.mergeCells(1, 4, 1, totalCols);
    // Subtitle
    ws.getRow(2).height = 16;
    const org = getOrg();
    const sc = ws.getCell(2, 4); sc.value = [org.formatia, 'Delgaz Grid S.A'].filter(Boolean).join(' — ');
    sc.font = fnt('7F8C8D', false, 10, true); sc.alignment = aln('left','middle');
    ws.mergeCells(2, 4, 2, totalCols);
    // Norm
    ws.getRow(3).height = 14;
    const nc0 = ws.getCell(3, 1); nc0.value = mn + ' ' + y + ' — ' + (wd||'?') + ' zile lucrătoare = ' + (expected!==null?expected+'h':'? h') + ' normă/electrician';
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
    setHdr(HDR, 1, 'Nume Prenume'); setHdr(HDR, 2, 'Funcția'); setHdr(HDR, 3, 'Echipaj');
    const yearHolidays = new Set(getLegalHolidays(y).map(h => h.date));
    for (let d = 1; d <= dim; d++) {
      const dow = new Date(y, m-1, d).getDay();
      setHdr(HDR, firstDay + d, d + '\n' + DAY_NAMES[dow], dow===0||dow===6, yearHolidays.has(dateKey(y,m,d)));
    }
    setHdr(HDR, colLucrate+1, 'Lucrate'); setHdr(HDR, colCOCM+1, 'CO/CM'); setHdr(HDR, colHoliday+1, 'Sărb.'); setHdr(HDR, colNorma+1, 'Normă');
    // Rows
    let R = HDR + 1;
    GROUPS.forEach(g => {
      const gEmps = emps.filter(e => (e.category||'urban') === g && !e.forced8);
      if (!gEmps.length) return;
      const gc = g==='urban' ? {bg:'D6EAF8',fg:'1A5276'} : {bg:'FDEBD0',fg:'935116'};
      const gLabel = (g==='urban'?'Urban':'Rural') + ' — ' + gEmps.length + ' electricieni';
      ws.getRow(R).height = 16;
      for (let c = 1; c <= totalCols; c++) {
        const cell = ws.getCell(R, c);
        cell.fill = fill(gc.bg); cell.font = fnt(gc.fg, true, 9);
        cell.alignment = aln(c===1?'left':'center','middle');
        if (c === 1) cell.value = gLabel;
      }
      ws.mergeCells(R, 1, R, totalCols); R++;
      gEmps.forEach(emp => {
        const st = getEmployeeStats(emp.id);
        const effExpected = effectiveExpected(expected, st);
        const diff = effExpected !== null ? st.hours - effExpected : 0;
        const hBg = effExpected===null?'F8F9FB':diff===0?'E8F8F0':diff>0?'FDE8E8':diff>=-16?'FFF8E1':'FDE8E8';
        const hFg = effExpected===null?'555555':diff===0?'1A7A3A':diff>0?'C0392B':diff>=-16?'B7770D':'C0392B';
        ws.getRow(R).height = 15;
        const c1=ws.getCell(R,1); c1.value=emp.name; c1.font=fnt('1A1A2E',true,9); c1.fill=fill('FFFFFF'); c1.alignment=aln('left','middle');
        const c2=ws.getCell(R,2); c2.value=FUNC_NAMES[emp.functia||'emitent']; c2.font=fnt('444444',false,8); c2.fill=fill('F8F9FB'); c2.alignment=aln('center','middle');
        const c3=ws.getCell(R,3); c3.value=emp.crew||'—'; c3.font=fnt('888888',false,8); c3.fill=fill('F8F9FB'); c3.alignment=aln('center','middle');
        for (let d = 1; d <= dim; d++) {
          const dow = new Date(y,m-1,d).getDay(), isW = dow===0||dow===6;
          const dk = dateKey(y,m,d);
          const v = getShift(dk, emp.id), rawSv = v!==null?v:0;
          const sv = (isW && (rawSv===5||rawSv===6||rawSv===8)) ? 0 : rawSv;
          const ss = shiftFill[sv], bg = isW&&sv===0?'FCE4E4':ss.bg, fg = isW&&sv===0?'999999':ss.fg;
          const dc = ws.getCell(R, firstDay+d);
          var crewForDay=getCrewForDay(emp,dk);var defCrew=emp.crew||'';
          dc.value=SHIFT_NAMES[sv]+(sv>0&&sv!==5&&sv!==6&&sv!==8&&crewForDay&&crewForDay!==defCrew?' ('+crewForDay+')':'');
          dc.font=fnt(fg,true,8); dc.fill=fill(bg); dc.alignment=aln('center','middle');
          // Chenar auriu pe celulele din zilele de sărbătoare — mirror al td.td-holiday din grafic
          if (yearHolidays.has(dk)) { const hb = { style:'thick', color:{argb:'FFD4A017'} }; dc.border = { top:hb, bottom:hb, left:hb, right:hb }; }
        }
        const lc=ws.getCell(R,colLucrate+1); lc.value=st.hours; lc.font=fnt(hFg,true,9); lc.fill=fill(hBg); lc.alignment=aln('center','middle');
        const cc=ws.getCell(R,colCOCM+1); cc.value=(st.co+st.cm)*8; cc.font=fnt('6C3483',false,9); cc.fill=fill('F5EEF8'); cc.alignment=aln('center','middle');
        const holCount1 = holidayShiftsCount(emp.id, y, m);
        const hcc=ws.getCell(R,colHoliday+1); hcc.value=holCount1||0; hcc.font=fnt(holCount1?'8A6510':'AAAAAA', !!holCount1, 9); hcc.fill=fill(holCount1?'FDF3D0':'F8F9FB'); hcc.alignment=aln('center','middle');
        const nc=ws.getCell(R,colNorma+1); nc.value=expected!==null?expected:'—'; nc.font=fnt('7F8C8D',false,9); nc.fill=fill('F8F9FB'); nc.alignment=aln('center','middle');
        R++;
      });
    });
    const f8Emps = emps.filter(e => e.forced8);
    if (f8Emps.length) {
      const f8Label = 'Program 8 ore — ' + f8Emps.length + ' electricieni';
      ws.getRow(R).height = 16;
      for (let c = 1; c <= totalCols; c++) {
        const cell = ws.getCell(R, c);
        cell.fill = fill('2C3E50'); cell.font = fnt('FFFFFF', true, 9);
        cell.alignment = aln(c===1?'left':'center','middle');
        if (c === 1) cell.value = f8Label;
      }
      ws.mergeCells(R, 1, R, totalCols); R++;
      f8Emps.forEach(emp => {
        const st = getEmployeeStats(emp.id);
        const effExpected = effectiveExpected(expected, st);
        const diff = effExpected !== null ? st.hours - effExpected : 0;
        const hBg = effExpected===null?'F8F9FB':diff===0?'E8F8F0':diff>0?'FDE8E8':diff>=-16?'FFF8E1':'FDE8E8';
        const hFg = effExpected===null?'555555':diff===0?'1A7A3A':diff>0?'C0392B':diff>=-16?'B7770D':'C0392B';
        ws.getRow(R).height = 15;
        const c1=ws.getCell(R,1); c1.value=emp.name; c1.font=fnt('1A1A2E',true,9); c1.fill=fill('FFFFFF'); c1.alignment=aln('left','middle');
        const c2=ws.getCell(R,2); c2.value=FUNC_NAMES[emp.functia||'emitent']; c2.font=fnt('444444',false,8); c2.fill=fill('F8F9FB'); c2.alignment=aln('center','middle');
        const c3=ws.getCell(R,3); c3.value='—'; c3.font=fnt('888888',false,8); c3.fill=fill('F8F9FB'); c3.alignment=aln('center','middle');
        for (let d = 1; d <= dim; d++) {
          const dow = new Date(y,m-1,d).getDay(), isW = dow===0||dow===6;
          // Lipsea maparea de weekend (CO/CM/INST -> L) pe care bucla principală de mai sus deja
          // o aplică — un angajat Forțat 8h cu CO/CM/INST manual pe weekend apărea colorat/
          // etichetat ca atare în Excel, în loc de L (bug găsit la audit).
          const dk2 = dateKey(y,m,d);
          const v = getShift(dk2, emp.id), rawSv = v!==null?v:0;
          const sv = (isW && (rawSv===5||rawSv===6||rawSv===8)) ? 0 : rawSv;
          const ss = shiftFill[sv], bg = isW&&sv===0?'FCE4E4':ss.bg, fg = isW&&sv===0?'999999':ss.fg;
          const dc = ws.getCell(R, firstDay+d);
          dc.value=SHIFT_NAMES[sv]; dc.font=fnt(fg,true,8); dc.fill=fill(bg); dc.alignment=aln('center','middle');
          if (yearHolidays.has(dk2)) { const hb = { style:'thick', color:{argb:'FFD4A017'} }; dc.border = { top:hb, bottom:hb, left:hb, right:hb }; }
        }
        const lc=ws.getCell(R,colLucrate+1); lc.value=st.hours; lc.font=fnt(hFg,true,9); lc.fill=fill(hBg); lc.alignment=aln('center','middle');
        const cc=ws.getCell(R,colCOCM+1); cc.value=(st.co+st.cm)*8; cc.font=fnt('6C3483',false,9); cc.fill=fill('F5EEF8'); cc.alignment=aln('center','middle');
        const holCount2 = holidayShiftsCount(emp.id, y, m);
        const hcc2=ws.getCell(R,colHoliday+1); hcc2.value=holCount2||0; hcc2.font=fnt(holCount2?'8A6510':'AAAAAA', !!holCount2, 9); hcc2.fill=fill(holCount2?'FDF3D0':'F8F9FB'); hcc2.alignment=aln('center','middle');
        const nc=ws.getCell(R,colNorma+1); nc.value=expected!==null?expected:'—'; nc.font=fnt('7F8C8D',false,9); nc.fill=fill('F8F9FB'); nc.alignment=aln('center','middle');
        R++;
      });
    }
    R++;
    ws.getRow(R).height = 22;
    var lc=ws.getCell(R,1); lc.value='Legendă:'; lc.font=fnt('2C3E50',true,10);
    ws.mergeCells(R,1,R,2);
    var li=[['T1 / T1A  06-14','D6EAF8','1A5276'],['T2 / T2A  14-22','FDEBD0','935116'],['8h  08-16','F0F4F8','2C3E50'],['INST  Instruire','D5F5E3','1A7A3A'],['CO  Concediu','E8D5F5','6C3483'],['CM  Medical','E8E8E8','555555'],['L  Liber','F0F0F0','666666']];
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
    const org2 = getOrg();
    const sefCoreXls = 'Aprobat Șef CORE' + (org2.judet ? ' ' + org2.judet : '');
    const sigs=[[' Șef FOL EM', org2.sefFOL||'—'],['Responsabil Tehnic', org2.responsabilTehnic||'—'],[sefCoreXls, org2.aprobat||'—']];
    const step = Math.floor(totalCols/3);
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

// ── Analiză moduri ──────────────────────────────────────────────────────
// Simulează pe rând toate cele 4 moduri de generare, pentru luna selectată
// curent, folosind exact motorul real de generare (generateDay), pe o copie
// izolată a state.schedule/genStats — starea reală nu e atinsă (backup +
// restore complet la final, saveState() dezactivat temporar cât timp rulează
// simulările, ca autosave-ul din generateDay() să nu scrie variante
// intermediare peste datele reale din localStorage/IndexedDB).
function groupByEffectiveCrew(emps, dk) {
  const groups = {};
  emps.forEach(e => {
    const key = getCrewForDay(e, dk) || ('__' + e.id);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  return groups;
}

function computeCategoryAnalysis(cat, year, month, dim) {
  const catEmps = state.employees.filter(e => (e.category || 'urban') === cat && !e.forced8);
  if (catEmps.length === 0) return null;
  const staticCrews = {};
  catEmps.forEach(e => { const k = e.crew || ('__' + e.id); (staticCrews[k] = staticCrews[k] || []).push(e); });
  const fullCrewCount = Object.values(staticCrews).filter(c => c.length >= 2).length;
  const soloCount = Object.values(staticCrews).filter(c => c.length === 1).length;

  let totalWorked = 0, totalGroupDays = 0, fullUtilDays = 0;
  for (let d = 1; d <= dim; d++) {
    const dk = dateKey(year, month, d);
    const dayGroups = groupByEffectiveCrew(catEmps, dk);
    const vals = Object.values(dayGroups);
    let worked = 0, available = 0;
    vals.forEach(g => {
      const memberVals = g.map(e => state.schedule[dk] ? state.schedule[dk][String(e.id)] : undefined);
      // Un echipaj integral în CO/CM azi nu era niciodată DISPONIBIL — nu ar trebui să scadă
      // utilizarea raportată (numitorul), la fel cum un om în concediu legal nu e o "capacitate
      // irosită". Fără asta, utilPct arăta mai rău decât realitatea de fiecare dată când exista
      // concediu în echipă (bug găsit la audit).
      const allOnLeave = memberVals.every(v => v === 5 || v === 6);
      if (allOnLeave) return;
      available++;
      // "activ" = CEL PUȚIN un membru lucrează, nu doar primul din listă — un echipaj cu
      // membri pe ture diferite (split legitim, ex. capacitate impară față de mărimea echipajului)
      // era raportat greșit ca inactiv dacă tocmai primul membru avea L (bug găsit la audit).
      if (memberVals.some(v => v >= 1 && v <= 4)) worked++;
    });
    totalWorked += worked;
    totalGroupDays += available;
    if (available > 0 && worked === available) fullUtilDays++;
  }
  const utilPct = totalGroupDays > 0 ? (totalWorked / totalGroupDays * 100) : 0;
  const avgPerDay = totalWorked / dim;

  // conflicte reale: max 4 consecutive, max 5/săptămână, gap T2->T1/T1A. Citește și zilele
  // dinaintea zilei 1 (din luna reală anterioară, dacă a fost vreodată generată) pt. săptămâna
  // care traversează granița de lună — altfel o violare reală, ce se întinde peste graniță, nu
  // era niciodată văzută de analiză (bug găsit la audit; generatorul real deja face asta corect).
  const violations = [];
  const readV = (empId, y, m, d) => {
    if (d < 1) { const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y; const pdim = daysInMonth(py, pm); d += pdim; m = pm; y = py; }
    const dk = dateKey(y, m, d);
    return state.schedule[dk] ? state.schedule[dk][String(empId)] : undefined;
  };
  catEmps.forEach(emp => {
    let consec = 0, maxConsec = 0, prevV = null;
    for (let d = 1; d <= dim; d++) {
      const v = readV(emp.id, year, month, d);
      const worked = (v >= 1 && v <= 4) || v === 7 || v === 8;
      if (worked) { consec++; maxConsec = Math.max(maxConsec, consec); } else { consec = 0; }
      if (prevV === 2 && (v === 1 || v === 3)) violations.push('gap');
      prevV = v;
    }
    if (maxConsec > 4) violations.push('consec');
    const weekStarts = new Set();
    for (let d = 1; d <= dim; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      weekStarts.add(d + (dow === 0 ? -6 : 1 - dow));
    }
    weekStarts.forEach(ws => {
      let wc = 0;
      for (let dd = ws; dd <= ws + 6; dd++) {
        const v2 = readV(emp.id, year, month, dd);
        if ((v2 >= 1 && v2 <= 4) || v2 === 7 || v2 === 8) wc++;
      }
      if (wc > 5) violations.push('weekly');
    });
  });

  const hoursArr = catEmps.map(e => getEmployeeStats(e.id).hours);
  return {
    fullCrewCount, soloCount, avgPerDay, utilPct, fullUtilDays, dim,
    minH: Math.min(...hoursArr), maxH: Math.max(...hoursArr), spread: Math.max(...hoursArr) - Math.min(...hoursArr),
    violations: violations.length
  };
}

const ANALYZE_MODES = [
  { key: 'full', label: '1) T1/T2 + T1A/T2A' },
  { key: 't12', label: '2) Zilnic T1/T2' },
  { key: 'rotation', label: '3) Rotație 8 zile' },
  { key: 'rotation3', label: '4) Rotație T1-T2-L' }
];

function analyzeModes() {
  if (state.employees.length === 0) { setStatus('Adaugă cel puțin un electrician pentru analiză.', 'warn'); return; }
  const year = state.currentYear, month = state.currentMonth;
  const dim = daysInMonth(year, month);
  const cfgs = {};
  GROUPS.forEach(g => cfgs[g] = readConfig(g));

  const backup = {
    schedule: JSON.parse(JSON.stringify(state.schedule)),
    genStats: genStats ? JSON.parse(JSON.stringify(genStats)) : null,
    genDay, genYear, genMonth, genDim,
    genCOCM: JSON.parse(JSON.stringify(genCOCM)),
    genMode: state.genMode
  };
  // CO/CM deja introduse manual în graficul REAL al lunii curente trebuie respectate în
  // simulare — altfel analiza răspunde la întrebarea greșită ("dacă nimeni nu ar fi în
  // concediu"), nu la cea reală ("cu concediile/lipsurile deja introduse"). Se extrag din
  // backup ÎNAINTE de a goli state.schedule, apoi se re-seedează ca genCOCM la fiecare mod —
  // generateDay() le tratează la fel ca orice CO/CM preexistent (inclusiv extensia de weekend).
  const realCOCM = {};
  for (const dk in backup.schedule) {
    for (const eid in backup.schedule[dk]) {
      const v = backup.schedule[dk][eid];
      if (v === 5 || v === 6) { if (!realCOCM[dk]) realCOCM[dk] = {}; realCOCM[dk][eid] = v; }
    }
  }
  const realSaveState = saveState;
  saveState = function () { return Promise.resolve(); };

  const perMode = {};
  try {
    ANALYZE_MODES.forEach(({ key: mode }) => {
      state.schedule = {};
      genCOCM = JSON.parse(JSON.stringify(realCOCM));
      state.genMode = mode;
      genYear = year; genMonth = month; genDim = dim; genDay = 0;
      genStats = {};
      state.employees.forEach(e => { genStats[e.id] = { total: 0, t1: 0, t2: 0, t1a: 0, t2a: 0, c8: 0, inst: 0, yesterday: null, consec: 0 }; });
      for (let d = 1; d <= dim; d++) generateDay(d);
      const byCat = {};
      GROUPS.forEach(cat => { byCat[cat] = computeCategoryAnalysis(cat, year, month, dim); });
      perMode[mode] = byCat;
    });
  } finally {
    state.schedule = backup.schedule;
    genStats = backup.genStats;
    genDay = backup.genDay; genYear = backup.genYear; genMonth = backup.genMonth; genDim = backup.genDim;
    genCOCM = backup.genCOCM;
    state.genMode = backup.genMode;
    saveState = realSaveState;
    const sel = document.getElementById('gen-mode');
    if (sel) sel.value = backup.genMode;
    saveState();
    render();
  }
  renderAnalyzeModal(perMode, year, month);
}

function renderAnalyzeModal(perMode, year, month) {
  let html = '<p style="color:var(--text-muted);margin-bottom:14px">Simulare pe baza electricienilor și configurației curente (Urban/Rural), pentru <strong>' + getMonthName(month) + ' ' + year + '</strong> — respectă CO/CM deja introduse manual în graficul real. Graficul real nu este modificat.</p>';
  GROUPS.forEach(cat => {
    const rows = ANALYZE_MODES.map(m => ({ ...m, stats: perMode[m.key][cat] }));
    if (!rows[0].stats) return;
    const best = rows.reduce((a, b) => (b.stats.utilPct > a.stats.utilPct ? b : a), rows[0]);
    const gc = cat === 'urban' ? { bg: 'D6EAF8', fg: '1A5276' } : { bg: 'FDEBD0', fg: '935116' };
    html += '<div style="margin-bottom:18px">';
    html += '<div style="font-weight:700;font-size:13px;margin-bottom:6px;color:var(--heading)">' + (cat === 'urban' ? 'Urban' : 'Rural') + ' — ' + rows[0].stats.fullCrewCount + ' echipaje complete' + (rows[0].stats.soloCount ? ' + ' + rows[0].stats.soloCount + ' individuali' : '') + '</div>';
    html += '<table class="stat-table"><thead><tr>';
    html += '<th data-tooltip="Modul de generare simulat — vezi manualul pentru detalii despre fiecare algoritm">Mod</th>';
    html += '<th data-tooltip="Media echipajelor/persoanelor care lucrează efectiv pe zi (media pe toată luna) — cu cât mai mare, cu atât capacitatea e mai bine folosită">Echipaje active/zi</th>';
    html += '<th data-tooltip="% din zile-echipaj disponibile (excluzând echipajele integral în CO/CM) în care cel puțin un membru a lucrat efectiv">Utilizare</th>';
    html += '<th data-tooltip="Numărul de zile din lună în care TOATE echipajele disponibile au fost active simultan, din totalul zilelor lunii">Zile cu toate echipajele</th>';
    html += '<th data-tooltip="Orele lucrate cele mai mici, respectiv cele mai mari, dintre toți electricienii categoriei, la finalul lunii simulate">Ore min–max</th>';
    html += '<th data-tooltip="Diferența dintre orele maxime și minime (max − min) — cu cât mai mic, cu atât distribuția e mai echitabilă între electricieni">Spread</th>';
    html += '<th data-tooltip="Număr de reguli încălcate: peste 4 zile consecutive lucrate, peste 5 zile/săptămână, sau gap T2→T1/T1A nerespectat">Conflicte</th>';
    html += '</tr></thead><tbody>';
    rows.forEach(r => {
      const s = r.stats;
      const isBest = r.key === best.key;
      html += '<tr class="' + (isBest ? 'stat-row-ok' : '') + '" style="' + (isBest ? 'outline:2px solid var(--accent);outline-offset:-2px' : '') + '">';
      html += '<td style="text-align:left;white-space:normal;overflow:visible;text-overflow:clip">' + esc(r.label) + (isBest ? ' <span class="shift-pill pill-t1" style="margin-left:4px">recomandat</span>' : '') + '</td>';
      html += '<td data-tooltip="' + s.avgPerDay.toFixed(2) + ' echipaje/persoane active în medie pe zi, din ' + s.fullCrewCount + (s.soloCount ? ' echipaje + ' + s.soloCount + ' individuali' : ' echipaje') + '">' + s.avgPerDay.toFixed(2) + '</td>';
      html += '<td class="' + (s.utilPct >= 70 ? 'stat-hours-ok' : s.utilPct >= 50 ? 'stat-hours-warn' : 'stat-hours-bad') + '" data-tooltip="' + s.utilPct.toFixed(1) + '% din zilele-echipaj disponibile au avut activitate — ≥70% bine, 50–70% acceptabil, sub 50% slab">' + s.utilPct.toFixed(1) + '%</td>';
      html += '<td data-tooltip="' + s.fullUtilDays + ' din ' + s.dim + ' zile ale lunii au avut toate echipajele disponibile active simultan">' + s.fullUtilDays + '/' + s.dim + '</td>';
      html += '<td data-tooltip="Electricianul cu cele mai puține ore a lucrat ' + s.minH + 'h, cel cu cele mai multe ' + s.maxH + 'h, la finalul lunii simulate">' + s.minH + 'h – ' + s.maxH + 'h</td>';
      html += '<td data-tooltip="Diferență de ' + s.spread + 'h între cel mai încărcat și cel mai puțin încărcat electrician — cu cât mai mic, cu atât mai echitabil">' + s.spread + 'h</td>';
      html += '<td class="' + (s.violations ? 'stat-hours-bad' : 'stat-hours-ok') + '" data-tooltip="' + (s.violations ? s.violations + ' încălcări de reguli (consecutive/săptămânal/gap T2→T1)' : 'Nicio încălcare de regulă detectată') + '">' + (s.violations || '—') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  });
  document.getElementById('analyze-body').innerHTML = html;
  document.getElementById('analyze-modal').style.display = 'flex';
}

function closeAnalyzeModal() {
  document.getElementById('analyze-modal').style.display = 'none';
}

function getOrg() {
  const stored = loadOrg();
  if (stored) return Object.assign({ formatia: '', sefFOL: '', responsabilTehnic: '', aprobat: '', judet: '' }, stored);
  return Object.assign({ formatia: '', sefFOL: '', responsabilTehnic: '', aprobat: '', judet: '' }, state.org || {});
}

function applyOrgToDOM() {
  const org = getOrg();
  const subtitle = document.getElementById('org-subtitle');
  if (subtitle) subtitle.textContent = [org.formatia, 'Delgaz Grid S.A'].filter(Boolean).join(' — ');
  document.title = 'Grafic de tură' + (org.formatia ? ' — ' + org.formatia : '') + ' - Delgaz Grid S.A';
  // esc() (deja folosit pt. nume electricieni în renderTable) — org.* poate veni dintr-un fișier
  // JSON importat de la altcineva; fără escape, innerHTML nesigur = XSS stocat la reload (bug
  // găsit la audit: applyJSON poate seta ORG_KEY din data.org la import de lună).
  const sigSef = document.getElementById('sig-sef');
  if (sigSef) sigSef.innerHTML = 'Șef FOL EM<br>' + esc(org.sefFOL || '—');
  const sigResp = document.getElementById('sig-resp');
  if (sigResp) sigResp.innerHTML = 'Responsabil Tehnic<br>' + esc(org.responsabilTehnic || '—');
  const sigAprobat = document.getElementById('sig-aprobat');
  const sefCoreLabel = 'Șef CORE' + (org.judet ? ' ' + esc(org.judet) : '');
  if (sigAprobat) sigAprobat.innerHTML = 'Aprobat<br>' + sefCoreLabel + '<br>' + esc(org.aprobat || '—');
}

function openOrgModal() {
  const org = getOrg();
  document.getElementById('org-formatia').value = org.formatia;
  document.getElementById('org-sef').value = org.sefFOL;
  document.getElementById('org-resp').value = org.responsabilTehnic;
  document.getElementById('org-judet').value = org.judet;
  document.getElementById('org-aprobat').value = org.aprobat;
  document.getElementById('org-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('org-formatia').focus(), 50);
}

function saveOrgSettings() {
  const org = {
    formatia: document.getElementById('org-formatia').value.trim(),
    sefFOL: document.getElementById('org-sef').value.trim(),
    responsabilTehnic: document.getElementById('org-resp').value.trim(),
    judet: document.getElementById('org-judet').value.trim(),
    aprobat: document.getElementById('org-aprobat').value.trim()
  };
  saveOrg(org);
  state.org = org;
  saveState();
  applyOrgToDOM();
  closeOrgModal();
  setStatus('Setări organizație salvate.', 'success');
}

function updateModeFieldVisibility() {
  // T1A/T2A sunt relevante doar in modurile care le pot folosi automat: T1/T2+T1A/T2A
  // ("full") si Rotatie 8 zile ("rotation"). In "t12" (Zilnic T1/T2) sunt ignorate complet
  // de algoritm (raman doar pt editare manuala pe celule), iar in "rotation3" nu exista deloc.
  const usesTA = state.genMode === 'full' || state.genMode === 'rotation';
  document.querySelectorAll('.ta-field').forEach(el => { el.style.display = usesTA ? '' : 'none'; });
  // c8 (8h) e alocat automat doar in full/t12 (assignCategoryShifts) — modurile de rotatie
  // (3/4) nu au deloc logica de c8, ascunde campul acolo ca sa nu para configurabil fara efect
  // (bug audit: campul ramanea vizibil peste tot, dar t12 il ignora silentios pana la fixul de mai sus).
  const usesC8 = state.genMode === 'full' || state.genMode === 't12';
  document.querySelectorAll('.c8-field').forEach(el => { el.style.display = usesC8 ? '' : 'none'; });
}

// Selector de modul: Exploatare rămâne aici, Dispecer redirecționează la aplicația separată.
function switchApp(v) {
  if (v === 'dispecer') window.location.href = 'dispecer.html';
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
    if (!state.genMode) state.genMode = 't12'; // consecvent cu defaultState() (bug audit)
    // migrate org from state to dedicated ORG_KEY if not yet migrated
    if (!loadOrg() && state.org && state.org.sefFOL) saveOrg(state.org);
    document.getElementById('gen-mode').value = state.genMode;
    // Sincronizează inputurile de configurare (T1/T1A/T2/T2A/8h) cu state.config salvat —
    // lipsea complet la încărcarea normală a paginii (doar importul de backup complet o
    // făcea). Inputurile reveneau la valorile hardcodate din HTML (T1A/T2A=0) la fiecare
    // reload, chiar dacă graficul deja generat folosea o altă capacitate — panoul de
    // configurare mințea vizual, nelegat de ce era efectiv salvat sau folosit la generare.
    GROUPS.forEach(g => {
      const c = (state.config && state.config[g]) || {};
      document.getElementById('cfg-' + g + '-t1').value = c.t1 ?? 2;
      document.getElementById('cfg-' + g + '-t1a').value = c.t1a ?? 0;
      document.getElementById('cfg-' + g + '-t2').value = c.t2 ?? 2;
      document.getElementById('cfg-' + g + '-t2a').value = c.t2a ?? 0;
      document.getElementById('cfg-' + g + '-c8').value = c.c8 ?? 0;
    });
    updateModeFieldVisibility();
    applyOrgToDOM();
    render();
    updateButtons();
    if (dbEl) dbEl.textContent = loaded ? '💾 IndexedDB: date încărcate' : '💾 IndexedDB: date noi';
    checkVersion();
    const org = getOrg();
    if (!org.sefFOL && !org.responsabilTehnic && !org.aprobat) openOrgModal();
  }).catch(e => {
    GROUPS.forEach(g => {
      const c = (state.config && state.config[g]) || {};
      document.getElementById('cfg-' + g + '-t1').value = c.t1 ?? 2;
      document.getElementById('cfg-' + g + '-t1a').value = c.t1a ?? 0;
      document.getElementById('cfg-' + g + '-t2').value = c.t2 ?? 2;
      document.getElementById('cfg-' + g + '-t2a').value = c.t2a ?? 0;
      document.getElementById('cfg-' + g + '-c8').value = c.c8 ?? 0;
    });
    render();
    updateButtons();
    applyOrgToDOM();
    if (dbEl) dbEl.textContent = '💾 IndexedDB: eroare';
  });
});
