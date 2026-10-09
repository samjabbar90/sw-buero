// Dunkles Glas für die Büro-Fenster (09.10.2026, Sam: Variante 2). Wird in jeder Fenster-Seite im <head> geladen.
// Nur bei ?glas=1 (schwebendes Fenster über dem Büro, siehe glasFenster() im Büro-Skript): Glas-Darstellung + Schließen-Knopf.
(function () {
  if (!new URLSearchParams(location.search).has("glas")) return;
  document.documentElement.classList.add("glas");
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "glas.css"; document.head.appendChild(css);
  // Schließen: das Fenster gehört dem Büro-Skript — über die Scripting-API das eigene Fenster suchen und schließen
  const zu = async () => {
    try {
      if (typeof WA === "undefined") return;
      await WA.onInit();
      const alle = await WA.ui.website.getAll();
      const ich = alle.find((w) => String(w.url || "").split("#")[0] === location.href.split("#")[0]);
      if (ich) ich.close();
    } catch (e) { console.warn("Fenster schließen", e); }
  };
  const knopf = () => { const b = document.createElement("button"); b.id = "glas-zu"; b.title = "Schließen"; b.textContent = "×"; b.onclick = zu; document.body.appendChild(b); };
  if (typeof WA === "undefined") { const s = document.createElement("script"); s.src = "https://play.workadventu.re/iframe_api.js"; document.head.appendChild(s); }
  if (document.body) knopf(); else document.addEventListener("DOMContentLoaded", knopf);
})();
