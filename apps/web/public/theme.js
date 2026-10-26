// Apply an explicit saved theme before paint; system stays untouched.
// Kept as a classic, render-blocking script in <head> so the app never flashes
// the wrong theme. It must stay inline-free: the API CSP is script-src 'self'.
(function () {
  try {
    var raw = localStorage.getItem('lifespire:mvp0');
    if (!raw) return;
    var parsed = JSON.parse(raw);
    var theme = parsed && parsed.settings && parsed.settings.theme;
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.dataset.theme = theme;
    }
  } catch {
    /* A blocked or corrupt save is handled by the app. */
  }
})();
