// Graphit-Glas für die Büro-Fenster (09.10.2026, Sam: Stil 1 „Graphit“, dunkler, mit Ziehen). Wird in jeder Fenster-Seite geladen.
// Nur bei ?glas=1 (schwebendes Fenster über dem Büro, siehe glasFenster() im Büro-Skript).
// Ziehen: linker Rand = breiter/schmaler · Ecke unten links = breiter + höher · Kopfzeile = verschieben.
// Während des Ziehens zeigt das Fenster die neue Größe an und versucht live mitzuwachsen; beim Loslassen wird die Lage in der
// Spieler-Variable „swFenster“ gespeichert — das Büro-Skript öffnet das Fenster dann in genau dieser Lage neu (klappt sicher).
// Leiste oben rechts: ◐ = Durchsicht (viel/mittel/wenig) · A = Schriftfarbe (Weiß / Gelb / Mint) · ⛶ = Vollbild an/aus · × = schließen.
(function () {
  if (!new URLSearchParams(location.search).has("glas")) return;
  const html = document.documentElement; html.classList.add("glas");
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "glas.css"; document.head.appendChild(css);
  const STANDARD = () => ({ b: Math.round(Math.min(780, Math.max(420, screen.availWidth * 0.44))), h: Math.round(Math.max(360, screen.availHeight * 0.8)), r: 14, o: 70, voll: false, schrift: "weiss", d: .55 });
  let ein = STANDARD();
  // Durchsicht (Knopf ◐): Deckkraft des Glases 0.4 / 0.55 / 0.75
  const durchsicht = () => html.style.setProperty("--glas-a", String(ein.d || .55));
  const schrift = () => { durchsicht(); html.classList.remove("glas-mint", "glas-gelb"); if (ein.schrift && ein.schrift !== "weiss") html.classList.add("glas-" + ein.schrift); };
  let api = null, ich = null;
  const bereit = (async () => {
    for (let i = 0; i < 50 && typeof WA === "undefined"; i++) await new Promise(r => setTimeout(r, 100));
    if (typeof WA === "undefined") return;
    await WA.onInit(); api = WA;
    try { const v = WA.player.state.swFenster; if (v && typeof v === "object") ein = Object.assign(STANDARD(), v); } catch { /* neu */ }
    schrift();
    try { const alle = await WA.ui.website.getAll(); ich = alle.find(w => String(w.url || "").split("#")[0] === location.href.split("#")[0]) || null; } catch { /* egal */ }
  })();
  const speichern = (neuOeffnen) => { if (!api) return; try { api.player.state.saveVariable("swFenster", Object.assign({}, ein, { neu: neuOeffnen ? Date.now() : (ein.neu || 0) }), { public: false, persist: true }); } catch (e) { console.warn("swFenster", e); } };
  // live mitwachsen versuchen (einzelne Felder, wie in der WA-Doku); wenn WA das nicht übernimmt, gilt es beim Loslassen
  const live = () => { if (!ich) return; try { ich.size.width = ein.b + "px"; ich.size.height = ein.h + "px"; if (ich.margin) { ich.margin.right = ein.r + "px"; ich.margin.top = ein.o + "px"; } } catch { /* nicht unterstützt */ } };
  // Anzeige während des Ziehens
  let anzeige = null;
  const zeigen = (t) => { if (!anzeige) { anzeige = document.createElement("div"); anzeige.id = "glas-mass"; anzeige.appendChild(document.createElement("span")); document.body.appendChild(anzeige); } anzeige.firstChild.textContent = t; anzeige.style.display = "flex"; };
  const ziehen = (el, art) => {
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || ein.voll) return; if (art === "kopf" && e.target.closest("button, a, input, select, textarea, #glas-leiste")) return;
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      const x0 = e.screenX, y0 = e.screenY, s = { ...ein }; let zuletzt = 0;
      html.classList.add("glas-zieht");
      const bewegen = (m) => {
        const dx = m.screenX - x0, dy = m.screenY - y0;
        if (art === "kopf") { ein.r = Math.max(0, s.r - dx); ein.o = Math.max(0, s.o + dy); zeigen("Verschieben … loslassen zum Übernehmen"); }
        else { ein.b = Math.max(340, Math.round(s.b - dx)); if (art === "ecke") ein.h = Math.max(300, Math.round(s.h + dy)); zeigen(ein.b + " × " + ein.h + " px"); }
        if (Date.now() - zuletzt > 120) { zuletzt = Date.now(); live(); }
      };
      const los = () => {
        el.removeEventListener("pointermove", bewegen); el.removeEventListener("pointerup", los); el.removeEventListener("pointercancel", los);
        html.classList.remove("glas-zieht"); if (anzeige) anzeige.style.display = "none";
        const passt = art !== "kopf" && Math.abs(window.innerWidth - ein.b) < 12 && Math.abs(window.innerHeight - ein.h) < 12;
        speichern(!passt); // nur neu öffnen, wenn das Fenster nicht schon live die richtige Größe hat
      };
      el.addEventListener("pointermove", bewegen); el.addEventListener("pointerup", los); el.addEventListener("pointercancel", los);
    });
  };
  const knopf = (txt, titel, fn) => { const b = document.createElement("button"); b.className = "glas-k"; b.textContent = txt; b.title = titel; b.onclick = fn; return b; };
  const aufbauen = () => {
    const l = document.createElement("div"); l.id = "glas-leiste";
    l.append(
      knopf("◐", "Durchsicht: viel / mittel / wenig", () => { ein.d = { 0.4: .55, 0.55: .75, 0.75: .4 }[ein.d] || .55; durchsicht(); speichern(false); }),
      knopf("A", "Schriftfarbe: Weiß / Gelb / Mint", () => { ein.schrift = { weiss: "gelb", gelb: "mint", mint: "weiss" }[ein.schrift] || "weiss"; schrift(); speichern(false); }),
      knopf("⛶", "Vollbild an/aus", () => { ein.voll = !ein.voll; speichern(true); }),
      knopf("×", "Schließen", async () => { await bereit; if (ich) ich.close(); }),
    );
    const rand = document.createElement("div"); rand.id = "glas-rand"; rand.title = "Ziehen: breiter / schmaler";
    const ecke = document.createElement("div"); ecke.id = "glas-ecke"; ecke.title = "Ziehen: größer / kleiner";
    document.body.append(l, rand, ecke);
    ziehen(rand, "rand"); ziehen(ecke, "ecke");
    const kopf = document.querySelector("header"); if (kopf) { kopf.classList.add("glas-kopf"); kopf.title = "Ziehen zum Verschieben"; ziehen(kopf, "kopf"); }
  };
  if (typeof WA === "undefined") { const s = document.createElement("script"); s.src = "https://play.workadventu.re/iframe_api.js"; document.head.appendChild(s); }
  if (document.body) aufbauen(); else document.addEventListener("DOMContentLoaded", aufbauen);
})();
