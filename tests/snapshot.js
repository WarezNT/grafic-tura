/* Test de „instantanee" pentru refactor: rulează scenarii deterministe în aplicația deschisă
 * (index.html SAU dispecer.html) și întoarce hash-uri ale graficului generat și ale interfeței.
 * Două versiuni ale codului sunt echivalente dacă hash-urile ies identice.
 *
 * Utilizare (în Browser pane, pagina servită prin http://, ex. python -m http.server):
 *   eval(await (await fetch('/tests/snapshot.js')).text()); JSON.stringify(await runSnapshot())
 */
async function runSnapshot() {
  const out = {};
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  const canon = o => Array.isArray(o) ? o.map(canon) : (o && typeof o === 'object') ? Object.keys(o).sort().reduce((a, k) => (a[k] = canon(o[k]), a), {}) : o;
  const isDisp = typeof assignDispecerShifts === 'function';
  const P = n => String(n).padStart(2, '0');
  window.confirm = () => true;
  const $ = id => document.getElementById(id);

  // organizație fixă, ca interfața să fie deterministă
  const orgBase = { formatia: 'Formația Test', sefFOL: 'Ion Sef', responsabilTehnic: 'Maria Resp', aprobat: 'Dan Aprobat', judet: 'Neamț' };
  saveOrg(isDisp ? { ...orgBase, entitate: 'Delgaz Grid S.A', labels: {}, off: {}, configured: true } : orgBase);
  applyOrgToDOM();

  const snapUI = name => {
    render();
    const g = id => ($(id) ? $(id).innerHTML : '');
    out[name] = {
      sched: hash(JSON.stringify(canon(state.schedule))),
      head: hash(g('table-head')), body: hash(g('table-body')), sum: hash(g('summary')),
      legend: hash(g('table-legend')), hol: hash(g('holiday-list')), gap: hash(g('gap-list')),
      sig: hash(g('signatures')), title: hash(document.title + '|' + g('org-subtitle'))
    };
  };
  const gen = (y, m) => { $('sel-year').value = y; $('sel-month').value = m; startGeneration(); generateAll(); };
  const reset = emps => { state.employees = emps; state.schedule = {}; state.preservedCOCM = {}; genCOCM = {}; genDay = 0; genStats = null; };

  // Excel: citește fișierul generat și face hash pe celule + stiluri
  async function excelHash(name) {
    let cap = null;
    const oc = URL.createObjectURL; URL.createObjectURL = b => { cap = b; return oc.call(URL, b); };
    const ocl = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    exportExcel();
    for (let i = 0; i < 30 && !cap; i++) await new Promise(r => setTimeout(r, 150));
    HTMLAnchorElement.prototype.click = ocl; URL.createObjectURL = oc;
    if (!cap) { out[name + ':xlsx'] = 'NO-BLOB'; return; }
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await cap.arrayBuffer());
    const ws = wb.worksheets[0]; const cells = [];
    ws.eachRow({ includeEmpty: false }, (r, i) => r.eachCell({ includeEmpty: false }, (c, j) => {
      const f = c.fill && c.fill.fgColor ? c.fill.fgColor.argb : '';
      cells.push(i + ':' + j + ':' + String(c.value) + ':' + f + ':' + (c.font && c.font.bold ? 'b' : ''));
    }));
    out[name + ':xlsx'] = hash(ws.name + '|' + ws.columnCount + '|' + cells.join('\n'));
  }

  // fragmente de interfață (modale), deschise și închise
  const snapModals = name => {
    const m = {};
    openOrgModal(); m.org = hash($('org-modal').innerHTML); closeOrgModal();
    openAddEmployeeModal(); m.add = hash($('add-emp-modal').innerHTML); closeAddEmployeeModal();
    openEditModal(state.employees[0].id); m.edit = hash($('emp-modal').innerHTML); closeModal();
    showChangelog(); m.changelog = hash($('changelog-modal').innerHTML); closeChangelog();
    openHelp(); m.help = hash($('help-modal').innerHTML); closeHelp();
    out[name] = m;
  };

  if (!isDisp) {
    // ---------------- EXPLOATARE ----------------
    const setCfg = (g, v) => ['t1', 't1a', 't2', 't2a', 'c8'].forEach(k => { $('cfg-' + g + '-' + k).value = v[k] || 0; });
    const mk = (crews, per, extra) => {
      const e = []; let id = 1;
      ['urban', 'rural'].forEach(c => {
        for (let i = 0; i < crews; i++) {
          const cr = (c === 'urban' ? 'U' : 'R') + (i + 1);
          for (let j = 0; j < per; j++) e.push({ id: id++, name: cr + '-' + j, category: c, functia: ['emitent', 'admitent', 'electrician', 'seftura'][j % 4], crew: cr, forced8: false, crewOverrides: {} });
        }
      });
      return extra ? extra(e) : e;
    };
    const run = (name, mode, y, m, cu, cr, emps, pre) => {
      reset(emps); setCfg('urban', cu); setCfg('rural', cr); state.genMode = mode; if ($('gen-mode')) $('gen-mode').value = mode;
      if (pre) pre();
      gen(y, m); snapUI(name);
    };
    run('e-t12-sep', 't12', 2026, 9, { t1: 2, t2: 2 }, { t1: 2, t2: 2 }, mk(4, 2));
    run('e-full-oct', 'full', 2026, 10, { t1: 2, t1a: 1, t2: 2, t2a: 1 }, { t1: 1, t2: 1 }, mk(3, 2));
    run('e-rot8-sep', 'rotation', 2026, 9, { t1: 2, t1a: 2, t2: 2, t2a: 2 }, { t1: 2, t1a: 2, t2: 2, t2a: 2 }, mk(5, 2));
    run('e-rot3-nov', 'rotation3', 2026, 11, { t1: 2, t2: 2 }, { t1: 2, t2: 2 }, mk(5, 2));
    run('e-mixed', 't12', 2026, 11, { t1: 2, t2: 2, c8: 1 }, { t1: 1, t2: 1 }, mk(3, 2, e => { e[0].forced8 = true; e[3].crewOverrides = { '2026-11-10': 'U3' }; return e; }), () => {
      const set = (id, ds, v) => ds.forEach(d => { const k = '2026-11-' + P(d); state.schedule[k] = state.schedule[k] || {}; state.schedule[k][id] = v; });
      set(2, [3, 4, 5, 6], 5); set(5, [9, 10], 6); set(7, [16, 17], 8);
    });
    // trei luni consecutive (continuitate)
    reset(mk(4, 2)); setCfg('urban', { t1: 2, t2: 2 }); setCfg('rural', { t1: 2, t2: 2 }); state.genMode = 'rotation3';
    gen(2026, 9); gen(2026, 10); gen(2026, 11); snapUI('e-chain-rot3');
    // analiză moduri
    analyzeModes(); out['e-analyze'] = hash($('analyze-body').innerHTML); closeAnalyzeModal();
    snapModals('e-modals');
    run('e-t12-sep2', 't12', 2026, 9, { t1: 2, t2: 2 }, { t1: 2, t2: 2 }, mk(4, 2));
    await excelHash('e-t12-sep');
  } else {
    // ---------------- DISPECER ----------------
    const mk = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: 'D' + (i + 1), category: 'dispecer' }));
    const co = (y, m, id, ds, v = 5) => ds.forEach(d => { const k = y + '-' + P(m) + '-' + P(d); state.schedule[k] = state.schedule[k] || {}; state.schedule[k][id] = v; });
    const run = (name, n, y, m, pre) => { reset(mk(n)); if (pre) pre(); gen(y, m); snapUI(name); };
    run('d-n5-oct', 5, 2026, 10);
    run('d-n7-nov-co', 7, 2026, 11, () => { co(2026, 11, 3, [10, 11, 12]); co(2026, 11, 5, [20, 21], 6); });
    run('d-n8-dec', 8, 2026, 12);
    run('d-n4-gaps', 4, 2026, 11);
    reset(mk(7)); co(2026, 10, 2, [5, 6, 7]); gen(2026, 10); gen(2026, 11); gen(2026, 12); snapUI('d-chain-q4');
    // dubluri introduse manual -> avertisment
    reset(mk(7)); gen(2026, 11); state.schedule['2026-11-05'][1] = 2; state.schedule['2026-11-05'][2] = 2; snapUI('d-dups');
    // org personalizat (denumiri + câmpuri dezactivate)
    saveOrg({ ...orgBase, entitate: 'Dispecerat Test', labels: { sefFOL: 'Șef dispecerat', aprobat: 'Director' }, off: { responsabilTehnic: true, judet: true }, configured: true });
    applyOrgToDOM(); reset(mk(5)); gen(2026, 11); snapUI('d-org-custom');
    saveOrg({ ...orgBase, entitate: 'Delgaz Grid S.A', labels: {}, off: {}, configured: true }); applyOrgToDOM();
    reset(mk(7)); gen(2026, 11); snapModals('d-modals');
    await excelHash('d-n7-nov');
    reset(mk(7)); co(2026, 11, 3, [10, 11, 12]); gen(2026, 11); await excelHash('d-n7-nov-co');
  }

  // ---------------- ACȚIUNI INTERACTIVE (identice ca flux în ambele moduri) ----------------
  {
    const stateHash = () => hash(JSON.stringify(canon({ e: state.employees, s: state.schedule, c: state.config || null })));
    const status = () => ($('status') ? $('status').textContent : '');
    const A = {};
    const fresh = () => {
      if (isDisp) { reset(Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: 'D' + (i + 1), category: 'dispecer' }))); gen(2026, 11); }
      else {
        const e = []; let id = 1;
        ['urban', 'rural'].forEach(c => { for (let i = 0; i < 3; i++) { const cr = (c === 'urban' ? 'U' : 'R') + (i + 1); for (let j = 0; j < 2; j++) e.push({ id: id++, name: cr + '-' + j, category: c, functia: 'emitent', crew: cr, forced8: false, crewOverrides: {} }); } });
        reset(e);
        ['urban', 'rural'].forEach(g => ['t1', 't1a', 't2', 't2a', 'c8'].forEach(k => { $('cfg-' + g + '-' + k).value = { t1: 2, t2: 2 }[k] || 0; }));
        state.genMode = 't12'; gen(2026, 11);
      }
      render();
    };
    // 1) adăugare angajat
    fresh();
    openAddEmployeeModal(); $('new-emp').value = 'Nou Test';
    if (!isDisp) { $('new-emp-cat').value = 'rural'; $('new-emp-fn').value = 'seftura'; $('new-emp-crew').value = 'R1'; }
    addEmployee();
    A.add = { st: stateHash(), msg: hash(status()), last: hash(JSON.stringify(canon(state.employees[state.employees.length - 1]))) };
    // 2) nume gol
    openAddEmployeeModal(); $('new-emp').value = ''; addEmployee(); A.addEmpty = hash(status());
    // 3) editare
    fresh(); openEditModal(2); $('modal-emp-name').value = 'Redenumit';
    if (!isDisp) { $('modal-emp-fn').value = 'admitent'; }
    saveModalEmployee(); A.edit = { st: stateHash(), msg: hash(status()) };
    // 4) CO pe interval (CO apoi CM)
    fresh(); openEditModal(3); $('leave-from').value = '2026-11-09'; $('leave-to').value = '2026-11-14'; $('leave-type').value = '5'; applyLeaveInterval();
    A.leaveCO = { st: stateHash(), msg: hash(status()) };
    $('leave-from').value = '2026-11-18'; $('leave-to').value = '2026-11-20'; $('leave-type').value = '6'; applyLeaveInterval(); closeModal();
    A.leaveCM = { st: stateHash(), msg: hash(status()) };
    // intervale invalide
    openEditModal(3); $('leave-from').value = '2026-11-20'; $('leave-to').value = '2026-11-10'; applyLeaveInterval(); A.leaveBad = hash(status()); closeModal();
    // 5) schimbare manuală a unei celule
    fresh(); render();
    const sel = [...document.querySelectorAll('#table-body select')][5];
    const m = sel.getAttribute('onchange').match(/onShiftChange\('([^']+)',(\d+),this\)/);
    sel.value = '2'; onShiftChange(m[1], +m[2], sel);
    A.cell = { st: stateHash(), td: hash(sel.parentElement.className), sum: hash($('summary').innerHTML) };
    // 6) ștergere angajat
    fresh(); modalEmpId = state.employees[1].id; deleteModalEmployee(); A.del = { st: stateHash(), msg: hash(status()), tbl: hash($('table-body').innerHTML) };
    // 7) curăță luna (păstrează CO/CM)
    fresh(); openEditModal(1); $('leave-from').value = '2026-11-05'; $('leave-to').value = '2026-11-07'; $('leave-type').value = '5'; applyLeaveInterval(); closeModal();
    state.currentYear = 2026; state.currentMonth = 11; $('sel-year').value = 2026; $('sel-month').value = 11;
    clearSchedule(); A.clear = { st: stateHash(), msg: hash(status()) };
    // 8) pas cu pas vs total, regenerare cu CO
    fresh(); clearSchedule(); startGeneration(); for (let i = 0; i < 12; i++) generateNextDay(); prevDay(); prevDay(); generateNextDay();
    A.step = { st: stateHash(), msg: hash(status()) };
    // 9) export/import: backup complet, lună, angajați
    fresh();
    let captured = null; const sfp = window.saveFileWithPicker; window.saveFileWithPicker = async d => { captured = d; return null; };
    await exportFullJSON(); const full = captured;
    await exportMonthJSON(); const month = captured;
    window.saveFileWithPicker = sfp;
    A.exportFull = hash(full); A.exportMonth = hash(month);
    const before = stateHash();
    state.schedule = {}; applyJSON(full); A.importFull = { st: stateHash(), same: before === stateHash(), msg: hash(status()) };
    state.schedule = {}; applyJSON(month); A.importMonth = { st: stateHash(), msg: hash(status()) };
    applyJSON('nu e json'); A.importBad = hash(status());
    const evt = txt => ({ target: { files: [new Blob([txt])], value: '' } });
    const n0 = state.employees.length;
    await new Promise(r => { importEmployeesJSON(evt(JSON.stringify([{ name: 'Importat Unu' }, { name: state.employees[0].name }]))); setTimeout(r, 250); });
    A.importEmps = { added: state.employees.length - n0, st: stateHash(), msg: hash(status()) };
    // 10) setări organizație (salvare + reafișare)
    openOrgModal(); A.orgModal = hash($('org-modal').innerHTML);
    saveOrgSettings(); A.orgSaved = { sub: hash($('org-subtitle').textContent), sig: hash($('signatures').innerHTML), msg: hash(status()) };
    out['actions'] = A;
  }
  return out;
}

