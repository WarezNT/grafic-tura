// ===========================================================================
// SHELL — markup-ul static al paginii (antet, controale, tabel, modale, bară de jos), generat din șablon.
// Părțile comune sunt aici; ce e specific modului vine din MODE.shell.<slot> (vezi modes/<mod>.js).
// Un slot lipsă = linia dispare. Nu duplica markup-ul comun în fișierele de mod.
// ===========================================================================

// Registrul manualelor (cheie → {label, panels}); fiecare js/manual-*.js își adaugă intrarea.
// (declarat în js/modes-registry.js)

const SHELL_PRE = `<div id="app">
  <h1 style="align-items:center">
    <img id="header-logo" alt="Delgaz Grid" width="160" height="68" style="height:68px;width:auto;flex-shrink:0;margin-right:14px">
    <span style="display:flex;flex-direction:column;gap:2px;flex:1">
{{titleLine}}
      <span id="org-subtitle" style="font-size:13px;font-weight:500;color:var(--text-muted)">Delgaz Grid S.A</span>
    </span>
    <label class="ctrl-label no-print" style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;margin-right:6px" title="Comută modulul aplicației (Exploatare / Dispecer)">Modul
      <select id="sel-app" onchange="switchApp(this.value)" style="font-size:12px;padding:4px 6px;font-weight:700">
{{appOptions}}
      </select>
    </label>
    <button class="btn btn-outline btn-sm no-print" onclick="openOrgModal()" title="Setări organizație" style="margin-right:6px;font-size:16px;padding:4px 10px">⚙️</button>
    <button class="dark-toggle no-print" onclick="toggleDarkMode()" title="Comută modul întunecat" id="dark-toggle-btn">🌙</button>
  </h1>

  <div class="controls no-print" style="padding:10px 14px">
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%">
      <button class="btn btn-outline btn-sm" onclick="prevMonth()" title="Luna anterioară" style="padding:4px 8px;font-size:14px">‹</button>
      <label class="ctrl-label" style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600">Luna
        <select id="sel-month" onchange="render()" style="font-size:12px;padding:4px 6px">
          <option value="1">Ianuarie</option><option value="2">Februarie</option><option value="3">Martie</option>
          <option value="4">Aprilie</option><option value="5">Mai</option><option value="6">Iunie</option>
          <option value="7">Iulie</option><option value="8">August</option><option value="9">Septembrie</option>
          <option value="10">Octombrie</option><option value="11">Noiembrie</option><option value="12">Decembrie</option>
        </select>
      </label>
      <label class="ctrl-label" style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600">An
        <input type="number" id="sel-year" min="2020" max="2040" onchange="render()" style="width:68px;font-size:12px;padding:4px 6px">
      </label>
      <button class="btn btn-outline btn-sm" onclick="nextMonth()" title="Luna următoare" style="padding:4px 8px;font-size:14px">›</button>
      <span style="width:1px;height:24px;background:var(--border);display:inline-block"></span>
{{controlsAndAddModal}}
      <div class="modal-buttons">
        <button class="btn btn-outline" onclick="closeAddEmployeeModal()">Anulează</button>
        <button class="btn btn-success" onclick="addEmployee()">Adaugă</button>
      </div>
    </div>
  </div>

{{orgAndExtraModals}}
      </div>
    </div>
  </div>

  <div id="status" class="status-msg info no-print" style="display:none"></div>

  <div class="table-wrap">
    <table id="schedule-table">
      <thead id="table-head"></thead>
      <tbody id="table-body"></tbody>
    </table>
    <div id="table-legend" style="padding:16px 0 4px;font-size:11px;display:flex;flex-wrap:wrap;gap:6px;align-items:center"></div>
    <div id="holiday-list" style="padding:0 0 8px;font-size:11px;display:flex;flex-wrap:wrap;gap:6px;align-items:center"></div>
{{gapList}}
    <div id="empty-msg" class="empty-msg"></div>
  </div>
  <div id="db-status" style="font-size:11px;color:#999;margin:4px 0 8px;text-align:right" class="no-print">💾 IndexedDB: inițializare...</div>

  <!-- Semnături — poziționate imediat după tabel în DOM (nu doar în CSS) ca la print să apară
       chiar sub grafic, pe aceeași pagină. Invizibile pe ecran (.signatures{display:none}),
       poziția DOM contează doar pt. ordinea de print — mutate aici din josul paginii, unde
       apăreau DUPĂ #summary (care are page-break-before:always), ajungând pe altă pagină decât
       tabelul, contrar intenției documentate în CSS (bug găsit la audit). -->
  <div id="signatures" class="signatures">
    <div class="signature-box">
      <div class="line" id="sig-sef">Șef FOL EM<br>—</div>
    </div>
    <div class="signature-box">
      <div class="line" id="sig-resp">Responsabil Tehnic<br>—</div>
    </div>
    <div class="signature-box">
      <div class="line" id="sig-aprobat">Aprobat<br>—</div>
    </div>
  </div>

  <input type="file" id="import-file" accept=".json" style="display:none" onchange="importJSON(event)">
  <input type="file" id="import-employees-file" accept=".json" style="display:none" onchange="importEmployeesJSON(event)">
  <div class="toolbar no-print">
    <!-- Fișiere dropdown -->
    <div class="tb-group tb-dd-wrap">
      <button class="btn btn-outline btn-sm" onclick="toggleTbDropdown('dd-fisiere')" data-tooltip="Salvează sau încarcă grafice și date">💾 Fișiere ▾</button>
      <div class="tb-dd" id="dd-fisiere">
{{exportTooltips}}
      </div>
    </div>
    <div class="tb-sep"></div>
    <!-- Export -->
    <div class="tb-group">
      <button class="btn btn-outline btn-sm" onclick="exportExcel()" data-tooltip="Exportă graficul în format Excel (.xlsx) cu stiluri și logo">📊 Excel</button>
      <button class="btn btn-primary btn-sm" onclick="printSchedule()" data-tooltip="Printează graficul sau salvează ca PDF (Ctrl+P)">🖨️ Print / PDF</button>
{{toolbarExtra}}
    </div>
    <div class="tb-sep"></div>
    <!-- Ajutor + versiune -->
    <div class="tb-group">
      <button class="btn btn-outline btn-sm" onclick="openHelp()" data-tooltip="Deschide manualul de utilizare cu instrucțiuni detaliate">📖 Manual</button>
      <span class="version-badge no-print" id="app-version-badge" onclick="showChangelog()" data-tooltip="Ce e nou în această versiune — click pentru detalii"></span>
      <span class="version-badge no-print" id="commit-badge" data-tooltip="Numărul de commituri din istoricul aplicației — util ca reper de versiune"></span>
    </div>
  </div>

  <div id="summary" class="summary"></div>
</div>

<!-- Modal changelog / ce e nou -->
<div id="changelog-modal" class="modal-overlay" style="display:none" onclick="if(event.target===this)closeChangelog()">
  <div class="modal-content" style="max-width:500px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <span style="font-size:28px;line-height:1">🆕</span>
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--accent);letter-spacing:.05em;text-transform:uppercase" id="cl-version"></div>
        <h3 style="margin:0;font-size:17px" id="cl-title"></h3>
      </div>
    </div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">Iată ce s-a schimbat față de versiunea anterioară:</p>
    <ul id="cl-items" class="cl-list"></ul>
    <div class="modal-buttons" style="margin-top:16px">
      <button class="btn btn-primary" onclick="closeChangelog()">Am înțeles</button>
    </div>
  </div>
</div>

{{devNote}}`;

