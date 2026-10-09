(() => {
  // main.ts
  var ENDPOINT = "https://swdigitaltest.de/buero-praesenz/melden";
  var BUERO_KEY = "a21b2aa2a42fe6189b05773c07bbc9ad78e38b34ba3bb6fe";
  var DASHBOARD = "https://swdigitaltest.de";
  var SITZUNG = Math.random().toString(36).slice(2) + Date.now().toString(36);
  var HANDY = (screen.width || 1200) < 768 || /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent);
  var aktuellerBereich = null;
  var beendet = false;
  var bereit = Promise.resolve();
  var position = null;
  var gespraech = /* @__PURE__ */ new Set();
  var zuletztGemeldet = 0;
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
    if (beendet || gesperrt && event !== "verlassen") return Promise.resolve();
    zuletztGemeldet = Date.now();
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
        tuer: meine ? { raum: meine.raum, status: tuerStatus(meine) } : null,
        pos: position,
        gespraech: [...gespraech]
      }),
      keepalive: true
    }).then((r) => r.json()).then((d) => {
      if (d && typeof d.system === "boolean") mitSystemZeit = d.system;
      if (d && d.inaktiv) return wegVomRechner();
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
          if ((o.class === "area" || o.type === "area") && o.name && o.name !== "start" && !o.name.startsWith("zu-") && !namen.includes(o.name)) namen.push(o.name);
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
  function tuerWache(raum) {
    const t = tueren.find((x) => x.raum === raum);
    if (!t || !t.draussen || tuerStatus(t) !== "zu" || istBesitzer(t) || (freigabe.get(t.variable) || 0) > Date.now()) return;
    WA.player.teleport(t.draussen[0] * 32 + 16, t.draussen[1] * 32 + 16);
    kurzMeldung(`\u{1F512} ${t.raum} ist abgeschlossen \u2013 Leertaste vor der T\xFCr = anklopfen`, 6e3);
  }
  var hinweis = null;
  var hinweisTuer = null;
  var geklopft = /* @__PURE__ */ new Map();
  function naheTuer(px, py) {
    const fx2 = Math.floor(px / 32), fy = Math.floor(py / 32);
    return tueren.find((t) => !istBesitzer(t) && tuerStatus(t) !== "frei" && aktuellerBereich !== t.raum && t.felder.some(([x, y]) => Math.max(Math.abs(x - fx2), Math.abs(y - fy)) <= 2)) || null;
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
          if (pr("tuerVariable")) tueren.push({ raum: o.name, besitzer: pr("besitzer"), variable: pr("tuerVariable"), felder: JSON.parse(pr("tuerFelder")), schild: JSON.parse(pr("schildFelder")), rechteck: [o.x / 32, o.y / 32, o.width / 32, o.height / 32] });
        });
      });
      lauf(k.layers || []);
      const alle = [];
      (function f(ls) {
        ls.forEach((l) => {
          if (l.type === "group") f(l.layers || []);
          else alle.push(l);
        });
      })(k.layers || []);
      const kol = (alle.find((l) => l.name === "collisions") || { data: [] }).data, W = k.width;
      for (const t of tueren) {
        const [rx, ry, rw, rh] = t.rechteck, drin = (x, y) => x >= rx && x < rx + rw && y >= ry && y < ry + rh;
        for (const [x, y] of t.felder) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]])
          if (!t.draussen && !drin(x + dx, y + dy) && !kol[(y + dy) * W + x + dx] && !t.felder.some(([a, b]) => a === x + dx && b === y + dy)) t.draussen = [x + dx, y + dy];
      }
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
  var INFO = "https://swdigitaltest.de/buero-praesenz/info";
  var info = { durchsage: null, geburtstage: [], reservierungen: [] };
  var durchsageGezeigt = null;
  var begruesst = false;
  var ballonsGesetzt = "";
  var hm = (d) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  function kurzMeldung(text, ms = 7e3) {
    try {
      const m = WA.ui.displayActionMessage({ message: text, callback: () => {
      } });
      setTimeout(() => {
        try {
          m.remove();
        } catch {
        }
      }, ms);
    } catch {
    }
  }
  function reservierungZeigen(raum) {
    const jetzt = hm(/* @__PURE__ */ new Date());
    const r = (info.reservierungen || []).filter((x) => x.raum === raum && x.bis > jetzt);
    if (!r.length) return;
    const aktiv = r.find((x) => x.von <= jetzt);
    const teil = (x) => `${x.von}\u2013${x.bis} (${x.wer}${x.thema ? " \xB7 " + x.thema : ""})`;
    kurzMeldung(aktiv ? `\u{1F4C5} ${raum} ist gerade belegt: ${teil(aktiv)}` : `\u{1F4C5} ${raum} heute reserviert: ${r.map(teil).join(", ")}`);
  }
  function ballonsSetzen() {
    const zonen = (karte && karte.tilesets || []).find((t) => t.name === "WA_Decoration");
    if (!zonen) return;
    const ballon = zonen.firstgid + 94, kinder = (info.geburtstage || []).map((n) => n.toLowerCase());
    const schluessel = kinder.join(",");
    if (schluessel === ballonsGesetzt) return;
    ballonsGesetzt = schluessel;
    const kacheln = [];
    for (const t of tueren) {
      const [x, y, w] = t.rechteck, an = kinder.includes(t.besitzer.toLowerCase());
      for (const fx2 of [x, x + w - 1]) kacheln.push({ x: fx2, y, tile: an ? ballon : null, layer: "above/above2" });
    }
    try {
      WA.room.setTiles(kacheln);
    } catch {
    }
  }
  var tuerVorTelefon = null;
  function telefonTuer() {
    const t = meineTuer();
    if (!t) return;
    const ich = vorname(WA.player.name), gleich = (n) => String(n).toLowerCase() === ich;
    const telefonat = (info.telefoniert || []).some(gleich), termin = (info.imTermin || []).some(gleich), telefoniere = telefonat || termin;
    if (telefoniere && tuerVorTelefon === null) {
      tuerVorTelefon = tuerStatus(t);
      if (tuerVorTelefon === "frei") WA.state.saveVariable(t.variable, "besetzt");
      kurzMeldung(telefonat ? "\u{1F4DE} Du telefonierst \u2013 deine T\xFCr steht auf \u201Ebesetzt\u201C" : "\u{1F4C5} Du hast gerade einen Termin \u2013 deine T\xFCr steht auf \u201Ebesetzt\u201C", 5e3);
    } else if (!telefoniere && tuerVorTelefon !== null) {
      if (tuerVorTelefon === "frei" && tuerStatus(t) === "besetzt") WA.state.saveVariable(t.variable, "frei");
      tuerVorTelefon = null;
    }
  }
  var fxStand = {};
  var FEIERABEND_RAEUME = ["Besprechung 10", "Besprechung 11", "Besprechung Glas", "Pause", "Lernzimmer", "Helpcenter", "Fitnessraum", "Fibu Backoffice"];
  var toene = {};
  function ton(name) {
    try {
      (toene[name] ||= WA.sound.loadSound(SEITEN + "toene/" + name + ".wav")).play({ volume: 0.5 });
    } catch {
    }
  }
  function fx(name, an) {
    if (fxStand[name] === an) return;
    fxStand[name] = an;
    try {
      an ? WA.room.showLayer(name) : WA.room.hideLayer(name);
    } catch {
    }
  }
  function effekte() {
    for (const o of ((karte && karte.layers || []).find((l) => l.name === "floorLayer") || { objects: [] }).objects) {
      if (!/^Büro /.test(o.name)) continue;
      const an = aktuellerBereich === o.name || (info.belegt || []).includes(o.name);
      fx("fx-dunkel-" + o.name.normalize("NFD").replace(/[^A-Za-z0-9]/g, ""), !an);
    }
    const teile = (/* @__PURE__ */ new Date()).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).split(/[- :]/).map(Number);
    const monat = teile[1], min = teile[3] * 60 + teile[4];
    const w = info.wetter;
    const hm2 = (t) => {
      const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ""));
      return m ? +m[1] * 60 + +m[2] : null;
    };
    const auf = hm2(w && w.auf), unter = hm2(w && w.unter);
    const nacht = auf !== null && unter !== null ? min >= unter + 30 || min < auf - 30 : min >= 20 * 60 || min < 6 * 60 + 30;
    const abend = !nacht && (auf !== null && unter !== null ? min >= unter - 45 || min < auf + 30 : min >= 18 * 60 || min < 7 * 60 + 30);
    fx("fx-nacht", nacht);
    fx("fx-lichter", nacht);
    fx("fx-abend", abend);
    for (const n of FEIERABEND_RAEUME) fx("fx-feierabend-" + n.normalize("NFD").replace(/[^A-Za-z0-9]/g, ""), (min >= 18 * 60 || nacht) && aktuellerBereich !== n && !(info.belegt || []).includes(n));
    if (w) {
      fx("fx-regen", !!w.regen);
      fx("fx-pfuetzen", !!w.regen);
      fx("fx-trueb", !!(w.regen || w.nebel || w.trueb || w.gewitter));
      fx("fx-schneefall", !!w.schnee);
      fx("fx-schnee", !!w.schneeLiegt);
    } else {
      const winter = monat === 12 || monat <= 2;
      fx("fx-schnee", winter);
      fx("fx-schneefall", winter);
      fx("fx-regen", false);
      fx("fx-pfuetzen", false);
      fx("fx-trueb", false);
    }
    gewitter = !!(w && w.gewitter);
    hundRuhe = nacht || !!(w && (w.regen || w.schnee || w.gewitter));
  }
  var hundRuhe = false;
  async function hundStarten() {
    let G = 0;
    try {
      const ts = ((await ladeKarte()).tilesets || []).find((t) => t.name === "SW_Hund");
      if (!ts) return;
      G = ts.firstgid;
    } catch {
      return;
    }
    const KORB = { x: 400, y: 80 }, ECKE = { x: 80, y: 80 }, UNTEN = { x: 80, y: 272 }, TEMPO = 32;
    const d1 = (KORB.x - ECKE.x) / TEMPO, d2 = (UNTEN.y - ECKE.y) / TEMPO;
    const PHASEN = [["lieg", 40], ["wedelK", 4], ["links", d1], ["runter", d2], ["sitz", 12], ["hoch", d2], ["rechts", d1], ["sitzK", 6]];
    const ZYKLUS = PHASEN.reduce((s, p) => s + p[1], 0);
    let alt = [], letzter = "", wedelBis = 0, hier = { x: KORB.x, y: KORB.y };
    const zeigen = (bild, px, py) => {
      const qx = Math.round(px / 8) * 8, qy = Math.round(py / 8) * 8, tx0 = Math.floor(qx / 32) - 1, ty0 = Math.floor(qy / 32) - 1;
      const schl = bild + ":" + tx0 + ":" + ty0;
      if (schl === letzter) return;
      letzter = schl;
      hier = { x: qx, y: qy };
      const neu = [];
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) neu.push({ x: tx0 + x, y: ty0 + y, tile: G + bild * 9 + y * 3 + x, layer: "hund" });
      const weg = alt.filter((a) => !neu.some((n) => n.x === a.x && n.y === a.y)).map((a) => ({ ...a, tile: null }));
      try {
        WA.room.setTiles([...weg, ...neu]);
        alt = neu;
      } catch {
      }
    };
    const off = (q) => Math.round(q / 8) * 8 % 32 / 8;
    const tick = () => {
      const jetzt = Date.now(), bein = Math.floor(jetzt / 250) % 2, wedel = Math.floor(jetzt / 300) % 2;
      if (wedelBis > jetzt) return zeigen(32 + (hier.x > ECKE.x + 8 ? 3 : 0) + (wedel ? 1 : 0), hier.x, hier.y);
      if (hundRuhe) return zeigen(32 + 3 + 2, KORB.x, KORB.y);
      let t = jetzt / 1e3 % ZYKLUS, p = PHASEN[0];
      for (const x of PHASEN) {
        if (t < x[1]) {
          p = x;
          break;
        }
        t -= x[1];
      }
      const anteil = t / p[1];
      switch (p[0]) {
        case "lieg":
          return zeigen(37, KORB.x, KORB.y);
        case "wedelK":
          return zeigen(35 + (wedel ? 1 : 0), KORB.x, KORB.y);
        // links: 35 sitz, 36 wedel, 37 lieg
        case "sitzK":
          return zeigen(35, KORB.x, KORB.y);
        case "links": {
          const x = KORB.x - (KORB.x - ECKE.x) * anteil;
          return zeigen(8 + off(x) * 2 + bein, x, ECKE.y);
        }
        case "rechts": {
          const x = ECKE.x + (KORB.x - ECKE.x) * anteil;
          return zeigen(off(x) * 2 + bein, x, ECKE.y);
        }
        case "runter": {
          const y = ECKE.y + (UNTEN.y - ECKE.y) * anteil;
          return zeigen(16 + off(y) * 2 + bein, ECKE.x, y);
        }
        case "hoch": {
          const y = UNTEN.y - (UNTEN.y - ECKE.y) * anteil;
          return zeigen(24 + off(y) * 2 + bein, ECKE.x, y);
        }
        default:
          return zeigen(32 + (t < 5 && wedel ? 1 : 0), UNTEN.x, UNTEN.y);
      }
    };
    tick();
    setInterval(tick, 150);
    let meldung = null;
    WA.player.onPlayerMove((e) => {
      const nah = Math.hypot(e.x - hier.x, e.y - hier.y) < 56;
      if (nah && !meldung) {
        try {
          meldung = WA.ui.displayActionMessage({ message: "\u{1F415} Leertaste: Hund streicheln", callback: () => {
            wedelBis = Date.now() + 4e3;
            meldung = null;
          } });
        } catch {
        }
      } else if (!nah && meldung) {
        try {
          meldung.remove();
        } catch {
        }
        meldung = null;
      }
    });
  }
  var gewitter = false;
  setInterval(() => {
    if (!gewitter || Math.random() > 0.15) return;
    fx("fx-blitz", true);
    setTimeout(() => fx("fx-blitz", false), 120);
    setTimeout(() => {
      fx("fx-blitz", true);
      setTimeout(() => fx("fx-blitz", false), 80);
    }, 260);
  }, 4e3);
  var SEITEN = "https://samjabbar90.github.io/sw-buero/";
  var glasOffen = null;
  var glasNeu = 0;
  function glasLage() {
    let e = {};
    try {
      e = WA.player.state.swFenster || {};
    } catch {
    }
    const SW = screen.availWidth || 1600, SH = screen.availHeight || 900, zw = (v, a, z) => Math.min(z, Math.max(a, v));
    const b = Math.round(zw(Number(e.b) || Math.min(780, SW * 0.44), 340, SW - 40)), hv = Math.round(zw(Number(e.hv) || 78, 30, 88));
    e = { ...e, r: zw(Number(e.r ?? 14) || 0, 0, Math.max(0, SW - b - 20)), o: zw(Number(e.o ?? 70) || 0, 0, 160) };
    if (HANDY) return { position: { vertical: "bottom", horizontal: "middle" }, size: { width: Math.round((screen.width || 390) - 20) + "px", height: "58vh" }, margin: { bottom: "96px" } };
    if (e.voll) return { position: { vertical: "top", horizontal: "middle" }, size: { width: Math.round(screen.availWidth * 0.94) + "px", height: "90vh" }, margin: { top: "40px" } };
    return { position: { vertical: "top", horizontal: "right" }, size: { width: b + "px", height: hv + "vh" }, margin: { top: Math.round(Number(e.o) || 70) + "px", right: Math.round(Number(e.r ?? 14)) + "px" } };
  }
  async function glasOeffnen(u) {
    return await WA.ui.website.open({ url: u, allowApi: true, visible: true, ...glasLage() });
  }
  async function glasFenster(url) {
    const u = url + (url.includes("?") ? "&" : "?") + "glas=1";
    try {
      glasOffen && glasOffen.handle && glasOffen.handle.close();
    } catch {
    }
    try {
      glasOffen = { url: u, handle: await glasOeffnen(u) };
    } catch (e) {
      console.warn("Glasfenster", e);
      try {
        return await WA.nav.openCoWebSite(url, true);
      } catch {
        return null;
      }
    }
    const meins = glasOffen;
    return { close: () => {
      if (glasOffen === meins) {
        try {
          meins.handle.close();
        } catch {
        }
        glasOffen = null;
      }
    } };
  }
  function glasBeobachten() {
    try {
      glasNeu = Number((WA.player.state.swFenster || {}).neu) || 0;
    } catch {
    }
    try {
      WA.player.state.onVariableChange("swFenster").subscribe(async (v) => {
        const n = Number(v && v.neu) || 0;
        if (!n || n === glasNeu) return;
        glasNeu = n;
        if (!glasOffen) return;
        const u = glasOffen.url;
        try {
          glasOffen.handle.close();
        } catch {
        }
        try {
          glasOffen.handle = await glasOeffnen(u);
        } catch (e) {
          console.warn("Glasfenster neu", e);
        }
      });
    } catch {
    }
  }
  var NEWS_BEREICH = { x: 41 * 32, y: 33 * 32, w: 8 * 32, h: 3 * 32 };
  var newsFenster = null;
  var newsHinweis = null;
  async function newsOeffnen() {
    try {
      newsHinweis && newsHinweis.remove();
    } catch {
    }
    try {
      newsFenster = await glasFenster(SEITEN + "news.html?t=" + Date.now());
    } catch {
    }
  }
  var HELPCENTER = [{ x: 40, y: 23 }];
  var hcFenster = null;
  var hcHinweis = null;
  function helpcenterRoboter() {
    HELPCENTER.forEach((h, i) => {
      const n = i + 1, bereich = { x: (h.x - 1) * 32, y: (h.y + 3) * 32, w: 8 * 32, h: 3 * 32 };
      const rein = () => {
        fx(`fx-hc${n}-aktiv`, true);
        fx(`fx-hc${n}-ruhe`, false);
        try {
          hcHinweis = WA.ui.displayActionMessage({ message: "\u{1F4AC} Helpcenter \xB7 Leertaste", callback: async () => {
            try {
              hcHinweis && hcHinweis.remove();
            } catch {
            }
            try {
              hcFenster = await glasFenster(SEITEN + "helpdesk.html?name=" + encodeURIComponent(WA.player.name || "") + "&t=" + Date.now());
            } catch {
            }
          } });
        } catch {
        }
      };
      const raus = () => {
        fx(`fx-hc${n}-aktiv`, false);
        fx(`fx-hc${n}-ruhe`, true);
        try {
          hcHinweis && hcHinweis.remove();
        } catch {
        }
        hcHinweis = null;
        try {
          hcFenster && hcFenster.close();
        } catch {
        }
        hcFenster = null;
      };
      try {
        WA.room.area.create({ name: "helpcenter-" + n, x: bereich.x, y: bereich.y, width: bereich.w, height: bereich.h });
        WA.room.area.onEnter("helpcenter-" + n).subscribe(rein);
        WA.room.area.onLeave("helpcenter-" + n).subscribe(raus);
      } catch {
        let drin = false;
        WA.player.onPlayerMove((e) => {
          const j = e.x >= bereich.x && e.x < bereich.x + bereich.w && e.y >= bereich.y && e.y < bereich.y + bereich.h;
          if (j && !drin) rein();
          if (!j && drin) raus();
          drin = j;
        });
      }
    });
  }
  function lernzimmer() {
    let fenster = null, hinweis2 = null;
    try {
      WA.room.area.onEnter("Lernzimmer").subscribe(() => {
        try {
          hinweis2 = WA.ui.displayActionMessage({ message: "\u{1F393} Schulungen \xB7 Leertaste", callback: async () => {
            try {
              hinweis2 && hinweis2.remove();
            } catch {
            }
            try {
              fenster = await glasFenster(SEITEN + "lernen.html?name=" + encodeURIComponent(WA.player.name || "") + "&t=" + Date.now());
            } catch {
            }
          } });
        } catch {
        }
      });
      WA.room.area.onLeave("Lernzimmer").subscribe(() => {
        try {
          hinweis2 && hinweis2.remove();
        } catch {
        }
        hinweis2 = null;
        try {
          fenster && fenster.close();
        } catch {
        }
        fenster = null;
      });
    } catch {
    }
  }
  var FITNESS = { x: 78, y: 6 };
  function fitnessEmpfang() {
    const b = { x: (FITNESS.x - 1) * 32, y: (FITNESS.y + 3) * 32, w: 8 * 32, h: 3 * 32 };
    let fenster = null, hinweis2 = null;
    const rein = () => {
      fx("fx-fit-aktiv", true);
      fx("fx-fit-ruhe", false);
      try {
        hinweis2 = WA.ui.displayActionMessage({ message: "\u2764\uFE0F Health & Wellbeing \xB7 Leertaste", callback: async () => {
          try {
            hinweis2 && hinweis2.remove();
          } catch {
          }
          try {
            fenster = await glasFenster(SEITEN + "health.html?name=" + encodeURIComponent(WA.player.name || "") + "&t=" + Date.now());
          } catch {
          }
        } });
      } catch {
      }
    };
    const raus = () => {
      fx("fx-fit-aktiv", false);
      fx("fx-fit-ruhe", true);
      try {
        hinweis2 && hinweis2.remove();
      } catch {
      }
      hinweis2 = null;
      try {
        fenster && fenster.close();
      } catch {
      }
      fenster = null;
    };
    try {
      WA.room.area.create({ name: "fitness-empfang", x: b.x, y: b.y, width: b.w, height: b.h });
      WA.room.area.onEnter("fitness-empfang").subscribe(rein);
      WA.room.area.onLeave("fitness-empfang").subscribe(raus);
    } catch {
      let drin = false;
      WA.player.onPlayerMove((e) => {
        const j = e.x >= b.x && e.x < b.x + b.w && e.y >= b.y && e.y < b.y + b.h;
        if (j && !drin) rein();
        if (!j && drin) raus();
        drin = j;
      });
    }
  }
  function ranglistenTafel() {
    try {
      WA.room.website.create({ name: "rangliste", url: SEITEN + "rangliste-bildschirm.html", visible: true, allowApi: false, origin: "map", scale: 1, position: { x: 2284, y: 128, width: 184, height: 54 } });
    } catch {
    }
    const b = { x: 71 * 32, y: 6 * 32, w: 7 * 32, h: 2 * 32 };
    let fenster = null, hinweis2 = null;
    const rein = () => {
      try {
        hinweis2 = WA.ui.displayActionMessage({ message: "\u{1F3C6} Rangliste \xB7 Leertaste", callback: async () => {
          try {
            hinweis2 && hinweis2.remove();
          } catch {
          }
          try {
            fenster = await glasFenster(SEITEN + "rangliste.html?name=" + encodeURIComponent(WA.player.name || "") + "&t=" + Date.now());
          } catch {
          }
        } });
      } catch {
      }
    };
    const raus = () => {
      try {
        hinweis2 && hinweis2.remove();
      } catch {
      }
      hinweis2 = null;
      try {
        fenster && fenster.close();
      } catch {
      }
      fenster = null;
    };
    try {
      WA.room.area.create({ name: "rangliste-tafel", x: b.x, y: b.y, width: b.w, height: b.h });
      WA.room.area.onEnter("rangliste-tafel").subscribe(rein);
      WA.room.area.onLeave("rangliste-tafel").subscribe(raus);
    } catch {
      let drin = false;
      WA.player.onPlayerMove((e) => {
        const j = e.x >= b.x && e.x < b.x + b.w && e.y >= b.y && e.y < b.y + b.h;
        if (j && !drin) rein();
        if (!j && drin) raus();
        drin = j;
      });
    }
  }
  var OFFENE_RAEUME = [14, 19, 24, 29, 52, 57, 62, 67].flatMap((x) => [17, 27].map((y) => ({ x, y, w: 5, h: 6 })));
  var ideenFenster = null;
  var ideenHinweis = null;
  async function ideenOeffnen() {
    try {
      ideenHinweis && ideenHinweis.remove();
    } catch {
    }
    try {
      ideenFenster = await glasFenster(SEITEN + "ideen.html?t=" + Date.now());
    } catch {
    }
  }
  function ideenHinweisZeigen() {
    try {
      ideenHinweis = WA.ui.displayActionMessage({ message: "\u{1F4A1} Meine Ideen \xB7 Leertaste", callback: () => {
        ideenOeffnen();
      } });
    } catch {
    }
  }
  function ideenHinweisWeg() {
    try {
      ideenHinweis && ideenHinweis.remove();
    } catch {
    }
    ideenHinweis = null;
    try {
      ideenFenster && ideenFenster.close();
    } catch {
    }
    ideenFenster = null;
  }
  function ideen() {
    try {
      const eigen = "B\xFCro " + String(WA.player.name || "").split(/\s+/)[0];
      WA.room.area.onEnter(eigen).subscribe(ideenHinweisZeigen);
      WA.room.area.onLeave(eigen).subscribe(ideenHinweisWeg);
    } catch {
    }
    OFFENE_RAEUME.forEach((o, i) => {
      try {
        WA.room.area.create({ name: "offen-" + (i + 1), x: o.x * 32, y: o.y * 32, width: o.w * 32, height: o.h * 32 });
        WA.room.area.onEnter("offen-" + (i + 1)).subscribe(ideenHinweisZeigen);
        WA.room.area.onLeave("offen-" + (i + 1)).subscribe(ideenHinweisWeg);
      } catch {
      }
    });
  }
  function leertasteBereich(name, b, text, aktion, raus) {
    let hinweis2 = null;
    const zeigen = () => {
      try {
        hinweis2 = WA.ui.displayActionMessage({ message: typeof text === "function" ? text() : text, callback: () => {
          aktion();
          setTimeout(() => {
            if (drin) zeigen();
          }, 1500);
        } });
      } catch {
      }
    };
    let drin = false;
    const rein = () => {
      drin = true;
      zeigen();
    };
    const weg = () => {
      drin = false;
      try {
        hinweis2 && hinweis2.remove();
      } catch {
      }
      hinweis2 = null;
      raus && raus();
    };
    try {
      WA.room.area.create({ name, x: b.x * 32, y: b.y * 32, width: b.w * 32, height: b.h * 32 });
      WA.room.area.onEnter(name).subscribe(rein);
      WA.room.area.onLeave(name).subscribe(weg);
    } catch {
    }
  }
  var KUECHE_GERAETE = ["kuehlschrank", "herd", "kaffee"];
  function kueche() {
    const aus = /* @__PURE__ */ new Map();
    const benutzen = (g) => {
      if (g === "kaffee" && !aus.has("dampf")) {
        fx("kueche-kaffee-dampf", true);
        aus.set("dampf", setTimeout(() => {
          aus.delete("dampf");
          fx("kueche-kaffee-dampf", false);
          benutzen("kaffee");
        }, 4e3));
        return;
      }
      if (g === "kaffee" && aus.has("dampf")) return;
      fx("kueche-" + g + "-an", true);
      fx("kueche-" + g + "-aus", false);
      clearTimeout(aus.get(g));
      aus.set(g, setTimeout(() => {
        fx("kueche-" + g + "-an", false);
        fx("kueche-" + g + "-aus", true);
      }, 8e3));
    };
    try {
      WA.event.on("sw-kueche").subscribe((ev) => {
        const g = ev && ev.data && ev.data.g;
        if (KUECHE_GERAETE.includes(g)) benutzen(g);
      });
    } catch {
    }
    const los = (g) => {
      benutzen(g);
      try {
        WA.event.broadcast("sw-kueche", { g });
      } catch {
      }
    };
    leertasteBereich("kueche-kuehlschrank", { x: 67, y: 37, w: 4, h: 1 }, "\u{1F9CA} K\xFChlschrank \xF6ffnen \xB7 Leertaste", () => los("kuehlschrank"));
    leertasteBereich("kueche-herd", { x: 75, y: 37, w: 3, h: 1 }, "\u{1F373} Spiegelei braten \xB7 Leertaste", () => los("herd"));
    leertasteBereich("kueche-kaffee", { x: 81, y: 36, w: 2, h: 4 }, "\u2615 Kaffee holen \xB7 Leertaste", () => {
      los("kaffee");
      kurzMeldung("\u2615 Kaffee l\xE4uft durch \u2026", 3800);
      setTimeout(() => {
        ton("kaffee");
        kurzMeldung("\u2615 Kaffee ist fertig \u2013 lass ihn dir schmecken!", 5e3);
      }, 4e3);
    });
  }
  var richtung = "";
  function klingel() {
    let zuletzt = 0, aus = null;
    const laeuten = (wer, ich) => {
      ton("klingel");
      fx("fx-klingel", true);
      clearTimeout(aus);
      aus = setTimeout(() => fx("fx-klingel", false), 3500);
      if (!ich) kurzMeldung("\u{1F514} Ding-Dong \u2013 " + wer + " ist am Eingang", 6e3);
    };
    try {
      WA.event.on("sw-klingel").subscribe((ev) => laeuten(String(ev && ev.data && ev.data.wer || "Jemand"), false));
    } catch {
    }
    try {
      WA.room.area.create({ name: "eingang-klingel", x: 43 * 32, y: 52 * 32, width: 4 * 32, height: 2 * 32 });
      WA.room.area.onEnter("eingang-klingel").subscribe(() => {
        if (richtung !== "up" || Date.now() - zuletzt < 2e4) return;
        zuletzt = Date.now();
        const wer = String(WA.player.name || "Jemand").split(/\s+/)[0];
        laeuten(wer, true);
        try {
          WA.event.broadcast("sw-klingel", { wer });
        } catch {
        }
      });
    } catch {
    }
  }
  var konfettiOffen = false;
  async function konfetti(name) {
    if (konfettiOffen) return;
    konfettiOffen = true;
    try {
      const w = await WA.ui.website.open({
        url: SEITEN + "konfetti.html?name=" + encodeURIComponent(name),
        allowApi: false,
        visible: true,
        position: { vertical: "top", horizontal: "middle" },
        size: { width: Math.round(screen.availWidth || 1600) + "px", height: "100vh" },
        margin: { top: "0px" }
      });
      ton("klingel");
      setTimeout(() => {
        try {
          w.close();
        } catch {
        }
        konfettiOffen = false;
      }, 6500);
    } catch {
      konfettiOffen = false;
    }
  }
  function konfettiHeute() {
    const kinder = info.geburtstage || [];
    if (!kinder.length) return;
    const heute = (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    try {
      if (localStorage.getItem("sw-konfetti") === heute) return;
      localStorage.setItem("sw-konfetti", heute);
    } catch {
    }
    konfetti(kinder.join(" & "));
  }
  function toreVon(name) {
    try {
      return Number(JSON.parse(String(WA.state.fussball_tore || "{}"))[name]) || 0;
    } catch {
      return 0;
    }
  }
  function profilOeffnen(name) {
    glasFenster(SEITEN + "profil.html?name=" + encodeURIComponent(name) + "&tore=" + toreVon(name) + "&t=" + Date.now()).catch(() => {
    });
  }
  function profilKarten() {
    try {
      WA.ui.onRemotePlayerClicked.subscribe((p) => {
        try {
          p.addAction("\u{1F464} Profil ansehen", () => profilOeffnen(String(p.name || "")));
        } catch {
        }
      });
    } catch {
    }
  }
  async function zuPerson(name) {
    try {
      await WA.players.configureTracking({ players: true, movement: false });
      const p = [...WA.players.list()].find((x) => String(x.name || "").toLowerCase() === name.toLowerCase());
      if (p && p.position) {
        await WA.player.moveTo(p.position.x, p.position.y + 32, 10);
        return;
      }
    } catch {
    }
    kurzMeldung("\u{1F6B6} " + name.split(/\s+/)[0] + " ist gerade nicht im B\xFCro", 5e3);
  }
  var FUSSBALL = {
    tore: [
      { name: "platz-tor-oben", x: 146, y: 5, w: 13, h: 6 },
      { name: "platz-tor-unten", x: 146, y: 34, w: 13, h: 6 },
      { name: "bolzplatz-tor-oben", x: 172, y: 5, w: 7, h: 4 },
      { name: "bolzplatz-tor-unten", x: 172, y: 23, w: 7, h: 4 }
    ],
    vereinsheim: { x: 168, y: 38, w: 14, h: 2 }
  };
  function torGeschossen(wer, wo) {
    try {
      WA.ui.banner.openBanner({ id: "sw-tor", text: `\u26BD TOOOR! ${wer} trifft ${wo}!`, bgColor: "#0f766e", textColor: "#ffffff", closable: true, timeToClose: 6e3 });
    } catch {
      kurzMeldung(`\u26BD TOOOR! ${wer} trifft ${wo}!`, 6e3);
    }
  }
  function fussball() {
    try {
      WA.event.on("sw-tor").subscribe((ev) => {
        const d = ev && ev.data;
        if (d && d.wer) torGeschossen(d.wer, d.wo);
      });
    } catch {
    }
    for (const t of FUSSBALL.tore) {
      const wo = t.name.startsWith("bolz") ? "auf dem Bolzplatz" : "auf dem Fu\xDFballplatz";
      leertasteBereich(t.name, t, "\u26BD Torschuss \xB7 Leertaste", () => {
        if (Math.random() >= 0.65) {
          kurzMeldung(["Knapp vorbei! \u{1F62C}", "Pfosten! \u{1F945}", "Gehalten! \u{1F9E4}", "Dr\xFCber! \u2601\uFE0F"][Math.floor(Math.random() * 4)], 3500);
          return;
        }
        const wer = String(WA.player.name || "Jemand").split(/\s+/)[0];
        torGeschossen(wer, wo);
        try {
          WA.event.broadcast("sw-tor", { wer, wo });
        } catch {
        }
        try {
          const tore = JSON.parse(String(WA.state.fussball_tore || "{}"));
          tore[WA.player.name] = (tore[WA.player.name] || 0) + 1;
          WA.state.saveVariable("fussball_tore", JSON.stringify(tore));
        } catch {
        }
      });
    }
    let fenster = null;
    leertasteBereich("vereinsheim", FUSSBALL.vereinsheim, "\u{1F3DF} Vereinsheim FC SW Digital \xB7 Leertaste", async () => {
      try {
        fenster = await glasFenster(SEITEN + "vereinsheim.html?t=" + Date.now());
      } catch {
      }
    }, () => {
      try {
        fenster && fenster.close();
      } catch {
      }
      fenster = null;
    });
  }
  var AMPEL_START = Date.now();
  var AMPEL_KREUZUNGEN = [{ x: 89, y: 67, sv: 4, sh: 6 }, { x: 89, y: 84, sv: 4, sh: 4 }];
  function ampelText() {
    const ZYK = 128 * 120, t = (Date.now() - AMPEL_START) % ZYK, f = Math.floor(t / 120);
    const status = (von, bis) => {
      const drin = f >= von && f < bis, ziel = drin ? bis : von, rest = Math.ceil(((ziel * 120 - t) % ZYK + ZYK) % ZYK / 1e3);
      return drin ? `\u{1F7E2} gehen (noch ${rest} s)` : `\u{1F534} warten (${rest} s)`;
    };
    return `\u{1F6A6} \xDCber die Hauptstra\xDFe: ${status(64, 128)} \xB7 \xDCber die Querstra\xDFe: ${status(0, 72)}`;
  }
  function fussgaengerAmpel() {
    AMPEL_KREUZUNGEN.forEach((k, i) => [[k.x - 1, k.y - 1], [k.x + k.sv, k.y - 1], [k.x - 1, k.y + k.sh], [k.x + k.sv, k.y + k.sh]].forEach(([x, y], j) => leertasteBereich(`ampel-${i + 1}-${j + 1}`, { x, y, w: 3, h: 3 }, "\u{1F6A6} Fu\xDFg\xE4nger-Ampel \xB7 Leertaste", () => kurzMeldung(ampelText(), 6e3))));
  }
  async function infoLaden() {
    try {
      info = await (await fetch(INFO, { headers: { "X-Buero-Key": BUERO_KEY } })).json();
    } catch {
      return;
    }
    try {
      const d = info.durchsage;
      if (d && d.id !== durchsageGezeigt) {
        durchsageGezeigt = d.id;
        WA.ui.banner.openBanner({ id: "sw-durchsage", text: `\u{1F4E2} ${d.text} \u2014 ${d.von}`, bgColor: "#0d9488", textColor: "#ffffff", closable: true, timeToClose: 0 });
      }
      if (!d && durchsageGezeigt) {
        durchsageGezeigt = null;
        WA.ui.banner.closeBanner();
      }
    } catch {
    }
    ballonsSetzen();
    konfettiHeute();
    telefonTuer();
    effekte();
    if (!begruesst) {
      begruesst = true;
      const v = String(WA.player.name || "").split(/\s+/)[0], h = (/* @__PURE__ */ new Date()).getHours();
      const gruss = h < 11 ? "Guten Morgen" : h < 17 ? "Hallo" : "Guten Abend";
      const teile = [];
      if ((info.geburtstage || []).some((n) => n.toLowerCase() === v.toLowerCase())) teile.push("\u{1F389} Alles Gute zum Geburtstag!");
      const andere = (info.geburtstage || []).filter((n) => n.toLowerCase() !== v.toLowerCase());
      if (andere.length) teile.push(`\u{1F382} ${andere.join(", ")} ${andere.length === 1 ? "hat" : "haben"} heute Geburtstag`);
      if ((info.reservierungen || []).length) teile.push(`\u{1F4C5} ${info.reservierungen.length} Raum-Reservierung${info.reservierungen.length === 1 ? "" : "en"} heute`);
      kurzMeldung(`${gruss} ${v}! ` + (teile.join(" \xB7 ") || "Sch\xF6n, dass du da bist."), 9e3);
    }
  }
  function beobachten(name, api) {
    api.onEnter(name).subscribe(() => {
      aktuellerBereich = name;
      const kind = (info.geburtstage || []).find((n) => "b\xFCro " + n.toLowerCase() === name.toLowerCase());
      if (kind) konfetti(kind);
      tuerWache(name);
      bereit.then(() => melden("betreten"));
      reservierungZeigen(name);
      effekte();
    });
    api.onLeave(name).subscribe(() => {
      if (aktuellerBereich === name) aktuellerBereich = null;
      bereit.then(() => melden("betreten"));
      effekte();
    });
  }
  function feierabendOeffnen() {
    glasFenster(SEITEN + "kernzeit.html?feierabend=1&t=" + Date.now());
  }
  function kernzeitStarten() {
    let zuletzt = 0;
    const pruefen = async () => {
      if (gesperrt || Date.now() - zuletzt < 30 * 60 * 1e3) return;
      try {
        const r = await fetch(ENDPOINT.replace(/melden$/, "kernzeit/hinweis"), { method: "POST", headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY }, body: JSON.stringify({ name: WA.player.name }) });
        const d = await r.json();
        if (d && d.zeigen) {
          zuletzt = Date.now();
          glasFenster(SEITEN + "kernzeit.html?t=" + Date.now());
        }
      } catch {
      }
    };
    setTimeout(pruefen, 8e3);
    setInterval(pruefen, 3 * 60 * 1e3);
  }
  var SCHLOSS_PAUSE_MS = 30 * 60 * 1e3;
  var gesperrt = false;
  var letzteAktivitaet = Date.now();
  var schlossOffen = () => {
    try {
      return Date.now() - Number(sessionStorage.getItem("swSchlossOffen") || 0) < SCHLOSS_PAUSE_MS;
    } catch {
      return false;
    }
  };
  var schlossMerken = (an) => {
    try {
      an ? sessionStorage.setItem("swSchlossOffen", String(Date.now())) : sessionStorage.removeItem("swSchlossOffen");
    } catch {
    }
  };
  function schliessen(grund = "") {
    gesperrt = true;
    schlossMerken(false);
    try {
      WA.controls.disablePlayerControls();
    } catch {
    }
    try {
      WA.ui.modal.closeModal();
    } catch {
    }
    WA.ui.website.getAll().then((alle) => alle.forEach((w) => {
      if (!/info\.html|leiste\.html|schloss\.html|tagescheck\.html\?karte|oben\.html\?v/.test(String(w.url || ""))) w.close().catch(() => {
      });
    })).catch(() => {
    });
    return new Promise((fertig) => {
      let fenster = null, abo = null;
      try {
        abo = WA.player.state.onVariableChange("swSchloss").subscribe((v) => {
          if (!v || v.sitzung !== SITZUNG) return;
          try {
            abo.unsubscribe();
          } catch {
          }
          try {
            fenster && fenster.close();
          } catch {
          }
          try {
            WA.controls.restorePlayerControls();
          } catch {
          }
          gesperrt = false;
          letzteAktivitaet = Date.now();
          schlossMerken(true);
          fertig();
        });
      } catch {
        gesperrt = false;
        fertig();
        return;
      }
      WA.ui.website.open({
        url: SEITEN + "schloss.html?sitzung=" + SITZUNG + (grund ? "&grund=" + grund : "") + "&t=" + Date.now(),
        allowApi: true,
        visible: true,
        position: { vertical: "middle", horizontal: "middle" },
        size: { width: "100vw", height: "100vh" }
      }).then((w) => {
        fenster = w;
      }).catch(() => {
        gesperrt = false;
        try {
          WA.controls.restorePlayerControls();
        } catch {
        }
        fertig();
      });
    });
  }
  var mitSystemZeit = false;
  function wegVomRechner() {
    if (beendet) return;
    beendet = true;
    WA.nav.goToPage(SEITEN + "weg.html");
  }
  function schlossWache() {
    setInterval(async () => {
      if (gesperrt) return;
      if (gespraech.size) {
        letzteAktivitaet = Date.now();
      }
      if (mitSystemZeit || Date.now() - letzteAktivitaet < SCHLOSS_PAUSE_MS) {
        schlossMerken(true);
        return;
      }
      await melden("verlassen");
      await schliessen("pause");
      bereit = melden("betreten", true);
    }, 6e4);
  }
  WA.onInit().then(async () => {
    const frisch = async () => {
      try {
        const r = await fetch(ENDPOINT.replace(/melden$/, "ausweis/frisch"), { method: "POST", headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY }, body: JSON.stringify({ name: WA.player.name }) });
        return !!(await r.json()).frisch;
      } catch {
        return false;
      }
    };
    if (!schlossOffen()) {
      if (await frisch()) schlossMerken(true);
      else await schliessen();
    }
    schlossWache();
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
    let kzAktiv = false, tcAktiv = false;
    try {
      const r = await fetch(ENDPOINT.replace(/melden$/, "kernzeit/hinweis"), { method: "POST", headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY }, body: JSON.stringify({ name: WA.player.name }) });
      const h = await r.json();
      kzAktiv = !!h.aktiv;
      tcAktiv = !!h.tc;
    } catch {
    }
    if (tcAktiv && !HANDY) {
      try {
        await WA.ui.website.open({ url: SEITEN + "tagescheck.html?karte=1", allowApi: true, visible: true, position: { vertical: "top", horizontal: "left" }, size: { width: "280px", height: "150px" }, margin: { top: "64px", left: "10px" } });
      } catch {
      }
    }
    effekte();
    setInterval(effekte, 6e4);
    infoLaden();
    setInterval(infoLaden, 15e3);
    try {
      await WA.ui.website.open({
        url: "https://samjabbar90.github.io/sw-buero/info.html?v=2" + (kzAktiv ? "&kz=1" : ""),
        allowApi: true,
        visible: true,
        // genau so groß wie die Leiste (kein weißer Rand): mit eigener Tür breiter (Tür + Fokus), sonst nur Uhrzeit + Kollegen
        position: { vertical: HANDY ? "top" : "bottom", horizontal: "middle" },
        size: { width: HANDY ? Math.min(330, (screen.width || 390) - 20) + "px" : 400 + (meineTuer() ? 150 : 0) + (kzAktiv ? 130 : 0) + "px", height: "40px" },
        margin: HANDY ? { top: "64px" } : { bottom: "14px" }
      });
    } catch {
    }
    glasBeobachten();
    ideen();
    helpcenterRoboter();
    lernzimmer();
    fitnessEmpfang();
    ranglistenTafel();
    kueche();
    fussball();
    fussgaengerAmpel();
    klingel();
    hundStarten();
    profilKarten();
    kernzeitStarten();
    const breite = 87 * 32, hoehe = 62 * 32;
    void karte;
    let blick = 0, uebersichtAn = false;
    const uebersicht = () => {
      uebersichtAn = true;
      try {
        WA.camera.set(breite / 2, hoehe / 2, breite, hoehe, false, true);
      } catch {
      }
    };
    const zuMir = () => {
      blick = 0;
      uebersichtAn = false;
      try {
        WA.camera.followPlayer(true);
      } catch {
      }
    };
    const blicken = async (felder) => {
      try {
        blick += felder;
        const p = await WA.player.getPosition();
        WA.camera.set(p.x, p.y + blick * 32, void 0, void 0, true, true);
      } catch {
      }
    };
    const schnellreise = () => {
      try {
        WA.ui.modal.openModal({ title: "Schnellreise", src: SEITEN + "schnellreise.html", allowApi: true, position: HANDY ? "center" : "right" });
      } catch {
      }
    };
    try {
      if (!HANDY) {
        await WA.ui.website.open({
          url: SEITEN + "oben.html?v=2",
          allowApi: true,
          visible: true,
          position: { vertical: "top", horizontal: "middle" },
          size: { width: "380px", height: "46px" },
          margin: { top: "8px" }
        });
      } else {
        await WA.ui.website.open({
          url: SEITEN + "leiste.html?v=" + Date.now(),
          allowApi: true,
          visible: true,
          position: { vertical: "bottom", horizontal: "middle" },
          size: { width: Math.round((screen.width || 390) - 20) + "px", height: "72px" },
          margin: { bottom: "12px" }
        });
      }
    } catch {
    }
    let menue = null, menueName = "";
    const menueZu = () => {
      if (menue) {
        try {
          menue.close();
        } catch {
        }
      }
      menue = null;
      menueName = "";
    };
    const menueUmschalten = async (m) => {
      const war = menueName;
      menueZu();
      if (war === m) return;
      const n = m === "karte" ? 4 : 2 + (tcAktiv ? 1 : 0) + (kzAktiv ? 2 : 0);
      menueName = m;
      try {
        menue = await WA.ui.website.open({
          url: SEITEN + "oben.html?menue=" + m + (tcAktiv ? "&tc=1" : "") + (kzAktiv ? "&kz=1" : ""),
          allowApi: true,
          visible: true,
          position: { vertical: "top", horizontal: "middle" },
          size: { width: "380px", height: n * 37 + 12 + "px" },
          margin: { top: "58px" }
        });
      } catch {
        menueName = "";
      }
    };
    let letzteAktion = 0;
    try {
      letzteAktion = Number((WA.player.state.swAktion || {}).t) || 0;
    } catch {
    }
    try {
      WA.player.state.onVariableChange("swAktion").subscribe((v) => {
        if (!v || !v.t || v.t === letzteAktion) return;
        letzteAktion = v.t;
        if (v.was === "menue") return menueUmschalten(String(v.m || ""));
        menueZu();
        const tuer = meineTuer();
        ({
          ideen: () => ideenOeffnen(),
          uebersicht,
          karte: () => uebersichtAn ? zuMir() : uebersicht(),
          zumir: zuMir,
          reise: schnellreise,
          news: () => newsOeffnen(),
          feierabend: () => feierabendOeffnen(),
          tagescheck: () => glasFenster(SEITEN + "tagescheck.html?t=" + Date.now()),
          arbeitszeit: () => glasFenster(SEITEN + "kernzeit.html?t=" + Date.now()),
          mehr: () => glasFenster(SEITEN + "mehr.html?tuer=" + (tuer ? encodeURIComponent(tuerStatus(tuer)) : "") + "&t=" + Date.now()),
          hoch: () => blicken(-6),
          runter: () => blicken(6),
          zuPerson: () => zuPerson(String(v.name || "")),
          meinProfil: () => glasFenster(SEITEN + "profil.html?ich=1&tore=" + toreVon(WA.player.name || "") + "&t=" + Date.now()),
          tuer: () => {
            if (tuer) WA.state.saveVariable(tuer.variable, { frei: "besetzt", besetzt: "zu", zu: "frei" }[tuerStatus(tuer)] || "frei");
          }
        })[v.was]?.();
      });
    } catch {
    }
    try {
      const p = await WA.player.getPosition();
      position = { x: p.x, y: p.y };
    } catch {
    }
    WA.player.onPlayerMove((e) => {
      position = { x: e.x, y: e.y };
      letzteAktivitaet = Date.now();
      richtung = e.direction || richtung;
      if (Date.now() - zuletztGemeldet > 5e3) melden("heartbeat");
    });
    try {
      const pm = WA.player.proximityMeeting;
      const neu = () => melden("heartbeat");
      pm.onJoin().subscribe((leute) => {
        gespraech.clear();
        (leute || []).forEach((p) => p && p.name && gespraech.add(p.name));
        neu();
      });
      pm.onParticipantJoin().subscribe((p) => {
        if (p && p.name) gespraech.add(p.name);
        neu();
      });
      pm.onParticipantLeave().subscribe((p) => {
        if (p && p.name) gespraech.delete(p.name);
        neu();
      });
      pm.onLeave().subscribe(() => {
        gespraech.clear();
        neu();
      });
    } catch {
    }
    setInterval(() => melden("heartbeat"), 3e4);
    window.addEventListener("pagehide", () => melden("verlassen"));
  });
})();