/* Amprenta markup-ului STATIC al paginii (shell + modale + manual), fără conținutul dinamic.
 * Se calculează pe o stare CANONICĂ (fără angajați și fără grafic), nu pe ce a rămas în browser:
 * altfel amprenta depinde de profilul de test (angajați vechi, butoane active, lună selectată) și
 * aceeași versiune de cod dădea rezultate diferite între local și site. */
function shellFingerprint() {
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  const saved = { emps: state.employees, sched: state.schedule, genDay: state.genDay, genStats: state.genStats };
  state.employees = []; state.schedule = {};
  state.genDay = 0; state.genStats = null; genDay = 0; genStats = null;
  try { render(); } catch (e) {}
  const b = document.body.cloneNode(true);
  b.querySelectorAll('script').forEach(s => s.remove());
  ['month-title', 'org-subtitle', 'table-head', 'table-body', 'table-legend', 'holiday-list', 'gap-list', 'empty-msg', 'status',
   'db-status', 'summary', 'sig-sef', 'sig-resp', 'sig-aprobat', 'app-version-badge', 'commit-badge', 'org-fields',
   'cl-items', 'cl-version', 'cl-title', 'btn-prev-day', 'btn-next-day', 'btn-generate-all', 'analyze-body',
   'modal-emp-crew', 'new-emp-crew', 'crew-datalist-override', 'crew-overrides-list'].forEach(id => {
    const e = b.querySelector('#' + id); if (e) e.innerHTML = '';
  });
  ['status', 'btn-prev-day', 'btn-next-day', 'btn-generate-all', 'header-logo'].forEach(id => {
    const e = b.querySelector('#' + id); if (e) { e.removeAttribute('style'); e.removeAttribute('src'); }
  });
  b.querySelectorAll('.ta-field,.c8-field').forEach(e => e.removeAttribute('style'));
  const html = b.innerHTML.replace(/>\s+</g, '><').trim();
  // restaurează starea de dinainte (testul continuă apoi cu scenariile lui)
  state.employees = saved.emps; state.schedule = saved.sched;
  state.genDay = saved.genDay; state.genStats = saved.genStats;
  genDay = saved.genDay; genStats = saved.genStats;
  try { render(); } catch (e) {}
  return { hash: hash(html), len: html.length };
}