const SHELL_POST = `<div id="emp-modal" class="modal-overlay" style="display:none" onclick="if(event.target===this)closeModal()">
  <div class="modal-content">
{{editModalBody}}
      <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center">
        <input type="date" id="leave-from" style="font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;outline:none">
        <span style="font-size:12px;color:var(--text-muted)">→</span>
        <input type="date" id="leave-to" style="font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;outline:none">
        <select id="leave-type" style="font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;outline:none">
          <option value="5">CO — Concediu Odihnă</option>
          <option value="6">CM — Concediu Medical</option>
{{leaveInstOption}}
        </select>
        <button class="btn btn-outline" onclick="applyLeaveInterval()" style="font-size:12px;padding:5px 10px">Aplică</button>
      </div>
    </div>
{{forced8Field}}
    <div class="modal-buttons">
      <button class="btn btn-danger" id="modal-btn-delete" onclick="deleteConfirmStep()">🗑 Șterge</button>
      <button class="btn btn-outline" onclick="closeModal()">Anulează</button>
      <button class="btn btn-primary" onclick="saveModalEmployee()">Salvează</button>
    </div>
  </div>
</div>

`;

const HELP_TABS = [
  ['start', '🚀 Început rapid'], ['config', '⚙️ Configurare'], ['gen', '▶ Generare'], ['rules', '📏 Reguli'],
  ['edit', '✏️ Editare'], ['stats', '📈 Statistici'], ['export', '💾 Fișiere &amp; Export']
];

