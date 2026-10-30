# Modul Dispecer — design și implementare

Aplicația de planificare a turelor deservea inițial un singur modul („Exploatare" — electricieni,
grupe Urban/Rural, ture de 8h). S-a adăugat un al doilea modul, **Dispecer**, ca **aplicație
separată** (`dispecer.html`), accesibilă printr-un selector de modul.

## 1. Arhitectură: două aplicații separate

| Fișier | Modul | Descriere |
|--------|-------|-----------|
| `index.html` | **Exploatare** | Aplicația existentă, neschimbată funcțional |
| `dispecer.html` | **Dispecer** | Aplicație nouă, standalone, pentru graficul dispecerilor |

### Selectorul de modul
- În antetul fiecărei aplicații există un selector permanent **„Modul"** (`Exploatare` / `Dispecer`).
- Pe `index.html`: alegerea „Dispecer" face `window.location.href = 'dispecer.html'`.
- Pe `dispecer.html`: alegerea „Exploatare" face `window.location.href = 'index.html'`.
- Cele două aplicații sunt complet independente (fără stare partajată).

### Persistență separată
Fiecare aplicație are propriile chei, ca să nu se amestece datele:

| | Exploatare (`index.html`) | Dispecer (`dispecer.html`) |
|---|---|---|
| State principal | `graficTura` | `graficTura_dispecer` |
| Organizație | `graficTura_org` | `graficTura_dispecer_org` |
| Versiune văzută | `graficTura_version` | `graficTura_dispecer_version` |
| IndexedDB | `GraficTuraDB` / `main` | `GraficTuraDispecerDB` / `main_dispecer` |

Organizația (formație, șef, responsabil) este **distinctă** între cele două aplicații.

## 2. Tipurile de tură (Dispecer)

| Val | Cod | Ore | Interval | Observații |
|-----|-----|-----|----------|-----------|
| 0 | L | 0 | — | Liber |
| 1 | T1+T4 | 12 | 06:00–10:00 + 22:00–06:00 | O singură celulă, aceeași persoană; 6h în ziua de start + 6h a doua zi |
| 2 | T2 | 6 | 10:00–16:00 | |
| 3 | T3 | 6 | 16:00–22:00 | Prima tură din ciclu (începe blocul) |
| 4 | T4 | 8 | 22:00–06:00 | Doar manual; trece de miezul nopții |
| 5 | CO | 0 | — | Concediu odihnă (manual) |
| 6 | CM | 0 | — | Concediu medical (manual) |
| 7 | IL | 6 | — | Instruire lunară (manual; nu acoperă nicio tură) |
| 8 | EMP | 6 | — | Examinare medicală periodică (manual) |
| 9 | Z | 6 | 08:00–14:00 | Program de zi (manual) |
| 10 | A | 6 | — | Autorizare anuală (manual) |

T1+T2+T3+T4 = 24h (acoperire completă a zilei). Valorile 7–10 sunt doar manuale, contează 6h lucrate și
**nu** acoperă turele T1–T4 (introduse în V2026.10.10).

## 3. Blocuri de ture (V2026.10.8 — înlocuiește ciclul fix pe poziții)

Regulă dură: **într-o tură (T1–T4) nu poate fi mai mult de un dispecer într-o zi — ceilalți sunt liberi**.

Un **bloc** = `T3 → T2 → T1+T4` (3 zile la rând; T1 și T4 la aceeași persoană, în aceeași zi de start — vezi V2026.10.10)
+ dimineața de 6h în care se termină T4 (00:00–06:00 a zilei următoare), urmat de o **zi liberă întreagă**. Ziua cu 6h
nu e zi liberă (`isWorkedDay` o socotește lucrată), deci un bloc nou **nu** începe imediat după ea. În fiecare zi începe
**exact un bloc nou** (T3), deci fiecare tură are un singur dispecer. Cu n dispeceri, **3 lucrează pe zi** și n−3 sunt liberi
(n=5: 3 din 5; n=7: 3 din 7, fiecare face un bloc la ~7 zile). Ciclul complet are 5 zile
(T3, T2, T1+T4, dimineața de 6h, liber), deci **5 dispeceri = minimul pentru acoperire 24h *și* zi liberă întreagă după T4**.

De ce nu mai e ciclu fix: cu 7 dispeceri un ciclu de 7 zile = o săptămână → fiecare ajungea să lucreze mereu aceleași zile
ale săptămânii (măsurat 2026: ture în weekend 104/52/0/0/52/104/104, T4 mereu în aceeași zi). Acum cine începe se alege la fiecare zi.

