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
  var ERSATZ_BEREICHE = [
    "B\xFCro Sam",
    "B\xFCro Emre",
    "B\xFCro Kadir",
    "B\xFCro Noura",
    "Townhall",
    "B\xFCro Attila",
    "B\xFCro Ferhat",
    "B\xFCro Angelina",
    "B\xFCro Leutrim",
    "Besprechung 1",
    "Besprechung 2",
    "B\xFCro Katharina",
    "B\xFCro Tanja",
    "B\xFCro Kerstin",
    "B\xFCro Kubilay",
    "B\xFCro Bin",
    "B\xFCro Ilona",
    "K\xFCche & Kaffee",
    "B\xFCro Angelika",
    "B\xFCro Bahjat",
    "B\xFCro Christiane",
    "B\xFCro Dilber",
    "B\xFCro Fatih",
    "B\xFCro Jana",
    "B\xFCro Julien",
    "B\xFCro Leonita",
    "B\xFCro Onur",
    "Chill-Zone"
  ];
  async function kartenBereiche() {
    try {
      let karte = await (await fetch(WA.room.mapURL)).json();
      if (!karte.layers && karte.mapUrl) karte = await (await fetch(new URL(karte.mapUrl, WA.room.mapURL).toString())).json();
      const namen = [];
      const lauf = (ls) => ls.forEach((l) => {
        if (l.type === "group") lauf(l.layers || []);
        if (l.type === "objectgroup") (l.objects || []).forEach((o) => {
          if ((o.class === "area" || o.type === "area") && o.name && o.name !== "start" && !namen.includes(o.name)) namen.push(o.name);
        });
      });
      lauf(karte.layers || []);
      return namen.length ? namen : ERSATZ_BEREICHE;
    } catch {
      return ERSATZ_BEREICHE;
    }
  }
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
  WA.onInit().then(async () => {
    bereit = melden("betreten", true);
    const tiled = await kartenBereiche();
    for (const name of tiled) beobachten(name, WA.room.area);
    try {
      for (const area of WA.mapEditor.area.list()) {
        const name = area.name;
        if (name && !tiled.includes(name)) beobachten(name, WA.mapEditor.area);
      }
    } catch {
    }
    try {
      const breite = 92 * 32, hoehe = 72 * 32;
      WA.ui.actionBar.addButton({ id: "sw-uebersicht", label: "\u{1F5FA} \xDCbersicht", callback: () => WA.camera.set(breite / 2, hoehe / 2, breite, hoehe, false, true) });
      WA.ui.actionBar.addButton({ id: "sw-zu-mir", label: "\u{1F4CD} Zu mir", callback: () => WA.camera.followPlayer(true) });
      WA.ui.actionBar.addButton({ id: "sw-schnellreise", label: "\u{1F680} Schnellreise", callback: () => WA.ui.modal.openModal({
        title: "Schnellreise",
        src: "https://samjabbar90.github.io/sw-buero/schnellreise.html",
        allowApi: true,
        position: "right"
      }) });
    } catch {
    }
    setInterval(() => melden("heartbeat"), 3e4);
    window.addEventListener("pagehide", () => melden("verlassen"));
  });
})();
