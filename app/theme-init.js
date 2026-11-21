/* Apply the saved theme before first paint without requiring inline JavaScript. */
(function () {
  try {
    var prefs = JSON.parse(localStorage.getItem('heytools.prefs.v2') || '{}');
    if (prefs.theme && prefs.theme !== 'light') {
      document.documentElement.setAttribute('data-theme', prefs.theme);
    }
  } catch (error) {
    /* Invalid or unavailable local preferences must never prevent app startup. */
  }
})();
