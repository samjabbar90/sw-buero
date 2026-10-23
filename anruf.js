// Kartenskript des Gesprächsraums (anruf.tmj, 23.10.2026 – 📞 Anrufen, Variante C).
// Link: …/anruf#kabine=N&id=<Anruf-ID>&zurueck=<handy|buero>. Stellt die Figur in Kabine N (dort verbindet der Meeting-Bereich aus
// anruf.wam beide Personen), zeigt „📵 Auflegen“ und geht zurück, sobald einer auflegt. Server: /buero-praesenz/anruf/:id/…
/* global WA */
(function () {
  const KEY = "a21b2aa2a42fe6189b05773c07bbc9ad78e38b34ba3bb6fe", B = "https://swdigitaltest.de/buero-praesenz/anruf";
  const KABINEN = { 1: [4, 3], 2: [11, 3], 3: [18, 3], 4: [4, 9], 5: [11, 9], 6: [18, 9] };
  const ZURUECK = { handy: "https://samjabbar90.github.io/sw-buero/handy.html", buero: "https://play.workadventu.re/@/swdigitaltax/sw-digital-tax/buero#karte=1" };
  let fertig = false;
  const H = () => ({ "X-Buero-Key": KEY, "Content-Type": "application/json" });
  WA.onInit().then(async () => {
    const h = WA.room.hashParameters || {}, id = String(h.id || ""), k = KABINEN[Number(h.kabine)] || null;
    const zurueck = ZURUECK[h.zurueck] || ZURUECK.handy;
    const raus = (text) => { if (fertig) return; fertig = true; try { WA.ui.displayActionMessage({ message: text, callback: () => WA.nav.goToPage(zurueck) }); } catch (e) { /* alt */ } setTimeout(() => WA.nav.goToPage(zurueck), 2500); };
    try { WA.controls.disableMapEditor && WA.controls.disableMapEditor(); WA.controls.disableInviteButton && WA.controls.disableInviteButton(); } catch (e) { /* alt */ }
    if (k) try { await WA.player.teleport(k[0] * 32 + 16, k[1] * 32 + 16); } catch (e) { /* alt */ }
    try { WA.controls.disablePlayerControls(); } catch (e) { /* alt */ } // in der Kabine bleiben – Laufen würde das Gespräch beenden
    const auflegen = async () => { try { await fetch(B + "/" + encodeURIComponent(id) + "/ende", { method: "POST", headers: H(), body: JSON.stringify({ name: WA.player.name }) }); } catch (e) { /* egal */ } raus("📵 Aufgelegt"); };
    try { WA.ui.actionBar.addButton({ id: "sw-auflegen", label: "📵 Auflegen", callback: auflegen }); } catch (e) { /* alt */ }
    if (!id) return;
    // legt der andere auf oder endet der Anruf, geht es zurück
    setInterval(async () => {
      try { const r = await fetch(B + "/" + encodeURIComponent(id) + "/status", { headers: H() }); const d = await r.json(); if (d && (d.status === "beendet" || d.status === "abgelehnt" || d.status === "verpasst")) raus("📵 Das Gespräch wurde beendet"); } catch (e) { /* nächstes Mal */ }
    }, 4000);
  });
})();
