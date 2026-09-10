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
- **Max 4 zile consecutive lucrate** (`MAX_CONSEC=4`, în `assignCategoryShifts` PENTRU
  full/t12 ȘI în `assignRotationShifts` pentru `rotation` — adăugat ulterior, inițial lipsea
  din rotation): dacă orice membru al echipajului/individul are `genStats[id].consec>=4`,
  primește `L` în loc de tura dorită de rotație. Nu face compensare încrucișată — dacă un
  echipaj e blocat de MAX_CONSEC, sloturile lui rămân neocupate (nu se redistribuie automat
  către alt echipaj care dorea alt tip de tură în acea zi).
- **T2 blochează T1/T1A a doua zi** (`checkYesterday`, doar `full`/`t12`): dacă ieri a fost
  T2, azi nu poate fi T1 sau T1A (gap de 8h între ture) — T2A nu blochează nimic.
- **`forced8`**: angajatul primește mereu tura `8` (valoare 7) în zile lucrătoare, exclus
  din orice altă alocare automată; weekend → `L`. Grupați separat în tabel sub „Program 8
  ore", după Rural.
- **Alternanță par/impar zi** (`full`/`t12`): ordinea de asignare T1↔T2 se inversează în
  funcție de paritatea zilei, ca să nu se stabilizeze un singur echipaj mereu pe aceeași
  tură.

## Algoritmul de generare — 4 moduri (`state.genMode`)

- `full` — T1/T2 + T1A/T2A alocate automat
- `t12` (**implicit**) — doar T1/T2 automat, T1A/T2A rămân manuale
- `rotation` — „Rotație 8 zile": ciclu fix T1→T1A→T2→L→T1→T2A→T2→L per echipaj/individ
- `rotation3` — „Rotație T1-T2-L (3 zile)": ciclu fix T1→T2→L per echipaj/individ

Toate rulează prin `generateDay(day)` → `assignCategoryShifts()` (full/t12) sau
`assignRotationShifts()` (ambele moduri `rotation*`), apelat separat pt. fiecare grup
(`urban`, `rural`) în `full`/`t12`, dar **o singură dată cu toți angajații amestecați** în
`rotation*` — motiv pentru bug-ul #3 de mai jos.

`assignRotationShifts(emps, dk, assigned, day, weekend, cfgs, ROTATION)` e generică —
`ROTATION` e array-ul de cicluri (`[1,3,2,0,1,4,2,0]` pt. 8 zile, `[1,2,0]` pt. 3 zile),
`CYCLE_LEN = ROTATION.length` înlocuiește orice `8` hardcodat (block, modulo). Adăugarea
modului `rotation3` a fost doar generalizarea funcției + un nou `case` în `generateDay()`
+ o opțiune nouă în select — toate fixurile de mai jos (fairness, rotație de bloc,
separare per categorie, MAX_CONSEC) se aplică automat la orice ciclu nou, fără duplicare.

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

4. **Lipsea gap-ul de siguranță T2→T1/T1A** — regula „dacă ieri a fost T2, azi nu poate fi
   T1 sau T1A" există în `full`/`t12` (`checkYesterday`) dar lipsea complet din
   `assignRotationShifts`. Ciclurile proprii (8 și 3 zile) nu produc natural T2 urmat
   direct de T1 — dar rotația de bloc poate crea un salt de fază la granița dintre
   blocuri, unde teoretic ar putea apărea.
   **Fix**: verificare explicită în `doAssign` — `sv∈{1,3} && cineva din listă are
   `genStats[id].yesterday === 2`` → refuzat, primește `L`.

