// Dunkles Glas für die Büro-Fenster (09.10.2026, Sam: Variante 2). Wird in jeder Fenster-Seite im <head> geladen.
// Nur bei ?glas=1 (schwebendes Fenster über dem Büro, siehe glasFenster() im Büro-Skript): Glas-Darstellung + Leiste oben rechts:
//   A = Schriftfarbe (Weiß / Mint / Gelb) · ◀ ▶ = Platz (links / Mitte / rechts) · ⛶ = Vollbild · × = schließen
// Frei mit der Maus ziehen geht in WorkAdventure nicht — das Fenster dockt an festen Plätzen an.
// Einstellungen in localStorage „swFenster“ (gleiche Herkunft wie das Büro-Skript → neue Fenster öffnen gleich so).
(function () {
  if (!new URLSearchParams(location.search).has("glas")) return;
  const html = document.documentElement; html.classList.add("glas");
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "glas.css"; document.head.appendChild(css);
  const lesen = () => { try { return Object.assign({ schrift: "weiss", platz: "right", voll: false }, JSON.parse(localStorage.getItem("swFenster") || "{}")); } catch { return { schrift: "weiss", platz: "right", voll: false }; } };
  const speichern = e => { try { localStorage.setItem("swFenster", JSON.stringify(e)); } catch { /* privat */ } };
  let ein = lesen();
  const schrift = () => { html.classList.remove("glas-mint", "glas-gelb"); if (ein.schrift !== "weiss") html.classList.add("glas-" + ein.schrift); };
  schrift();
  // eigenes Fenster über die Scripting-API finden
  let ich = null;
  const finden = async () => {
    if (ich) return ich;
    if (typeof WA === "undefined") return null;
    await WA.onInit();
    const alle = await WA.ui.website.getAll();
    ich = alle.find((w) => String(w.url || "").split("#")[0] === location.href.split("#")[0]) || null;
    return ich;
  };
  // gleiche Maße wie glasFenster() im Büro-Skript
  const anwenden = async () => {
    const w = await finden(); if (!w) return;
    // einzelne Felder setzen (so steht es in der WA-Doku: website.position.vertical = "top")
    const setze = (obj, werte) => { for (const [k, v] of Object.entries(werte)) obj[k] = v; };
    try {
      const m = ein.voll ? { left: "0px", right: "0px" } : ein.platz === "left" ? { left: "14px", right: "0px" } : ein.platz === "right" ? { left: "0px", right: "14px" } : { left: "0px", right: "0px" };
      setze(w.position, ein.voll ? { vertical: "middle", horizontal: "middle" } : { vertical: "middle", horizontal: ein.platz });
      setze(w.size, ein.voll ? { width: "96vw", height: "92vh" } : { width: "44vw", height: "90vh" });
      if (w.margin) setze(w.margin, m);
    } catch (e) { console.warn("Fenster ändern", e); }
  };
  const PLAETZE = ["left", "middle", "right"];
  const knopf = (txt, titel, fn) => { const b = document.createElement("button"); b.className = "glas-k"; b.textContent = txt; b.title = titel; b.onclick = fn; return b; };
  const leiste = () => {
    const l = document.createElement("div"); l.id = "glas-leiste";
    l.append(
      knopf("A", "Schriftfarbe: Weiß / Mint / Gelb", () => { ein.schrift = { weiss: "mint", mint: "gelb", gelb: "weiss" }[ein.schrift] || "weiss"; speichern(ein); schrift(); }),
      knopf("◀", "Fenster nach links", () => { ein.voll = false; ein.platz = PLAETZE[Math.max(0, PLAETZE.indexOf(ein.platz) - 1)]; speichern(ein); anwenden(); }),
      knopf("▶", "Fenster nach rechts", () => { ein.voll = false; ein.platz = PLAETZE[Math.min(2, PLAETZE.indexOf(ein.platz) + 1)]; speichern(ein); anwenden(); }),
      knopf("⛶", "Vollbild an/aus", () => { ein.voll = !ein.voll; speichern(ein); anwenden(); }),
      knopf("×", "Schließen", async () => { const w = await finden(); if (w) w.close(); }),
    );
    document.body.appendChild(l);
  };
  if (typeof WA === "undefined") { const s = document.createElement("script"); s.src = "https://play.workadventu.re/iframe_api.js"; document.head.appendChild(s); }
  if (document.body) leiste(); else document.addEventListener("DOMContentLoaded", leiste);
})();
