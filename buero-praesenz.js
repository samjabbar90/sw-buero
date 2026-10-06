(() => {
  // main.ts
  var ENDPOINT = "https://swdigitaltest.de/buero-praesenz/melden";
  var BUERO_KEY = "a21b2aa2a42fe6189b05773c07bbc9ad78e38b34ba3bb6fe";
  var DASHBOARD = "https://swdigitaltest.de";
  var SITZUNG = Math.random().toString(36).slice(2) + Date.now().toString(36);
  var aktuellerBereich = null;
  var beendet = false;
  var bereit = Promise.resolve();
  function beenden() {
    if (beendet) return;
    beendet = true;
    WA.ui.displayActionMessage({
      message: "Du bist an einem anderen Ort ins B\xFCro gegangen \u2013 diese Sitzung wird beendet.",
      callback: () => WA.nav.goToPage(DASHBOARD)
    });
    setTimeout(() => WA.nav.goToPage(DASHBOARD), 4e3);
  }
  function melden(event, start = false) {
    if (beendet) return Promise.resolve();
    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY },
      body: JSON.stringify({ name: WA.player.name, bereich: aktuellerBereich, event, sitzung: SITZUNG, start }),
      keepalive: true
    }).then((r) => r.json()).then((d) => {
      if (d && d.abgeloest) beenden();
    }).catch(() => {
    });
  }
  var TILED_BEREICHE = ["Townhall", "Payroll", "Besprechung 1", "Besprechung 2", "Sam's Buero"];
  function beobachten(name, api) {
    api.onEnter(name).subscribe(() => {
      aktuellerBereich = name;
      bereit.then(() => melden("betreten"));
    });
    api.onLeave(name).subscribe(() => {
      if (aktuellerBereich === name) aktuellerBereich = null;
      bereit.then(() => melden("betreten"));
    });
  }
  WA.onInit().then(() => {
    bereit = melden("betreten", true);
    for (const name of TILED_BEREICHE) beobachten(name, WA.room.area);
    try {
      for (const area of WA.mapEditor.area.list()) {
        const name = area.name;
        if (name && !TILED_BEREICHE.includes(name)) beobachten(name, WA.mapEditor.area);
      }
    } catch {
    }
    setInterval(() => melden("heartbeat"), 3e4);
    window.addEventListener("pagehide", () => melden("verlassen"));
  });
})();