/* Compară cu referința versionată tests/baseline-<mod>.json (fără `_` la început: GitHub Pages,
 * adică Jekyll, nu publică fișierele care încep cu `_`, iar testul trebuie să meargă și pe site).
 * Utilizare: eval(await (await fetch('/tests/snapshot.js')).text()); JSON.stringify(await compareSnapshot())
 * Întoarce lista diferențelor (goală = comportament identic). Rulează de două ori (prima rulare „încălzește”). */
async function compareSnapshot() {
  const shell = shellFingerprint();
  await runSnapshot();
  const s = await runSnapshot();
  s.shell = shell;
  const isD = typeof assignDispecerShifts === 'function';
  const file = 'tests/baseline-' + (isD ? 'dispecer' : 'exploatare') + '.json';
  let base;
  try {
    // cale RELATIVĂ (fără `/` la început): pe GitHub Pages aplicația stă în /grafic-tura/, deci
    // `/tests/...` ar căuta la rădăcina domeniului și ar da 404; așa merge și local și pe site.
    const resp = await fetch(file);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    base = await resp.json();
  } catch (e) {
    return { page: isD ? 'dispecer' : 'exploatare', keys: Object.keys(s).length,
             diffs: ['baseline indisponibil (' + e.message + ') — rulează tools/harness/make-baseline.mjs'] };
  }
  const diffs = [];
  const walk = (x, y, p) => {
    if (x && typeof x === 'object') { for (const k of Object.keys(x)) walk(x[k], y ? y[k] : undefined, p + '.' + k); }
    else if (x !== y) diffs.push(p + ': base=' + x + ' now=' + y);
  };
  walk(base, s, '');
  return { page: isD ? 'dispecer' : 'exploatare', keys: Object.keys(s).length, diffs };
}