// Completează un șablon: liniile `{{slot}}` se înlocuiesc cu fragmentul (gol → linia dispare).
function shellFill(tmpl, values) {
  const out = [];
  tmpl.split('\n').forEach(line => {
    const m = /^\{\{(\w+)\}\}$/.exec(line);
    if (!m) { out.push(line); return; }
    const v = values[m[1]];
    if (v === undefined) return;
    out.push(...v.split('\n'));
  });
  return out.join('\n');
}

// Manualul: două moduri (câte un buton + cele 7 file), cel al aplicației curente e deschis implicit.
function buildHelpModal() {
  const modeBlock = (key, active) => {
    const tabs = HELP_TABS.map(([k, lbl], i) =>
      '      <button class="help-tab' + (i === 0 ? ' active' : '') + '" onclick="showHelpTab(\'' + key + '\',\'' + k + '\',this)">' + lbl + '</button>'
    ).join('\n');
    const panels = MANUALS[key].panels;
    return '    <div id="help-mode-' + key + '" class="help-mode-wrap" style="display:' + (active ? 'flex' : 'none') + '">\n' +
      '    <div class="help-tabs">\n' + tabs + '\n    </div>\n' +
      '    <div style="overflow-y:auto;flex:1;font-size:13px;line-height:1.7;color:var(--text);padding-right:4px">\n\n' +
      panels + '\n    </div>\n    </div>\n';
  };
  const keys = Object.keys(MANUALS);
  const buttons = keys.map(k =>
    '      <button class="help-mode' + (MODE.helpMode === k ? ' active' : '') + '" data-mode="' + k + '" onclick="showHelpMode(\'' + k + '\')">' + MANUALS[k].label + '</button>'
  ).join('\n');
  return '<div id="help-modal" class="modal-overlay" style="display:none" onclick="if(event.target===this)closeHelp()">\n' +
    '  <div class="modal-content" style="max-width:760px;max-height:88vh;display:flex;flex-direction:column;padding-bottom:12px">\n' +
    '    <h3 style="margin-bottom:10px">📖 Manual de utilizare</h3>\n' +
    '    <div class="help-modes">\n' + buttons + '\n    </div>\n' +
    keys.map(k => modeBlock(k, MODE.helpMode === k)).join('') +
    '    <div class="modal-buttons" style="margin-top:12px">\n' +
    '      <button class="btn btn-primary" onclick="closeHelp()">Închide</button>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n\n';
}

function buildShell() {
  const s = MODE.shell || {};
  const appOptions = APP_MODES.map(m =>
    '        <option value="' + m.id + '"' + (m.id === MODE.id ? ' selected' : '') + '>' + m.label + '</option>'
  ).join('\n');
  return shellFill(SHELL_PRE, Object.assign({}, s, { appOptions })) + buildHelpModal() + shellFill(SHELL_POST, s);
}
