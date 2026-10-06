(() => {
  // main.ts
  var ENDPOINT = "https://swdigitaltest.de/buero-praesenz/melden";
  var BUERO_KEY = "a21b2aa2a42fe6189b05773c07bbc9ad78e38b34ba3bb6fe";
  var aktuellerBereich = null;
  function melden(event) {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY },
      body: JSON.stringify({ name: WA.player.name, bereich: aktuellerBereich, event }),
      keepalive: true
    }).catch(() => {
    });
  }
  var TILED_BEREICHE = ["Townhall", "Payroll", "Besprechung 1", "Besprechung 2", "Sam's Buero"];
  function beobachten(name, api) {
    api.onEnter(name).subscribe(() => {
      aktuellerBereich = name;
      melden("betreten");
    });
    api.onLeave(name).subscribe(() => {
      if (aktuellerBereich === name) aktuellerBereich = null;
      melden("betreten");
    });
  }
  WA.onInit().then(() => {
    for (const name of TILED_BEREICHE) beobachten(name, WA.room.area);
    try {
      for (const area of WA.mapEditor.area.list()) {
        const name = area.name;
        if (name && !TILED_BEREICHE.includes(name)) beobachten(name, WA.mapEditor.area);
      }
    } catch {
    }
    melden("betreten");
    setInterval(() => melden("heartbeat"), 6e4);
    window.addEventListener("pagehide", () => melden("verlassen"));
  });
})();
