// ===========================================================================
// MANUALUL modului «Dispecer» — cele 7 file (HTML) afișate în fereastra 📖 Manual.
// Încărcat de TOATE paginile: manualul unui mod se vede din orice aplicație. Se înregistrează în MANUALS
// sub cheia modului (folosită în id-urile help-<cheie>-<fila>). Vezi js/shell.js (buildHelpModal).
// ===========================================================================
MANUALS.disp = {
  label: '🎧 Mod Dispecer',
  panels: `      <!-- TAB: Început rapid -->
      <div id="help-disp-start" class="help-tab-panel">
        <div class="help-hero">
          <div class="help-hero-title">Grafic Dispecer</div>
          <div class="help-hero-sub">Planifică turele dispecerilor pe blocuri T3→T2→T1→T4, cu acoperire 24h și un singur dispecer pe tură — generare automată, CO/CM, statistici și export.</div>
          <div class="help-chips">
            <span class="help-chip">📴 Funcționează offline</span>
            <span class="help-chip">🎯 Acoperire 24h</span>
            <span class="help-chip">1️⃣ Un dispecer pe tură</span>
            <span class="help-chip">⚖️ Distribuție echitabilă</span>
          </div>
        </div>

        <div class="help-section">
          <div class="help-section-title">✨ Ce poate face aplicația</div>
          <div class="help-feat-grid">
            <div class="help-feat"><span class="help-feat-ico">🕐</span><div><div class="help-feat-t">Ture de 4/6/6/8 ore</div><div class="help-feat-d">T1 (06–10), T2 (10–16), T3 (16–22), T4 (22–06).</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">🔄</span><div><div class="help-feat-t">Blocuri automate</div><div class="help-feat-d">Fiecare dispecer: T3→T2→T1→T4, apoi zile libere.</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">1️⃣</span><div><div class="help-feat-t">Un dispecer pe tură</div><div class="help-feat-d">Niciodată doi pe aceeași tură; ceilalți sunt liberi.</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">⚖️</span><div><div class="help-feat-t">Alegere echitabilă</div><div class="help-feat-d">Cine începe un bloc se alege după ore, weekenduri și sărbători.</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">🏖️</span><div><div class="help-feat-t">CO / CM</div><div class="help-feat-d">Păstrate la regenerare; turele rămase goale se redistribuie automat.</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">📊</span><div><div class="help-feat-t">Statistici</div><div class="help-feat-d">Ore, ture și sărbători pe dispecer, comparate cu norma.</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">💾</span><div><div class="help-feat-t">Salvare &amp; backup</div><div class="help-feat-d">Automat în browser + backup JSON portabil.</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">📤</span><div><div class="help-feat-t">Export</div><div class="help-feat-d">Excel stilizat, Print/PDF (A3) și JSON.</div></div></div>
          </div>
        </div>

        <div class="help-section">
          <div class="help-section-title">🚀 Pașii pentru un grafic nou</div>
          <div class="help-steps">
            <div class="help-step"><span class="help-step-n">1</span><span class="help-step-t"><strong>Completează setările organizației</strong> (⚙️ din colțul dreapta-sus) — denumirile câmpurilor sunt editabile.</span></div>
            <div class="help-step"><span class="help-step-n">2</span><span class="help-step-t"><strong>Adaugă dispecerii</strong> cu <em>+ Dispecer</em> (doar numele). Pentru acoperire 24h ai nevoie de cel puțin 5.</span></div>
            <div class="help-step"><span class="help-step-n">3</span><span class="help-step-t"><strong>Alege luna și anul</strong> (săgețile ‹ › sau selectoarele).</span></div>
            <div class="help-step"><span class="help-step-n">4</span><span class="help-step-t"><strong>Introdu concediile</strong> (CO / CM) <em>înainte</em> de generare — algoritmul le respectă și redistribuie turele rămase goale.</span></div>
            <div class="help-step"><span class="help-step-n">5</span><span class="help-step-t">Apasă <em>▶ Generare</em>, apoi <em>Generare totală →</em> (sau <em>Ziua →</em> pas cu pas). Verifică avertismentele ⚠️ de sub tabel, ajustează manual celulele, apoi exportă (Excel / Print / JSON).</span></div>
          </div>
        </div>
        <div class="help-section">
          <div class="help-section-title">🧭 Ce găsești pe ecran</div>
          <ul class="help-list">
            <li><strong>Antet</strong> — logo, luna afișată, formația și entitatea; selectorul de <em>Modul</em>, ⚙️ setări organizație, 🌙/☀️ mod întunecat.</li>
            <li><strong>Bara de sus</strong> — navigare lună/an, eticheta <em>Acoperire 24h automată</em>, apoi butoanele <em>▶ Generare</em>, <em>✕ Curăță</em>, <em>+ Dispecer</em>.</li>
            <li><strong>Tabelul</strong> — un rând pe dispecer, o coloană pe zi; fiecare celulă e un dropdown editabil. Coloanele finale: <em>Lucrate</em>, <em>CO/CM</em>, <em>Normă</em>.</li>
            <li><strong>Sub tabel</strong> — legenda turelor, lista sărbătorilor lunii, avertismente ⚠️ (ture neacoperite / cu mai mulți dispeceri), carduri și tabel de statistici.</li>
            <li><strong>Bara de jos</strong> — <em>💾 Fișiere</em>, <em>📊 Excel</em>, <em>🖨️ Print/PDF</em>, <em>📖 Manual</em>, versiunea aplicației.</li>
          </ul>
        </div>
        <div class="help-section">
          <div class="help-section-title">💡 Bune de știut</div>
          <ul class="help-list">
            <li>Tot ce faci se <strong>salvează automat</strong> în browser. Fă periodic un backup JSON.</li>
            <li>Datele Dispecer sunt <strong>separate</strong> de cele din modul Electricieni (Exploatare).</li>
            <li>Aplicația funcționează și <strong>offline</strong>; doar exportul Excel are nevoie de internet.</li>
          </ul>
        </div>
      </div>

      <!-- TAB: Configurare -->
      <div id="help-disp-config" class="help-tab-panel" style="display:none">
        <div class="help-section">
          <div class="help-section-title">⚙️ Setări organizație</div>
          <p>La prima utilizare apare automat un dialog; îl poți redeschide oricând cu butonul <em>⚙️</em>. Câmpuri: <strong>Entitate</strong> (implicit Delgaz Grid S.A), <strong>Formația/Unitatea</strong>, <strong>Șef FOL EM</strong>, <strong>Responsabil Tehnic</strong>, <strong>Județ</strong> (pentru Șef CORE) și <strong>Aprobat Șef CORE</strong>. <strong>Denumirea fiecărui câmp se poate edita</strong> (ex. „Șef dispecerat” în loc de „Șef FOL EM”), iar <strong>bifa</strong> din stânga lui îl activează / dezactivează — un câmp dezactivat nu mai apare în antet, la print și în Excel.</p>
          <p>Datele apar în subtitlul paginii, titlul filei de browser, semnăturile de la print și exportul Excel. Sunt salvate separat de grafic și <strong>nu se șterg</strong> la import de fișiere sau la actualizarea aplicației.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">👤 Dispeceri</div>
          <p>Apasă <em>+ Dispecer</em> și completează doar <strong>numele</strong>. Numărul de dispeceri determină ciclul și norma (vezi tabul <em>Reguli</em>).</p>
          <p><strong>Editare / ștergere:</strong> click pe numele dispecerului din tabel. Ștergerea cere confirmare în doi pași. Din același loc poți seta CO/CM pe interval.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🕐 Cele 4 ture</div>
          <ul class="help-list">
            <li><strong>T1</strong> (06:00–10:00, 4h)</li>
            <li><strong>T2</strong> (10:00–16:00, 6h)</li>
            <li><strong>T3</strong> (16:00–22:00, 6h)</li>
            <li><strong>T4</strong> (22:00–06:00, 8h)</li>
          </ul>
          <p>Împreună acoperă 24h. Nu există configurare numerică: alocarea e automată, în funcție de numărul de dispeceri.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🌙 Mod întunecat</div>
          <p>Butonul 🌙 / ☀️ din antet comută între tema clară și cea întunecată. Alegerea nu se păstrează după reîncărcarea paginii; la print se folosește mereu tema clară.</p>
        </div>
      </div>

      <!-- TAB: Generare -->
      <div id="help-disp-gen" class="help-tab-panel" style="display:none">
        <div class="help-section">
          <div class="help-section-title">▶ Cum generezi graficul</div>
          <p>Selectează luna și anul, apoi apasă <em>▶ Generare</em>. Dacă există deja zile generate, aplicația cere confirmarea să continue din prima zi negenerată (zilele existente se păstrează). După pornire apar:</p>
          <ul class="help-list">
            <li><em>Ziua N →</em> — generează doar ziua curentă și avansează; util pentru verificare pas cu pas.</li>
            <li><em>Generare totală (N) →</em> — generează dintr-odată toate zilele rămase.</li>
            <li><em>← Ziua N</em> — întoarce cu o zi și o regenerează dacă rezultatul nu te mulțumește.</li>
          </ul>
          <p><strong>Continuitate între luni:</strong> blocurile în curs continuă peste granița dintre luni și ani; nu se resetează nimic.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🔄 Cum se alocă turele</div>
          <ul class="help-list">
            <li>Un <strong>bloc</strong> înseamnă <strong>T3 → T2 → T1 → T4</strong> (4 zile la rând), urmat de cel puțin o zi liberă.</li>
            <li>În <strong>fiecare zi începe exact un bloc nou</strong> (tura T3). Așa, fiecare tură are un singur dispecer în fiecare zi, iar ceilalți sunt liberi.</li>
            <li><strong>Cine începe</strong> blocul se alege din cei odihniți, echitabil: cu cele mai puține ore în an (cu report între luni), apoi cu cele mai puține weekenduri/sărbători lucrate. De aceea nu lucrezi „mereu aceleași zile ale săptămânii”.</li>
            <li>Nu începe un bloc cine are CO/CM în următoarele 3 zile (l-ar rupe).</li>
          </ul>
          <p>Exemplu: cu 7 dispeceri lucrează 4 pe zi, iar 3 sunt liberi; fiecare face un bloc la aproximativ 7 zile.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">✕ Curăță</div>
          <p>Șterge <strong>doar turele generate</strong> pentru luna afișată. <strong>CO și CM deja introduse se păstrează.</strong> Dispecerii și setările rămân neatinse. Cere confirmare înainte.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🏷️ Legendă ture</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
            <span class="shift-pill pill-t1" style="padding:3px 10px;font-size:12px">T1 — 06:00–10:00 (4h)</span>
            <span class="shift-pill pill-t2" style="padding:3px 10px;font-size:12px">T2 — 10:00–16:00 (6h)</span>
            <span class="shift-pill pill-t3" style="padding:3px 10px;font-size:12px">T3 — 16:00–22:00 (6h)</span>
            <span class="shift-pill pill-t4" style="padding:3px 10px;font-size:12px">T4 — 22:00–06:00 (8h)</span>
            <span class="shift-pill pill-co" style="padding:3px 10px;font-size:12px">CO — Concediu Odihnă</span>
            <span class="shift-pill pill-cm" style="padding:3px 10px;font-size:12px">CM — Concediu Medical</span>
            <span class="shift-pill" style="padding:3px 10px;font-size:12px;background:var(--shift0-bg);color:var(--shift0-text)">L — Liber</span>
          </div>
          <p style="margin-top:8px">Orele se contorizează real per tură: T1 = 4h, T2 = 6h, T3 = 6h, T4 = 8h.</p>
        </div>
      </div>

      <!-- TAB: Reguli -->
      <div id="help-disp-rules" class="help-tab-panel" style="display:none">
        <div class="help-section">
          <div class="help-section-title">📏 Reguli respectate la generarea automată</div>
          <ul class="help-list">
            <li><strong>Cel mult un dispecer pe tură</strong> într-o zi; restul sunt liberi.</li>
            <li><strong>Bloc T3→T2→T1→T4</strong>; <strong>T1 e urmat de T4</strong> (aceeași persoană) și după T4 urmează cel puțin o zi liberă.</li>
            <li><strong>Odihnă minimă 11h</strong> între două ture consecutive și maximum <strong>4 zile lucrate la rând</strong>.</li>
            <li><strong>Acoperire 24h</strong> — în fiecare zi există câte un dispecer pe T1, T2, T3 și T4 (cu cel puțin 5 dispeceri și fără concedii suprapuse).</li>
            <li><strong>Echitate</strong> — cine începe un bloc se alege după orele din an, apoi după weekenduri și sărbători lucrate; nu apar dispeceri „blocați” pe aceleași zile ale săptămânii.</li>
            <li><strong>Continuitate</strong> — blocurile curg peste granița dintre luni (fără resetare).</li>
            <li><strong>CO / CM existente</strong> se păstrează la generare și regenerare.</li>
            <li><strong>Redistribuire automată</strong> — dacă CO/CM lasă o tură fără nimeni într-o zi, aplicația caută cea mai bună reasignare a zilei (inclusiv lanțuri de mutări: A preia tura goală, B preia tura lui A ș.a.m.d.). Se aleg, în ordine: cât mai multe ture acoperite, orele din an cât mai uniforme, cât mai puține schimbări — cu 11h odihnă și max. 4 zile la rând. CO/CM nu se ating.</li>
          </ul>
        </div>
        <div class="help-section">
          <div class="help-section-title">🧮 Norma și CO/CM în calcule</div>
          <ul class="help-list">
            <li><strong>Norma lunară</strong> = zilele lunii × 24h împărțite la numărul de dispeceri (minim 5). Cu 5 dispeceri ≈ 4,8h/zi (144h/lună), cu 7 ≈ 3,4h/zi (≈103h/lună).</li>
            <li><strong>CO/CM reduc norma</strong> cu aceleași ore pe zi (doar zile lucrătoare), ca să nu apară „sub normă” pentru zilele de concediu.</li>
            <li><strong>CO/CM nu se contorizează în weekend</strong> — se afișează ca L, dar valoarea rămâne memorată.</li>
          </ul>
        </div>
        <div class="help-section">
          <div class="help-section-title">⚠️ Limitări și avertismente</div>
          <ul class="help-list">
            <li>Cu mai puțin de 5 dispeceri nu toate turele pot fi acoperite.</li>
            <li>Când nu se poate acoperi o tură fără să se încalce odihna minimă sau seria de 4 zile (de ex. concedii suprapuse), ziua rămâne cu tura goală — apare un avertisment ⚠️ sub tabel și o corectezi manual din dropdown.</li>
            <li>Dacă introduci manual doi dispeceri pe aceeași tură, apare avertismentul „Ture cu mai mulți dispeceri”.</li>
            <li>Sărbătorile legale nu influențează alocarea; pe carduri și în Statistici vezi câte ture de sărbătoare a lucrat fiecare (în lună și în an), ca să poți decide manual.</li>
            <li>Regulile se aplică doar generării automate; la editare manuală ai libertate deplină.</li>
          </ul>
        </div>
      </div>

      <!-- TAB: Editare -->
      <div id="help-disp-edit" class="help-tab-panel" style="display:none">
        <div class="help-section">
          <div class="help-section-title">✏️ Editare pe celulă</div>
          <p>Click pe orice celulă din tabel → dropdown cu turele disponibile: <strong>L, T1, T2, T3, T4, CO, CM</strong>. Modificarea se salvează imediat; orele și statisticile se actualizează în timp real.</p>
          <p>În weekend (S/D), CO și CM nu sunt oferite. Dacă o celulă de weekend are deja CO/CM din date mai vechi, se afișează ca L.</p>
          <p>Dacă schimbi o tură deja setată (diferită de L) în alta, apare o confirmare.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🏖️ CO / CM pe interval</div>
          <p>Click pe numele dispecerului → secțiunea <em>„CO / CM pe interval”</em>: alegi data de început, data de sfârșit și tipul (CO sau CM), apoi <em>Aplică</em>. Se setează dintr-odată toate zilele din interval. Apoi regenerează luna ca turele să se redistribuie.</p>
          <ul class="help-list">
            <li>Suprascrie ce era setat înainte în acele zile.</li>
            <li>CO/CM acoperă și weekendul (afișat ca L, fără să consume normă).</li>
            <li>Datele pornesc pe prima zi a <strong>lunii afișate</strong>.</li>
            <li>Intervalul poate traversa mai multe luni.</li>
          </ul>
        </div>
        <div class="help-section">
          <div class="help-section-title">👤 Modalul de editare dispecer</div>
          <p>Click pe nume: poți schimba numele și seta concedii pe interval. Butonul <em>🗑 Șterge</em> cere două confirmări; turele lui dispar din grafic, iar în zilele rămase goale poți regenera luna.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🎉 Sărbători legale</div>
          <p>Sărbătorile legale din România sunt calculate automat pentru orice an și marcate pe coloane. Ele <strong>nu influențează</strong> alocarea (dispeceratul lucrează 24/7). Pe carduri apare <em>„🎉 Sărb.: N lună · M an”</em>, iar în Statistici coloanele „🎉 Sărb.” și „🎉 Sărb. an” — le folosești ca să decizi manual cine lucrează în sărbători.</p>
        </div>
      </div>

      <!-- TAB: Statistici -->
      <div id="help-disp-stats" class="help-tab-panel" style="display:none">
        <div class="help-section">
          <div class="help-section-title">📊 Ore și normă în tabel</div>
          <ul class="help-list">
            <li><strong>Lucrate</strong> — suma orelor reale pe ture (T1=4h, T2=6h, T3=6h, T4=8h).</li>
            <li><strong>CO/CM</strong> — orele de concediu (doar zile lucrătoare).</li>
            <li><strong>Normă</strong> — zilele lunii × 24h împărțite la numărul de dispeceri (minim 5).</li>
          </ul>
          <p><strong>Culorile orelor:</strong> verde = exact norma, galben = sub normă cu cel mult 16h, roșu = peste normă sau cu mai mult de 16h sub normă. Pentru un dispecer cu blocuri care încep/se termină în altă lună, diferențele se echilibrează de-a lungul anului.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🗂️ Carduri și statistici (sub tabel)</div>
          <ul class="help-list">
            <li><strong>Carduri dispeceri</strong> — ore lucrate față de normă (procent), câte ture de fiecare tip (T1–T4, CO, CM) și „🎉 Sărb.” (în lună · în an).</li>
            <li><strong>Statistici ture</strong> — tabel detaliat cu ture pe tip, sărbători (lună și an), ore, normă și diferența (±).</li>
          </ul>
          <p>Ambele secțiuni se pot plia/desface cu butonul ▼/▶ din antetul lor.</p>
        </div>
      </div>

      <!-- TAB: Fișiere & Export -->
      <div id="help-disp-export" class="help-tab-panel" style="display:none">
        <div class="help-section">
          <div class="help-section-title">💾 Salvare automată</div>
          <p>Orice modificare se salvează automat în browser (localStorage + copie de siguranță în IndexedDB). La redeschidere, în același browser, datele se restaurează. Starea salvării apare sub tabel („💾 IndexedDB…”).</p>
          <p><strong>Atenție:</strong> datele se pierd dacă ștergi datele site-ului/cache-ul sau folosești alt browser/calculator. Folosește exportul JSON ca backup portabil. Dacă la pornire datele salvate sunt corupte, aplicația pornește curat și păstrează copia coruptă sub o cheie separată, cu un avertisment.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">📁 Meniul „💾 Fișiere”</div>
          <ul class="help-list">
            <li><em>💾 Descarcă doar luna curentă</em> — fișier JSON mic cu graficul lunii afișate și dispecerii; ușor de trimis cuiva.</li>
            <li><em>💿 Descarcă tot (backup complet)</em> — toate lunile, toți dispecerii și toate setările.</li>
            <li><em>📂 Încarcă fișier (lună sau backup)</em> — recunoaște automat tipul fișierului.</li>
            <li><em>👥 Adaugă dispeceri din fișier</em> — adaugă doar dispecerii lipsă (după nume), fără să atingă graficul.</li>
          </ul>
          <p><strong>Import de lună:</strong> înlocuiește doar luna din fișier; celelalte luni rămân intacte. Dispecerii lipsă se adaugă, dar lista existentă <strong>nu</strong> se suprascrie. Dacă un id de dispecer coincide cu unul local dar numele diferă, primești un avertisment (turele ar putea ajunge la persoana greșită).</p>
          <p><strong>Fișiere din modul Electricieni:</strong> fișierele exportate din aplicația Exploatare (electricieni, ture T1A/T2A/8h) sunt refuzate la import — au alt înțeles al turelor.</p>
          <p><strong>Import de backup complet:</strong> <strong>înlocuiește toată baza de date</strong> curentă. Datele organizației deja completate nu se suprascriu.</p>
          <p>Fișierele sunt compatibile între versiuni; câmpurile noi se completează automat la import. În browserele moderne, „Descarcă tot” rescrie același fișier ales anterior, fără să mai ceară locația.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">📊 Export Excel</div>
          <p><em>📊 Excel</em> generează un fișier <strong>.xlsx</strong> (A3, peisaj) cu logo, antet (formația și entitatea), ture colorate, totaluri de ore, chenar auriu pe zilele de sărbătoare, legendă și semnăturile active — oglinda variantei printate.</p>
          <p><em>Necesită internet</em> (biblioteca ExcelJS se încarcă din CDN). Dacă ești offline, apare un avertisment la deschiderea aplicației; restul funcțiilor merg normal.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🖨️ Print / PDF</div>
          <p><em>🖨️ Print / PDF</em> deschide dialogul de printare (sau Ctrl+P). <strong>Setări recomandate: A3, Peisaj (Landscape).</strong> Documentul conține antetul cu logo și organizația, graficul colorat, semnăturile active, legenda, sărbătorile și statisticile; numerele de pagină apar automat. Elementele de editare (butoane, dropdown-uri) nu se printează. Pentru PDF alege „Salvare ca PDF” ca imprimantă.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🆕 Versiune și „Ce e nou”</div>
          <p>Insigna cu versiunea din bara de jos deschide lista noutăților; după o actualizare, fereastra apare automat o singură dată. Numărul de după # e numărul de commit (reper de versiune).</p>
        </div>
      </div>
`
};
