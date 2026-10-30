// ===========================================================================
// MANUALUL modului «Exploatare (electricieni)» — cele 7 file (HTML) afișate în fereastra 📖 Manual.
// Încărcat de TOATE paginile: manualul unui mod se vede din orice aplicație. Se înregistrează în MANUALS
// sub cheia modului (folosită în id-urile help-<cheie>-<fila>). Vezi js/shell.js (buildHelpModal).
// ===========================================================================
MANUALS.exp = {
  label: '👷 Mod Electricieni (Exploatare)',
  panels: `<!-- TAB: Început rapid -->
      <div id="help-exp-start" class="help-tab-panel">
        <div class="help-hero">
          <div class="help-hero-title">Grafic de Tură</div>
          <div class="help-hero-sub">Planifică turele echipelor Urban și Rural în câteva secunde — generare automată, concedii și instruiri, statistici și export.</div>
          <div class="help-chips">
            <span class="help-chip">📴 Funcționează offline</span>
            <span class="help-chip">🎯 Generare automată</span>
            <span class="help-chip">🔄 Rotații configurabile</span>
          </div>
        </div>

        <div class="help-section">
          <div class="help-section-title">✨ Ce poate face aplicația</div>
          <div class="help-feat-grid">
            <div class="help-feat"><span class="help-feat-ico">🏭</span><div><div class="help-feat-t">Urban &amp; Rural</div><div class="help-feat-d">Două grupe cu cerințe de ture independente.</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">👥</span><div><div class="help-feat-t">Echipaje</div><div class="help-feat-d">Membrii unui echipaj lucrează împreună; schimbare de echipaj pe dată.</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">🔀</span><div><div class="help-feat-t">4 moduri de generare</div><div class="help-feat-d">Complet, doar T1/T2, rotație 8 zile, rotație 3 zile, rotație 5 zile, rotație 4 zile.</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">🏖️</span><div><div class="help-feat-t">CO / CM / Instruire</div><div class="help-feat-d">Păstrate la regenerare, excluse automat din weekend.</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">🧮</span><div><div class="help-feat-t">Normă &amp; validare</div><div class="help-feat-d">Calcul automat cu sărbători legale și verificarea orelor.</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">📊</span><div><div class="help-feat-t">Statistici</div><div class="help-feat-d">Ore pe angajat, carduri, comparație cu norma lunară.</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">💾</span><div><div class="help-feat-t">Salvare &amp; backup</div><div class="help-feat-d">Automat în browser + backup JSON portabil.</div></div></div>
            <div class="help-feat"><span class="help-feat-ico">📤</span><div><div class="help-feat-t">Export</div><div class="help-feat-d">Excel stilizat, Print/PDF (A3) și JSON.</div></div></div>
          </div>
        </div>

        <div class="help-section">
          <div class="help-section-title">🚀 Cei 6 pași pentru un grafic nou</div>
          <div class="help-steps">
            <div class="help-step"><span class="help-step-n">1</span><span class="help-step-t"><strong>Completează setările organizației</strong> (⚙️ din colțul dreapta-sus) — apar în antet, semnături, print și Excel.</span></div>
            <div class="help-step"><span class="help-step-n">2</span><span class="help-step-t"><strong>Adaugă electricienii</strong> cu <em>+ Electrician</em>: nume, mediu (Urban/Rural), funcție, echipaj.</span></div>
            <div class="help-step"><span class="help-step-n">3</span><span class="help-step-t"><strong>Alege luna și anul</strong> (săgețile ‹ › sau selectoarele).</span></div>
            <div class="help-step"><span class="help-step-n">4</span><span class="help-step-t"><strong>Setează cerința</strong> pentru fiecare grup (Urban / Rural): câți electricieni pe T1, T2 etc., apoi alege <strong>Modul</strong> de generare.</span></div>
            <div class="help-step"><span class="help-step-n">5</span><span class="help-step-t"><strong>Introdu concediile</strong> (CO / CM) și instruirile <em>înainte</em> de generare — algoritmul le respectă.</span></div>
            <div class="help-step"><span class="help-step-n">6</span><span class="help-step-t">Apasă <em>▶ Generare</em>, apoi <em>Generare totală →</em> (sau <em>Ziua →</em> pas cu pas). Ajustează manual celulele, verifică <em>Statisticile</em>, apoi exportă (Excel / Print / JSON).</span></div>
          </div>
        </div>
        <div class="help-section">
          <div class="help-section-title">🧭 Ce găsești pe ecran</div>
          <ul class="help-list">
            <li><strong>Antet</strong> — logo, luna afișată, formația; ⚙️ setări organizație, 🌙/☀️ mod întunecat.</li>
            <li><strong>Bara de sus</strong> — navigare lună/an, cerința de ture pentru Urban și Rural, <em>Mod</em>, apoi butoanele <em>▶ Generare</em>, <em>✕ Curăță</em>, <em>+ Electrician</em>.</li>
            <li><strong>Tabelul</strong> — un rând pe electrician, o coloană pe zi; fiecare celulă e un dropdown editabil. Coloanele finale: <em>Lucrate</em> (ore), <em>CO/CM</em> (ore de concediu) și <em>Normă</em>.</li>
            <li><strong>Sub tabel</strong> — legenda turelor, lista sărbătorilor lunii, carduri și tabel de statistici.</li>
            <li><strong>Bara de jos</strong> — <em>💾 Fișiere</em>, <em>📊 Excel</em>, <em>🖨️ Print/PDF</em>, <em>📈 Analiză moduri</em>, <em>📖 Manual</em>, versiunea aplicației (click = ce e nou) și numărul de commit.</li>
          </ul>
          <p>Peste tot în aplicație, trecerea cu cursorul peste un buton, un câmp sau un antet de coloană afișează un tooltip explicativ.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">💡 Bune de știut</div>
          <ul class="help-list">
            <li>Tot ce faci se <strong>salvează automat</strong> în browser. Pentru siguranță, fă periodic un backup JSON (<em>Fișiere → Descarcă tot</em>).</li>
            <li>Graficul fiecărei luni e independent; poți lucra oricând pe orice lună/an (2020–2040).</li>
            <li>Aplicația funcționează și <strong>offline</strong>; doar exportul Excel are nevoie de internet.</li>
          </ul>
        </div>
      </div>

      <!-- TAB: Configurare -->
      <div id="help-exp-config" class="help-tab-panel" style="display:none">
        <div class="help-section">
          <div class="help-section-title">⚙️ Setări organizație</div>
          <p>La prima utilizare apare automat un dialog; îl poți redeschide oricând cu butonul <em>⚙️</em>. Câmpuri: <strong>Formația/Unitatea</strong>, <strong>Șef FOL EM</strong>, <strong>Responsabil Tehnic</strong>, <strong>Județ</strong> (pentru Șef CORE) și <strong>Aprobat Șef CORE</strong>.</p>
          <p>Datele apar în subtitlul paginii, titlul filei de browser, semnăturile de la print și exportul Excel. Sunt salvate separat de grafic și <strong>nu se șterg</strong> la import de fișiere sau la actualizarea aplicației.</p>
          <p><strong>Setările sunt ținute separat pentru cele două aplicații:</strong> ce completezi aici (Exploatare) nu apare în graficul de dispecer și invers — fiecare are formația, semnăturile și entitatea ei.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">👤 Electricieni</div>
          <p>Apasă <em>+ Electrician</em> și completează:</p>
          <p>La prima pornire există deja un electrician-exemplu (<em>„Electrician 1"</em>), ca să vezi imediat cum arată tabelul — îl poți redenumi sau șterge.</p>
          <ul class="help-list">
            <li><strong>Nume</strong> — apare în tabel, carduri și exporturi.</li>
            <li><strong>Categorie (Urban / Rural)</strong> — grupul de ture; fiecare grup e alocat separat, conform cerinței proprii.</li>
            <li><strong>Funcția</strong> — Emitent, Admitent, Electrician, Șef tură (informativ, colorat în tabel).</li>
            <li><strong>Echipaj</strong> — opțional; membrii aceluiași echipaj lucrează împreună (vezi mai jos).</li>
            <li><strong>Forțat 8h</strong> — primește mereu tura 8h în zilele lucrătoare (weekend = L), e exclus din orice altă alocare automată și apare grupat separat, sub „Program 8 ore", cu insigna <em>F</em>.</li>
          </ul>
          <p><strong>Editare / ștergere:</strong> click pe numele electricianului din tabel. Ștergerea cere confirmare în doi pași (a doua apăsare în 3 secunde), ca să nu se șteargă din greșeală.</p>
          <p><strong>Adăugare din fișier:</strong> <em>Fișiere → Adaugă electricieni din fișier</em> — vezi tabul Fișiere &amp; Export.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">👥 Echipaje</div>
          <p>Membrii aceluiași echipaj sunt tratați ca un bloc: primesc aceeași tură în aceeași zi. Dacă blocul nu încape pe o tură, tot echipajul trece la următoarea.</p>
          <p><strong>Echipaje predefinite:</strong> U1–U5 (Urban), R1–R5 (Rural). Poți crea oricâte echipaje proprii scriind un nume în câmpul „Echipaj nou…” și apăsând <em>+ Adaugă</em>.</p>
          <p><strong>Schimbare echipaj pe dată</strong> — în modalul de editare, secțiunea „Schimbări echipaj pe dată”: alegi o dată și echipajul nou; de la acea dată electricianul face parte din alt echipaj (valabil până la următoarea schimbare). Poți adăuga oricâte schimbări și le poți șterge individual.</p>
          <p><strong>Vizualizare:</strong> în zilele în care electricianul e mutat într-un alt echipaj, numele echipajului efectiv apare <span style="color:#f59e0b;font-weight:600">portocaliu</span> sub tură, în celulă (ecran și print).</p>
          <p><strong>Echipaj rupt (CO/CM sau fără echipaj):</strong> dacă partenerul cuiva e în concediu într-o zi, sau dacă cineva nu are echipaj setat, cei rămași fără pereche sunt <strong>împerecheați temporar</strong> între ei, automat, în acea zi (după ordinea din listă). Dacă rămâne unul singur, lucrează ca individ solo, iar responsabilul îi poate ajusta manual programul (de ex. 8h). Nu există echipaje de 3 persoane.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🔧 Cerința de ture (bara de sus)</div>
          <p>Pentru fiecare grup, <strong>Urban</strong> și <strong>Rural</strong>, setezi câți electricieni vrei pe fiecare tură, în fiecare zi:</p>
          <ul class="help-list">
            <li><strong>T1</strong> (06:00–14:00) și <strong>T2</strong> (14:00–22:00) — se alocă în orice zi, în toate modurile.</li>
            <li><strong>T1A / T2A</strong> — variante ale T1/T2, doar zile lucrătoare (L–V). Câmpurile apar doar în modurile 1 și 3, care le pot aloca automat.</li>
            <li><strong>8h</strong> (08:00–16:00) — program normal, doar zile lucrătoare. Câmpul apare doar în modurile 1 și 2.</li>
          </ul>
          <p>Dacă suma cerută depășește numărul de electricieni din grup, aplicația te avertizează la generare (unii nu vor avea zile libere). Valorile se salvează și se restaurează la redeschidere.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🌙 Mod întunecat</div>
          <p>Butonul 🌙 / ☀️ din antet comută între tema clară și cea întunecată. Alegerea nu se păstrează după reîncărcarea paginii.</p>
        </div>
      </div>

      <!-- TAB: Generare -->
      <div id="help-exp-gen" class="help-tab-panel" style="display:none">
        <div class="help-section">
          <div class="help-section-title">▶ Cum generezi graficul</div>
          <p>Selectează luna și anul, setează cerința și modul, apoi apasă <em>▶ Generare</em>. Aplicația verifică dacă există electricieni și, dacă sunt zile deja generate, îți cere confirmarea să continue din prima zi liberă (zilele existente se păstrează). După pornire apar:</p>
          <ul class="help-list">
            <li><em>Ziua N →</em> — generează doar ziua curentă și avansează; util pentru verificare pas cu pas.</li>
            <li><em>Generare totală (N) →</em> — generează dintr-odată toate zilele rămase.</li>
            <li><em>← Ziua N</em> — întoarce cu o zi și o regenerează dacă rezultatul nu te mulțumește.</li>
          </ul>
          <p><strong>Modul</strong> se poate schimba oricând, inclusiv în timpul generării pas cu pas; se aplică zilelor următoare.</p>
          <p><strong>Continuitate între luni:</strong> generarea ține cont de ultima zi din luna anterioară (tura de ieri, zile consecutive, săptămâna care traversează granița), deci regulile se respectă și la început de lună.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">✕ Curăță</div>
          <p>Șterge <strong>doar turele generate</strong> pentru luna afișată. <strong>CO, CM și Instruire deja introduse se păstrează.</strong> Electricienii și setările rămân neatinse. Cere confirmare înainte.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🔀 Cele 4 moduri de generare</div>
          <ul class="help-list">
            <li><strong>1) T1/T2 + T1A/T2A</strong> — toate turele se alocă automat zilnic, prin completare (nu ciclu fix). Alternanța par/impar a zilei inversează ordinea de asignare T1↔T2, ca să nu se fixeze mereu același echipaj pe aceeași tură.</li>
            <li><strong>2) Zilnic T1/T2</strong> (implicit) — la fel, dar completează automat doar T1, T2 (și 8h); T1A/T2A rămân complet manuale.</li>
            <li><strong>3) Rotație 8 zile</strong> — fiecare echipaj/individ urmează ciclul personal T1→T1A→T2→L→T1→T2A→T2→L. Dacă faza T1A/T2A cade în weekend, se transformă în T1/T2 (dacă formația folosește T1A/T2A), altfel rămâne L. Ciclul curge continuu peste granița dintre luni. La 5+ echipaje pe grup, ciclul are coliziuni inevitabile, rezolvate automat: câștigă cine are mai puține ore, iar perechea care se ciocnește se rotește la fiecare 8 zile.</li>
            <li><strong>4) Rotație T1-T2-L</strong> — ciclu fix de 3 zile: T1→T2→L. Nu folosește T1A/T2A/8h. Aceeași protecție la coliziuni și aceeași continuitate între luni.</li>
            <li><strong>5) Rotație T1-T1A-T2-T2A-L</strong> — ciclu fix de 5 zile: T1→T1A→T2→T2A→L. Dacă faza T1A/T2A cade în weekend (sau formația nu folosește T1A/T2A), se transformă în T1/T2. Aceleași reguli și continuitate ca la celelalte rotații.</li>
            <li><strong>6) Rotație T1-T1A-T2-L</strong> — ciclu fix de 4 zile: T1→T1A→T2→L. Folosește T1A, dar nu T2A. Aceeași tratare a weekendului și aceleași reguli.</li>
          </ul>
          <p><strong>Cum alegi:</strong> folosește <em>📈 Analiză moduri</em> (bara de jos) — simulează toate cele 6 moduri pe luna curentă și arată care utilizează cel mai bine echipajele, fără să modifice graficul real (vezi tabul Statistici).</p>
          <p>Comune tuturor modurilor: grupare pe echipaje, respectarea echipajului „pe dată”, împerecherea temporară a celor rămași fără pereche, protecțiile din tabul Reguli, iar electricienii cu <em>Forțat 8h</em> primesc mereu 8h în zile lucrătoare.</p>
          <p>În modurile de rotație, dacă un echipaj pierde competiția pentru tura dorită, încearcă automat cealaltă tură (T1↔T2) dacă acolo mai e loc. Cu puține echipaje și cerere mare, unele zile pot rămâne totuși sub capacitatea configurată — ciclul fix garantează ziua liberă.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🏷️ Legendă ture</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
            <span class="shift-pill pill-t1" style="padding:3px 10px;font-size:12px">T1 — 06:00–14:00</span>
            <span class="shift-pill pill-t2" style="padding:3px 10px;font-size:12px">T2 — 14:00–22:00</span>
            <span class="shift-pill pill-t1a" style="padding:3px 10px;font-size:12px">T1A — 06:00–14:00 (L–V)</span>
            <span class="shift-pill pill-t2a" style="padding:3px 10px;font-size:12px">T2A — 14:00–22:00 (L–V)</span>
            <span class="shift-pill pill-co" style="padding:3px 10px;font-size:12px">CO — Concediu Odihnă</span>
            <span class="shift-pill pill-cm" style="padding:3px 10px;font-size:12px">CM — Concediu Medical</span>
            <span class="shift-pill pill-c8" style="padding:3px 10px;font-size:12px">8h — Program normal (08:00–16:00, L–V)</span>
            <span class="shift-pill" style="padding:3px 10px;font-size:12px;background:#d5f5e3;color:#1a7a3a;font-weight:600">INST — Instruire</span>
            <span class="shift-pill" style="padding:3px 10px;font-size:12px;background:var(--shift0-bg);color:var(--shift0-text)">L — Liber</span>
          </div>
          <p style="margin-top:8px">Orice tură lucrată (T1, T2, T1A, T2A, 8h, INST) se numără ca <strong>8 ore</strong>.</p>
        </div>
      </div>

      <!-- TAB: Reguli -->
      <div id="help-exp-rules" class="help-tab-panel" style="display:none">
        <div class="help-section">
          <div class="help-section-title">📏 Reguli respectate la generarea automată</div>
          <ul class="help-list">
            <li><strong>Maxim 4 zile consecutive lucrate</strong> — după 4 zile la rând, următoarea zi e obligatoriu L (toate modurile).</li>
            <li><strong>Maxim 5 zile lucrate pe săptămână calendaristică</strong> (luni–duminică), inclusiv zilele din luna precedentă când săptămâna traversează granița.</li>
            <li><strong>Pauză de siguranță T2 → T1/T1A</strong> — dacă ieri a fost T2, azi nu poate fi T1 sau T1A (gap de 8h). T2A nu blochează nimic.</li>
            <li><strong>Echitate pe ore</strong> — la concurență pentru o tură, primește cine are mai puține ore acumulate în luna curentă.</li>
            <li><strong>T1A / T2A / 8h doar în zile lucrătoare</strong> (L–V).</li>
            <li><strong>CO / CM / INST existente</strong> se păstrează la generare și regenerare.</li>
          </ul>
        </div>
        <div class="help-section">
          <div class="help-section-title">🏖️ CO, CM și Instruire în calcule</div>
          <ul class="help-list">
            <li><strong>CO / CM nu se contorizează în weekend</strong> — consumă normă doar în zile lucrătoare. Sâmbăta/duminica cu CO/CM se afișează ca L, dar valoarea rămâne memorată.</li>
            <li><strong>Extensie la weekend:</strong> dacă vineri (sau luni) are CO/CM, sâmbăta/duminica adiacentă primește automat același marcaj la generare.</li>
            <li><strong>Instruirea (INST)</strong> se contorizează ca zi lucrată (8h), se poate seta doar în zile lucrătoare și rămâne pe loc și la regenerare.</li>
            <li>CO/CM <strong>reduc norma</strong> electricianului cu 8h/zi, ca să nu apară „sub normă” pentru zilele de concediu.</li>
          </ul>
        </div>
        <div class="help-section">
          <div class="help-section-title">⚠️ Limitări cunoscute</div>
          <ul class="help-list">
            <li>Un electrician rămas fără pereche și fără alt orfan lucrează solo; programul lui (de ex. 8h) se ajustează manual de responsabil.</li>
            <li>Dacă un echipaj e blocat de „maxim 4 consecutive”, sloturile lui pot rămâne neocupate — nu se redistribuie automat către alt echipaj.</li>
            <li>Sărbătorile legale sunt strict informative: nu influențează alocarea automată.</li>
            <li>Regulile de mai sus se aplică doar generării automate; la editare manuală, responsabilul are libertate deplină.</li>
          </ul>
        </div>
      </div>

      <!-- TAB: Editare -->
      <div id="help-exp-edit" class="help-tab-panel" style="display:none">
        <div class="help-section">
          <div class="help-section-title">✏️ Editare pe celulă</div>
          <p>Click pe orice celulă din tabel → dropdown cu turele disponibile: <strong>L, T1, T2, T1A, T2A, CO, CM, 8h, INST</strong>. Modificarea se salvează imediat, iar orele, cardurile și statisticile se actualizează în timp real.</p>
          <p>În weekend (S/D), opțiunile T1A, T2A, 8h, CO, CM și INST nu sunt oferite. Dacă o celulă de weekend are deja CO/CM/INST din date mai vechi sau din extensia automată, se afișează ca L.</p>
          <p>Dacă schimbi o tură deja setată (diferită de L) în alta, apare o confirmare.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🏖️ CO / CM / Instruire pe interval</div>
          <p>Click pe numele electricianului → secțiunea <em>„CO / CM / Instruire pe interval”</em>: alegi data de început, data de sfârșit și tipul (CO, CM sau INST), apoi <em>Aplică</em>. Se setează dintr-odată toate zilele din interval, în loc de click pe fiecare celulă.</p>
          <ul class="help-list">
            <li>Suprascrie ce era setat înainte în acele zile.</li>
            <li>CO/CM acoperă și weekendul (afișat ca L, fără să consume normă); <strong>INST sare automat peste weekend</strong>, iar mesajul îți spune câte zile au fost sărite.</li>
            <li>Datele pornesc pe prima zi a <strong>lunii afișate</strong> în grafic, nu pe data de azi.</li>
            <li>Intervalul poate traversa mai multe luni.</li>
          </ul>
        </div>
        <div class="help-section">
          <div class="help-section-title">👤 Modalul de editare electrician</div>
          <p>Click pe nume: poți schimba numele, mediul, funcția, echipajul implicit, bifa/debifa <em>Forțat 8h</em>, adăuga schimbări de echipaj pe dată și seta concedii pe interval. Butonul <em>🗑 Șterge</em> cere două confirmări.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🎉 Sărbători legale</div>
          <p>Sărbătorile legale din România (Anul Nou, Boboteaza, Paște, Ziua Muncii, Rusalii, Sf. Maria, Crăciun etc.) sunt calculate automat pentru orice an, inclusiv datele mobile (Paște, Rusalii).</p>
          <p>Coloana zilei e evidențiată pe grafic (antet colorat + chenar), cu numele sărbătorii la hover; sub tabel apare lista sărbătorilor lunii. Sărbătorile <strong>scad din norma lunară</strong>, dar <strong>nu influențează</strong> alocarea automată. Ture lucrate în sărbători: coloana „🎉 Sărb.” din Statistici.</p>
        </div>
      </div>

      <!-- TAB: Statistici -->
      <div id="help-exp-stats" class="help-tab-panel" style="display:none">
        <div class="help-section">
          <div class="help-section-title">📊 Ore și normă în tabel</div>
          <ul class="help-list">
            <li><strong>Lucrate</strong> — numărul de ture lucrate × 8h.</li>
            <li><strong>CO/CM</strong> — orele de concediu (doar zile lucrătoare).</li>
            <li><strong>Normă</strong> — zilele lucrătoare ale lunii (fără weekend și sărbători) × 8h. Deasupra secțiunii de statistici apare rezumatul: „N zile lucrătoare = Xh normă/electrician”.</li>
          </ul>
          <p><strong>Culorile orelor:</strong> verde = exact norma (după scăderea CO/CM), galben = sub normă cu cel mult 16h, roșu = peste normă sau cu mai mult de 16h sub normă.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🗂️ Carduri și statistici (sub tabel)</div>
          <ul class="help-list">
            <li><strong>Carduri electricieni</strong> — ore lucrate față de normă (procent), plus câte ture de fiecare tip a făcut (T1, T2, T1A, T2A, 8h, INST, CO, CM, sărbători).</li>
            <li><strong>Statistici ture</strong> — tabel detaliat pe Urban/Rural/Program 8 ore, cu ture pe tip, sărbători, ore lucrate, ore CO/CM, normă și diferența (±) față de normă.</li>
          </ul>
          <p>Ambele secțiuni se pot plia/desface cu butonul ▼/▶ din antetul lor.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">📈 Analiză moduri</div>
          <p>Butonul <em>📈 Analiză moduri</em> simulează pe rând cele 4 moduri pe luna afișată, cu electricienii și cerința curentă, respectând CO/CM deja introduse. <strong>Graficul real nu se modifică.</strong> Pentru fiecare grup (Urban/Rural) vezi un tabel cu:</p>
          <ul class="help-list">
            <li><strong>Echipaje active/zi</strong> — media echipajelor care lucrează pe zi.</li>
            <li><strong>Utilizare</strong> — procentul de zile-echipaj disponibile în care echipajul a lucrat (verde ≥ 70%, galben 50–70%, roșu sub 50%).</li>
            <li><strong>Zile cu toate echipajele</strong> — zilele în care toate echipajele disponibile au fost active simultan.</li>
            <li><strong>Ore min–max</strong> și <strong>Spread</strong> — cât de echitabil sunt distribuite orele (spread mic = echitabil).</li>
            <li><strong>Conflicte</strong> — încălcări ale regulilor (peste 4 consecutive, peste 5/săptămână, gap T2→T1).</li>
          </ul>
          <p>Modul cu cea mai bună utilizare e marcat „recomandat”. Trece cu cursorul peste antetul și valorile din tabel pentru explicații.</p>
        </div>
      </div>

      <!-- TAB: Fișiere & Export -->
      <div id="help-exp-export" class="help-tab-panel" style="display:none">
        <div class="help-section">
          <div class="help-section-title">💾 Salvare automată</div>
          <p>Orice modificare se salvează automat în browser (localStorage + copie de siguranță în IndexedDB). La redeschidere, în același browser, datele se restaurează. Starea salvării apare sub tabel („💾 IndexedDB…”).</p>
          <p><strong>Atenție:</strong> datele se pierd dacă ștergi datele site-ului/cache-ul sau folosești alt browser/calculator. Folosește exportul JSON ca backup portabil. Dacă la pornire datele salvate sunt corupte, aplicația pornește curat și păstrează copia coruptă sub o cheie separată, cu un avertisment.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">📁 Meniul „💾 Fișiere”</div>
          <ul class="help-list">
            <li><em>💾 Descarcă doar luna curentă</em> — fișier JSON mic cu graficul lunii afișate, electricienii și configurația; ușor de trimis cuiva.</li>
            <li><em>💿 Descarcă tot (backup complet)</em> — toate lunile, toți electricienii și toate setările.</li>
            <li><em>📂 Încarcă fișier (lună sau backup)</em> — recunoaște automat tipul fișierului.</li>
            <li><em>👥 Adaugă electricieni din fișier</em> — adaugă doar electricienii lipsă (după nume), fără să atingă graficul.</li>
          </ul>
          <p><strong>Import de lună:</strong> înlocuiește doar luna din fișier; celelalte luni rămân intacte. Electricienii lipsă se adaugă, dar lista existentă și configurația curentă <strong>nu</strong> se suprascriu. Dacă un id de electrician coincide cu unul local dar numele diferă, primești un avertisment (turele ar putea ajunge la persoana greșită).</p>
          <p><strong>Import de backup complet:</strong> <strong>înlocuiește toată baza de date</strong> curentă. Datele organizației deja completate nu se suprascriu.</p>
          <p>Fișierele sunt compatibile între versiuni; câmpurile noi se completează automat la import. În browserele moderne, „Descarcă tot” rescrie același fișier ales anterior, fără să mai ceară locația.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">📊 Export Excel</div>
          <p><em>📊 Excel</em> generează un fișier <strong>.xlsx</strong> (A3, peisaj) cu logo, antet, ture colorate, totaluri de ore, chenar și coloană marcată pe zilele de sărbătoare, statistici, legendă și semnături — oglinda variantei printate.</p>
          <p><em>Necesită internet</em> (biblioteca ExcelJS se încarcă din CDN). Dacă ești offline, apare un avertisment la deschiderea aplicației; restul funcțiilor merg normal.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🖨️ Print / PDF</div>
          <p><em>🖨️ Print / PDF</em> deschide dialogul de printare (sau Ctrl+P). <strong>Setări recomandate: A3, Peisaj (Landscape).</strong> Documentul conține antetul cu logo și organizația, graficul colorat, semnăturile, legenda, sărbătorile și statisticile; numerele de pagină apar automat. Elementele de editare (butoane, dropdown-uri) nu se printează. Pentru PDF alege „Salvare ca PDF” ca imprimantă.</p>
        </div>
        <div class="help-section">
          <div class="help-section-title">🆕 Versiune și „Ce e nou”</div>
          <p>Insigna cu versiunea din bara de jos (ex. V2026.09.20) deschide lista noutăților; după o actualizare, fereastra apare automat o singură dată. Numărul de după # e numărul de commit (reper de versiune).</p>
        </div>
      </div>

    `
};
