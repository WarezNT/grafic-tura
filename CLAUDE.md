# Grafic de Tură — note tehnice pentru sesiuni viitoare

Aplicație single-file (`index.html`, ~200KB, fără build step). Deploy prin GitHub Pages
direct din `main`. Editare directă a fișierului, testare în browser (local file:// sau preview),
apoi commit + push.

## Persistență date

Trei chei de storage, INDEPENDENTE una de alta — nu se suprascriu reciproc:

- `graficTura` (`STORAGE_KEY`) — state-ul principal: `employees`, `schedule`, `config`, etc.
- `graficTura_version` (`VERSION_KEY`) — ultima versiune văzută de user, pt. popup changelog
- `graficTura_org` (`ORG_KEY`) — date organizație (formație, șef FOL, responsabil tehnic).
  **Deliberat separat de `state.org`** — vezi „Bug fix: org reset" mai jos.

Plus IndexedDB (`GraficTuraDB`) ca back-up secundar la `saveState()`.

### Bug fix istoric: org data se reseta la fiecare deploy/import
Cauză: `state.org` era suprascris de orice import JSON (lună sau backup complet) sau
migrare de state. Fix: org trăiește acum EXCLUSIV în `ORG_KEY`, citit prin `getOrg()`
(fallback la `state.org` doar pt. compatibilitate cu date foarte vechi). `applyJSON` nu
mai scrie peste `ORG_KEY` dacă acesta există deja.

## Versionare + changelog

`APP_VERSION` (format `VYYYY.MM.N`) și `CHANGELOG[APP_VERSION]` — ambele manuale, în
`index.html` lângă top. La fiecare schimbare vizibilă pt. user: bump `APP_VERSION`,
adaugă un entry nou în `CHANGELOG`. Popup-ul de changelog (`checkVersion()`) se declanșează
când `localStorage[VERSION_KEY] !== APP_VERSION` — **cheile trebuie să fie identice**
(am avut odată un typo: `CHANGELOG['V2026.06.16']` vs `APP_VERSION='V2026.06.1'` → popup
nu apărea niciodată, fail silențios pentru că `CHANGELOG[APP_VERSION]` era `undefined`).

`COMMIT_COUNT` (afișat în footer lângă versiune) se auto-actualizează la fiecare commit
via git hook `.githooks/pre-commit` (activat prin `git config core.hooksPath .githooks`
— setare LOCALĂ, trebuie rulată o dată pe orice clone nou).

## Valorile turelor (`SHIFT_NAMES`, folosite peste tot ca număr, nu string)

| Val | Cod | Sens |
|---|---|---|
| 0 | L | Liber |
| 1 | T1 | 12h, 06:00–14:00 (start) |
| 2 | T2 | 12h, 14:00–22:00 (start) |
| 3 | T1A | variantă T1, doar L-V |
| 4 | T2A | variantă T2, doar L-V |
| 5 | CO | Concediu odihnă (manual) |
| 6 | CM | Concediu medical (manual) |
| 7 | 8 | Program 8h, doar L-V (08:00–16:00) |
| 8 | INST | Instruire, orice zi, manual — contorizat ca lucrat |

`crewOverrides: {'YYYY-MM-DD': 'crewName'}` pe fiecare angajat — `getCrewForDay(emp, dk)`
întoarce cel mai recent override ≤ data curentă (permite schimbare de echipaj la mijlocul
lunii, oricâte modificări pe lună).

## Reguli deja existente în aplicație (nu ținute de fixurile din sesiunea curentă)

- **CO/CM nu se contorizează în weekend**: `getEmployeeStats()` exclude explicit
  `v===5|6 && isWeekend` din calculul orelor — regulă de business (CO/CM consumă normă
  doar în zile lucrătoare). Recent completat cu afișare: în weekend, o celulă cu CO/CM
  în state se AFIȘEAZĂ ca `L` (dropdown-ul nici nu oferă CO/CM ca opțiune pe S/D) — doar
  vizual, valoarea reală rămâne CO/CM în `state.schedule` (regenerarea o păstrează corect).
- **Extensie CO/CM la weekend adiacent**: dacă vinerea (sau lunea) are CO, sâmbăta/duminica
  adiacentă primește automat același marcaj la regenerare (`startGeneration()` +
  `generateDay()`, secțiunea „weekend extension").
- **Max 4 zile consecutive lucrate** (doar în modurile `full`/`t12`, via
  `assignCategoryShifts` → `MAX_CONSEC=4`): angajații cu `consec>=4` sunt excluși din
  alocare, forțați spre `L`. **Nu există în modul `rotation`** — posibilă sursă viitoare
  de dezechilibru sau oboseală dacă cineva prelungește manual un ciclu.
- **T2 blochează T1/T1A a doua zi** (`checkYesterday`, doar `full`/`t12`): dacă ieri a fost
  T2, azi nu poate fi T1 sau T1A (gap de 8h între ture) — T2A nu blochează nimic.
- **`forced8`**: angajatul primește mereu tura `8` (valoare 7) în zile lucrătoare, exclus
  din orice altă alocare automată; weekend → `L`. Grupați separat în tabel sub „Program 8
  ore", după Rural.
- **Alternanță par/impar zi** (`full`/`t12`): ordinea de asignare T1↔T2 se inversează în
  funcție de paritatea zilei, ca să nu se stabilizeze un singur echipaj mereu pe aceeași
  tură.

## Algoritmul de generare — 3 moduri (`state.genMode`)

- `full` — T1/T2 + T1A/T2A alocate automat
- `t12` (**implicit**) — doar T1/T2 automat, T1A/T2A rămân manuale
- `rotation` — „Rotație 8 zile", ciclu fix per echipaj/individ

Toate rulează prin `generateDay(day)` → `assignCategoryShifts()` (full/t12) sau
`assignRotationShifts()` (rotation), apelat separat pt. fiecare grup (`urban`, `rural`)
în `full`/`t12`, dar **o singură dată cu toți angajații amestecați** în `rotation` — motiv
pentru bug-ul de mai jos.

### Modul `rotation` — cum gândește

`ROTATION = [1,3,2,0,1,4,2,0]` = T1→T1A→T2→L→T1→T2A→T2→L, ciclu de 8 zile.
Fiecare echipaj (sau individ fără echipaj complet) are o "fază" = poziția lui în acest
ciclu la ziua curentă.

**Grupare**: angajații se grupează după `getCrewForDay()` (echipaj efectiv la acea dată,
ținând cont de `crewOverrides`). Echipaje complete (≥2 membri) merg în `fullCrews`,
restul (echipaj gol sau echipaj cu 1 singur membru rămas) în `individuals`.

**Trei probleme structurale găsite și fixate** (toate în `assignRotationShifts`,
`index.html` ~linia 1137):

1. **Coliziune inevitabilă la 5+ echipaje/grup** — `ROTATION` are simetrie de perioadă 4
   (T1/T2/L se repetă, doar T1A/T2A diferă între prima și-a doua jumătate a ciclului).
   Cu 5 echipaje, cel puțin o pereche (idx0↔idx4 în orice moment) va cere mereu aceeași
   tură în aceeași zi — inevitabil dat fiind ciclul.
   **Fix parte 1 — fairness pe ore**: la conflict, câștigă cine are mai puține ore
   acumulate luna curentă (`getEmployeeStats(id).hours`), nu mai mereu id-ul mai mic.
   **Fix parte 2 — rotație de bloc**: poziția fiecărui echipaj în ciclu (`idx`) se
   decalează la fiecare bloc de 8 zile (`block = Math.floor((day-1)/8)`,
   `idx = (i + block) % n`), ca perechea care se ciocnește să se rotească printre toate
   echipajele pe parcursul lunii, nu să cadă mereu pe aceeași pereche fixă.

2. **T1A/T2A pierdute în weekend, fără recuperare** — T1A/T2A rulează doar L-V
   (`limits[cat].t1a = weekend ? 0 : c.t1a`). Ciclul de 8 zile și săptămâna de 7 zile
   "alunecă" una față de alta — unele echipaje nimeresc mai des cu faza lor de T1A/T2A
   tocmai în weekend (unde e blocat), pierzând acea zi complet, fără nicio compensare.
   Alte echipaje evită coincidența și lucrează normal. Efect: diferențe mari de ore
   (ex. 80h vs 184h într-o lună) — **mai grav decât problema #1** când T1A/T2A sunt
   configurate activ (>0).
   **Fix — `weekendFallback()`**: dacă faza cade pe T1A/T2A tocmai în weekend ȘI
   formația chiar folosește T1A/T2A în timpul săptămânii (config > 0), faza cade pe
   echivalentul principal (T1A→T1, T2A→T2) și concurează normal pentru acel slot, în loc
   să se piardă. Dacă T1A/T2A sunt dezactivate complet (config=0), comportamentul rămâne
   neschimbat (L) — fallback-ul nu inventează cerere unde nu exista una reală.

3. **Rotația de fază amesteca Urban și Rural** — cel mai subtil și mai grav bug. Deși
   limitele numerice (`limits[cat]`) sunt per-categorie, `fullCrews`/`individuals` erau
   liste UNICE care combinau echipaje urban ȘI rurale, iar `idx`/`block` se calculau pe
   lista combinată (`nCrews` = 10 în loc de 5 per grup, de exemplu). Asta strica total
   matematica de anti-coliziune derivată pentru dimensiunea REALĂ a fiecărui grup (n=5).
   **Fix**: `idx`/`block` se calculează acum SEPARAT per categorie — bucla iterează
   `GROUPS` (`['urban','rural']`) și filtrează `fullCrews`/`individuals` per categorie
   înainte de a calcula `idx`, fiecare cu propriul `n`.

**Rezultate testate** (5 echipaje/grup, config identic ambele grupe, generare simulată
via `startGeneration()` + `generateAll()` în consolă browser):
- T1A/T2A=0: spread redus la ~16h (88-104h)
- T1A/T2A=2 (config real, luna Septembrie): spread ~8h (136-144h) — cel mai bun caz
- T1A/T2A=2 (Iulie): spread ~24h (136-160h) — variază puțin cu luna (nr. de weekend-uri,
  aliniere zile), dar mult sub bug-ul original (56-104h spread)
- 4 echipaje/grup (fără coliziune structurală): întotdeauna perfect egal (0h spread),
  neschimbat de niciunul din fixuri — bun test de regresie rapid

**Dacă apare din nou un raport de "cineva are mult mai multe/puține ore"**: prima
verificare — cere config-ul exact (T1/T1A/T2/T2A pt. ambele grupe) + luna, reproduce
în consolă browser (vezi metoda de testare mai jos), și verifică dacă nu cumva a apărut
o A PATRA sursă de asimetrie neacoperită încă (ex. interacțiune cu CO/CM, cu `forced8`,
cu `crewOverrides` la mijlocul lunii, sau cu `MAX_CONSEC` din `assignCategoryShifts` —
regula de max 4 zile consecutive lucrate nu e implementată deloc în `assignRotationShifts`,
ar putea fi următoarea sursă de dezechilibru la configurații extreme).

### Metodă de testare rapidă (fără UI, direct în consolă browser)

```js
function setCfg(g, vals) {
  ['t1','t1a','t2','t2a','c8'].forEach(k => { document.getElementById('cfg-'+g+'-'+k).value = vals[k]||0; });
}
state.employees = [];
let id = 1;
['U1','U2','U3','U4','U5'].forEach(cr => { for(let i=0;i<2;i++) state.employees.push({id:id++,name:cr+'-'+i,category:'urban',functia:'emitent',crew:cr,forced8:false,crewOverrides:{}}); });
setCfg('urban', {t1:2,t1a:2,t2:2,t2a:2});
setCfg('rural', {t1:0,t2:0});
state.genMode = 'rotation';
state.schedule = {}; state.preservedCOCM = {}; genCOCM = {};
document.getElementById('sel-year').value = 2026;
document.getElementById('sel-month').value = 9;
startGeneration();
generateAll();
state.employees.map(e => getEmployeeStats(e.id).hours);
```

Deschide fișierul local în Browser pane (`mcp__Claude_Browser__navigate` la
`file:///...index.html`), rulează scriptul de mai sus via `javascript_exec` — mult mai
rapid decât click-uri manuale în UI pentru testarea unor configurații multiple.
**Atenție**: `readConfig()` citește din DOM, nu din `state.config` — trebuie setate
inputurile (`cfg-urban-t1` etc.) direct, altfel `startGeneration()` poate afișa un
`confirm()` (care se auto-respinge în execuție headless) și ieși silențios fără să genereze
nimic.

## Toolbar (structură curentă)

- Bara de sus (`.controls`): navigare lună/an, config Urban/Rural, `Mod`, apoi
  `▶ Generare` / `✕ Curăță` / `+ Electrician` — pinned la dreapta via un `<span
  style="flex:1">` plasat imediat înainte de ele (containerul părinte are nevoie de
  `width:100%` ca `flex:1` să aibă unde să se extindă).
- Bara de jos (`.toolbar`): dropdown `💾 Fișiere` (salvare/încărcare JSON), `📊 Excel`,
  `🖨️ Print/PDF`, `📖 Manual`, badge versiune + `#commit`.

## Alte convenții

- Tooltips: `data-tooltip` attribute + CSS `::after`/`::before` (nu `title` — stil custom).
- Dark mode: `[data-theme="dark"]` pe `<html>`, toggle manual (nu urmărește
  `prefers-color-scheme`).
- Ștergere angajat: confirmare în 2 pași (`deleteConfirmStep()`, auto-reset după 3s).