## 4. Algoritm (`assignDispecerShifts`)

Pentru ziua d, pornind de la tura reală de IERI a fiecărui dispecer (`BLOCK_NEXT`):
1. **Continuă blocurile în curs**: ieri T3 → azi T2; T2 → T1; T1 → T4; T4 → L.
2. **Alege cine începe T3 azi** dintre cei odihniți (ieri nu T4/bloc, nu în CO/CM, fără CO/CM în următoarele 3 zile, ca să
   nu rupă blocul): ore în an cu credit CO/CM (`ctx.yearHours`) la nivel de bloc (toleranță 24h, `BLOCK_HOURS`), apoi
   **cele mai puține weekenduri+sărbători** lucrate în an (`weekendHolidayShifts`), apoi ore, apoi id.
   Toleranța de 24h e esențială: fără ea, diferențe mici de ore impun o coadă fixă care la 7 dispeceri se blochează iar pe zilele săptămânii.
   **Ziua de ieri trebuie să fie complet liberă**: cine a lucrat 00:00–06:00 (dimineața de după T4) e exclus, ca seria
   să nu sară de 4 zile. Dacă nu rămâne nimeni (sub 5 dispeceri, concedii suprapuse), acoperirea are prioritate și se
   acceptă și continuarea imediată — vezi nota din §11.
3. Fără istoric (prima zi generată): „ieri" virtual T2 pentru primul și T3 pentru al doilea, ca toate cele 4 ture să
   pornească din prima zi (primul continuă în T1+T4, al doilea în T2, al treilea începe T3).
4. CO/CM introduse manual se păstrează; golurile rezultate se completează prin §12.

Blocul garantează prin construcție: T1→T4, odihnă ≥ 11h, max 4 zile la rând, cel puțin o zi liberă după T4, o singură persoană pe tură.
Schimbarea numărului de dispeceri la mijloc de an nu cere nicio recalculare (starea e în `state.schedule`, nu într-o formulă).

Testat headless (2026-10-30, an întreg 2026 generat lună cu lună, fără concedii, `tools/harness/audit-disp.mjs`):
ture de weekend per dispecer — n=5: 62–63 (spread 1) · n=6: 48–57 (9) · n=7: 42–48 (6) · n=8: 30–45 (15);
ore pe an — n=5: 1746–1752 (6h diferență) · n=6: 1440–1476 (36h) · n=7: 1224–1272 (48h) · n=8: 1074–1116 (42h).
0 goluri de acoperire, 0 dubluri, 0 încălcări de odihnă, **cea mai lungă serie de zile lucrate = 4** (socotind și
dimineața de 6h) la n ≥ 5.

> Cifrele mai vechi de aici (n=7: 59–60 ture de weekend, spread 1) erau măsurate înainte de V2026.10.10, când T1 și T4
> erau persoane diferite (4 oameni/zi). Nu „repara" algoritmul ca să iasă cifrele vechi.
> **V2026.10.12** (ziua liberă după T4): înainte de fix, seriile ajungeau la 8/12/16/24 de zile la rând (n=8/7/6/5) și
> spread-ul anual era 42/72/60/30h — cauza și cifrele în §11.

## 5. Norma (Dispecer) — V2026.10.13

- **Norma lunară = zile lucrătoare × 6h** (`MODE.expectedHours` = `workingDays(y, m) × NORM_H_PER_DAY`).
  Zilele lucrătoare = luni–vineri **minus sărbătorile legale** care cad în cursul săptămânii; `workingDays`
  stă în `js/core.js` (o folosește și Exploatarea, cu ×8h — acolo formula a rămas neschimbată).
  Tura standard are 6h (T2/T3), iar T1+T4 = 12h se socotește două ture.
  Ex.: octombrie 2026 = 22 zile → **132h**; ianuarie 2026 = 18 zile (5 sărbători) → **108h**; anul 2026 = 250 zile → **1500h**.
- **Nu se calculează pe zile calendaristice.** Formula veche (`zile × 24h / nr. dispeceri`) dădea ~103h/lună la
  7 dispeceri și ascundea întrebarea reală: cât din normă acoperă graficul. Acoperirea 24h/zi e asigurată de
  echipă, nu de fiecare om — la 3 oameni pe zi și 7 dispeceri ies ~1250h/an, adică **82–85% din normă**
  (cu 6 dispeceri ~100%, cu 5 peste normă).
