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
  return out;
}
