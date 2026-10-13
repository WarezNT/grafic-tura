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

## 3. Ciclul de rotație

Regulă de bază (V2026.10.6): **într-o tură (T1–T4) nu poate fi mai mult de un dispecer într-o zi — ceilalți sunt
liberi**. Ciclul fiecărui dispecer are lungimea `max(5, nr. dispeceri)`:

```
T3 → T2 → T1 → T4 → L → (L ... până la lungimea ciclului) → repetă
```
- n = 5: T3,T2,T1,T4,L (4 zile lucrate, 1 liberă). n = 7: T3,T2,T1,T4,L,L,L. n = 10: 4 lucrate + 6 libere.
- Poziția avansează cu 1 pe zi; ciclul curge continuu peste luni/ani (fără resetare).
- T1 e urmat de T4; după T4 cel puțin o zi liberă; max 4 zile lucrate la rând.
- n < 5: ciclul rămâne de 5, deci nu toate turele pot fi acoperite (inevitabil).

## 4. Algoritm de acoperire 24h

```
poz(dispecer i, ziAbs) = (i + ziAbs) % lungimeCiclu        i = indexul în lista COMPLETĂ (după id)
tura = poz < 4 ? [T3, T2, T1, T4][poz] : L
```
- `ziAbs` = zile absolute (continuitate între luni). Indexul e din lista completă, ca CO/CM să nu decaleze fazele.
- Pentru n ≥ 4 fazele sunt distincte → fiecare tură are exact un dispecer în fiecare zi (n ≥ 5).
- CO/CM introduse manual sunt păstrate; golurile rezultate se completează prin §12.
- Siguranță la schimbarea numărului de dispeceri (ciclul se recalculează): dacă tura din ciclu ar încălca
  odihna de 11h față de ieri sau ar depăși 4 zile la rând, dispecerul primește L (`assignDispecerShifts`).

## 5. Norma (Dispecer)

- Ore medii pe zi = `24 / max(5, nr. dispeceri)` (`avgHoursPerDay()`); norma lunară = `round(zile × ore_medii)`.
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
și față de tura de MÂINE (din ciclu sau CO/CM) — `ctx.restOk`; iar dacă era în zi liberă, seria de
zile consecutive ≤ 4 inclusiv zilele următoare din ciclu — `ctx.consecOk`.

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