5. **Bias persistent la reziduu + prag greșit pt. detecția coliziunii** — două probleme
   găsite împreună:
   - Când zilele lunii nu se împart exact la `CYCLE_LEN` (ex. 31 zile / ciclu de 3 → 10
     blocuri complete + 1 zi reziduală), fără corecție **ACELAȘI** echipaj (idx0) câștiga
     mereu ziua în plus — nu doar o lună, ci în FIECARE lună de 31 de zile, tot anul.
     Descoperit de user testând exact 3 echipaje/grup (potrivire perfectă cu ciclul de 3
     zile — teoretic fără nicio coliziune, dar reziduul lunii tot introducea bias).
   - În timp ce investigam, a ieșit la iveală un prag greșit: presupusesem că o coliziune
     de tură apare doar dacă `n > CYCLE_LEN`. Fals — `n<=CYCLE_LEN` garantează idx unic,
     dar NU garantează tură unică, dacă `ROTATION` însuși repetă aceeași valoare pe poziții
     diferite (ex. T1 la poziția 0 ȘI 4 în ciclul de 8 zile). Pragul greșit dezactiva
     incorect rotația de bloc pentru `rotation` (8 zile) cu n=5 (5≤8, dar EXISTĂ coliziune
     reală — asta era exact problema #1 de mai sus).
   **Fix**: `hasCollision(n)` verifică direct, pentru fiecare zi a ciclului, dacă există
   două `idx` din `[0,n)` care cer aceeași tură reală (L exclus) — nu se mai bazează pe
   un prag presupus. `blockFor(n)`: dacă NU există coliziune, `idx` rămâne FIX toată luna
   (ciclu perfect simetric, neîntrerupt — exact ce a cerut userul) + se aplică doar un
   offset dependent de lună (`monthSeed`) ca reziduul să se rotească între luni diferite,
   nu să favorizeze mereu același echipaj. Dacă EXISTĂ coliziune, se folosește rotația de
   bloc din interiorul lunii (ca înainte) — **fără** `monthSeed` suprapus, pentru că
   adăugarea lui acolo schimbă tie-break-urile în moduri imprevizibile și înrăutățește
   rezultatul (testat empiric și respins).
   **Efect colateral bun**: odată cu pragul corect, cazul „perfect" cu 4 echipaje/ciclu de
   8 zile (afectat ușor de fix-ul #4, spread ~8h) a revenit la 0h spread — fără coliziune
   reală acolo, idx rămâne fix, deci ciclul neîntrerupt respectă deja natural gap-ul T2→T1.

**Rezultate testate** (generare simulată via `startGeneration()` + `generateAll()` în
consolă browser):
(după fix #14 — fază continuă `absDay`, fără `monthSeed`):
- `rotation` (8 zile), config identic ambele grupe:
  - 4 echipaje/grup (fără coliziune): 0h spread (perfect)
  - 5 echipaje/grup, T1A/T2A=2 (Sept ȘI Iulie): spread ~8h (136-152h) — Iulie s-a
    îmbunătățit de la ~24h la ~8h datorită continuității
- `rotation3` (3 zile), T1=2/T2=2 ambele grupe:
  - 3 echipaje/grup: 0h spread pe unele luni, 8h pe altele — reziduul se rotește natural
    între echipaje de la lună la lună
  - 5 echipaje/grup: spread ~8-16h în toate lunile (era 0h pe lunile de 30 zile cu
    `monthSeed`, dar acela avea bug-ul de graniță #14 — compromis acceptat)
  - Zero violări T2→T1/T1A și tranziții de lună legale, verificate programatic pe toate

6. **`hasCollision` nu vedea coliziunile create de `weekendFallback`** — găsit prin testare
   automată (matrice 1-6 echipaje × 4 lungimi de lună). `hasCollision(n)` verifica doar
   `ROTATION` static, dar `weekendFallback` remapează dinamic T1A→T1 și T2A→T2 în weekend
   (când formația chiar folosește T1A/T2A activ) — o poziție din ciclu poate cădea pe orice
   zi a săptămânii de-a lungul lunii, deci fallback-ul putea crea coliziuni noi (ex. T1 la
   poz. 0 ȘI 1, dacă poz. 1 era T1A) nedetectate de verificarea pe array-ul static, lăsând
   rotația de bloc dezactivată exact când era nevoie de ea (ex. n=3,4 cu T1A/T2A activ).
   **Fix**: `hasCollision(n, cat)` verifică ACUM ambele variante — `ROTATION` de bază ȘI
   varianta cu T1A/T2A remapate la T1/T2 (doar dacă formația chiar le folosește activ).
   **Rezultat**: n=3 Septembrie 24h→8h spread, n=4 Septembrie 24h→16h spread, fără regresie.

### Împerechere temporară a „orfanilor" (echipaj rupt de CO/CM sau fără echipaj)

Când un membru al unui echipaj ia CO/CM, partenerul rămas fără pereche era tratat ca individ
solo — concura prost cu echipajele complete (putea rămâne aproape complet pe `L`), sau, mai
grav, doi orfani din echipaje DIFERITE puteau ajunge să lucreze pe **ture diferite în aceeași
zi** (unul T1, altul T2) — nu doar inechitabil, ci nerealist (electricienii nu lucrează
singuri). Găsit de user pe date reale (captură cu 3 echipaje, unul cu CO parțial).

**Fix, aplicat în TOATE cele 4 moduri**: cei rămași fără pereche într-o zi (CO/CM pe partener,
sau angajat fără echipaj setat deloc) sunt împerecheați TEMPORAR între ei, determinist după id
(primii doi din listă formează o pereche, următorii doi alta, ș.a.m.d.; ultimul rămâne solo
dacă numărul e impar). Perechea temporară e tratată de restul algoritmului exact ca un echipaj
normal de 2 — aceleași reguli de capacitate, gap T2→T1, MAX_CONSEC.
- `assignRotationShifts` (moduri 3,4): `tempPairs` construite din `individuals`, per categorie,
  apoi împinse în `fullCrews` înainte de calculul `idx`/`block`.
- `assignCategoryShifts` (moduri 1,2): `crews` include acum `tempPairs` construite din
  grupurile de mărime 1, înainte de `assignShift`.

**Nu e o garanție 100%** — dacă unul din cei doi are deja `consec>=4` din activitate ANTERIOARĂ
suprapunerii (independent de partener), regula de max 4 zile consecutive are prioritate corectă
peste împerechere: acea persoană primește `L` obligatoriu, celălalt poate lucra solo în ziua
respectivă. Testat: 3 din 5 zile de suprapunere perfect împerecheate, celelalte 2 explicate de
consec individual preexistent — comportament corect, nu bug.

**Grupare la 3+ orfani simultan**: împerecherea e silențioasă și deterministă (după id) — user
a confirmat explicit că nu vrea modal/atenționare interactivă pentru a alege manual gruparea,
nici pentru cazuri cu mai mult de 2 orfani. Nu propune din nou acest lucru fără cerere explicită.

**Limitare cunoscută, ACCEPTATĂ deliberat (nu e bug, nu se fixează)**: NU există alocare
automată de 8h/`c8` pentru cazul (rar) în care cineva rămâne fără nicio pereche posibilă
(număr impar de orfani). Propusă și **respinsă explicit de user** — responsabilul poate seta
manual `8h` din dropdown pentru acea persoană. Nu re-investiga sau propune fix pentru asta
fără să fie cerut din nou.

8. **Capacitate asimetrică T1≠T2 prost umplută în `rotation`/`rotation3`** — când un echipaj
   pierdea competiția pentru tura dorită (coliziune), rămânea pur și simplu neasignat, fără
   nicio încercare de redirecționare spre CEALALTĂ tură (T1↔T2) dacă acolo mai era loc.
   **Fix**: `spillover(list, sv)` — după asignarea principală, orice echipaj/individ rămas
   neasignat care voia T1 sau T2 încearcă automat tura alternativă (prin `doAssign`, deci
   respectă toate regulile). **Limită reală, nu eliminabilă**: cu puține echipaje și
   capacitate cerută mult peste ce oferă ciclul fix (ex. T1=4 cu doar 4 echipaje pe ciclu de
   3 zile — cere 2 echipaje simultan, dar ciclul dă fiecărui echipaj doar 1 zi din 3 pe T1),
   unele zile tot vor fi sub capacitate — a forța altfel ar însemna sacrificarea zilei
   libere garantate a ciclului.

9. **CRITIC — fairness pe ore complet suprascrisă de preferința de varietate, în `full`/`t12`**
   (`assignCategoryShifts`/`assignShift`) — găsit de user cu config asimetric (T1=4, T2=2,
   4 echipaje): un echipaj rămânea mereu ultimul (120h vs 168h pt. restul), fără să se
   corecteze NICIODATĂ, deși diferența creștea zi de zi. Cauza: preferința „evită repetarea
   aceleiași ture ieri" (`softPrefer`, menită doar să încurajeze varietate) **înlocuia
   complet** lista de candidați eligibili — excludea definitiv orice echipaj/individ care
   lucrase acea tură ieri, INDIFERENT cât de puține ore acumulate avea. Confirmat prin trace
   zi de zi: echipajul cu cele mai puține ore din toată luna tot pierdea sistematic.
   **Fix**: fairness pe ore e acum criteriul PRINCIPAL de sortare întotdeauna — `softPrefer`
   intervine STRICT ca departajare la egalitate de ore, nu mai suprascrie niciodată o
   diferență reală de fairness. Aplicat consistent la echipaje ȘI la fallback-ul individual.
   **Rezultat**: spread redus de la 48h (168 vs 120) la 8h (192 vs 184) pe config asimetric.
   În aceeași investigație s-a mai găsit și reparat: fallback-ul individual excludea
   definitiv (hard skip) pe oricine lucrase ieri tura respectivă, lăsând capacitatea
   configurată neumplută chiar și fără nicio alternativă (asta era bug-ul INIȚIAL raportat
   de user — T1=4 configurat, umplut doar cu 2 în multe zile); și o regresie/bug pre-existent
   expus abia acum: T1A nu avea deloc protecție hard împotriva gap-ului T2→T1A în `full`/`t12`
   (fix: `assignShift(remaining, t1ac, 3, 't1a', false, [2])`, al 6-lea param `hardBlock`).

### Audit complet (cerut explicit de user, 3 probleme găsite și fixate)

10. **Import „lună" suprascria lista GLOBALĂ de electricieni + config** (`applyJSON`, ramura
    `type==='month'`) — comentariul zicea „overwrite only schedule", dar codul făcea
    `state.employees = data.employees` și `state.config = data.config` necondiționat. Import
    al unui fișier de lună mai vechi ștergea silențios orice electrician adăugat de atunci și
    reseta config-ul. **Fix**: merge electricienii după id (adaugă doar cei lipsă din state
    curent), `state.config` nu se mai atinge deloc la import de lună (e setare curentă, nu
    ține de luna importată).

11. **Regula „max 5 zile/săptămână" lipsea complet din `assignRotationShifts`** — există doar
    în `assignCategoryShifts` (moduri 1/2), documentată în manual, dar absentă din modurile de
    rotație (3/4). MAX_CONSEC verifică doar zile CONSECUTIVE, nu total pe săptămână — cineva
    putea depăși 5 zile lucrate într-o săptămână calendaristică în rotație fără nicio
    protecție. **Fix**: adăugat `weekCount(empId)` + verificare în `doAssign`, aceeași logică.

12. **Cap-ul săptămânal nu numără zilele din luna anterioară** (ambele module) — bucla de
    calcul avea `if (dd<1) continue;`, sărind peste zilele care cădeau în luna precedentă
    când săptămâna calendaristică se întindea peste graniță — regulă mai permisivă exact la
    început de lună. **Fix**: `new Date(yr, mo-1, dd)` normalizează automat zile ≤0 spre luna
    anterioară, apoi se extrage data reală din obiectul normalizat — nu mai sare nimic.

13. **FIXAT ULTERIOR — cap-ul de 5 zile/săptămână nu limita deloc T1/T2** — inițial se aplica
    DOAR la eligibilitatea pentru T1A/T2A/8h (filtrul rula după ce T1/T2 erau deja asignate).
    Confirmat empiric: cineva putea lucra 6+ zile într-o săptămână pe T1/T2 (respecta totuși
    max 4 consecutive, dar nu totalul săptămânal) în `full`/`t12`. **Fix**: cap-ul mutat la
    nivelul `available` (lângă MAX_CONSEC deja existent acolo), aplicat UNIFORM de la început
    tuturor turelor — T1, T2, T1A, T2A, 8h. Filtrul separat de dinainte (doar pt. T1A/T2A/8h)
    a devenit redundant și a fost eliminat. `assignRotationShifts` nu a necesitat schimbări —
    `weekCount()` din `doAssign()` (sursa #11) era deja universal, fără distincție de tură.

14. **CRITIC — faza ciclului de rotație sărea la granița dintre luni** — raportat de user (mod
    4, Octombrie continuând din Septembrie): **prima zi din lună nu avea deloc T1**. Cauza:
    `monthSeed` (offset dependent de lună pt. rotația reziduului) se schimba lună→lună, iar
    `day-1` se reseta la 0 → faza făcea un SALT la graniță. Un echipaj cu T2 pe 30 sept primea
    brusc cerere de T1 pe 1 oct → gap T2→T1 o bloca → și cum doar acel echipaj voia T1 acea zi,
    tura rămânea COMPLET neacoperită. **Fix**: faza se calculează acum din numărul ABSOLUT de
    zile (`absDay = Math.round(new Date(dk+'T00:00:00Z').getTime()/86400000)`), nu din ziua
    lunii — ciclul curge CONTINUU peste toate granițele. `monthSeed` eliminat complet (reziduul
    lunilor de 31 zile se rotește oricum natural — fiecare lună începe într-un punct diferit al
    ciclului continuu, fiindcă 31 % CYCLE_LEN ≠ 0). `blockFor` = `hasCollision ? blockAbs : 0`
    (`blockAbs = Math.floor(absDay/CYCLE_LEN)`). **Compromis acceptat**: `rotation3` la n=5
    echipaje are acum spread ~8-16h pe lunile de 30 zile (era 0h cu `monthSeed` — super-ciclul
    de 5 blocuri se alinia perfect cu 30 zile). `rotation` 8 zile la n=5 S-A ÎMBUNĂTĂȚIT însă
    (Iulie 24h→8h). Continuitatea + acoperirea garantată a turelor contează mai mult decât 0h
    perfect într-un caz. **Verificat pentru TOATE modurile**: tranziția Sept→Oct continuă →
    ziua 1 complet acoperită, zero tranziții ilegale, zero violări de gap. Modurile 1/2/full
    nu aveau problema (fill greedy + seed de gap din luna anterioară în `startGeneration` deja
    funcționau).

**Dacă apare din nou un raport de "cineva are mult mai multe/puține ore"**: prima
verificare — cere config-ul exact (T1/T1A/T2/T2A pt. ambele grupe), MODUL exact (1-4 —
nu presupune, cere explicit; confuzie reală a avut loc în sesiune între modul 2 și 4), luna,
reproduce în consolă browser (vezi metoda de testare mai jos), și verifică dacă nu cumva a
apărut o A ZECEA sursă de asimetrie neacoperită încă (ex. interacțiune cu `crewOverrides` la
mijlocul lunii, sau cu faptul că MAX_CONSEC nu face compensare încrucișată — vezi mai sus).
Cele 9 surse deja găsite și fixate: coliziune structurală la 5+ echipaje, T1A/T2A pierdute în
weekend, amestec Urban/Rural în calculul de fază, MAX_CONSEC lipsă din rotation, bias
persistent la reziduu + prag greșit pt. coliziune, weekendFallback nedetectat de
hasCollision, capacitate asimetrică fără spillover în rotation/rotation3, și CRITIC:
fairness suprascrisă de preferința de varietate + hard-skip individual + gap T1A lipsă,
toate în full/t12.

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
- `Mod` (select `#gen-mode`): opțiunile sunt numerotate `1)`..`4)` în text, ca reper vizual
  rapid — `2) Zilnic T1/T2` (fost „Doar T1/T2", redenumit ca să nu se confunde cu
  `4) Rotație T1-T2-L`). Câmpurile T1A/T2A din config Urban/Rural (`.ta-field`, cu id
  `cfg-{urban,rural}-{t1a,t2a}-field`) sunt ascunse dinamic (`updateModeFieldVisibility()`,
  apelată la schimbarea modului și la încărcare) când modul curent nu le poate folosi
  (ascunse la moduri 2 și 4, vizibile la 1 și 3).
- Modalul de editare electrician are o secțiune „🏖️ CO / CM / Instruire pe interval"
  (`applyLeaveInterval()`) — data început/sfârșit + tip, aplică direct în `state.schedule`
  pentru tot intervalul (INST sare automat peste weekend). Inputurile de dată se
  pre-completează la deschiderea modalului cu prima zi a LUNII SELECTATE ÎN GRAFIC
  (`state.currentYear/currentMonth`), nu cu data reală de azi — altfel calendarul nativ al
  browserului deschidea pe luna curentă reală, confuz dacă userul naviga graficul pe altă
  lună (bug raportat de user, fixat).

## Palete de culori (teme)

`THEMES` (obiect JS lângă `APP_VERSION`) = SURSĂ UNICĂ pentru culorile turelor, folosită
și de grafic (prin CSS vars) și de exportul Excel. Fiecare temă are `light` + `dark`, cu
`s[0..8] = [bg, text]` (hex cu `#`) pentru fiecare valoare de tură + `weekendTd`.
Momentan: `clasic` (originale), `pastel`, și trei teme **monocrome** (`mono_gri`,
`mono_indigo`, `mono_teal`) generate de `monoTheme(name, h, s)` dintr-un singur hue —
 turele diferă doar prin luminozitate/saturație (schedule `MONO_LIGHT`/`MONO_DARK`,
per tură `[bgL, textL, satMul]`), `hslHex()` face HSL→hex. Contrast text/fundal ținut
≥3.0 (text bold). Teme monocrome noi = un rând în `Object.assign(THEMES, {...})` + o
`<option>` (nu ating schedule-ul).

- `applyTheme(id)` scrie `--shift{0..8}-bg/-text` + `--weekend-td` pe `document.documentElement.style`,
  alegând varianta `light`/`dark` după `data-theme` curent. Persistă în `THEME_KEY`
  (`graficTura_theme`, cheie proprie) + fallback in-memory `_themeId` (localStorage poate
  arunca pe `data:` URL / storage dezactivat — toate accesele sunt în try/catch).
- `toggleDarkMode()` reapelează `applyTheme(currentThemeId())` ca varianta paletei să se
  schimbe odată cu modul.
- CSS: `td.shift-3..8` și pill-urile (`.pill-t1a/t2a/c8/co/cm`) folosesc acum `var(--shiftN-*)` —
  s-au ȘTERS toate override-urile `[data-theme="dark"]` pentru ele (JS le setează). shift0/1/2
  erau deja pe var. Valori clasice hardcodate rămân doar ca default în ambele blocuri `:root`.
- Excel (`exportExcel`): `shiftFill` + `weekendEmptyBg` + culorile din legendă se construiesc
  din `themeVariant(currentThemeId(), false)` — **MEREU varianta light** (fișier de printat/
  trimis, decizie user). `hx()` stripează `#` → ARGB.
- Selector: `<select id="theme-select">` lângă butonul 🌙 (clasa `.theme-select`, `no-print`).
- La adăugarea unei teme noi: doar un obiect nou în `THEMES` + o `<option>` în `#theme-select`.
  Nimic altceva — CSS și Excel se adaptează automat.

## Alte convenții

- Tooltips: `data-tooltip` attribute + CSS `::after`/`::before` (nu `title` — stil custom).
- Dark mode: `[data-theme="dark"]` pe `<html>`, toggle manual (nu urmărește
  `prefers-color-scheme`).
- Ștergere angajat: confirmare în 2 pași (`deleteConfirmStep()`, auto-reset după 3s).
- `document.title` e setat dinamic în `applyOrgToDOM()` din `org.formatia` — `<title>` static
  din HTML e generic ("Grafic de tură - Delgaz Grid S.A"), NU hardcodat cu o formație anume
  (era bug: titlul static avea o formație specifică bătută în cod, vizibilă la orice
  vizitator al link-ului, indiferent de propriile setări org).
- INST (valoare 8) e exclus din selecție pe weekend, la fel ca CO/CM — nu apare în dropdown
  pe S/D, se afișează ca `L` dacă e deja setat din date vechi, și nu se contorizează în ore
  pe weekend (`getEmployeeStats`).
