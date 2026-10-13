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

Fiecare dispecer parcurge ciclul de 5 poziții:

```
T3 → T2 → T1 → T4 → L → (repetă)
```

- Poziția avansează cu 1 în fiecare zi.
- **T1 este întotdeauna urmat de T4** (aceeași persoană).
- După T4 urmează cel puțin o zi liberă până la următorul T3.
- Ciclul curge **continuu** peste granița dintre luni (fără resetare).

## 4. Algoritm de acoperire 24h

Faza de start se distribuie round-robin după indexul din lista completă de dispeceri:

```
faza(dispecer i, ziAbs) = (i + ziAbs) % 5
tura = CICLU[faza],  CICLU = [T3, T2, T1, T4, L]  (valori [3, 2, 1, 4, 0])
```

- `ziAbs` = zile absolute de la o dată de referință (continuitate între luni).
- Indexul e luat din lista COMPLETĂ de dispeceri, ca CO/CM să nu decaleze fazele celorlalți.
- Cu 5 dispeceri → exact 1 pe fiecare tură în fiecare zi (acoperire perfectă).
- Cu alt număr → round-robin garantează cel puțin 1 pe fiecare tură.
- CO/CM introduse manual sunt păstrate (nu sunt suprascrise).

## 5. Norma (Dispecer)

- Norma lunară = media ciclului: `rotunjit(zile_din_lună × 24 / 5)`.
- CO/CM reduc norma cu orele medii pe zi (`24 / 5`).

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
  neacoperite chiar și după redistribuire — apar ca avertisment ⚠️ sub tabel (`coverageGaps`) și
  se corectează manual din dropdown.
- Norma lunară nu scade pentru sărbători (24/7 — media ciclului, 4,8h/zi): cine are zi liberă
  într-o sărbătoare poate apărea sub normă în luna respectivă (§13).
- Norma CO/CM: 4,8h/zi (media ciclului), rotunjit la 0,1h.

## 12. Redistribuire automată (`rebalanceCoverage`)

Rulează la fiecare zi generată, DUPĂ ciclul fix. Pentru fiecare tură T1–T4 fără nimeni, alege
un dispecer care:
- nu e în CO/CM în ziua respectivă;
- fie lucrează o tură acoperită de 2+ persoane, fie e în zi liberă (cu max. 4 zile consecutive);
- are ≥ 11h de odihnă față de tura de IERI (reală) și față de tura de MÂINE (din ciclu sau CO/CM);
- are cele mai puține ore în luna curentă (la egalitate, id-ul mai mic).

Efecte: fără CO/CM rezultatul e identic cu ciclul pur (no-op). „T1 urmat de T4" poate fi încălcată
când T1 e preluată de altcineva — acoperirea 24h are prioritate. Testat (nov. 2026): 7 dispeceri +
CO 3 zile → 0 goluri, 0 încălcări de odihnă/consecutive; 5 dispeceri + CO → goluri inevitabile,
raportate în `#gap-list`.

## 13. Sărbători legale: raționalizare + echilibrare (`rationalizeHoliday`)

Scop: în sărbători lucrează doar minimul, iar orele rămân cât mai uniforme între dispeceri.
Rulează după `rebalanceCoverage`, doar în zilele din `getLegalHolidays(an)`:
1. **Raționalizare** — o tură acoperită de 2+ persoane rămâne cu una singură (câte unul pe
   T1–T4); ceilalți primesc L. Rămâne la lucru cel cu cele mai puține ore acumulate în an
   (`ctx.yearHours`: ture lucrate + credit CO/CM pe zile lucrătoare, report între luni), apoi cel cu
   cele mai puține ture de sărbătoare (`holidayShiftsBefore`), apoi id-ul mai mic.
2. **Echilibrare** — dacă titularul unei ture are cu mai mult de o tură de ore peste un coleg în
   zi liberă, tura se mută la coleg (doar cu 11h odihnă și seria de zile consecutive ≤ 4, inclusiv
   zilele următoare din ciclu — `ctx.consecOk`). CO/CM nu se ating.
3. `rebalanceCoverage` (goluri din CO/CM) alege tot după ore în an, apoi după sărbători.

Fără evidențieri speciale în tabel și fără ajustarea normei (decizie utilizator). Coloana
„🎉 Sărb. an" din Statistici = `holidayShiftsYear` (informativ).

**Comutator** „🎉 Raționalizare sărbători" (bara de sus, `#holiday-balance`): `state.holidayBalance`,
implicit `true`, persistat odată cu starea (localStorage + IndexedDB + backup JSON). Oprit → toți
lucrează conform ciclului: ore perfect egale, dar 5–7 oameni lucrează într-o sărbătoare. Se aplică
la următoarea generare (lunile deja generate nu se schimbă singure — „Curăță" + „▶ Generare").

Rezultate testate (2026 întreg, 17 sărbători, fără CO), spread ore pe an / max. spread lunar:
- n=5: 0h / 8h (neschimbat — fără surplus, nu se poate raționaliza);
- n=6: 0 → 10h / 14h; n=7: 0 → 12h / 18h; n=8: 0 → 16h / 20h; câte 4 persoane în fiecare sărbătoare;
- 0 goluri noi, 0 încălcări de odihnă, 0 încălcări de zile consecutive.

Compromis: raționalizarea ia ore celor eliberați, deci spread-ul de ore crește față de ciclul
pur (0h) — alegerea după ore în an îl menține la 1–2 ture pe an. Raționalizarea și uniformitatea
perfectă a orelor se exclud reciproc.
