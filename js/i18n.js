/**
 * i18n.js — i18next initialisation for Discover Rasnov
 *
 * Loads translation files from /locales/{lng}/translation.json.
 * Exposes:
 *   window.t(key, opts)   — shorthand for i18next.t()
 *   window.switchLanguage(lng) — change language and re-render all data-i18n elements
 *   window.getCurrentLang()    — returns the active language code ('en' | 'ro')
 *
 * HTML elements are translated via the data-i18n attribute:
 *   <span data-i18n="key">fallback</span>          — sets textContent
 *   <input data-i18n="[placeholder]key" />          — sets placeholder attribute
 *   <button data-i18n="[aria-label]key [title]key2">— sets multiple attributes
 *   <button data-i18n="[html]key">                  — sets innerHTML (use sparingly)
 *
 * The script.js companion uses window.t() for dynamically generated strings.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Bootstrap — wait for i18next to be loaded from CDN, then initialise
  // ---------------------------------------------------------------------------
  function waitForI18next(cb, attempts) {
    attempts = attempts || 0;
    if (typeof i18next !== 'undefined') {
      cb();
    } else if (attempts < 50) {
      setTimeout(function () { waitForI18next(cb, attempts + 1); }, 100);
    } else {
      console.error('[i18n] i18next did not load from CDN');
    }
  }

  // ---------------------------------------------------------------------------
  // Detect preferred language from localStorage → browser → 'en'
  // ---------------------------------------------------------------------------
  function detectLang() {
    var saved = localStorage.getItem('rasnov_lang');
    if (saved === 'en' || saved === 'ro') return saved;
    var browser = (navigator.language || navigator.userLanguage || 'en').split('-')[0];
    return browser === 'ro' ? 'ro' : 'en';
  }

  // ---------------------------------------------------------------------------
  // Apply data-i18n attributes to the current document
  // ---------------------------------------------------------------------------
  function applyDataI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var spec = el.getAttribute('data-i18n');

      // Multiple directives can be separated by ' ' if they start with '['
      // e.g. "[placeholder]key [title]key2"
      // Simple text: just "key" (no brackets)
      if (spec.indexOf('[') === -1) {
        // Plain text content
        el.textContent = i18next.t(spec);
      } else {
        // Parse attribute directives like "[placeholder]key"
        var re = /\[([^\]]+)\]([^\[]*)/g;
        var match;
        while ((match = re.exec(spec)) !== null) {
          var attr = match[1].trim();
          var key  = match[2].trim();
          if (!key) continue;
          if (attr === 'text') {
            el.textContent = i18next.t(key);
          } else if (attr === 'html') {
            el.innerHTML = i18next.t(key, { interpolation: { escapeValue: false } });
          } else {
            el.setAttribute(attr, i18next.t(key));
          }
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Public API exposed on window
  // ---------------------------------------------------------------------------
  window.t = function (key, opts) {
    return (typeof i18next !== 'undefined') ? i18next.t(key, opts) : key;
  };

  window.getCurrentLang = function () {
    return (typeof i18next !== 'undefined') ? i18next.language : 'en';
  };

  /**
   * Switch to a new language, persist the choice, and re-render the page.
   * Returns a Promise that resolves after translations are applied.
   */
  window.switchLanguage = function (lng) {
    if (typeof i18next === 'undefined') return Promise.resolve();
    return i18next.changeLanguage(lng).then(function () {
      localStorage.setItem('rasnov_lang', lng);
      document.documentElement.lang = lng;
      applyDataI18n();
      // Let script.js know the language changed so it can refresh dynamic content
      document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lng: lng } }));
    });
  };

  // ---------------------------------------------------------------------------
  // Initialise i18next with HTTP backend (loads /locales/{lng}/translation.json)
  // ---------------------------------------------------------------------------
  waitForI18next(function () {
    // i18next-http-backend may not be loaded; fall back to inline init if absent
    var plugins = (typeof i18nextHttpBackend !== 'undefined') ? [i18nextHttpBackend] : [];

    var initOpts = {
      lng: detectLang(),
      fallbackLng: 'en',
      debug: false,
      interpolation: { escapeValue: true },
      resources: null // will be populated below if no backend
    };

    if (plugins.length > 0) {
      // HTTP Backend: load JSON from /locales/{lng}/translation.json
      initOpts.backend = {
        loadPath: '/locales/{{lng}}/translation.json'
      };
      i18next.use(i18nextHttpBackend);
    }

    // Load both locale files up-front so switching language is instant
    i18next.init(initOpts, function (err) {
      if (err) console.error('[i18n] init error', err);
      document.documentElement.lang = i18next.language;
      applyDataI18n();

      // Pre-load the other language so toggling is instant
      var other = i18next.language === 'en' ? 'ro' : 'en';
      i18next.loadLanguages(other, function () { /* preloaded silently */ });
    });
  });
})();
