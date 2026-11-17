// Aplica el tema guardado antes de que React pinte, para que no haya un destello
// claro al abrir la app en modo oscuro. Archivo externo (no inline) por la CSP.
(function () {
  var mode = 'system';
  try {
    var v = localStorage.getItem('pistachio:theme');
    if (v === 'light' || v === 'dark' || v === 'system') mode = v;
  } catch (e) {}
  var dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  if (dark) root.classList.add('dark');
  root.style.colorScheme = dark ? 'dark' : 'light';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#111312' : '#FFFFFF');
})();
