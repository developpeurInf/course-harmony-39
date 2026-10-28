/**
 * Exécuté avant le premier affichage : thème clair / sombre, couleur principale et
 * arrondi de la personnalisation (cache local), hauteur visible réelle (--app-vh).
 * Évite le flash de thème au chargement.
 */
export const BOOT_SCRIPT = String.raw`
(function () {
  try {
    var t = null;
    var cfg = null;
    try { t = window.localStorage.getItem('maataoui-theme'); } catch (eS) {}
    try {
      var rawCfg = window.localStorage.getItem('app-settings-cache-v1');
      if (rawCfg) cfg = JSON.parse(rawCfg);
    } catch (eP) { cfg = null; }
    if (t !== 'light' && t !== 'dark' && cfg && cfg.theme) {
      // Aucun choix personnel : mode par défaut fixé par l'administration
      var dm = cfg.theme.defaultMode;
      if (dm === 'light' || dm === 'dark') t = dm;
    }
    if (t !== 'light' && t !== 'dark') {
      t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    // Personnalisation (cache local) : nom de l'application, couleur principale, arrondi
    if (cfg) {
      try {
        if (cfg.identity && typeof cfg.identity.appName === 'string' && cfg.identity.appName.replace(/\s+/g, '')) {
          document.title = cfg.identity.appName;
        }
        var css = '';
        var hex = cfg.theme && typeof cfg.theme.primary === 'string' ? cfg.theme.primary.replace(/^\s+|\s+$/g, '') : '';
        if (hex.toLowerCase() === '#3b82f6') hex = ''; // ancienne valeur par défaut
        var m = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.exec(hex);
        if (m) {
          var v = m[1];
          if (v.length === 3) v = v.charAt(0) + v.charAt(0) + v.charAt(1) + v.charAt(1) + v.charAt(2) + v.charAt(2);
          var r = parseInt(v.substr(0, 2), 16) / 255, g = parseInt(v.substr(2, 2), 16) / 255, b = parseInt(v.substr(4, 2), 16) / 255;
          var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2;
          if (mx !== mn) {
            var d = mx - mn;
            s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
            if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (mx === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h = h * 60;
          }
          var hh = Math.round(h), ss = Math.round(s * 100), ll = Math.round(l * 100);
          var hsl = hh + ' ' + ss + '% ' + ll + '%';
          var dhsl = hh + ' ' + ss + '% ' + Math.min(70, Math.max(55, ll + 6)) + '%';
          css += 'html:root:not(.dark){--primary:' + hsl + ';--ring:' + hsl + ';--sidebar-primary:' + hsl + ';}';
          css += 'html.dark:root{--primary:' + dhsl + ';--ring:' + dhsl + ';--sidebar-primary:' + dhsl + ';}';
        }
        var rad = cfg.theme ? Number(cfg.theme.radius) : NaN;
        if (!isNaN(rad) && rad !== 0.75 && cfg.theme.radius !== null && cfg.theme.radius !== '') {
          css += 'html:root{--radius:' + Math.max(0, Math.min(1.5, rad)) + 'rem;}';
        }
        if (css) {
          // Sélecteurs renforcés : la feuille de style principale est chargée après ce bloc.
          var st = document.createElement('style');
          st.id = 'app-settings-boot';
          st.appendChild(document.createTextNode(css));
          document.head.appendChild(st);
          // Dès que l'application applique le thème complet, ce style provisoire est retiré.
          var tries = 0;
          var poll = setInterval(function () {
            tries++;
            if (document.getElementById('app-settings-theme')) {
              clearInterval(poll);
              if (st.parentNode) st.parentNode.removeChild(st);
            } else if (tries > 300) {
              clearInterval(poll);
            }
          }, 100);
        }
      } catch (eB) {}
    }
    var root = document.documentElement;
    root.classList.remove(t === 'dark' ? 'light' : 'dark');
    root.classList.add(t);
    try { root.style.colorScheme = t; } catch (eC) {}
  } catch (eT) {}
})();
(function () {
  var html = document.documentElement;
  function setAppHeight() { try { html.style.setProperty('--app-vh', window.innerHeight + 'px'); } catch (e) {} }
  setAppHeight();
  window.addEventListener('resize', setAppHeight);
})();
`;
