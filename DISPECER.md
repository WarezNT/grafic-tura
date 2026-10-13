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
| 1 | T1 | 4 | 06:00–10:00 | |
| 2 | T2 | 6 | 10:00–16:00 | |
| 3 | T3 | 6 | 16:00–22:00 | Prima tură din ciclu |
| 4 | T4 | 8 | 22:00–06:00 | Trece de miezul nopții; o singură celulă |
| 5 | CO | 0 | — | Concediu odihnă (manual) |
| 6 | CM | 0 | — | Concediu medical (manual) |

T1+T2+T3+T4 = 24h (acoperire completă a zilei).

## 3. Blocuri de ture (V2026.10.8 — înlocuiește ciclul fix pe poziții)

Regulă dură: **într-o tură (T1–T4) nu poate fi mai mult de un dispecer într-o zi — ceilalți sunt liberi**.

Un **bloc** = `T3 → T2 → T1 → T4` (4 zile la rând), urmat de cel puțin o zi liberă. În fiecare zi începe
**exact un bloc nou** (T3), deci fiecare tură are un singur dispecer. Cu n dispeceri, 4 lucrează pe zi și n−4 sunt liberi
(n=5: 4 din 5; n=7: 4 din 7, fiecare face un bloc la ~7 zile).

De ce nu mai e ciclu fix: cu 7 dispeceri un ciclu de 7 zile = o săptămână → fiecare ajungea să lucreze mereu aceleași zile
ale săptămânii (măsurat 2026: ture în weekend 104/52/0/0/52/104/104, T4 mereu în aceeași zi). Acum cine începe se alege la fiecare zi.

## 4. Algoritm (`assignDispecerShifts`)

Pentru ziua d, pornind de la tura reală de IERI a fiecărui dispecer (`BLOCK_NEXT`):
1. **Continuă blocurile în curs**: ieri T3 → azi T2; T2 → T1; T1 → T4; T4 → L.
2. **Alege cine începe T3 azi** dintre cei odihniți (ieri nu T4/bloc, nu în CO/CM, fără CO/CM în următoarele 3 zile, ca să
   nu rupă blocul): ore în an cu credit CO/CM (`ctx.yearHours`) la nivel de bloc (toleranță 24h, `BLOCK_HOURS`), apoi
   **cele mai puține weekenduri+sărbători** lucrate în an (`weekendHolidayShifts`), apoi ore, apoi id.
   Toleranța de 24h e esențială: fără ea, diferențe mici de ore impun o coadă fixă care la 7 dispeceri se blochează iar pe zilele săptămânii.
3. Fără istoric (prima zi generată): „ieri" virtual T1/T2/T3 pentru primii trei, ca toate cele 4 ture să pornească din prima zi.
4. CO/CM introduse manual se păstrează; golurile rezultate se completează prin §12.

Blocul garantează prin construcție: T1→T4, odihnă ≥ 11h, max 4 zile la rând, cel puțin o zi liberă după T4, o singură persoană pe tură.
Schimbarea numărului de dispeceri la mijloc de an nu cere nicio recalculare (starea e în `state.schedule`, nu într-o formulă).

Testat (2026, fără concedii, ture lucrate în weekend per dispecer / spread; goluri 0, dubluri 0, încălcări 0):
n=5: 84/83/83/83/83 (1) · n=6: 67–73 (6) · **n=7: 59–60 (1)** · n=8: 42–57 (15) · n=10: 40–44 (4).

## 5. Norma (Dispecer)

- Ore medii pe zi = `24 / max(5, nr. dispeceri)` (`cycleLength()`, `avgHoursPerDay()`); norma lunară = `round(zile × ore_medii)`.
  Ex. 7 dispeceri: 3,43h/zi → ~103h/lună, ~1250h/an (nu 144h ca la 5 dispeceri).
- CO/CM reduc norma cu orele medii pe zi (doar zile lucrătoare).

## 6. Interfață (Dispecer)

- Antet: logo, titlu „Grafic dispecer", selector Modul, ⚙️ organizație, 🌙 mod întunecat.
- Bara de sus: navigare lună/an, etichetă informativă „Acoperire 24h automată", butoane
  `▶ Generare` / `✕ Curăță` / `+ Dispecer`.
- Tabel: un rând pe dispecer, o coloană pe zi, dropdown per celulă (`L, T1, T2, T3, T4, CO, CM`).
  În weekend CO/CM nu sunt oferite. Coloane finale: Lucrate, CO/CM, Normă.
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
  consecutive e principala cauză (vezi sensibilitatea din §12) — apar ca avertisment ⚠️ sub tabel (`coverageGaps`) și
  se corectează manual din dropdown.
- Norma lunară nu scade pentru sărbători (24/7 — 24h / lungimea ciclului pe zi): cine are zi liberă
  într-o sărbătoare poate apărea sub normă în luna respectivă (§13).
- Norma CO/CM: ore medii pe zi (`avgHoursPerDay`, ex. 3,4h la 7 dispeceri), rotunjit la 0,1h.

## 12. Redistribuire automată (`rebalanceCoverage`)

Rulează la fiecare zi generată, DUPĂ ciclul fix, doar dacă o tură T1–T4 e goală. Evaluează TOATE
reasignările legale ale zilei (≤ 4 ture × dispecerii disponibili; căutare exhaustivă, câteva mii de
variante) și alege, în ordine: (1) cât mai multe ture acoperite; (2) suma pătratelor orelor din an
(`ctx.yearHours`, cu credit CO/CM) după azi cât mai mică = ore uniforme; (3) cât mai puține schimbări.

Un dispecer poate prelua o tură t doar dacă: nu e în CO/CM; are ≥ 11h odihnă față de tura de IERI (reală)
și (ziua următoare e continuarea blocului, care respectă mereu odihna) — `ctx.restOk`; iar seria de zile consecutive
(zile lucrate înainte + restul blocului din tura preluată, `BLOCK_REMAINING`) ≤ 4 — `ctx.consecOk(e, t)`.

Efecte: fără CO/CM rezultatul e identic cu ciclul pur (no-op, ore egale). „T1 urmat de T4" poate fi
încălcată — acoperirea 24h are prioritate. Lanțurile (A preia golul, B preia tura lui A) apar des:
de ex. T4 poate fi preluat doar de cine are T1 azi (mâine tot T4), iar T1 rămas gol e preluat de altul.

Testat (2026, ore efective = ture + credit CO/CM; fără dubluri: 0 zile cu 2 pe aceeași tură în toate scenariile):

| n | fără concedii | 30 zile CO/dispecer, eșalonat | idem, aleator |
|---|---|---|---|
| 5 | 0 goluri, 0h spread | 133 zile cu goluri* | 114* |
| 6 | 0 goluri, 8h | 130 | 103 |
| **7** | **0 goluri, 8h (~1250h/an)** | **0 goluri, 35h** | **23 zile, 18h** |
| 8 | 0 goluri, 18h | 0 goluri, 35h | 3 zile, 39h |
| 10 | 0 goluri, 24h | – | – |

\* cu 5 dispeceri un singur concediu lasă o tură fără înlocuitor legal.

Sensibilitate la „max zile consecutive" (`MAX_CONSEC_DAYS`, azi 4) când cineva e chemat din zi liberă,
zile cu goluri pe an (eșalonat / aleator): n=6: 130/103 (max 4) → 1/26 (max 5) → 0/21 (max 6);
n=7: 0/23 → 0/9 → 0/2; n=8: 0/3 → 0/1 → 0/1. Decizie de business (regulamentul intern).

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
