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
    const meine = meineTuer();
    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY },
      body: JSON.stringify({
        name: WA.player.name,
        bereich: aktuellerBereich,
        event,
        sitzung: SITZUNG,
        start,
        tuer: meine ? { raum: meine.raum, status: tuerStatus(meine) } : null
      }),
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
  var karte = null;
  async function ladeKarte() {
    if (karte) return karte;
    let k = await (await fetch(WA.room.mapURL)).json();
    if (!k.layers && k.mapUrl) k = await (await fetch(new URL(k.mapUrl, WA.room.mapURL).toString())).json();
    return karte = k;
  }
  async function kartenBereiche() {
    try {
      const karte2 = await ladeKarte();
      const namen = [];
      const lauf = (ls) => ls.forEach((l) => {
        if (l.type === "group") lauf(l.layers || []);
        if (l.type === "objectgroup") (l.objects || []).forEach((o) => {
          if ((o.class === "area" || o.type === "area") && o.name && o.name !== "start" && !namen.includes(o.name)) namen.push(o.name);
        });
      });
      lauf(karte2.layers || []);
      return namen.length ? namen : ERSATZ_BEREICHE;
    } catch {
      return ERSATZ_BEREICHE;
    }
  }
  var tueren = [];
  var schildGids = {};
  var kollisionGid = 3;
  var freigabe = /* @__PURE__ */ new Map();
  var vorname = (n) => String(n || "").trim().split(/\s+/)[0].toLowerCase();
  var istBesitzer = (t) => t.besitzer.toLowerCase() === vorname(WA.player.name);
  var meineTuer = () => tueren.find(istBesitzer);
  var tuerStatus = (t) => String(WA.state[t.variable] || "frei");
  var TEXT = { frei: "\u{1F7E2} T\xFCr: frei", besetzt: "\u{1F7E1} T\xFCr: besetzt", zu: "\u{1F534} T\xFCr: zu" };
  function tuerAnwenden(t) {
    const s = tuerStatus(t);
    const darfDurch = istBesitzer(t) || (freigabe.get(t.variable) || 0) > Date.now();
    const kacheln = t.felder.map(([x, y]) => ({ x, y, tile: s === "zu" && !darfDurch ? kollisionGid : null, layer: "collisions" }));
    const sg = schildGids[s] || null;
    t.schild.forEach(([x, y], i) => kacheln.push({ x, y, tile: sg ? sg[i] : null, layer: "furniture/labels" }));
    try {
      WA.room.setTiles(kacheln);
    } catch {
    }
  }
  function tuerKnopf() {
    const t = meineTuer();
    if (!t) return;
    try {
      WA.ui.actionBar.removeButton("sw-tuer");
    } catch {
    }
    WA.ui.actionBar.addButton({ id: "sw-tuer", label: TEXT[tuerStatus(t)] || TEXT.frei, callback: () => {
      const naechster = { frei: "besetzt", besetzt: "zu", zu: "frei" }[tuerStatus(t)] || "frei";
      WA.state.saveVariable(t.variable, naechster);
    } });
  }
  var hinweis = null;
  var hinweisTuer = null;
  var geklopft = /* @__PURE__ */ new Map();
  function naheTuer(px, py) {
    const fx = Math.floor(px / 32), fy = Math.floor(py / 32);
    return tueren.find((t) => !istBesitzer(t) && tuerStatus(t) !== "frei" && aktuellerBereich !== t.raum && t.felder.some(([x, y]) => Math.max(Math.abs(x - fx), Math.abs(y - fy)) <= 2)) || null;
  }
  function hinweisZeigen(t) {
    if ((t ? t.variable : null) === hinweisTuer) return;
    if (hinweis) {
      try {
        hinweis.remove();
      } catch {
      }
      hinweis = null;
    }
    hinweisTuer = t ? t.variable : null;
    if (!t) return;
    const zu = tuerStatus(t) === "zu";
    hinweis = WA.ui.displayActionMessage({
      message: `${t.raum}: ${t.besitzer} ist ${zu ? "nicht zu st\xF6ren \u2013 T\xFCr abgeschlossen" : "besch\xE4ftigt"}. Leertaste = anklopfen`,
      callback: () => anklopfen(t)
    });
  }
  function anklopfen(t) {
    if (Date.now() - (geklopft.get(t.variable) || 0) < 15e3) return;
    geklopft.set(t.variable, Date.now());
    WA.event.broadcast("sw-klopfen", { an: t.besitzer, von: WA.player.name, variable: t.variable });
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY },
      body: JSON.stringify({ name: WA.player.name, event: "klopfen", an: t.besitzer, raum: t.raum, sitzung: SITZUNG })
    }).catch(() => {
    });
    hinweisTuer = null;
    hinweisZeigen(null);
    const m = WA.ui.displayActionMessage({ message: `Angeklopft bei ${t.besitzer} \u2013 einen Moment \u2026`, callback: () => {
    } });
    setTimeout(() => {
      try {
        m.remove();
      } catch {
      }
    }, 6e3);
  }
  async function tuerenStarten() {
    try {
      const k = await ladeKarte();
      const p = (k.properties || []).find((x) => x.name === "tuerSchilder");
      if (p) schildGids = JSON.parse(p.value);
      const zonen = (k.tilesets || []).find((t) => t.name === "WA_Special_Zones");
      if (zonen) kollisionGid = zonen.firstgid + 2;
      const lauf = (ls) => ls.forEach((l) => {
        if (l.type === "group") lauf(l.layers || []);
        if (l.type === "objectgroup") (l.objects || []).forEach((o) => {
          const pr = (n) => ((o.properties || []).find((x) => x.name === n) || {}).value;
          if (pr("tuerVariable")) tueren.push({ raum: o.name, besitzer: pr("besitzer"), variable: pr("tuerVariable"), felder: JSON.parse(pr("tuerFelder")), schild: JSON.parse(pr("schildFelder")) });
        });
      });
      lauf(k.layers || []);
    } catch {
      return;
    }
    for (const t of tueren) {
      tuerAnwenden(t);
      WA.state.onVariableChange(t.variable).subscribe(() => {
        tuerAnwenden(t);
        if (istBesitzer(t)) {
          tuerKnopf();
          melden("heartbeat");
        }
      });
    }
    tuerKnopf();
    WA.player.onPlayerMove((e) => hinweisZeigen(naheTuer(e.x, e.y)));
    WA.event.on("sw-klopfen").subscribe((ev) => {
      const d = ev.data || {};
      const t = meineTuer();
      if (!t || vorname(d.an) !== vorname(WA.player.name)) return;
      const m = WA.ui.displayActionMessage({
        message: `\u270A ${d.von} klopft an deine T\xFCr \u2013 Leertaste = reinlassen`,
        callback: () => WA.event.broadcast("sw-reinlassen", { fuer: d.von, variable: t.variable })
      });
      setTimeout(() => {
        try {
          m.remove();
        } catch {
        }
      }, 2e4);
    });
    WA.event.on("sw-reinlassen").subscribe((ev) => {
      const d = ev.data || {};
      if (d.fuer !== WA.player.name) return;
      const t = tueren.find((x) => x.variable === d.variable);
      if (!t) return;
      freigabe.set(t.variable, Date.now() + 3e4);
      tuerAnwenden(t);
      const m = WA.ui.displayActionMessage({ message: `${t.besitzer} hat dich reingelassen \u2013 komm rein!`, callback: () => {
      } });
      setTimeout(() => {
        try {
          m.remove();
        } catch {
        }
      }, 5e3);
      setTimeout(() => tuerAnwenden(t), 30500);
    });
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
    await tuerenStarten();
    try {
      const breite = (karte && karte.width || 92) * 32, hoehe = (karte && karte.height || 72) * 32;
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
