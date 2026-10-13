// ===========================================================================
// REGISTRUL MODURILOR — singurul loc unde aplicația „află” ce moduri există.
// Pentru un mod nou adaugă aici o intrare (id, eticheta din selectorul „Modul”, pagina de intrare).
// Încărcat de TOATE paginile, înaintea modes/<mod>.js.
// ===========================================================================
const APP_MODES = [
  { id: 'exploatare', label: 'Exploatare', page: 'index.html' },
  { id: 'dispecer', label: 'Dispecer', page: 'dispecer.html' }
];

// Manualele modurilor (cheie → {label, panels}); fiecare js/manual-<mod>.js își adaugă intrarea.
// Ordinea de încărcare a fișierelor = ordinea butoanelor din manual.
const MANUALS = {};
