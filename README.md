# Grafic de Ture — Shift Scheduling App

A single‑file HTML application for scheduling 12‑hour shifts (T1, T2, T1A, T2A, 8h) for two groups (Urban, Rural) with crew pairing, CO/CM management, and automatic generation. Runs entirely in the browser; data is persisted to `localStorage` plus optional JSON file backup.

## Architecture

One file: `index.html`. No build step, no server. Load by double‑clicking in a browser (Chrome/Edge recommended for File System Access API). Uses `xlsx` library from CDN for Excel export.

### Data Model (localStorage key `graficTura`)

```typescript
interface State {
  employees: Employee[];
  config: { urban: Config; rural: Config };
  schedule: Record<DateKey, Record<EmpIdString, ShiftValue>>;
  preservedCOCM: Record<DateKey, Record<EmpIdString, 5|6>>;
  genDay: number;       // current generation day (1-based)
  genStats: Stats | null;
  genYear: number;
  genMonth: number;
  genDim: number;        // days in current month
  currentMonth: number;
  currentYear: number;
}

interface Employee {
  id: number;
  name: string;
  category: 'urban' | 'rural';
  functia: 'emitent' | 'admitent' | 'electrician' | 'seftura';
  crew: string;          // e.g. 'U1', 'R3', or '' for none
  forced8: boolean;      // forced 8h shifts only
}

interface Config {
  t1: number;   t1a: number;
  t2: number;   t2a: number;
  c8: number;
}
```

### Shift Values

| Value | Label | Meaning |
|-------|-------|---------|
| 0 | L | Free day |
| 1 | T1 | 12h shift A |
| 2 | T2 | 12h shift B |
| 3 | T1A | 12h shift A variant |
| 4 | T2A | 12h shift B variant |
| 5 | CO | Concediu de odihnă (manual) |
| 6 | CM | Concediu medical (manual) |
| 7 | 8 | 8-hour shift (weekdays only) |

### Key Constants

- Column width: `38px` (`th.day-col`), cell padding `1px`
- Print: A3 landscape (`@page { size: A3 landscape; margin: 1cm }`)

## Generation Algorithm

### Flow

```
startGeneration()
  ├─ Save existing CO/CM into genCOCM (preservedCOCM)
  ├─ Find first day without generated data (firstEmpty)
  ├─ Restore CO/CM from genCOCM onto schedule (days that lack them)
  ├─ Extend CO/CM to adjacent weekend days
  ├─ Rebuild genStats from scratch (days 1..firstEmpty-1)
  └─ Set genDay = firstEmpty

generateDay(day)
  ├─ Preserve CO/CM for this day (from genCOCM + existing manual edits)
  ├─ Weekend extension: if Sat/Sun, inherit CO/CM from adjacent weekday(s)
  ├─ Clear all non‑CO assignments: state.schedule[dk] = {CO/CM only}
  ├─ For each group (urban, rural):
  │    assignCategoryShifts(employees, config, day)
  │      └─ Excludes: CO/CM employees + forced8=true
  ├─ Forced8 override (weekdays only): assign 8→T2A→T2→T1A→T1
  └─ Fill unassigned with L (0), update genStats
```

### Shift Assignment Order

Alternating per day parity:
- **Even days** (`day % 2 === 0`): T2 → T1 → T1A → T2A → 8
- **Odd days**: T1 → T2 → T1A → T2A → 8

### 8-Hour Gap Rule

Only T2 blocks T1/T1A (`checkYesterday === true`). T2A does not block.

## CO/CM Preservation

- CO/CM saved to `genCOCM` (→ `state.preservedCOCM` → localStorage) before any generation
- Restored per‑day after schedule clear; never overwritten
- Weekend extension: if Friday/Monday has CO/CM, adjacent Sat/Sun auto‑inherit

## Forced 8h

- Checkbox per employee; displayed as `F` badge
- Excluded from `assignCategoryShifts` via `!e.forced8` filter
- Weekdays: assigned first available slot in order 8 → T2A → T2 → T1A → T1 (fallback: 8)
- Weekends: skipped → gets L

## Key Functions (line references for `index.html`)

| Function | Line | Purpose |
|----------|------|---------|
| `startGeneration()` | ~570 | Initialize generation for selected month/year |
| `generateDay(day)` | ~672 | Generate one day's schedule |
| `generateNextDay()` | ~735 | Day‑by‑day generator |
| `generateAll()` | ~765 | Generate all remaining days |
| `prevDay()` | ~793 | Go back one day, rebuild stats |
| `assignCategoryShifts()` | ~458 | Core assignment logic for one category |
| `assignShift()` | ~475 | Two‑pass crew → individual shift assignment |
| `renderTable()` | ~890 | Build the HTML table |

## UI Controls

- **Add Employee**: name, category, funcția, crew, forced8 checkbox
- **Edit/Delete**: click employee name → modal
- **← Ziua N** / **Ziua N →** / **Generare totală (N) →**: generation buttons
- **Ctrl+S**: save JSON; **📂**: load JSON
- **Excel export**, **Print** (A3 landscape), **?** help modal

## Setup

No build step. Open `index.html` in Chrome/Edge. Data auto‑saves to localStorage.

## License

MIT
