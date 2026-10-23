// Graphit-Glas für die Büro-Fenster (09.10.2026, Sam: Stil 1 „Graphit“, dunkler, mit Ziehen). Wird in jeder Fenster-Seite geladen.
// Nur bei ?glas=1 (schwebendes Fenster über dem Büro, siehe glasFenster() im Büro-Skript).
// Ziehen: linker Rand = breiter/schmaler · Ecke unten links = breiter + höher · Kopfzeile = verschieben.
// Während des Ziehens zeigt das Fenster die neue Größe an und versucht live mitzuwachsen; beim Loslassen wird die Lage in der
// Spieler-Variable „swFenster“ gespeichert — das Büro-Skript öffnet das Fenster dann in genau dieser Lage neu (klappt sicher).
// Leiste oben rechts: ◐ = Durchsicht (viel/mittel/wenig) · A = Schriftfarbe (Weiß / Gelb / Mint) · ⛶ = Vollbild an/aus · × = schließen.
// Aktivität im Fenster (13.10.2026, Sam: „auf die gesamte Aktivität achten“): Tippen, Klicken, Scrollen hier zählt fürs Büro wie Laufen —
// höchstens alle 20 s über die Spieler-Variable „swAktiv“ ans Büro-Skript (10-Min-Ruhe-Regel, routes/buero.js).
(function () {
  let zuletzt = 0;
  const aktiv = () => { const j = Date.now(); if (j - zuletzt < 20000 || typeof WA === "undefined") return; zuletzt = j;
    try { WA.player.state.saveVariable("swAktiv", j, { public: false, persist: false }); } catch { /* ohne API */ } };
  ["keydown", "mousedown", "wheel", "touchstart", "input"].forEach(ev => document.addEventListener(ev, aktiv, { passive: true, capture: true }));
})();
// Büro nicht ohne Rückfrage schließen (15.10.2026, Sam: „lässt sich immer noch per X schließen“): Der Browser fragt nur, wenn der Rahmen,
// der fragt, vorher angeklickt wurde – das Büro-Skript selbst bekommt nie Klicks. Darum fragt jedes Büro-Fenster mit.
// Nicht nach dem Feierabend-Knopf und nicht, wenn das Büro selbst weiterleitet (Abmelden, Sperre: Variable swGehtRaus).
// 15.10.2026 abends (Sam: „Profil etc. lässt sich nicht mehr vergrößern“): nur in Fenstern, die nie neu geöffnet werden (Leiste unten, Joystick) –
// beim Vergrößern schließt das Büro ein Fenster und öffnet es neu, dabei störte die Rückfrage
if (/\/(info|blick)\.html$/.test(location.pathname)) window.addEventListener("beforeunload", (e) => {
  try {
    if (typeof WA === "undefined" || /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent)) return;
    const s = WA.player.state, heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    if (s.swFeierabendTag === heute || Date.now() - Number(s.swGehtRaus || 0) < 60000) return;
    e.preventDefault(); e.returnValue = "Du hast noch nicht auf Feierabend geklickt – Büro wirklich schließen?"; return e.returnValue;
  } catch { /* ohne API */ }
});
(function () {
  if (!new URLSearchParams(location.search).has("glas")) return;
  const html = document.documentElement; html.classList.add("glas");
  // Farbschema „dunkel“ wie WorkAdventure — sonst legt Chrome/Brave hinter das Fenster einen undurchsichtigen Hintergrund (09.10.: „nicht transparent“)
  html.style.colorScheme = "dark"; { const m = document.createElement("meta"); m.name = "color-scheme"; m.content = "dark"; document.head.appendChild(m); }
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "glas.css?v=1792090000"; document.head.appendChild(css); // Versionsnummer: sonst nimmt der Browser die alte Datei aus dem Zwischenspeicher
  const STANDARD = () => ({ b: Math.round(Math.min(780, Math.max(420, screen.availWidth * 0.44))), hv: 78, r: 14, o: 70, voll: false, schrift: "weiss", d: .55 });
  let ein = STANDARD();
  // Durchsicht (Knopf ◐): Deckkraft des Glases 0.4 / 0.55 / 0.75
  const durchsicht = () => html.style.setProperty("--glas-a", String(ein.d || .55));
  const schrift = () => { durchsicht(); html.classList.remove("glas-mint", "glas-gelb"); if (ein.schrift && ein.schrift !== "weiss") html.classList.add("glas-" + ein.schrift); };
  let api = null, ich = null;
  const START = location.href.split("#")[0]; // 23.10.2026: Adresse beim Öffnen merken – Seiten wie chat.html ändern sie später (sonst findet ✕ das Fenster nicht)
  const bereit = (async () => {
    for (let i = 0; i < 50 && typeof WA === "undefined"; i++) await new Promise(r => setTimeout(r, 100));
    if (typeof WA === "undefined") return;
    await WA.onInit(); api = WA;
    try { const v = WA.player.state.swFenster; if (v && typeof v === "object") ein = Object.assign(STANDARD(), v); } catch { /* neu */ }
    schrift();
    try { const alle = await WA.ui.website.getAll(); ich = alle.find(w => String(w.url || "").split("#")[0] === START) || null; } catch { /* egal */ }
  })();
  const speichern = (neuOeffnen) => { if (!api) return; try { api.player.state.saveVariable("swFenster", Object.assign({}, ein, { neu: neuOeffnen ? Date.now() : (ein.neu || 0) }), { public: false, persist: true }); } catch (e) { console.warn("swFenster", e); } };
  // live mitwachsen versuchen (einzelne Felder, wie in der WA-Doku); wenn WA das nicht übernimmt, gilt es beim Loslassen
  const live = () => { if (!ich) return; try { ich.size.width = ein.b + "px"; ich.size.height = ein.hv + "vh"; if (ich.margin) { ich.margin.right = ein.r + "px"; ich.margin.top = ein.o + "px"; } } catch { /* nicht unterstützt */ } };
  // Anzeige während des Ziehens
  let anzeige = null;
  const zeigen = (t) => { if (!anzeige) { anzeige = document.createElement("div"); anzeige.id = "glas-mass"; anzeige.appendChild(document.createElement("span")); document.body.appendChild(anzeige); } anzeige.firstChild.textContent = t; anzeige.style.display = "flex"; };
  const ziehen = (el, art) => {
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || ein.voll) return; if (art === "kopf" && e.target.closest("button, a, input, select, textarea, #glas-leiste")) return;
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      const x0 = e.screenX, y0 = e.screenY, s = { ...ein }; let zuletzt = 0;
      // Höhe des Büro-Fensters aus der eigenen Höhe (die in vh geöffnet wurde) zurückrechnen
      const vp = window.innerHeight * 100 / (Number(s.hv) || 78), hpx0 = window.innerHeight;
      html.classList.add("glas-zieht");
      const bewegen = (m) => {
        const dx = m.screenX - x0, dy = m.screenY - y0;
        const SW = window.outerWidth || screen.availWidth || 1600, SH = screen.availHeight || 900, zw = (v, a, z) => Math.min(z, Math.max(a, v)); // nie aus dem Browserfenster (23.10.2026: outerWidth)
        const hvMax = Math.max(30, Math.floor(100 - (ein.o + 40) * 100 / vp)); // unten nicht aus dem Büro-Fenster
        if (art === "kopf") { ein.r = zw(s.r - dx, 0, SW - ein.b - 20); ein.o = zw(s.o + dy, 0, Math.max(0, vp - hpx0 - 40)); zeigen("Verschieben … loslassen zum Übernehmen"); }
        else { ein.b = zw(Math.round(s.b - dx), 340, SW - ein.r - 20); if (art === "ecke") ein.hv = zw(Math.round((hpx0 + dy) * 100 / vp), 30, hvMax);
          zeigen(ein.b + " × " + Math.round(ein.hv * vp / 100) + " px"); }
        if (Date.now() - zuletzt > 120) { zuletzt = Date.now(); live(); }
      };
      const los = () => {
        el.removeEventListener("pointermove", bewegen); el.removeEventListener("pointerup", los); el.removeEventListener("pointercancel", los);
        html.classList.remove("glas-zieht"); if (anzeige) anzeige.style.display = "none";
        const passt = art !== "kopf" && Math.abs(window.innerWidth - ein.b) < 12 && Math.abs(window.innerHeight - ein.hv * vp / 100) < 12;
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
      // 15.10.2026 abends (Sam: „Profil etc. kann ich nicht größer ziehen“): Größe per Klick in Stufen – geht immer, auch wenn Ziehen hakt
      knopf("⤢", "Größer: mittel → groß → sehr groß → normal", () => { const SW = screen.availWidth || 1600, stufen = [780, 1100, 1450, Math.max(1500, SW - 80)], hoehe = [78, 84, 88, 92];
        const i = stufen.findIndex(w => (ein.b || 780) < w - 20); const n = i < 0 ? 0 : i; ein.voll = false; ein.b = Math.min(stufen[n], SW - 40); ein.hv = hoehe[n]; ein.r = Math.min(ein.r ?? 14, 40); speichern(true); }),
      knopf("↺", "Größe und Platz zurücksetzen", () => { const sch = ein.schrift, d = ein.d; ein = STANDARD(); ein.schrift = sch; ein.d = d; speichern(true); }),
      knopf("⛶", "Vollbild an/aus", () => { ein.voll = !ein.voll; speichern(true); }),
      knopf("×", "Schließen", async () => { await bereit; if (ich) ich.close(); else if (api) try { api.player.state.saveVariable("swAktion", { was: "glasZu", t: Date.now() }, { public: false, persist: false }); } catch { /* alt */ } }), // ohne Treffer: Büro-Skript schließt das Glas-Fenster
    );
    const rand = document.createElement("div"); rand.id = "glas-rand"; rand.title = "Ziehen: breiter / schmaler";
    const ecke = document.createElement("div"); ecke.id = "glas-ecke"; ecke.title = "Ziehen: größer / kleiner";
    document.body.append(l, rand, ecke);
    ziehen(rand, "rand"); ziehen(ecke, "ecke");
    const kopf = document.querySelector("header"); if (kopf) { kopf.classList.add("glas-kopf"); kopf.title = "Ziehen zum Verschieben"; ziehen(kopf, "kopf"); }
  };
  // Tastatur zurück ans Büro (09.10., Sam: „Leertaste geht nicht mehr“): nach jedem Klick, der nicht in ein Eingabefeld geht,
  // den Fokus aus dem Fenster nehmen — sonst landen Leertaste/Pfeiltasten im Fenster statt im Büro
  const zurueck = () => { const a = document.activeElement; if (a && a.closest && a.closest("input, textarea, select, [contenteditable]")) return; try { a && a.blur && a.blur(); } catch { /* egal */ } try { window.blur(); } catch { /* egal */ } };
  document.addEventListener("pointerup", () => setTimeout(zurueck, 0), true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const a = document.activeElement; if (a && a.blur) a.blur(); try { window.blur(); } catch { /* egal */ } } }, true);
  if (typeof WA === "undefined") { const s = document.createElement("script"); s.src = "https://play.workadventu.re/iframe_api.js"; document.head.appendChild(s); }
  if (document.body) aufbauen(); else document.addEventListener("DOMContentLoaded", aufbauen);
})();