- CO/CM reduc norma cu **6h pe zi** (`MODE.leaveHoursPerDay`), doar în zilele lucrătoare; coloana CO/CM din
  Statistici arată aceleași ore.
- `avgHoursPerDay()` (24 / nr. dispeceri) a rămas **doar ca „credit" intern de echitate** în generare: câte ore
  ar fi lucrat în medie într-o zi dacă nu era în concediu (`dayContext.yearHours`), ca orele din an să rămână
  comparabile între oameni. Nu e norma și nu se afișează.
- **Situația pe an, pe carduri** (`ytdTotals`): ore de la **prima lună generată din an** până la sfârșitul lunii
  afișate (dacă e generat tot anul, de la 1 ianuarie), față de norma aceleiași perioade minus CO/CM luat
  (6h pe zi lucrătoare), plus câte zile de CO/CM are în an. Se iau doar lunile care au date — altfel, cu o
  singură lună generată, s-ar compara orele unei luni cu norma a 10 luni și ar ieși un procent fals.
  Contează pentru că **fiecare om are ~20 de zile de CO legal pe an = 120h**: norma anului 2026 scade de la
  1500h la 1380h, iar cu CO eșalonat graficul acoperă **88–92%** (măsurat headless, `tools/harness/norma-co.mjs`),
  nu 82–85% cât iese fără concedii. Dacă vrei procentul real, CO-ul viitor trebuie introdus în grafic
  (butonul „CO/CM pe interval" din modalul dispecerului) — altfel norma rămâne cea brută.

## 6. Interfață (Dispecer)

- Antet: logo, titlu „Grafic dispecer", selector Modul, ⚙️ organizație, 🌙 mod întunecat.
- Bara de sus: navigare lună/an, etichetă informativă „Acoperire 24h automată", butoane
  `▶ Generare` / `✕ Curăță` / `+ Dispecer`.
- Tabel: un rând pe dispecer, o coloană pe zi, dropdown per celulă (`L, T1+T4, T2, T3, T4, IL, EMP, Z, A`;
  `CO`/`CM` doar în zilele lucrătoare). Coloane finale: Lucrate, CO/CM, Normă.
- Sub tabel: legendă, sărbători legale, carduri + tabel statistici (T1–T4, CO, CM, ore).
- Bara de jos: Fișiere (JSON), Excel, Print/PDF, Manual, versiune.

## 7. Funcții eliminate din Dispecer (specifice Exploatare)

Grupe Urban/Rural, ture T1A/T2A/8h/INST, „Forțat 8h", echipaje, cele 4 moduri de generare
și „Analiză moduri". CO/CM rămân.

## 8. Stare implementare

- [x] `index.html` — selector de modul în antet (redirect)
- [x] `dispecer.html` — aplicație completă (ture, ciclu, acoperire, tabel, statistici, export, manual)
- [x] Persistență separată + organizație distinctă
- [x] Manual rescris pentru Dispecer
- [x] Verificare în browser (2026-10-13, pe server local `http://`): generare 7 dispeceri Oct–Dec,
      continuitate între luni, CO pe interval, sărbători (30 Nov, 1 Dec...), import, export Excel
- [x] Curățenie cod moștenit din Exploatare (V2026.10.2): echipaje, Urban/Rural, rotații,
      „Analiză moduri", coloana „Funcția", forced8, CSS și texte; `dispecer.html` 3260 → ~2230 linii
- [x] Redistribuire automată când CO/CM lasă o tură neacoperită (`rebalanceCoverage`, vezi §12)

## 9. Note tehnice

- Ambele aplicații sunt single-file (fără build step), consistent cu restul proiectului.
- Print/PDF folosește mereu tema deschisă (indiferent de dark mode) — la fel ca Exploatare.
- Codurile speciale (AUT/EXM/PND/IN) din exemplul inițial NU au fost implementate (la cerere);
  pot fi adăugate ulterior ca CO/CM (manuale).

## 10. Import între module

`applyJSON` și „Adaugă dispeceri din fișier" refuză fișierele care arată a fi din Exploatare
(`category` urban/rural/8ore, `crew`, `forced8`, `config.urban/rural`, `module` ≠ `dispecer`) —
valorile de tură 3/4 au alt sens acolo (T1A/T2A) și ar strica graficul.

## 11. Limitări cunoscute

- Cu mai puțini de 5 dispeceri disponibili sau mai multe CO/CM suprapuse, unele ture rămân
  neacoperite chiar și după redistribuire (§12). Cu 6–7 dispeceri și concedii multe, limita de 4 zile
  consecutive e principala cauză — apar ca avertisment ⚠️ sub tabel (`coverageGaps`) și
  se corectează manual din dropdown.
- **Cu 4 dispeceri sau mai puțin nu se pot avea amândouă**: 24h/zi acoperite *și* o zi liberă întreagă după T4
  (ciclul `T3, T2, T1+T4, dimineața de 6h, liber` are 5 zile). Acoperirea rămâne prioritară: `assignDispecerShifts`
  acceptă și cine a lucrat dimineața de 6h, deci seriile depășesc 4 zile — la 4 dispeceri fiecare lucrează practic
  toate zilele anului (274 ture + 91 dimineți, 0–1 zile complet libere), iar la 3 dispeceri se acoperă ~18h/zi.
  Sub tabel apare o notă `ℹ️` care numește cine a depășit 4 zile la rând — se detectează din grafic, deci prinde
  și cazul „7 dispeceri, dar 3 în concediu" (acolo e cel mai probabil).
- Norma se calculează **doar pe zile lucrătoare** (L–V fără sărbători), deci turele din weekend și din sărbători
  apar ca ore peste norma de bază — corect pentru munca în ture, dar cine prinde multe weekenduri poate trece
  peste 100% fără să fi lucrat mai mult decât colegii (echitatea se citește din coloana „±", nu din procent).
- Norma CO/CM: 6h pe zi lucrătoare (`MODE.leaveHoursPerDay`), rotunjit la 0,1h.

## 12. Redistribuire automată (`rebalanceCoverage`)

Rulează la fiecare zi generată, DUPĂ ciclul fix, doar dacă o tură T1–T4 e goală. Evaluează TOATE
reasignările legale ale zilei (≤ 4 ture × dispecerii disponibili; căutare exhaustivă, câteva mii de
variante) și alege, în ordine: (1) cât mai multe ture acoperite; (2) suma pătratelor orelor din an
(`ctx.yearHours`, cu credit CO/CM) după azi cât mai mică = ore uniforme; (3) cât mai puține schimbări.

Un dispecer poate prelua o tură t doar dacă: nu e în CO/CM; are ≥ 11h odihnă față de tura de IERI (reală)
și (ziua următoare e continuarea blocului, care respectă mereu odihna) — `ctx.restOk`; iar seria de zile consecutive
(zile lucrate înainte + restul blocului din tura preluată, `BLOCK_REMAINING`) ≤ 4 — `ctx.consecOk(e, t)`.
Seriile socotesc și **dimineața de 6h de după T4** (`runBefore`), ca regula de 4 zile să fie reală, nu doar pe hârtie.

Efecte: fără CO/CM rezultatul e identic cu ciclul pur (no-op, ore egale). „T1 urmat de T4" poate fi
încălcată — acoperirea 24h are prioritate. Lanțurile (A preia golul, B preia tura lui A) apar des:
de ex. T4 poate fi preluat doar de cine are T1 azi (mâine tot T4), iar T1 rămas gol e preluat de altul.

Testat headless (2026-10-30, an întreg 2026 generat lună cu lună; ore efective = ture + credit CO/CM;
0 zile cu 2 pe aceeași tură în toate scenariile):

| n | fără concedii | 30 zile CO/dispecer, eșalonat |
|---|---|---|
| 5 | 0 goluri, 6h diferență/an | – (un concediu lasă o tură fără înlocuitor legal) |
| 6 | 0 goluri, 36h/an | 4 zile cu T1+T4 neacoperit, 36h/an |
| **7** | **0 goluri, 48h/an (~1250h)** | **0 goluri, 36h/an** |
| 8 | 0 goluri, 42h/an | 0 goluri, 30h/an |

Numerele de dinainte de V2026.10.12 (8h spread la n=7, 130 zile cu goluri la n=6 cu concedii) fuseseră măsurate cu
dimineața de 6h socotită „zi liberă" — nu mai sunt valabile.

Sensibilitatea la `MAX_CONSEC_DAYS` (azi 4) fusese măsurată tot atunci (max 4 → 5/6 reducea golurile). Acum regula se
aplică real la n ≥ 5, deci compromisul „max 5/6" nu mai e necesar; dacă se schimbă limita, re-măsoară cu
`node tools/harness/audit-disp.mjs`.

Zero încălcări de odihnă (11h); CO/CM păstrate 100%; ~170 ms pentru un an întreg. Golurile rămase apar când
nu există variantă legală în ziua respectivă (se corectează manual).

## 13. Sărbători legale: contor informativ (decizie manuală)

Echilibrarea automată din sărbători (V2026.10.3: raționalizare + comutator) a fost **scoasă** în
V2026.10.4 — decizia cine lucrează în sărbători o ia cine face graficul, din dropdown.

Ce rămâne:
- cardurile arată `🎉 Sărb.: N lună · M an` (`holidayShiftsCount` pe lună, `holidayShiftsYear` de la
  1 ianuarie până la sfârșitul lunii afișate);
- Statistici: coloanele „🎉 Sărb." (lună) și „🎉 Sărb. an";
- `rebalanceCoverage` (§12) alege după ore acumulate în an, apoi id — fără criteriu de sărbători;
- Excel: coloana „Sărb." (lună) și chenar auriu pe zilele de sărbătoare, ca înainte.

Istoric: în V2026.10.3 raționalizarea ținea 4 persoane/sărbătoare cu spread ore 10–16h/an (vs 0h
fără); scoasă la cerere, fiindcă utilizatorul preferă control manual.

## 14. Cel mult un dispecer pe tură — avertisment la editare manuală

Algoritmul nu produce niciodată dubluri. Dacă cineva pune manual doi dispeceri pe aceeași tură în aceeași zi,
sub tabel apare „⚠️ Ture cu mai mulți dispeceri (regula: cel mult unul pe tură)" cu zilele (`duplicateShifts`).

## 15. Setări organizație editabile (V2026.10.7)

Dispecerii au alte entități/funcții decât Exploatarea, deci modalul ⚙️ e complet configurabil:
- **Entitate** (`org.entitate`, implicit „Delgaz Grid S.A") — în subtitlu, `document.title`, Excel.
- Fiecare câmp din `ORG_FIELDS` (Formația/Unitatea, Șef FOL EM, Responsabil Tehnic, Județ, Aprobat Șef CORE):
  **denumire editabilă** (`org.labels[key]`, goală = implicită) și **bifă activ/inactiv** (`org.off[key]`).
- Inactiv = nu apare în antet, la print (`.signature-box` ascuns) și în Excel; valoarea rămâne memorată.
- Semnăturile (`orgSignatures`) sunt: Șef FOL EM, Responsabil Tehnic, Aprobat (+ județ, dacă e activ);
  Excel împarte lățimea la numărul de semnături active (0 = bloc omis).
- Compatibil cu datele vechi (fără `labels`/`off`/`entitate` → valori implicite). Se salvează în
  `graficTura_dispecer_org` și intră în exportul de lună. Dialogul de la prima pornire nu se mai redeschide
  după ce a fost salvat o dată (`org.configured`), chiar dacă toate câmpurile sunt dezactivate.
- Toate valorile se afișează cu `esc()`/`escAttr()` (import JSON de la terți).

## 16. Manualul în două moduri (V2026.10.8 / index V2026.10.2)

Butonul 📖 Manual din **ambele** aplicații deschide același manual cu două moduri: „👷 Mod Electricieni (Exploatare)" și
„🎧 Mod Dispecer" (`showHelpMode`, `HELP_DEFAULT_MODE` = modul aplicației curente). Fiecare mod are cele 7 file
(`help-exp-*` / `help-disp-*`). Aplicațiile sunt single-file, deci conținutul ambelor moduri e DUPLICAT în `index.html` și
`dispecer.html` — orice modificare de manual se face în ambele fișiere (aceeași structură, ID-uri prefixate cu modul).
CSS-ul claselor `pill-*` folosite de manualul celuilalt mod e inclus în ambele fișiere.

## 17. Structura codului (V2026.10.9 / index V2026.10.3)

`dispecer.html` e acum o pagină de ~30 linii: logica stă în `js/core.js` (comună cu Exploatarea) și `modes/dispecer.js`
(ce e specific: blocuri, redistribuire, organizație configurabilă, `MODE`). Manualul e în `js/manual-dispecer.js`.
Detalii și ghidul „cum adaug un mod" în CLAUDE.md.
