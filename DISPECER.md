# Modul Dispecer — design și proces de implementare

Aplicația Grafic de Tură deservea inițial un singur modul („Exploatare" — electricieni,
2 grupe Urban/Rural, ture de 8h). Acest document descrie al doilea modul, **Dispecer**,
adăugat în același fișier `index.html`, fără să afecteze modulul existent (în producție).

## 1. Scop

Modulul Dispecer planifică turele dispecerilor (dispecerat), care lucrează în ture cu
durate diferite, pe o schemă de rotație continuă pentru acoperire 24h.

## 2. Decizii luate (cu utilizatorul)

| Subiect | Decizie |
|---|---|
| Comutare module | Selector **„Modul"** în bara de sus |
| Angajați | **Listă separată** complet de electricienii de exploatare |
| Structura | **Un singur grup** (fără Urban/Rural) |
| Ciclu de rotație | **T3 → T2 → T1 → T4 → [liber]**, apoi se repetă |
| Început | Ciclul începe cu T3 |
| După T4 | Minim o zi liberă până la următorul T3 (variabil) |
| Legătură T1↔T4 | Persoana care a fost în **T1 este întotdeauna și în T4** (T1 urmat direct de T4) |
| Număr pe tură | **Automat:** acoperire 24h cu cele 4 ture |
| Ore pe tură | T1=4h, T2=6h, T3=6h, T4=8h (concediu CO/CM = 0h) |
| Coduri speciale (AUT/EXM/PND/IN) | **Nu se implementează acum** — manual, ulterior |
| Afișare T4 (22:00–06:00) | **O singură celulă**, în ziua de start |

## 3. Tipurile de tură

| Val | Cod | Ore | Interval | Observații |
|-----|-----|-----|----------|-----------|
| 0 | L | 0 | — | Liber |
| 1 | T1 | 4 | 06:00–10:00 | |
| 2 | T2 | 6 | 10:00–16:00 | |
| 3 | T3 | 6 | 16:00–22:00 | Prima tură din ciclu |
| 4 | T4 | 8 | 22:00–06:00 | Trece de miezul nopții; o singură celulă |
| 5 | CO | 0 | — | Concediu odihnă (manual) |
| 6 | CM | 0 | — | Concediu medical (manual) |

Total 24h acoperite de T1+T2+T3+T4.

## 4. Ciclul de rotație

Fiecare dispecer parcurge ciclul de 5 poziții:

```
T3 → T2 → T1 → T4 → L → (repetă)
```

- Poziția avansează cu 1 în fiecare zi.
- T1 este întotdeauna urmat de T4 (aceeași persoană).
- Ziua liberă (L) este poziția 4 din ciclu; poate fi modificată manual
  (variabil — ex. concediu, zile suplimentare libere).

## 5. Algoritmul de acoperire (24h)

Fiecare dispecer primește o „fază" de start în ciclu, distribuită round-robin:

```
faza(i) = i % 5            // i = index în lista sortată de dispeceri
tura(i, ziAbs) = CICLU[(faza(i) + ziAbs) % 5]
CICLU = [T3, T2, T1, T4, L]   // valori [3, 2, 1, 4, 0]
```

- `ziAbs` = numărul absolut de zile de la o dată de referință (flux continuu peste
  granița dintre luni, la fel ca la exploatare).
- Cu 5 dispeceri, fiecare zi are exact câte 1 pe fiecare tură (acoperire perfectă).
- Cu alt număr, distribuția round-robin garantează **cel puțin 1** pe fiecare tură.
- CO/CM introduse manual sunt păstrate (algoritmul nu le suprascrie).

## 6. Arhitectură (integrare în index.html)

Pentru a nu atinge logica modulului Exploatare, se introduce un strat de „module":

- `MODULE_DEFS` — registru cu, pentru fiecare modul: `label`, `groups`, `groupNames`,
  `shiftNames`, `shiftHours`, `storageKey`, `dbKey`.
- `CURRENT_MODULE` — 'exploatare' (implicit) sau 'dispecer', salvat în
  `localStorage['graficTura_module']`.
- `GROUPS`, `SHIFT_NAMES`, `SHIFT_HOURS` devin variabile (nu `const`) și sunt setate
  din `MODULE_DEFS[CURRENT_MODULE]` la pornire și la schimbarea modulului.
- Datele fiecărui modul se păstrează **separat**:
  - Exploatare: `graficTura` (compatibil cu versiunile existente)
  - Dispecer: `graficTura_dispecer`
  - IndexedDB: chei `main` / `main_dispecer`
- Organizația (formație, șef, etc.) rămâne **comună** (`graficTura_org`).

### Puncte care devin module-aware

1. `getEmployeeStats()` — orele se calculează din `SHIFT_HOURS[v]`, nu `v * 8`.
2. `renderTable()` — numărul de ture din `SHIFT_NAMES.length`, grupe din `GROUPS`,
   ore din `SHIFT_HOURS`.
3. `renderLegend()` — legendă specifică modulului.
4. `renderSummary()` — pastile/tabel din `counts[]` (index de tură), generic.
5. `generateDay()` — ramură Dispecer (`assignDispecerShifts`).
6. `exportExcel()` — culori/legende/totaluri module-aware.
7. Bara de configurare — câmpuri diferite per modul.
8. Modalul adaugă/editează angajat — categorie unică pentru Dispecer.

## 7. Pași de implementare (checklist)

- [x] Definiții module (`MODULE_DEFS`, `CURRENT_MODULE`, `GROUPS`/`SHIFT_NAMES`/`SHIFT_HOURS` mutabile)
- [ ] `defaultState()` module-aware (câmp `module`, config Dispecer `{t1,t2,t3,t4}`)
- [ ] Persistență separată (`loadState`/`saveState`/`initStateFromDB` cu chei per modul)
- [ ] `migrateState()` module-aware
- [ ] `getEmployeeStats()` cu `SHIFT_HOURS`
- [ ] Selector „Modul" în bara de sus + `switchModule()`
- [ ] `assignDispecerShifts()` + ramură în `generateDay()`
- [ ] `renderTable()` generic (ture, grupe, ore)
- [ ] `renderLegend()` per modul
- [ ] `renderSummary()` generic (counts)
- [ ] Config UI per modul (Dispecer: doar t1–t4)
- [ ] Modale angajat per modul
- [ ] Export Excel + Print module-aware
- [ ] Secțiune în manual + intrare în changelog

## 8. Riscuri / atenționări

- Aplicația este în producție — modulul Exploatare nu trebuie să se schimbe.
- `SHIFT_NAMES`/`GROUPS` erau `const`; devin variabile — de verificat că nicio funcție
  nu le captează valoarea la definire.
- Export/print trebuie testate în ambele module.
- Codurile speciale (AUT/EXM/PND/IN) se adaugă ulterior, manual, ca CO/CM.
