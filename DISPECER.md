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
- [ ] Redistribuire automată când CO/CM lasă o tură neacoperită (decizie deschisă — acum rămâne manual)

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

- Cu mai puțini de 5 dispeceri, sau cu CO/CM, unele ture pot rămâne neacoperite într-o zi
  (ciclul nu redistribuie; se corectează manual din dropdown).
- Sărbătorile legale sunt afișate (antet colorat, listă, coloană în statistici/Excel) dar nu
  modifică norma (24/7 — media ciclului, 4,8h/zi).
- Norma CO/CM: 4,8h/zi (media ciclului), rotunjit la 0,1h.
