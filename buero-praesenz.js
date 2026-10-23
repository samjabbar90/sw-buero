(() => {
  // main.ts
  var ENDPOINT = "https://swdigitaltest.de/buero-praesenz/melden";
  var BUERO_KEY = "a21b2aa2a42fe6189b05773c07bbc9ad78e38b34ba3bb6fe";
  var DASHBOARD = "https://swdigitaltest.de";
  var SITZUNG = (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)) + Date.now().toString(36);
  var DY = 26;
  var MI = (x) => x >= 48 ? x + 8 : x;
  var MI32 = (px) => px >= 48 * 32 ? px + 256 : px;
  var DX = 2;
  var HANDY = (screen.width || 1200) < 768 || /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent);
  var aktuellerBereich = null;
  var beendet = false;
  var bereit = Promise.resolve();
  var position = null;
  var gespraech = /* @__PURE__ */ new Set();
  var zuletztGemeldet = 0;
  var pauseHinweis = null;
  function beenden() {
    if (beendet) return;
    beendet = true;
    if (!HANDY) {
      WA.ui.displayActionMessage({ message: "Du bist auf einem anderen Ger\xE4t ins B\xFCro gegangen \u2013 hier wirst du abgemeldet.", callback: () => rausZu(DASHBOARD) });
      setTimeout(() => rausZu(DASHBOARD), 4e3);
      return;
    }
    try {
      pauseHinweis && pauseHinweis.remove();
    } catch {
    }
    try {
      pauseHinweis = klickHinweis({ message: "\u{1F4F1}\u{1F4BB} Du bist gerade auf einem anderen Ger\xE4t im B\xFCro \u2013 hier weitermachen", callback: () => {
        pauseHinweis = null;
        beendet = false;
        letzteAktivitaet = Date.now();
        bereit = melden("betreten", true);
      } });
    } catch {
    }
  }
  function rausZu(url) {
    try {
      WA.player.state.saveVariable("swGehtRaus", Date.now(), { public: false, persist: false });
    } catch {
    }
    setTimeout(() => WA.nav.goToPage(url), 150);
  }
  var mitteilungen = [];
  var mtFenster = null;
  var mtAnzahl = -1;
  var mtLage = "";
  function mitteilung(m, autoWegMs = 0) {
    const id = Math.random().toString(36).slice(2, 9);
    mitteilungen = [{ ...m, id, t: Date.now() }, ...mitteilungen].slice(0, 5);
    if (m.art === "klopfen" || m.art === "einladung") ton("klopfen", "direkt");
    else if (m.art === "anruf") ton("klingel", "direkt");
    else if (m.art === "nachricht") ton("klingel", "direkt");
    else if (m.art === "termin") ton("klingel", "gruppe");
    mtZeigen();
    if (autoWegMs) setTimeout(() => mtWeg(id), autoWegMs);
    return id;
  }
  function mtWeg(id) {
    const n = mitteilungen.length;
    mitteilungen = mitteilungen.filter((x) => x.id !== id);
    if (mitteilungen.length !== n) mtZeigen();
  }
  var mtKette = Promise.resolve();
  function mtZeigen() {
    mtKette = mtKette.then(mtZeigenJetzt, mtZeigenJetzt);
    return mtKette;
  }
  async function mtZeigenJetzt() {
    try {
      await WA.player.state.saveVariable("swMitteilungen", mitteilungen, { public: false, persist: false });
    } catch {
    }
    if (HANDY && grundriss) return;
    let rechts = 12 + (leisteBreite() ? leisteBreite() + 8 : 0);
    if (glasOffen) {
      try {
        const g = glasLage();
        if (g.position && g.position.horizontal === "right") rechts = parseInt(g.margin.right) + parseInt(g.size.width) + 10;
      } catch {
      }
    }
    const lage = mitteilungen.length + ":" + rechts;
    if (lage === mtLage && mtFenster) return;
    mtLage = lage;
    const alt = mtFenster;
    mtFenster = null;
    if (mitteilungen.length) try {
      mtFenster = await WA.ui.website.open({
        url: SEITEN + "mitteilungen.html?v=8",
        allowApi: true,
        visible: true,
        position: { vertical: "top", horizontal: HANDY ? "middle" : "right" },
        size: {
          width: HANDY ? Math.min(360, Math.round((screen.width || 390) - 16)) + "px" : "330px",
          height: mitteilungen.reduce((s, x) => {
            const t = String((x.art === "info" ? x.kurz : x.text) || ""), z = Math.ceil(t.length / (HANDY ? 36 : 40));
            return s + 104 + Math.max(0, Math.min(x.art === "info" || x.art === "push" ? 10 : x.art === "nachricht" ? 3 : 1, z) - 1) * 18;
          }, 0) + 8 + "px"
          /* 16.10.2026: Höhe nach Textlänge */
        },
        margin: HANDY ? { top: "110px" } : { top: "64px", right: rechts + "px" }
      });
    } catch {
    }
    try {
      alt && alt.close();
    } catch {
    }
    try {
      const meins = mtFenster;
      const alle = await WA.ui.website.getAll();
      for (const w of alle) if (/mitteilungen\.html/.test(String(w.url || "")) && w !== meins && (!meins || w.id !== meins.id)) w.close().catch(() => {
      });
    } catch {
    }
    void mtAnzahl;
  }
  var anrufFenster = null;
  async function anrufPille(id, annehmen) {
    try {
      anrufFenster && anrufFenster.close();
    } catch {
    }
    anrufFenster = null;
    try {
      anrufFenster = await WA.ui.website.open({
        url: SEITEN + "anruf.html?id=" + encodeURIComponent(id) + "&s=" + SITZUNG + "&klein=1" + (annehmen ? "&annehmen=1" : "") + "&t=" + Date.now(),
        allowApi: true,
        allowPolicy: "microphone; autoplay",
        visible: true,
        position: { vertical: "bottom", horizontal: "middle" },
        size: { width: "380px", height: "64px" },
        margin: { bottom: "136px" }
      });
    } catch {
    }
  }
  var MT_AKTIONEN = {
    mtWeg: (m) => mtWeg(m.id),
    mtReinlassen: (m) => {
      try {
        WA.event.broadcast("sw-reinlassen", { fuer: m.von, variable: m.variable });
      } catch {
      }
      mtWeg(m.id);
    },
    mtGleich: (m) => {
      try {
        WA.event.broadcast("sw-gleich", { fuer: m.von, von: WA.player.name });
      } catch {
      }
      mtWeg(m.id);
    },
    mtHin: (m) => {
      if (m.raum) zuRaum(m.raum);
      mtWeg(m.id);
    },
    mtAnruf: (m) => {
      HANDY ? glasFenster(SEITEN + "anruf.html?id=" + encodeURIComponent(m.anruf || "") + "&s=" + SITZUNG + "&t=" + Date.now()) : anrufPille(m.anruf || "", true);
      mtWeg(m.id);
    },
    // 23.10.2026: am PC Annehmen direkt in der Karte → Pille
    mtAnrufNein: (m) => {
      fetch(ENDPOINT.replace(/melden$/, "anruf/" + encodeURIComponent(m.anruf || "") + "/ablehnen"), { method: "POST", headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY, "X-Buero-Sitzung": SITZUNG }, body: "{}" }).catch(() => {
      });
      mtWeg(m.id);
    },
    // Einladung (22.10.2026): annehmen = Einladenden informieren und hinlaufen; „Später“ sagt es ihm auch
    mtEinladungJa: (m) => {
      try {
        WA.event.broadcast("sw-einladung-antwort", { an: m.von, von: WA.player.name, ja: true, raum: m.raum });
      } catch {
      }
      if (m.raum) zuRaum(m.raum);
      mtWeg(m.id);
    },
    mtEinladungNein: (m) => {
      try {
        WA.event.broadcast("sw-einladung-antwort", { an: m.von, von: WA.player.name, ja: false });
      } catch {
      }
      mtWeg(m.id);
    },
    mtChat: (m) => {
      glasFenster(m.vonId ? SEITEN + "chat.html?" + (m.konv ? "k=" + encodeURIComponent(m.konv) : "mit=" + encodeURIComponent(m.vonId)) + "&s=" + SITZUNG + "&t=" + Date.now() : SEITEN + "wer.html?an=" + encodeURIComponent(m.von || "") + "&t=" + Date.now());
      mtWeg(m.id);
    },
    mtPush: (m) => {
      glasFenster(SEITEN + "push-start.html?t=" + Date.now());
      mtWeg(m.id);
    }
    // 16.10.2026: Benachrichtigungen auf diesem Gerät
  };
  var nachrichtHinweis = null;
  var pushHinweisGezeigt = false;
  var anrufGezeigt = /* @__PURE__ */ new Set();
  function nachrichtZeigen(m) {
    if (m.anruf && (anrufGezeigt.has(m.anruf) || mitteilungen.some((x) => x.anruf === m.anruf))) return;
    if (m.anruf) {
      anrufGezeigt.add(m.anruf);
      mitteilung({ art: "anruf", von: m.von, vonId: m.vonId, anruf: m.anruf, text: "ruft an \u2026" }, 45e3);
      let n = 0;
      const iv = setInterval(() => {
        if (++n > 8 || !mitteilungen.some((x) => x.anruf === m.anruf)) return clearInterval(iv);
        ton("klingel", "direkt");
      }, 5e3);
      return;
    }
    {
      mitteilung({ art: "nachricht", von: m.von, vonId: m.vonId, konv: m.konv, text: String(m.text || "").slice(0, 300) });
      return;
    }
    try {
      nachrichtHinweis && nachrichtHinweis.remove();
    } catch {
    }
    const vorname2 = String(m.von || "").split(" ")[0];
    try {
      nachrichtHinweis = WA.ui.displayActionMessage({
        message: `\u{1F4AC} ${vorname2}: ${String(m.text || "").slice(0, 140)} \xB7 Leertaste = antworten`,
        callback: () => {
          nachrichtHinweis = null;
          glasFenster(SEITEN + "wer.html?an=" + encodeURIComponent(m.von) + "&t=" + Date.now());
        }
      });
      const h = nachrichtHinweis;
      setTimeout(() => {
        try {
          if (nachrichtHinweis === h) {
            h.remove();
            nachrichtHinweis = null;
          }
        } catch {
        }
      }, 3e4);
    } catch {
    }
  }
  var pushFenster = null;
  var pushErledigt = false;
  async function pushPflicht() {
    if (pushFenster || pushErledigt || gesperrt) return;
    try {
      WA.controls.disablePlayerControls();
    } catch {
    }
    try {
      pushFenster = await WA.ui.website.open({
        url: SEITEN + "push-start.html?pflicht=1&t=" + Date.now(),
        allowApi: true,
        visible: true,
        position: { vertical: "middle", horizontal: "middle" },
        size: { width: "520px", height: "460px" }
      });
    } catch {
      pushFenster = null;
      try {
        WA.controls.restorePlayerControls();
      } catch {
      }
    }
  }
  function pushPflichtFertig() {
    pushErledigt = true;
    try {
      pushFenster && pushFenster.close();
    } catch {
    }
    pushFenster = null;
    if (!gesperrt) try {
      WA.controls.restorePlayerControls();
    } catch {
    }
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
        gespraech: [...gespraech],
        ruhe: Date.now() - letzteAktivitaet,
        handy: HANDY,
        ...start ? { karte: String(WA.room.mapURL || "").slice(0, 300) } : {}
      }),
      // karte: welche Karten-Datei geladen ist (13.10., Umbau Mandanten-Stockwerk) // handy: am Handy bleibt man drin, bis man sich abmeldet (12.10., Sam) // 12.10.: ms seit der letzten Bewegung — der Server rechnet alle Aktivitäten zusammen (10 Min Ruhe → raus)
      keepalive: true
    }).then((r) => r.json()).then((d) => {
      if (d && typeof d.system === "boolean") mitSystemZeit = d.system;
      if (d && Array.isArray(d.nachrichten)) for (const m of d.nachrichten) nachrichtZeigen(m);
      if (d && Array.isArray(d.termine)) termineErinnern(d.termine);
      if (d && Array.isArray(d.glocke)) for (const g of d.glocke) mitteilung({ art: "info", kurz: String(g.text || "").slice(0, 200) }, 6e4);
      if (d && d.pushAktiv === false && !HANDY) pushPflicht();
      else if (d && d.pushAktiv === false && !pushHinweisGezeigt) {
        pushHinweisGezeigt = true;
        setTimeout(() => mitteilung({ art: "push", kurz: "Benachrichtigungen aktivieren", text: "Damit Nachrichten, Anklopfen und Einladungen als Windows-Meldung auch \xFCber DATEV erscheinen." }), 15e3);
      }
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
  var schildGidsSenk = {};
  var kollisionGid = 3;
  var freigabe = /* @__PURE__ */ new Map();
  var vorname = (n) => String(n || "").trim().split(/\s+/)[0].toLowerCase();
  var istBesitzer = (t) => t.offen ? zimmerDaten(t).s !== "frei" && vorname(zimmerDaten(t).wer) === vorname(WA.player.name) : t.besitzer.toLowerCase() === vorname(WA.player.name);
  var meineTuer = () => tueren.find((t) => !t.offen && istBesitzer(t));
  var fokusBis = (t) => {
    const v = String(WA.state[t.variable] || "");
    return v.startsWith("fokus:") ? Number(v.slice(6)) || 0 : 0;
  };
  var offenBis = (t) => {
    const v = String(WA.state[t.variable] || "");
    return v.startsWith("offen:") ? Number(v.slice(6)) || 0 : 0;
  };
  var immerZu = (t) => !t.offen && (info.immerZu || []).includes(vorname(t.besitzer));
  var besitzerDa = (t) => !Array.isArray(info.da) || info.da.includes(vorname(t.besitzer));
  var telefoniertGerade = (n) => (info.telefoniert || []).some((x) => vorname(x) === vorname(n));
  function autoZu(t) {
    const wer = vorname(t.besitzer), gleich = (n) => String(n).toLowerCase() === wer;
    if (!besitzerDa(t)) return "";
    if ((info.telefoniert || []).some(gleich)) return "telefoniert";
    if ((info.imTermin || []).some(gleich) && (!info.imTerminRaum || info.imTerminRaum[wer] === t.raum)) return "hat einen Termin";
    if ((info.zuRaeume || []).includes(t.raum)) return "hat Besuch";
    return "";
  }
  var tuerStatus = (t) => {
    if (t.offen) {
      const d = zimmerDaten(t);
      return d.s !== "frei" && telefoniertGerade(d.wer) ? "zu" : d.s;
    }
    if (immerZu(t) && !(offenBis(t) > Date.now())) return "zu";
    if (!besitzerDa(t)) return "frei";
    if (autoZu(t)) return "zu";
    return fokusBis(t) > Date.now() ? "fokus" : "frei";
  };
  var bisText = (ms) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  var TEXT = { frei: "\u{1F7E2} T\xFCr: frei", fokus: "\u{1F3AF} Fokus", zu: "\u{1F534} T\xFCr: zu" };
  function fokusSetzen(t, min) {
    WA.state.saveVariable(t.variable, min > 0 ? "fokus:" + (Date.now() + min * 6e4) : "frei");
  }
  var FOKUS_MIN = 25;
  var FOKUS_MAX = 3;
  var heuteTag = () => (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  var fokusGenutzt = () => {
    const z = WA.player.state.swFokusZaehler;
    return z && z.tag === heuteTag() ? Number(z.n) || 0 : 0;
  };
  function fokusErlaubt() {
    const n = fokusGenutzt();
    if (n >= FOKUS_MAX) {
      kurzMeldung("\u{1F3AF} Heute schon " + FOKUS_MAX + "\xD7 Fokus genutzt \u2013 morgen wieder", 6e3);
      return false;
    }
    try {
      WA.player.state.saveVariable("swFokusZaehler", { tag: heuteTag(), n: n + 1 }, { public: false, persist: true });
    } catch {
    }
    kurzMeldung("\u{1F512} Fokus: dein Zimmer ist " + FOKUS_MIN + " Min abgeschlossen \xB7 heute noch " + (FOKUS_MAX - n - 1) + "\xD7", 6e3);
    return true;
  }
  function offenUmschalten(t) {
    if (offenBis(t) > Date.now()) {
      WA.state.saveVariable(t.variable, "frei");
      kurzMeldung("\u{1F512} Deine T\xFCr ist wieder zu", 4e3);
      return;
    }
    const ende = /* @__PURE__ */ new Date();
    ende.setHours(23, 59, 0, 0);
    WA.state.saveVariable(t.variable, "offen:" + ende.getTime());
    kurzMeldung("\u{1F7E2} Deine T\xFCr bleibt heute offen \u2013 nochmal tippen = wieder zu", 5e3);
  }
  function fokusUmschalten(t) {
    if (immerZu(t)) return offenUmschalten(t);
    if (fokusBis(t) > Date.now()) return fokusSetzen(t, 0);
    if (fokusErlaubt()) fokusSetzen(t, FOKUS_MIN);
  }
  function tuerAnwenden(t) {
    const s = tuerStatus(t);
    const darfDurch = istBesitzer(t) || (freigabe.get(t.variable) || 0) > Date.now() || aktuellerBereich === t.raum;
    const kacheln = t.felder.map(([x, y]) => ({ x, y, tile: (s === "zu" || s === "fokus") && !darfDurch ? kollisionGid : null, layer: "collisions" }));
    const sg = (t.senk ? schildGidsSenk : schildGids)[s] || null;
    t.schild.forEach(([x, y], i) => kacheln.push({ x, y, tile: sg ? sg[i] : null, layer: "furniture/labels" }));
    try {
      WA.room.setTiles(kacheln);
    } catch {
    }
    try {
      schilderAktualisieren();
    } catch {
    }
    try {
      rahmenZeichnen();
    } catch {
    }
  }
  function tuerKnopf() {
    const t = meineTuer();
    if (!t || !HANDY || true) return;
    try {
      WA.ui.actionBar.removeButton("sw-tuer");
    } catch {
    }
    WA.ui.actionBar.addButton({ id: "sw-tuer", label: TEXT[tuerStatus(t)] || TEXT.frei, callback: () => fokusUmschalten(t) });
  }
  function tuerWache(raum) {
    const t = tueren.find((x) => x.raum === raum);
    if (!t || !t.draussen || !["zu", "fokus"].includes(tuerStatus(t)) || istBesitzer(t) || (freigabe.get(t.variable) || 0) > Date.now()) return;
    WA.player.teleport(t.draussen[0] * 32 + 16, t.draussen[1] * 32 + 16);
    kurzMeldung(`\u{1F512} ${t.raum} ist gerade nicht frei \u2013 Leertaste vor der T\xFCr = anklopfen`, 6e3);
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
    const st = tuerStatus(t), wer = String(werVon(t)).split(/\s+/)[0];
    const grund = t.offen ? st === "zu" ? "nicht zu st\xF6ren \u2013 Zimmer abgeschlossen" : "besch\xE4ftigt" : st === "fokus" ? "im Fokus bis " + bisText(fokusBis(t)) : st === "zu" ? autoZu(t) || (immerZu(t) ? "hat die T\xFCr zu" : "besch\xE4ftigt") : "besch\xE4ftigt";
    hinweis = WA.ui.displayActionMessage({
      message: `${t.raum}: ${wer} ${t.offen || st !== "zu" ? "ist " : ""}${grund}. Leertaste = anklopfen`,
      callback: () => anklopfen(t)
    });
  }
  function anklopfen(t) {
    if (Date.now() - (geklopft.get(t.variable) || 0) < 15e3) return;
    geklopft.set(t.variable, Date.now());
    WA.event.broadcast("sw-klopfen", { an: werVon(t), von: WA.player.name, variable: t.variable });
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY },
      body: JSON.stringify({ name: WA.player.name, event: "klopfen", an: werVon(t), raum: t.raum, sitzung: SITZUNG })
    }).catch(() => {
    });
    hinweisTuer = null;
    hinweisZeigen(null);
    const m = WA.ui.displayActionMessage({ message: `Angeklopft bei ${String(werVon(t)).split(/\s+/)[0]} \u2013 einen Moment \u2026`, callback: () => {
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
      const ps = (k.properties || []).find((x) => x.name === "tuerSchilderSenk");
      if (ps) schildGidsSenk = JSON.parse(ps.value);
      const zonen = (k.tilesets || []).find((t) => t.name === "WA_Special_Zones");
      if (zonen) kollisionGid = zonen.firstgid + 2;
      const lauf = (ls) => ls.forEach((l) => {
        if (l.type === "group") lauf(l.layers || []);
        if (l.type === "objectgroup") (l.objects || []).forEach((o) => {
          const pr = (n) => ((o.properties || []).find((x) => x.name === n) || {}).value;
          if (pr("tuerVariable")) tueren.push({ raum: o.name, besitzer: pr("besitzer"), variable: pr("tuerVariable"), felder: JSON.parse(pr("tuerFelder")), schild: JSON.parse(pr("schildFelder")), rechteck: [o.x / 32, o.y / 32, o.width / 32, o.height / 32], senk: !!pr("schildSenk"), offen: !!pr("offen") });
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
        if (t.offen) {
          if (aktuellerBereich === t.raum) zimmerKnopf();
          return;
        }
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
      const t = tueren.find((x) => x.offen && x.variable === d.variable && istBesitzer(x)) || meineTuer();
      if (!t || vorname(d.an) !== vorname(WA.player.name)) return;
      if (!HANDY) {
        mitteilung({ art: "klopfen", von: d.von, text: "an " + (t.offen ? t.raum : "deine T\xFCr"), variable: t.variable }, 6e4);
        return;
      }
      const m = WA.ui.displayActionMessage({
        message: `\u270A ${d.von} klopft an ${t.offen ? t.raum : "deine T\xFCr"} \u2013 Leertaste = reinlassen`,
        callback: () => WA.event.broadcast("sw-reinlassen", { fuer: d.von, variable: t.variable })
      });
      setTimeout(() => {
        try {
          m.remove();
        } catch {
        }
      }, 2e4);
    });
    WA.event.on("sw-gleich").subscribe((ev) => {
      const d = ev.data || {};
      if (d.fuer !== WA.player.name) return;
      mitteilung({ art: "info", von: d.von, kurz: "kommt gleich", text: "Einen Moment \u2013 gleich geht die T\xFCr auf." }, 3e4);
    });
    WA.event.on("sw-reinlassen").subscribe((ev) => {
      const d = ev.data || {};
      if (d.fuer !== WA.player.name) return;
      const t = tueren.find((x) => x.variable === d.variable);
      if (!t) return;
      freigabe.set(t.variable, Date.now() + 3e4);
      tuerAnwenden(t);
      mitteilung({ art: "info", von: werVon(t), kurz: "hat dich reingelassen", text: "Komm rein \u2013 die T\xFCr ist 30 Sekunden offen." }, 1e4);
      setTimeout(() => tuerAnwenden(t), 30500);
    });
  }
  function zimmerDaten(t) {
    try {
      const d = JSON.parse(String(WA.state[t.variable] || ""));
      if (d && d.s && Date.now() - Number(d.t || 0) < 3 * 6e4) {
        if (d.s === "zu" && !(Number(d.bis) > Date.now())) d.s = "besetzt";
        return d;
      }
    } catch {
    }
    return { s: "frei", wer: "", t: 0 };
  }
  function werVon(t) {
    return t.offen ? zimmerDaten(t).wer : t.besitzer;
  }
  function zimmerSetzen(t, s, bis = 0) {
    WA.state.saveVariable(t.variable, s === "frei" ? "" : JSON.stringify({ s, wer: WA.player.name, t: Date.now(), ...bis ? { bis } : {} }));
  }
  var ZTEXT = { frei: "\u{1F7E2} frei", besetzt: "\u{1F7E1} besetzt", zu: "\u{1F512} Fokus" };
  function zimmerKnopf() {
    try {
      WA.ui.actionBar.removeButton("sw-zimmer");
    } catch {
    }
    const t = tueren.find((x) => x.offen && x.raum === aktuellerBereich);
    if (!t) return;
    const d = zimmerDaten(t), fremd = d.s !== "frei" && vorname(d.wer) !== vorname(WA.player.name), wer = String(d.wer).split(/\s+/)[0];
    try {
      WA.ui.actionBar.addButton({ id: "sw-zimmer", label: fremd ? "\u{1F512} " + t.raum + ": " + wer : "\u{1F6AA} " + t.raum + ": " + (ZTEXT[d.s] || ZTEXT.frei), callback: () => {
        const n = zimmerDaten(t);
        if (n.s !== "frei" && vorname(n.wer) !== vorname(WA.player.name)) return kurzMeldung(t.raum + " hat gerade " + String(n.wer).split(/\s+/)[0] + " \u2013 nur wer es eingestellt hat, kann umstellen", 5e3);
        if (n.s === "besetzt") {
          if (fokusErlaubt()) zimmerSetzen(t, "zu", Date.now() + FOKUS_MIN * 6e4);
          return;
        }
        zimmerSetzen(t, n.s === "frei" ? "besetzt" : "frei");
      } });
    } catch {
    }
  }
  var zimmerWeg = /* @__PURE__ */ new Map();
  function zimmerRein(raum) {
    for (const x of tueren) if (!x.offen && x.raum === raum) tuerAnwenden(x);
    const t = tueren.find((x) => x.offen && x.raum === raum);
    if (!t) return;
    clearTimeout(zimmerWeg.get(raum));
    tuerAnwenden(t);
    zimmerKnopf();
  }
  function zimmerRaus(raum) {
    for (const x of tueren) if (!x.offen && x.raum === raum) {
      freigabe.delete(x.variable);
      setTimeout(() => tuerAnwenden(x), 600);
    }
    const t = tueren.find((x) => x.offen && x.raum === raum);
    if (!t) return;
    tuerAnwenden(t);
    zimmerKnopf();
    if (istBesitzer(t)) zimmerWeg.set(raum, setTimeout(() => {
      if (aktuellerBereich !== raum && istBesitzer(t)) zimmerSetzen(t, "frei");
    }, 2 * 6e4));
  }
  setInterval(() => {
    for (const t of tueren) if (t.offen) {
      if (aktuellerBereich === t.raum && istBesitzer(t)) {
        const d = zimmerDaten(t);
        zimmerSetzen(t, d.s, d.s === "zu" ? Number(d.bis) || 0 : 0);
      }
      tuerAnwenden(t);
    }
  }, 6e4);
  var INFO = "https://swdigitaltest.de/buero-praesenz/info";
  var info = { durchsage: null, geburtstage: [], reservierungen: [] };
  var durchsageGezeigt = null;
  var begruesst = false;
  var ballonsGesetzt = "";
  var hm = (d) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  var infoLeiste = null;
  var hinweiseOffen = 0;
  var LEISTE_UNTEN = "3px";
  function leisteVerschieben() {
    try {
      if (infoLeiste) infoLeiste.visible = hinweiseOffen === 0;
    } catch {
    }
  }
  function hinweiseUeberwachen() {
    try {
      const orig = WA.ui.displayActionMessage.bind(WA.ui);
      const stapel = [];
      const zeigen = (e) => {
        e.m = orig({ ...e.o, callback: () => {
          e.m = null;
          raus(e);
          try {
            return e.o.callback && e.o.callback();
          } catch (x) {
            console.warn(x);
          }
        } });
      };
      const zaehlen = () => {
        hinweiseOffen = stapel.length;
        leisteVerschieben();
      };
      const raus = (e) => {
        if (e.weg) return;
        e.weg = true;
        try {
          e.m && e.m.remove();
        } catch {
        }
        e.m = null;
        const i = stapel.indexOf(e);
        if (i >= 0) stapel.splice(i, 1);
        const oben = stapel[stapel.length - 1];
        if (i === stapel.length && oben && !oben.m) zeigen(oben);
        zaehlen();
      };
      WA.ui.displayActionMessage = (o) => {
        const vorher = stapel[stapel.length - 1];
        if (vorher && vorher.m) {
          try {
            vorher.m.remove();
          } catch {
          }
          vorher.m = null;
        }
        const e = { o, m: null, weg: false };
        stapel.push(e);
        zeigen(e);
        zaehlen();
        return { remove: () => raus(e) };
      };
    } catch {
    }
  }
  async function ausweisWeitergeben(token) {
    try {
      await WA.player.state.saveVariable("swAusweisNeu", token, { public: false, persist: false });
    } catch {
    }
  }
  function ausweisPruefen() {
    return new Promise((fertig) => {
      let abo = null;
      const start = Date.now();
      const ende = (s) => {
        clearTimeout(uhr);
        try {
          abo && abo.unsubscribe();
        } catch {
        }
        fertig(s);
      };
      const uhr = setTimeout(() => ende("ok"), 8e3);
      try {
        abo = WA.player.state.onVariableChange("swAusweisStand").subscribe((v) => {
          if (v && Number(v.t) >= start - 1e3) ende(v.s === "fehlt" ? "fehlt" : "ok");
        });
      } catch {
        ende("ok");
        return;
      }
      WA.ui.website.open({ url: SEITEN + "ausweis-sync.html?v=2&t=" + Date.now(), allowApi: true, visible: true, position: { vertical: "top", horizontal: "left" }, size: { width: "1px", height: "1px" }, margin: { top: "0px", left: "0px" } }).catch(() => ende("ok"));
    });
  }
  function leertasteAus(_) {
    return { remove: () => {
    } };
  }
  var POKE_API = "https://swdigitaltest.de/buero-praesenz/pokemon";
  var pokeListe = [];
  var pokeAktiv = /* @__PURE__ */ new Map();
  var pokeGesehen = /* @__PURE__ */ new Set();
  var POKE_ANSAGE = { selten: "\u{1F31F} Selten", sehrSelten: "\u{1F48E} Sehr selten", raid: "\u2694\uFE0F RAID", mew: "\u2728 Geheimnis" };
  var pokeOrt = (x, y) => y >= 88 ? "an der Stra\xDFe" : y < 12 ? "oben im Garten" : x > 140 ? "am Sportplatz" : x > 100 ? "rechts beim Parkplatz" : x < 20 ? "links im Garten" : "im Garten";
  async function pokemonStarten() {
    try {
      pokeListe = await (await fetch(SEITEN + "pokemon/pokemon.json?t=" + Date.now())).json();
    } catch {
      return;
    }
    pokeAbgleich();
    setInterval(pokeAbgleich, 6e4);
  }
  async function pokeAbgleich() {
    let d;
    try {
      d = await (await fetch(POKE_API + "/spawns?name=" + encodeURIComponent(WA.player.name || ""), { headers: { "X-Buero-Key": BUERO_KEY } })).json();
    } catch {
      return;
    }
    const da = /* @__PURE__ */ new Set();
    let handyZahl = 0;
    for (const s of d.spawns || []) {
      if (HANDY && s.y >= 88) continue;
      if (HANDY && ++handyZahl > 3) continue;
      if (s.raid && s.ichDabei) continue;
      da.add(s.id);
      if (pokeAktiv.has(s.id)) continue;
      const p = pokeListe.find((x) => x.nr === s.nr), name = p ? p.name : "Pok\xE9mon";
      const v = s.getarnt ? "blume" : s.raid ? "raid" : ["busch", "gras", "schatten"][(s.id.length + s.nr) % 3];
      const gross = s.raid ? 72 : 44;
      try {
        const h = await WA.room.website.create({
          name: "poke-" + s.id,
          url: SEITEN + "poke.html?v5&nr=" + s.nr + "&i=" + encodeURIComponent(s.id) + "&v=" + v,
          visible: true,
          allowApi: true,
          origin: "map",
          scale: 1,
          position: { x: s.x * 32 - (gross - 32) / 2, y: s.y * 32 - (gross - 20), width: gross, height: gross }
        });
        pokeAktiv.set(s.id, { h, s });
      } catch {
      }
      if (POKE_ANSAGE[s.stufe] && !pokeGesehen.has(s.id)) {
        pokeGesehen.add(s.id);
        kurzMeldung(POKE_ANSAGE[s.stufe] + ": " + (s.getarnt ? "Irgendwo drau\xDFen versteckt sich etwas Besonderes \u2026" : name + " ist " + pokeOrt(s.x, s.y) + " aufgetaucht!") + (s.raid ? " Nur zusammen zu fangen: " + s.treffer + " / " + s.raid : ""), 9e3);
      }
    }
    for (const id of [...pokeAktiv.keys()]) if (!da.has(id)) pokeWeg(id);
    for (const t of d.tauschEin || []) if (!pokeGesehen.has("t" + t.id)) {
      pokeGesehen.add("t" + t.id);
      kurzMeldung("\u{1F504} " + t.von + " m\xF6chte mit dir Pok\xE9mon tauschen \u2013 \u{1F4DA} Sammlungen \u203A Tausch", 9e3);
    }
    for (const x of d.ruhmNeu || []) if (!pokeGesehen.has("r" + x.id)) {
      pokeGesehen.add("r" + x.id);
      if (ruhmGeladen) kurzMeldung("\u{1F409} " + x.name + " hat alle 7 Dragon Balls gefunden und Shenlong gerufen!", 9e3);
    }
    ruhmGeladen = true;
    dbAbgleich();
  }
  var ruhmGeladen = false;
  var dbAktiv = /* @__PURE__ */ new Map();
  async function dbAbgleich() {
    let d;
    try {
      d = await (await fetch(POKE_API + "/db?name=" + encodeURIComponent(WA.player.name || ""), { headers: { "X-Buero-Key": BUERO_KEY } })).json();
    } catch {
      return;
    }
    const offen = /* @__PURE__ */ new Set();
    for (const k of d.kugeln || []) {
      if (k.gefunden) continue;
      if (HANDY && offen.size >= 1) continue;
      offen.add(k.s);
      if (dbAktiv.has(k.s)) continue;
      try {
        const h = await WA.room.website.create({
          name: "db-" + k.s,
          url: SEITEN + "db.html?v=1&s=" + k.s,
          visible: true,
          allowApi: true,
          origin: "map",
          scale: 1,
          position: { x: k.x * 32 + 4, y: k.y * 32 + 2, width: 26, height: 26 }
        });
        dbAktiv.set(k.s, h);
      } catch {
      }
    }
    for (const s of [...dbAktiv.keys()]) if (!offen.has(s)) dbWeg(s);
    dbGefundenListe = (d.kugeln || []).filter((k) => k.gefunden).map((k) => k.s);
    if (d.wunschOffen && !wunschErinnert) {
      wunschErinnert = true;
      kurzMeldung("\u{1F409} Shenlong wartet noch auf deinen Wunsch \u2013 \u{1F4DA} Sammlungen \u203A Dragon Balls", 9e3);
    }
    goldRand(d.goldBis);
  }
  var dbGefundenListe = [];
  var wunschErinnert = false;
  var goldAn = false;
  var shenlongFenster = null;
  function goldRand(bis) {
    const an = !!bis && Date.parse(bis) > Date.now();
    if (an === goldAn) return;
    goldAn = an;
    try {
      if (an) WA.player.setOutlineColor(251, 191, 36);
      else WA.player.removeOutlineColor();
    } catch {
    }
  }
  async function shenlongOeffnen() {
    if (shenlongFenster) return;
    try {
      shenlongFenster = await WA.ui.website.open({
        url: SEITEN + "shenlong.html?v=2&name=" + encodeURIComponent(WA.player.name || "") + "&t=" + Date.now(),
        allowApi: true,
        visible: true,
        position: { vertical: "top", horizontal: "left" },
        size: { width: "100vw", height: "100vh" },
        margin: { top: "0px", left: "0px" }
      });
    } catch {
      kurzMeldung("\u{1F409} Alle 7 Dragon Balls! Shenlong erscheint \u2013 dein Wunsch wartet unter \u{1F4DA} Sammlungen.", 9e3);
    }
  }
  function shenlongZu() {
    try {
      shenlongFenster && shenlongFenster.close();
    } catch {
    }
    shenlongFenster = null;
  }
  function dbWeg(s) {
    dbAktiv.delete(s);
    try {
      WA.room.website.delete("db-" + s);
    } catch {
    }
  }
  async function dbGefunden(v) {
    const s = Number(v.s) || 0;
    if (!s) return;
    setTimeout(() => dbWeg(s), 500);
    let r = {};
    try {
      const a = await fetch(POKE_API + "/db/fund", { method: "POST", headers: { "X-Buero-Key": BUERO_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ name: WA.player.name, s }) });
      r = await a.json();
      if (!a.ok) {
        kurzMeldung("\u{1F4A8} " + (r.error || "Weg!"), 5e3);
        return;
      }
    } catch {
      return;
    }
    if (!dbGefundenListe.includes(s)) dbGefundenListe.push(s);
    try {
      const w = await WA.ui.website.open({
        url: SEITEN + "dbfund.html?v=1&s=" + s + "&g=" + dbGefundenListe.join(",") + "&t=" + Date.now(),
        allowApi: false,
        visible: true,
        position: { vertical: "top", horizontal: "left" },
        size: { width: "100vw", height: "100vh" },
        margin: { top: "0px", left: "0px" }
      });
      setTimeout(() => {
        try {
          w.close();
        } catch {
        }
      }, 4200);
    } catch {
      kurzMeldung("\u{1F409} Dragon Ball " + "\u2605".repeat(s) + " gefunden \u2013 " + r.anzahl + " / 7 diese Woche", 6e3);
    }
    if (r.alle) setTimeout(shenlongOeffnen, 4300);
    erfolgeZeigen(r.neueErfolge);
  }
  function erfolgeZeigen(liste) {
    (liste || []).forEach((e, i) => setTimeout(() => kurzMeldung("\u{1F3C5} Neuer Erfolg: " + e.icon + " " + e.name + " \u2013 " + e.text, 8e3), 6500 * (i + 1)));
  }
  function pokeWeg(id) {
    const e = pokeAktiv.get(id);
    pokeAktiv.delete(id);
    try {
      WA.room.website.delete("poke-" + id);
    } catch {
      try {
        e && e.h && e.h.remove && e.h.remove();
      } catch {
      }
    }
  }
  async function pokeGefangen(v) {
    const id = String(v.i || ""), e = pokeAktiv.get(id);
    if (!e) return;
    setTimeout(() => pokeWeg(id), 450);
    const nr = e.s.nr, p = pokeListe.find((x) => x.nr === nr);
    let r = {};
    try {
      const a = await fetch(POKE_API + "/fang", { method: "POST", headers: { "X-Buero-Key": BUERO_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ name: WA.player.name, spawn: id }) });
      r = await a.json();
      if (!a.ok) {
        kurzMeldung("\u{1F4A8} " + (r.error || "Weg!"), 5e3);
        return;
      }
    } catch {
      return;
    }
    setTimeout(pokeAbgleich, 1200);
    erfolgeZeigen(r.neueErfolge);
    if (r.raid && !r.geschafft) {
      kurzMeldung("\u2694\uFE0F Raid: " + r.treffer + " von " + r.noetig + " dabei \u2013 holt Verst\xE4rkung, dann bekommt ihr " + (p ? p.name : "es") + " alle!", 9e3);
      return;
    }
    try {
      const w = await WA.ui.website.open({
        url: SEITEN + "fang.html?nr=" + nr + "&name=" + encodeURIComponent(p ? p.name : "Pok\xE9mon") + "&neu=" + (r.neu ? 1 : 0) + "&anzahl=" + (r.anzahl || 1) + "&arten=" + (r.arten || 0) + "&t=" + Date.now(),
        allowApi: false,
        visible: true,
        position: { vertical: "middle", horizontal: "middle" },
        size: { width: HANDY ? "300px" : "380px", height: HANDY ? "330px" : "360px" }
      });
      setTimeout(() => {
        try {
          w.close();
        } catch {
        }
      }, 4800);
    } catch {
      kurzMeldung((r.neu ? "\u2728 Neu! Du hast " : "Du hast ") + (p ? p.name : "Pok\xE9mon") + (r.neu ? " gefangen" : " erneut gefangen (" + (r.anzahl || 1) + "\xD7)") + (r.arten ? " \xB7 " + r.arten + " / 151" : ""), 6e3);
    }
  }
  var gokuFliegt = false;
  function gokuStarten() {
    setInterval(gokuPruefen, 4e3);
    gokuPruefen();
  }
  async function gokuPruefen() {
    if (gokuFliegt || HANDY) return;
    const jetzt = Date.now(), min = Math.floor(jetzt / 6e4), b = new Date(jetzt).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" });
    const tagNr = Math.floor(Date.parse(b.slice(0, 10) + "T12:00:00Z") / 864e5), flugMin = 600 + (Math.imul(tagNr, 2654435761) >>> 0 >>> 7) % 180;
    if (Number(b.slice(11, 13)) * 60 + Number(b.slice(14, 16)) !== flugMin) return;
    const start = min * 6e4, dauer = 3e4;
    if (jetzt - start > dauer - 2e3) return;
    gokuFliegt = true;
    const zufall = (min * 9301 + 49297) % 233280 / 233280, rechts = min % 2 === 0, y = (zufall < 0.5 ? 2 + zufall * 10 : 84 + (zufall - 0.5) * 14) * 32, B = 236 * 32 + 256;
    let h = null;
    try {
      h = await WA.room.website.create({ name: "goku", url: SEITEN + "goku.html?v=1" + (rechts ? "" : "&l=1"), visible: true, allowApi: false, origin: "map", scale: 1, position: { x: -200, y, width: 96, height: 72 } });
    } catch {
      gokuFliegt = false;
      return;
    }
    const tick = setInterval(() => {
      const t = (Date.now() - start) / dauer;
      if (t >= 1) {
        clearInterval(tick);
        try {
          WA.room.website.delete("goku");
        } catch {
        }
        setTimeout(() => {
          gokuFliegt = false;
        }, 6e4);
        return;
      }
      const x = rechts ? -200 + t * B : B - 200 - t * B;
      try {
        h.x = Math.round(x);
        h.y = Math.round(y + Math.sin(t * 12) * 10);
      } catch {
      }
    }, 80);
  }
  var PARADE = [
    { name: "sunny", seite: "schiff.html?v=1&b=sunny", w: 160, h: 300, bahn: "fluss", dauer: 18e4 },
    // Thousand Sunny (One Piece)
    { name: "merry", seite: "schiff.html?v=1&b=merry", w: 160, h: 300, bahn: "fluss", dauer: 18e4 },
    // Going Merry (One Piece)
    { name: "pearl", seite: "schiff.html?v=1&b=pearl", w: 160, h: 300, bahn: "fluss", dauer: 18e4 },
    // Black Pearl (Fluch der Karibik)
    { name: "hollaender", seite: "schiff.html?v=1&b=hollaender", w: 160, h: 300, bahn: "fluss", dauer: 18e4 },
    // Fliegender Holländer (Geisterschiff)
    { name: "bigmom", seite: "schiff.html?v=1&b=bigmom", w: 160, h: 300, bahn: "fluss", dauer: 18e4 },
    // Queen Mama Chanter (Big Mom)
    { name: "redforce", seite: "schiff.html?v=1&b=redforce", w: 160, h: 300, bahn: "fluss", dauer: 18e4 },
    // Red Force (Shanks)
    { name: "mobydick", seite: "schiff.html?v=1&b=mobydick", w: 160, h: 300, bahn: "fluss", dauer: 18e4 },
    // Moby Dick (Whitebeard)
    { name: "orojackson", seite: "schiff.html?v=1&b=orojackson", w: 160, h: 300, bahn: "fluss", dauer: 18e4 },
    // Oro Jackson (Gol D. Roger)
    { name: "polartang", seite: "schiff.html?v=1&b=polartang", w: 160, h: 300, bahn: "fluss", dauer: 18e4 }
    // Polar Tang (Law)
  ];
  var paradeLaeuft = false;
  function paradeStarten() {
    setInterval(paradePruefen, 5e3);
    paradePruefen();
  }
  var paradeHash = (n) => Math.imul(n, 2246822519) >>> 0 >>> 9;
  async function paradePruefen() {
    if (paradeLaeuft || HANDY || !PARADE.length) return;
    const jetzt = Date.now(), b = new Date(jetzt).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" });
    const tagNr = Math.floor(Date.parse(b.slice(0, 10) + "T12:00:00Z") / 864e5), std = Number(b.slice(11, 13)), mi = Number(b.slice(14, 16));
    if (std < 8 || std >= 20) return;
    for (let k = 0; k < 2; k++) {
      const seed = tagNr * 48 + std * 2 + k, abMin = k * 30 + paradeHash(seed + 11) % 27, p = PARADE[paradeHash(seed + 5) % PARADE.length];
      if (mi < abMin || mi >= abMin + Math.ceil(p.dauer / 6e4)) continue;
      const start = Math.floor(jetzt / 6e4) * 6e4 - (mi - abMin) * 6e4;
      if (jetzt - start > p.dauer - 3e3) continue;
      paradeLaeuft = true;
      const x = 223 * 32 + 128 - p.w / 2, y0 = -p.h, y1 = 150 * 32 + 20;
      let h = null;
      try {
        h = await WA.room.website.create({ name: "parade", url: SEITEN + p.seite, visible: true, allowApi: false, origin: "map", scale: 1, position: { x, y: y0, width: p.w, height: p.h } });
      } catch {
        paradeLaeuft = false;
        return;
      }
      const tick = setInterval(() => {
        const t = (Date.now() - start) / p.dauer;
        if (t >= 1) {
          clearInterval(tick);
          try {
            WA.room.website.delete("parade");
          } catch {
          }
          setTimeout(() => {
            paradeLaeuft = false;
          }, 6e4);
          return;
        }
        try {
          h.y = Math.round(y0 + t * (y1 - y0));
          h.x = Math.round(x + Math.sin(t * 9) * 12);
        } catch {
        }
      }, 100);
      return;
    }
  }
  var FLIEGER = ["tenshinhan", "vegeta", "bulma", "goku", "gohan", "trunks", "krillin", "yamcha", "c18", "c17", "freezer", "boo"];
  var fliegerFliegt = false;
  function fliegerStarten() {
    setInterval(fliegerPruefen, 4e3);
    fliegerPruefen();
  }
  async function fliegerPruefen() {
    if (fliegerFliegt || HANDY) return;
    const jetzt = Date.now(), b = new Date(jetzt).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" });
    const tagNr = Math.floor(Date.parse(b.slice(0, 10) + "T12:00:00Z") / 864e5), std = Number(b.slice(11, 13)), mi = Number(b.slice(14, 16));
    if (std < 8 || std >= 20) return;
    for (let k = 0; k < 2; k++) {
      const seed = tagNr * 48 + std * 2 + k + 1e3, abMin = k * 30 + 3 + paradeHash(seed + 17) % 24;
      if (mi !== abMin) continue;
      const start = Math.floor(jetzt / 6e4) * 6e4, dauer = 3e4;
      if (jetzt - start > dauer - 2e3) continue;
      fliegerFliegt = true;
      const wer = FLIEGER[paradeHash(seed + 3) % FLIEGER.length], rechts = (std + k) % 2 === 0, z = paradeHash(seed + 29) % 1e3 / 1e3;
      const y = (z < 0.5 ? 2 + z * 10 : 84 + (z - 0.5) * 14) * 32, B = 236 * 32 + 256;
      let h = null;
      try {
        h = await WA.room.website.create({ name: "flieger", url: SEITEN + "flieger.html?v=2&f=" + wer + (rechts ? "" : "&l=1"), visible: true, allowApi: false, origin: "map", scale: 1, position: { x: -200, y, width: 192, height: 96 } });
      } catch {
        fliegerFliegt = false;
        return;
      }
      const tick = setInterval(() => {
        const t = (Date.now() - start) / dauer;
        if (t >= 1) {
          clearInterval(tick);
          try {
            WA.room.website.delete("flieger");
          } catch {
          }
          setTimeout(() => {
            fliegerFliegt = false;
          }, 6e4);
          return;
        }
        const x = rechts ? -200 + t * B : B - 200 - t * B;
        try {
          h.x = Math.round(x);
          h.y = Math.round(y + Math.sin(t * 12) * 10);
        } catch {
        }
      }, 80);
      return;
    }
  }
  var gongGezeigt = "";
  function gongStarten() {
    setInterval(gongPruefen, 3e3);
    gongPruefen();
  }
  async function gongPruefen() {
    const jetzt = Date.now(), b = new Date(jetzt).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }), tag = b.slice(0, 10);
    const wt = (/* @__PURE__ */ new Date(tag + "T12:00:00Z")).getUTCDay();
    if (wt === 0 || wt === 6 || b.slice(11, 16) !== "16:00" || gongGezeigt === tag) return;
    gongGezeigt = tag;
    const start = Math.floor(jetzt / 6e4) * 6e4, dauer = 45e3;
    kurzMeldung("\u{1F409} Goku: Die Kernarbeitszeit ist vorbei! Sch\xF6nen Feierabend \u2013 wer mag \u{1F604}", 12e3);
    if (HANDY || jetzt - start > dauer - 3e3) return;
    const y = 9 * 32, B = 236 * 32 + 320;
    let h = null;
    try {
      h = await WA.room.website.create({ name: "gong", url: SEITEN + "gong.html?v=1", visible: true, allowApi: false, origin: "map", scale: 1, position: { x: -320, y, width: 320, height: 210 } });
    } catch {
      return;
    }
    const tick = setInterval(() => {
      const t = (Date.now() - start) / dauer;
      if (t >= 1) {
        clearInterval(tick);
        try {
          WA.room.website.delete("gong");
        } catch {
        }
        return;
      }
      try {
        h.x = Math.round(-320 + t * B);
        h.y = Math.round(y + Math.sin(t * 10) * 8);
      } catch {
      }
    }, 80);
  }
  var DEKO_ORTE = [[206, 68], [167, 14], [184, 87], [147, 71], [97, 71], [177, 8], [116, 83], [17, 74], [198, 80], [76, 79], [164, 52], [68, 11], [164, 78], [32, 6], [137, 25], [133, 75], [216, 12], [202, 21], [160, 22], [149, 15], [127, 19], [5, 87], [113, 25], [189, 14]];
  function osterSonntag(j) {
    const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), t = (h + l - 7 * m + 114) % 31 + 1;
    return Date.UTC(j, mo - 1, t);
  }
  function saisonHeute() {
    const tag = (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }), md = tag.slice(5), j = Number(tag.slice(0, 4)), heute = Date.parse(tag + "T00:00:00Z");
    const zw = (a, b) => a <= b ? md >= a && md <= b : md >= a || md <= b, os = osterSonntag(j), ost = (v, b) => heute >= os + v * 864e5 && heute <= os + b * 864e5;
    const l = [];
    if (zw("10-24", "10-31")) l.push({ e: "\u{1F383}", n: 8, a: "wippen", gruss: "\u{1F383} Happy Halloween! Drau\xDFen stehen K\xFCrbisse \u2013 und die Flederm\xE4use sind unterwegs." }, { e: "\u{1F987}", n: 4, a: "schweben" });
    if (md === "11-11") l.push({ e: "\u{1F3AD}", n: 6, a: "wippen", gruss: "\u{1F389} Helau! Heute um 11:11 Uhr beginnt die Karnevalssession." });
    if (zw("12-01", "12-23")) l.push({ e: "\u{1F384}", n: 6, a: "funkeln", gruss: "\u{1F56F}\uFE0F Sch\xF6ne Adventszeit!" }, { e: "\u{1F381}", n: 4, a: "wippen" });
    if (zw("12-24", "12-26")) l.push({ e: "\u{1F384}", n: 8, a: "funkeln", gruss: "\u{1F384} Frohe Weihnachten!" }, { e: "\u{1F381}", n: 6, a: "wippen" });
    if (zw("12-31", "01-01")) l.push({ e: "\u{1F386}", n: 8, a: "funkeln", gruss: md === "12-31" ? "\u{1F386} Guten Rutsch ins neue Jahr!" : "\u{1F942} Frohes neues Jahr!" }, { e: "\u{1F340}", n: 4, a: "wippen" });
    if (ost(-3, 1)) l.push({ e: "\u{1F95A}", n: 8, a: "wippen", gruss: "\u{1F423} Frohe Ostern! Drau\xDFen liegen bunte Eier." }, { e: "\u{1F430}", n: 3, a: "schweben" });
    if (md === "06-20") l.push({ e: "\u{1F389}", n: 8, a: "funkeln", gruss: "\u{1F389} Heute ist Firmenjubil\xE4um von SW Digital Tax!" });
    if (md === "05-01") l.push({ e: "\u{1F333}", n: 4, a: "wippen", gruss: "\u{1F333} Sch\xF6nen 1. Mai!" });
    if (zw("03-20", "05-31")) l.push({ e: "\u{1F337}", n: 6, a: "wippen" });
    else if (zw("06-01", "09-22")) l.push({ e: "\u{1F33B}", n: 6, a: "wippen" });
    else if (zw("09-23", "11-30")) l.push({ e: "\u{1F342}", n: 7, a: "schweben" });
    else l.push({ e: "\u26C4", n: 3, a: "wippen" });
    return { tag, l };
  }
  var dekoTag = "";
  var dekoNamen = [];
  function dekoStarten() {
    dekoPruefen();
    setInterval(dekoPruefen, 5 * 6e4);
  }
  async function dekoPruefen() {
    const { tag, l } = saisonHeute();
    if (tag === dekoTag) return;
    dekoTag = tag;
    const g = l.find((x) => x.gruss);
    if (g) setTimeout(() => kurzMeldung(g.gruss, 1e4), 8e3);
    if (HANDY) return;
    for (const n of dekoNamen) {
      try {
        WA.room.website.delete(n);
      } catch {
      }
    }
    dekoNamen = [];
    let o = 0;
    for (const x of l) for (let k = 0; k < x.n && o < DEKO_ORTE.length; k++, o++) {
      const [px, py] = DEKO_ORTE[o], name = "deko-" + o;
      try {
        await WA.room.website.create({ name, url: SEITEN + "deko.html?v=1&a=" + x.a + "&i=" + o + "&e=" + encodeURIComponent(x.e), visible: true, allowApi: false, origin: "map", scale: 1, position: { x: px * 32 - 4, y: py * 32 - 12, width: 40, height: 44 } });
        dekoNamen.push(name);
      } catch {
      }
    }
  }
  var AUTOS = ["lambo", "r8", "rsq8", "amggt", "porsche911", "delorean", "kitt", "batmobil", "herbie", "ecto1", "bumblebee"];
  var autoFaehrt = false;
  var AUTO_TEST_BIS = 1792253942e3;
  function autosStarten() {
    setInterval(autosPruefen, 4e3);
    autosPruefen();
  }
  async function autosPruefen() {
    if (autoFaehrt || HANDY) return;
    const jetzt = Date.now(), b = new Date(jetzt).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" });
    const tagNr = Math.floor(Date.parse(b.slice(0, 10) + "T12:00:00Z") / 864e5), std = Number(b.slice(11, 13)), mi = Number(b.slice(14, 16));
    if (jetzt < AUTO_TEST_BIS) {
      const slot = Math.floor(jetzt / 3e4), start = slot * 3e4, dauer = 25e3;
      if (jetzt - start > dauer - 2e3) return;
      return autoFahren(AUTOS[slot % AUTOS.length], slot % 2 === 0, start, dauer);
    }
    if (std < 8 || std >= 20) return;
    for (let k = 0; k < 2; k++) {
      const seed = tagNr * 48 + std * 2 + k + 2e3, abMin = k * 30 + 10 + paradeHash(seed + 23) % 18;
      if (mi !== abMin) continue;
      const start = Math.floor(jetzt / 6e4) * 6e4, dauer = 25e3;
      if (jetzt - start > dauer - 2e3) continue;
      return autoFahren(AUTOS[paradeHash(seed + 7) % AUTOS.length], (std + k) % 2 === 1, start, dauer);
    }
  }
  async function autoFahren(wer, rechts, start, dauer) {
    {
      autoFaehrt = true;
      const W = 160, H = 80;
      const y = Math.round((rechts ? 98.7 : 96.3) * 32) - H, B = 236 * 32 + W;
      let h = null;
      try {
        h = await WA.room.website.create({ name: "auto", url: SEITEN + "auto.html?v=1&a=" + wer + (rechts ? "" : "&l=1"), visible: true, allowApi: false, origin: "map", scale: 1, position: { x: rechts ? -W : B, y, width: W, height: H } });
      } catch {
        autoFaehrt = false;
        return;
      }
      const tick = setInterval(() => {
        const t = (Date.now() - start) / dauer;
        if (t >= 1) {
          clearInterval(tick);
          try {
            WA.room.website.delete("auto");
          } catch {
          }
          setTimeout(() => {
            autoFaehrt = false;
          }, Date.now() < AUTO_TEST_BIS ? 0 : 6e4);
          return;
        }
        try {
          h.x = Math.round(rechts ? -W + t * B : B - t * (B + W));
        } catch {
        }
      }, 60);
    }
  }
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
  var telefonGemeldet = false;
  function telefonTuer() {
    for (const x of tueren) if (!x.offen) tuerAnwenden(x);
    const t = meineTuer();
    if (!t) return;
    if (WA.state[t.variable] === "besetzt" || WA.state[t.variable] === "zu") WA.state.saveVariable(t.variable, "frei");
    if (fokusBis(t) && fokusBis(t) <= Date.now()) {
      fokusSetzen(t, 0);
      kurzMeldung("\u2615 Fokuszeit vorbei \u2013 deine T\xFCr ist wieder frei", 8e3);
    }
    const grund = autoZu(t), tel = telefoniertGerade(WA.player.name);
    void tel;
    void telefonGemeldet;
    if (grund && tuerVorTelefon === null) {
      tuerVorTelefon = "x";
      kurzMeldung(`\u{1F534} Deine T\xFCr ist zu \u2013 du ${grund === "hat Besuch" ? "hast Besuch" : grund === "hat einen Termin" ? "hast einen Termin" : "telefonierst (\u{1F4DE} am Schild)"}`, 5e3);
    } else if (!grund && tuerVorTelefon !== null) tuerVorTelefon = null;
    return;
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
  var FEIERABEND_RAEUME = [
    "Besprechung 11",
    "Besprechung Glas",
    "Pause",
    "Lernzimmer",
    "Helpcenter",
    "Fitnessraum",
    "Fibu Backoffice",
    // 23.10.2026 (Sam: „jedes Büro oder Besprechungszimmer dunkler, wenn keiner drin ist“; Flächen aus kartenbau/dunkel-weitere-raeume.js)
    "Besprechung 1",
    "Besprechung 2",
    "Fibu-Besprechung",
    "Jahresabschlussersteller",
    "Social Media",
    "IT-Abteilung",
    "Onboarding",
    "Payroll-Lounge",
    "Termine mit Donna"
  ];
  var RAUM_PLAETZE = { "Social Media": ["Mina"], "Jahresabschlussersteller": ["JA-Abschluss"], "IT-Abteilung": ["IT-Rengid", "IT-Olga"], "Onboarding": ["Onboarding-Ron"] };
  var toene = {};
  var LAUT_STANDARD = { direkt: 0.5, gruppe: 0.5, eingang: 0.15 };
  function lautstaerke(art) {
    try {
      const v = WA.player.state.swLautstaerke;
      if (v && typeof v[art] === "number") return Math.max(0, Math.min(1, v[art]));
    } catch {
    }
    return LAUT_STANDARD[art] ?? 0.5;
  }
  function ton(name, art = "gruppe") {
    if (HANDY) return;
    const volume = lautstaerke(art);
    if (!volume) return;
    try {
      (toene[name] || (toene[name] = WA.sound.loadSound(SEITEN + "toene/" + name + ".wav"))).play({ volume });
    } catch {
    }
  }
  var SPAR_EBENE = /^fx-(regen|schnee|trueb|blitz|pfuetzen|abend|nacht|lichter|dunkel|feierabend)/;
  function fx(name, an) {
    if (HANDY && SPAR_EBENE.test(name)) an = false;
    if (fxStand[name] === an) return;
    fxStand[name] = an;
    if (TEIL_MUSTER.test(name)) {
      if (teile) teilSchalten(name, an);
      return;
    }
    try {
      an ? WA.room.showLayer(name) : WA.room.hideLayer(name);
    } catch {
    }
  }
  var TEIL_MUSTER = /^(fx-dunkel-|fx-feierabend-|kueche-.+-(an|aus)$|kueche-kaffee-dampf$|fx-klingel$)/;
  var teile = null;
  var teilAn = {};
  var teilZelle = {};
  function teilSchalten(name, an) {
    const t = teile && teile[name];
    if (!t || teilAn[name] === an) return;
    teilAn[name] = an;
    const kacheln = t.z.map(([x, y]) => {
      let tile = null;
      for (const p of teilZelle[t.e + ":" + x + ":" + y]) if (teilAn[p.n]) tile = p.g;
      return { x, y, tile, layer: t.e };
    });
    try {
      WA.room.setTiles(kacheln);
    } catch {
    }
  }
  async function teileLaden() {
    var _a;
    const neu = {};
    try {
      const k = await ladeKarte();
      for (const l of k.layers || []) {
        const p = (l.properties || []).find((p2) => p2.name === "teile");
        if (!p) continue;
        for (const t of JSON.parse(p.value)) {
          neu[t.n] = { e: l.name, z: t.z };
          teilAn[t.n] = t.v;
          for (const [x, y, g] of t.z) (teilZelle[_a = l.name + ":" + x + ":" + y] || (teilZelle[_a] = [])).push({ n: t.n, g });
        }
      }
      rahmenGid = Number(((k.properties || []).find((p) => p.name === "rahmenGid") || {}).value) || 0;
    } catch {
      return;
    }
    teile = neu;
    for (const [n, an] of Object.entries(fxStand)) if (TEIL_MUSTER.test(n)) teilSchalten(n, an);
    rahmenZeichnen();
  }
  var RAHMEN_RAUM = /^(Büro |Google Meet |Zoom |Teams |Zimmer \d)|^(Paris|Berlin|Lissabon|New York|Amsterdam|Moskau)$/;
  var raumBelegt = (n) => aktuellerBereich === n || (info.belegt || []).includes(n);
  var rahmenGid = 0;
  var rahmenRechtecke = null;
  var rahmenAlt = /* @__PURE__ */ new Map();
  function rahmenStatus(raum) {
    if (!raumBelegt(raum)) return 0;
    const t = tueren.find((x) => x.raum === raum);
    if (!t) return 1;
    const s = schildStatus(t);
    return s === "tel" ? 3 : s === "fokus" ? 2 : 1;
  }
  function rahmenZeichnen() {
    if (!rahmenGid || !teile || !karte) return;
    if (!rahmenRechtecke) {
      const r = [];
      for (const o of ((karte && karte.layers || []).find((l) => l.name === "floorLayer") || { objects: [] }).objects) {
        if (!RAHMEN_RAUM.test(o.name)) continue;
        const t = teile["fx-dunkel-" + o.name.normalize("NFD").replace(/[^A-Za-z0-9]/g, "")];
        if (!t || !t.z.length) continue;
        const xs = t.z.map((z) => z[0]), ys = t.z.map((z) => z[1]);
        r.push({ raum: o.name, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
      }
      rahmenRechtecke = r.map((a) => {
        const n = { ...a };
        for (const b of r) {
          if (a === b) continue;
          const yUeber = a.y0 <= b.y1 && b.y0 <= a.y1, xUeber = a.x0 <= b.x1 && b.x0 <= a.x1;
          if (yUeber && a.x1 === b.x0) n.x1 = a.x1 - 1;
          if (yUeber && a.x0 === b.x1) n.x0 = a.x0 + 1;
          if (xUeber && a.y1 === b.y0) n.y1 = a.y1 - 1;
          if (xUeber && a.y0 === b.y1) n.y0 = a.y0 + 1;
        }
        return n;
      });
    }
    const neu = /* @__PURE__ */ new Map();
    for (const r of rahmenRechtecke) {
      const z = rahmenStatus(r.raum);
      if (!z) continue;
      const f = (z - 1) * 20, w = r.x1 - r.x0 + 1, setz = (x, y, n) => neu.set(x + ":" + y, f + n);
      if (w >= 6) {
        const x0 = r.x0 + Math.floor(w / 2) + 1;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) setz(x0 + i, r.y0 + j, j * 3 + i);
      } else if (w % 2) {
        const x0 = r.x0 + (w - 1) / 2 - 1;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) setz(x0 + i, r.y0 + j, j * 3 + i);
      } else {
        const x0 = r.x0 + w / 2 - 2;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) setz(x0 + i, r.y0 + j, 6 + j * 4 + i);
      }
      const t = tueren.find((x) => x.raum === r.raum);
      for (const [x, y] of t ? t.felder : []) {
        const inX = x >= r.x0 && x <= r.x1, inY = y >= r.y0 && y <= r.y1;
        const s = !inY ? y > r.y1 ? 0 : 2 : !inX ? x > r.x1 ? 3 : 1 : y === r.y1 ? 2 : y === r.y0 ? 0 : x === r.x1 ? 1 : 3;
        setz(x, y, 14 + s);
      }
    }
    const kacheln = [];
    for (const [k, n] of neu) if (rahmenAlt.get(k) !== n) {
      const [x, y] = k.split(":").map(Number);
      kacheln.push({ x, y, tile: rahmenGid + n, layer: "rahmen" });
    }
    for (const k of rahmenAlt.keys()) if (!neu.has(k)) {
      const [x, y] = k.split(":").map(Number);
      kacheln.push({ x, y, tile: null, layer: "rahmen" });
    }
    rahmenAlt = neu;
    if (kacheln.length) try {
      WA.room.setTiles(kacheln);
    } catch {
    }
  }
  async function aussenweltAus() {
    try {
      const k = await ladeKarte();
      const geh = (ls, pfad) => {
        for (const l of ls || []) {
          if (l.type === "group") geh(l.layers, pfad + l.name + "/");
          else if (/-aussen$/.test(l.name)) {
            try {
              WA.room.hideLayer(pfad + l.name);
            } catch {
            }
            if (pfad) try {
              WA.room.hideLayer(l.name);
            } catch {
            }
          }
        }
      };
      geh(k.layers, "");
    } catch {
    }
  }
  function effekte() {
    schilderAktualisieren();
    rahmenZeichnen();
    const teile2 = (/* @__PURE__ */ new Date()).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).split(/[- :]/).map(Number);
    const monat = teile2[1], min = teile2[3] * 60 + teile2[4];
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
    const dunkelZeit = nacht || abend;
    for (const o of ((karte && karte.layers || []).find((l) => l.name === "floorLayer") || { objects: [] }).objects) {
      if (!RAHMEN_RAUM.test(o.name)) continue;
      fx("fx-dunkel-" + o.name.normalize("NFD").replace(/[^A-Za-z0-9]/g, ""), dunkelZeit && !raumBelegt(o.name));
    }
    for (const n of FEIERABEND_RAEUME) fx("fx-feierabend-" + n.normalize("NFD").replace(/[^A-Za-z0-9]/g, ""), dunkelZeit && ![n, ...RAUM_PLAETZE[n] || []].some(raumBelegt));
    if (w) {
      regenAn = !!w.regen;
      fx("fx-pfuetzen", !!w.regen);
      fx("fx-trueb", !!(w.regen || w.nebel || w.trueb || w.gewitter));
      schneeAn = !!w.schnee;
      fx("fx-schnee", !!w.schneeLiegt);
    } else {
      const winter = monat === 12 || monat <= 2;
      fx("fx-schnee", winter);
      schneeAn = winter;
      regenAn = false;
      fx("fx-pfuetzen", false);
      fx("fx-trueb", false);
    }
    gewitter = !!(w && w.gewitter);
    hundRuhe = nacht || !!(w && (w.regen || w.schnee || w.gewitter));
  }
  var regenAn = false;
  var schneeAn = false;
  function wetterTakt() {
    setInterval(() => {
      fx("fx-regen", regenAn);
      fx("fx-schneefall", schneeAn);
    }, 1e3);
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
    const KORB = { x: MI32(400 + DX * 32), y: -144 + DY * 32 }, ECKE = { x: 48, y: -144 + DY * 32 }, UNTEN = { x: 48, y: 272 + DY * 32 }, TEMPO = 32;
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
    const SW = window.outerWidth || screen.availWidth || 1600, SH = screen.availHeight || 900, zw = (v, a, z) => Math.min(z, Math.max(a, v));
    const b = Math.round(zw(Number(e.b) || Math.min(780, SW * 0.44), 340, SW - 40)), hv = Math.round(zw(Number(e.hv) || 78, 30, 92));
    e = { ...e, r: zw(Number(e.r ?? 14) || 0, 0, Math.max(0, SW - b - 20)), o: zw(Number(e.o ?? 70) || 0, 0, 160) };
    if (HANDY) return { position: { vertical: "bottom", horizontal: "middle" }, size: { width: Math.round(screen.width || 390) + "px", height: "76vh" }, margin: { bottom: "0px" } };
    if (e.voll) return { position: { vertical: "top", horizontal: "middle" }, size: { width: Math.round(screen.availWidth * 0.94) + "px", height: "90vh" }, margin: { top: "40px" } };
    return { position: { vertical: "top", horizontal: "right" }, size: { width: b + "px", height: hv + "vh" }, margin: { top: Math.round(Number(e.o) || 70) + "px", right: Math.round(Number(e.r ?? 14)) + "px" } };
  }
  async function glasOeffnen(u) {
    return await WA.ui.website.open({ url: u, allowApi: true, allowPolicy: "microphone", visible: true, ...glasLage() });
  }
  async function glasFenster(url) {
    const u = url + (url.includes("?") ? "&" : "?") + "glas=1";
    try {
      glasOffen && glasOffen.handle && glasOffen.handle.close();
    } catch {
    }
    if (HANDY) handyBlattZu();
    try {
      glasOffen = { url: u, handle: await glasOeffnen(u) };
      if (mitteilungen.length) mtZeigen();
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
  var BLEIBT_OFFEN = /anruf\.html\?.*klein=1|leiste-rechts.html|push-start\.html\?pflicht|info\.html|leiste\.html|schloss\.html|tagescheck\.html\?karte|oben\.html|handy-menue\.html|blick\.html|app\.html|ausweis-sync\.html|mitteilungen\.html/;
  function allesZu() {
    try {
      WA.ui.modal.closeModal();
    } catch {
    }
    try {
      WA.nav.closeCoWebSite();
    } catch {
    }
    shenlongZu();
    glasOffen = null;
    konfettiOffen = false;
    if (HANDY) try {
      handyBlattZu();
    } catch {
    }
    WA.ui.website.getAll().then((alle) => alle.forEach((w) => {
      if (!BLEIBT_OFFEN.test(String(w.url || ""))) w.close().catch(() => {
      });
    })).catch(() => {
    });
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
  var NEWS_SCHIRM = { x: MI32(1325 + DX * 32), y: 962 + DY * 32, w: 214, h: 70 };
  var NEWS_BEREICH = { x: (41 + DX) * 32, y: (33 + DY) * 32, w: 8 * 32, h: 3 * 32 };
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
  var HELPCENTER = true ? [{ x: 63, y: 70 }] : [{ x: MI(40 + DX), y: 22 + DY }];
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
  var FITNESS = { x: MI(78 + DX), y: 6 + DY };
  var POSTER = [
    { name: "poster-zimmer4", bild: "kubilay.jpg", x: MI(31 + DX), y: 18.15 + DY, w: 2.5, h: 1.4, zimmerX: MI(29 + DX), zimmerY: 17 + DY, unsichtbar: true },
    // 16.10.2026 (Sam): Büro Ferhat – Bild statt Whiteboard (Whiteboard = Ebene fx-ideen x 4–8 / y 49–50); Bild liegt auf dem Server (wa-bilder)
    { name: "poster-ferhat", srv: "ferhat-poster.webp", x: MI(1.95 + DX), y: 48.75, w: 2.2, h: 1, unsichtbar: true }
  ];
  function posterAufhaengen() {
    const POSTER_AKTIV = true ? [] : POSTER;
    for (const p of POSTER_AKTIV) {
      if (p.ohneWhiteboard) {
        const t = [];
        for (let x = p.ohneWhiteboard.x; x < p.ohneWhiteboard.x + p.ohneWhiteboard.w; x++) for (let y = p.ohneWhiteboard.y; y < p.ohneWhiteboard.y + p.ohneWhiteboard.h; y++) t.push({ x, y, tile: null, layer: "fx-ideen" });
        try {
          WA.room.setTiles(t);
        } catch {
        }
      }
      try {
        WA.room.website.create({
          name: p.name,
          url: SEITEN + "poster.html?v=2&" + (p.srv ? "srv=" + encodeURIComponent(p.srv) + (p.pos ? "&pos=" + encodeURIComponent(p.pos) : "") : "bild=" + encodeURIComponent(p.bild)) + (p.unsichtbar ? "&klick=1" : ""),
          visible: true,
          allowApi: true,
          origin: "map",
          scale: 1,
          position: { x: Math.round(p.x * 32), y: Math.round(p.y * 32), width: Math.round(p.w * 32), height: Math.round(p.h * 32) }
        });
      } catch {
      }
    }
  }
  var OFFENE_RAEUME = [14, 19, 24, 29, 52, 57, 62, 67].map((x) => x + DX).flatMap((x) => [17 + DY, 27 + DY].map((y) => ({ x, y, w: 5, h: 6 })));
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
      ideenHinweis = leertasteAus({ message: "\u{1F4A1} Meine Ideen \xB7 Leertaste", callback: () => {
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
      if (POSTER.some((p) => p.zimmerX === o.x && p.zimmerY === o.y)) return;
      try {
        WA.room.area.create({ name: "offen-" + (i + 1), x: o.x * 32, y: o.y * 32, width: o.w * 32, height: o.h * 32 });
        WA.room.area.onEnter("offen-" + (i + 1)).subscribe(ideenHinweisZeigen);
        WA.room.area.onLeave("offen-" + (i + 1)).subscribe(ideenHinweisWeg);
      } catch {
      }
    });
  }
  var BW = () => Math.round(screen.width || 390) + "px";
  var handyBlatt = null;
  function handyBlattZu() {
    const war = handyBlatt && handyBlatt.name;
    if (handyBlatt) {
      try {
        handyBlatt.h.close();
      } catch {
      }
    }
    handyBlatt = null;
    if (war === "arbeiten") {
      arbeitenOffen = false;
      grundrissZeigen();
    }
  }
  async function handyBlattUmschalten(name, url, hoehe) {
    const war = handyBlatt && handyBlatt.name;
    handyBlattZu();
    if (war === name) return;
    try {
      glasOffen && glasOffen.handle && glasOffen.handle.close();
    } catch {
    }
    glasOffen = null;
    try {
      const h = await WA.ui.website.open({ url, allowApi: true, visible: true, position: { vertical: "bottom", horizontal: "middle" }, size: { width: BW(), height: hoehe }, margin: { bottom: "0px" } });
      handyBlatt = { name, h };
    } catch {
      handyBlatt = null;
    }
  }
  var hinweisWeb = null;
  var hinweisNr = 0;
  var hinweisAkt = null;
  function hinweisText(t) {
    return String(t || "").replace(/\s*[·–-]?\s*Leertaste\s*=\s*/gi, " \u2192 ").replace(/\s*[·–-]?\s*Leertaste\s*(zum Sprechen|zum|:)?\s*/gi, " ").replace(/\s+/g, " ").replace(/\s*[·:–-]\s*$/, "").trim();
  }
  function handyHinweis(o, pc = false) {
    const nr = ++hinweisNr, cb = o && o.callback || (() => {
    }), knopf = String(cb).replace(/\s/g, "") !== "()=>{}";
    hinweisAkt = { nr, cb };
    if (grundriss && !pc) {
      try {
        WA.player.state.saveVariable("swAppHinweis", { text: hinweisText(o && o.message), knopf, nr, t: Date.now() }, { public: false, persist: false });
      } catch {
      }
      return { remove: () => {
        if (hinweisAkt && hinweisAkt.nr === nr) {
          hinweisAkt = null;
          try {
            WA.player.state.saveVariable("swAppHinweis", null, { public: false, persist: false });
          } catch {
          }
        }
      } };
    }
    const url = SEITEN + "hinweis.html?nr=" + nr + (knopf ? "&knopf=1" : "") + (pc ? "&los=Starten" : "") + "&text=" + encodeURIComponent(hinweisText(o && o.message));
    const alt = hinweisWeb;
    hinweisWeb = null;
    WA.ui.website.open({
      url,
      allowApi: true,
      visible: true,
      position: { vertical: "bottom", horizontal: "middle" },
      size: { width: pc ? "420px" : Math.round((screen.width || 390) - 28) + "px", height: "56px" },
      margin: { bottom: pc ? "70px" : "232px" }
    }).then((h) => {
      try {
        alt && alt.close();
      } catch {
      }
      if (hinweisAkt && hinweisAkt.nr === nr) hinweisWeb = h;
      else {
        try {
          h.close();
        } catch {
        }
      }
    }).catch(() => {
      try {
        alt && alt.close();
      } catch {
      }
    });
    return { remove: () => {
      if (hinweisAkt && hinweisAkt.nr === nr) {
        hinweisAkt = null;
        try {
          hinweisWeb && hinweisWeb.close();
        } catch {
        }
        hinweisWeb = null;
      }
    } };
  }
  function klickHinweis(o) {
    return HANDY ? WA.ui.displayActionMessage(o) : handyHinweis(o, true);
  }
  function hinweisGetippt(nr) {
    if (hinweisAkt && hinweisAkt.nr === nr) {
      const cb = hinweisAkt.cb;
      try {
        cb();
      } catch (e) {
        console.warn(e);
      }
    }
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
  function zitatTafel() {
    let fenster = null;
    leertasteBereich("zitat-tafel", { x: MI(45 + DX), y: 50 + DY, w: 4, h: 4 }, "\u{1F4DC} Leertaste: Zitat des Tages sehen", async () => {
      try {
        fenster = await glasFenster(SEITEN + "zitat.html?t=" + Date.now());
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
  function dankeWand() {
    let fenster = null;
    leertasteBereich("danke-wand", { x: MI(64 + DX), y: 38 + DY, w: 2, h: 1 }, "\u{1F49B} Leertaste: Danke-Wand", async () => {
      try {
        fenster = await glasFenster(SEITEN + "danke.html?t=" + Date.now());
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
  function schaufenster() {
    let fenster = null;
    leertasteBereich("schaufenster", { x: MI(66 + DX), y: 37 + DY, w: 2, h: 1 }, "\u{1F6CD}\uFE0F Leertaste: Mitarbeiter-Rabatte", async () => {
      try {
        fenster = await glasFenster(SEITEN + "rabatte.html?t=" + Date.now());
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
  var GESPRAECHS_RAEUME = [
    // 14.10.2026: Besprechung 10 ist jetzt das Lernzimmer
    { raum: "Besprechung 11", x: MI(25 + DX), y: 39 + DY, w: 7, h: 5 },
    true ? { raum: "Besprechung Glas", x: 45, y: 34, w: 12, h: 16 } : { raum: "Besprechung Glas", x: MI(45 + DX), y: 6 + DY, w: 8, h: 8 },
    // 22.10.2026 (Sam): alle Besprechungsräume – Haupt, Klein, Team Fibu (Lage wie die Karten-Bereiche)
    ...true ? [{ raum: "Besprechung 1", x: 75, y: 39, w: 11, h: 5 }, { raum: "Besprechung 2", x: 75, y: 45, w: 11, h: 5 }, { raum: "Fibu-Besprechung", x: 4, y: 44, w: 7, h: 4 }] : []
  ];
  var gespHinweis = null;
  var gespRaum = "";
  var gespFenster = null;
  function gespHinweisPruefen() {
    if (!gespRaum || zimmerId || gesperrt) {
      try {
        gespHinweis && gespHinweis.remove();
      } catch {
      }
      gespHinweis = null;
      return;
    }
    if (gespHinweis) return;
    const raum = gespRaum;
    try {
      gespHinweis = klickHinweis({ message: "\u{1F4AC} Gespr\xE4ch / Notizen", callback: async () => {
        gespHinweis = null;
        try {
          gespFenster = await glasFenster(SEITEN + "gespraech.html?raum=" + encodeURIComponent(raum) + "&t=" + Date.now());
        } catch {
        }
        setTimeout(gespHinweisPruefen, 1500);
      } });
    } catch {
    }
  }
  function gespraechsRaeume() {
    for (const r of GESPRAECHS_RAEUME) {
      const name = "gesp-" + r.raum.replace(/\s+/g, "-");
      try {
        WA.room.area.create({ name, x: r.x * 32, y: r.y * 32, width: r.w * 32, height: r.h * 32 });
        WA.room.area.onEnter(name).subscribe(() => {
          gespRaum = r.raum;
          gespHinweisPruefen();
        });
        WA.room.area.onLeave(name).subscribe(() => {
          if (gespRaum !== r.raum) return;
          gespRaum = "";
          gespHinweisPruefen();
          try {
            gespFenster && gespFenster.close();
          } catch {
          }
          gespFenster = null;
        });
      } catch {
      }
    }
  }
  var leisteRechts = null;
  var leisteSchmal = false;
  var LEISTE_BREIT = 232;
  var LEISTE_SCHMAL = 58;
  var leisteR = 8;
  function leisteBreite() {
    return leisteRechts && leisteR <= 40 ? leisteSchmal ? LEISTE_SCHMAL : LEISTE_BREIT : 0;
  }
  async function leisteRechtsAuf() {
    if (HANDY) return;
    try {
      leisteSchmal = !!WA.player.state.swLeisteSchmal;
    } catch {
    }
    let lage = {};
    try {
      lage = WA.player.state.swLeisteRechtsLage || {};
    } catch {
    }
    const breite = leisteSchmal ? LEISTE_SCHMAL : LEISTE_BREIT, zw = (v, a, z) => Math.min(z, Math.max(a, v));
    const lr = Math.round(zw(Number(lage.r ?? 8) || 0, 0, Math.max(0, (window.outerWidth || 1600) - breite - 8))), lo = Math.round(zw(Number(lage.o ?? 72) || 0, 0, Math.max(0, (window.outerHeight || 900) * 0.45)));
    leisteR = lr;
    const alt = leisteRechts;
    leisteRechts = null;
    try {
      leisteRechts = await WA.ui.website.open({
        url: SEITEN + "leiste-rechts.html?s=" + SITZUNG + (leisteSchmal ? "&schmal=1" : "") + "&t=" + Date.now(),
        allowApi: true,
        visible: true,
        position: { vertical: "top", horizontal: "right" },
        size: { width: (leisteSchmal ? LEISTE_SCHMAL : LEISTE_BREIT) + "px", height: "48vh" },
        margin: { top: lo + "px", right: lr + "px" }
      });
    } catch {
    }
    try {
      alt && alt.close();
    } catch {
    }
    mtLage = "";
    if (mitteilungen.length) mtZeigen();
  }
  var GESPRAECH_RAUM = /^(Büro .+|Besprechung (Glas|11|1|2)|Fibu-Besprechung)$/;
  async function raumGespraeche() {
    let k;
    try {
      k = await ladeKarte();
    } catch {
      return;
    }
    const raeume = ((k.layers || []).find((l) => l.name === "floorLayer") || { objects: [] }).objects.filter((o) => GESPRAECH_RAUM.test(o.name || "") && o.width && o.height);
    const kurz = (n) => n.normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
    const flaechen = /* @__PURE__ */ new Map(), an = /* @__PURE__ */ new Map();
    for (const o of raeume) {
      try {
        flaechen.set(o.name, WA.room.area.create({ name: "raumgespraech-" + kurz(o.name), x: o.x, y: o.y, width: o.width, height: o.height }));
      } catch {
      }
    }
    try {
      await WA.players.configureTracking({ players: true, movement: true });
    } catch {
    }
    const pruefen = () => {
      let andere = [];
      try {
        const ich = String(WA.player.name || "").trim().toLowerCase();
        andere = [...WA.players.list()].filter((p) => String(p.name || "").trim().toLowerCase() !== ich);
      } catch {
      }
      for (const o of raeume) {
        const a = flaechen.get(o.name);
        if (!a) continue;
        const drin = aktuellerBereich === o.name && !gesperrt && andere.some((p) => p.position && p.position.x >= o.x && p.position.x < o.x + o.width && p.position.y >= o.y && p.position.y < o.y + o.height);
        if (an.get(o.name) === drin) continue;
        an.set(o.name, drin);
        try {
          a.setProperty("jitsiRoom", drin ? "sw-" + kurz(o.name) : void 0);
        } catch {
        }
      }
    };
    setInterval(pruefen, 1500);
  }
  var zimmerLeiste = null;
  var zimmerId = "";
  var zimmerRaum = "";
  var zimmerHinweis = null;
  var zimmerZurueck = null;
  var zimmerAndere = /* @__PURE__ */ new Set();
  var istBueroRaum = (n) => !!n && /^(Büro\s+|Zimmer\s+\d+$)/i.test(n);
  function zimmerSagen(was, raum, id = "") {
    try {
      WA.event.broadcast("sw-zimmer", { was, raum, id, wer: WA.player.name });
    } catch {
    }
  }
  function zimmerHinweisWeg() {
    try {
      zimmerHinweis && zimmerHinweis.remove();
    } catch {
    }
    zimmerHinweis = null;
  }
  function zimmerHinweisPruefen() {
    const raum = aktuellerBereich;
    if (!istBueroRaum(raum) || zimmerId || !zimmerAndere.size || gesperrt) return zimmerHinweisWeg();
    if (zimmerHinweis) return;
    const mit = [...zimmerAndere].map((n) => n.split(/\s+/)[0]).join(", ");
    try {
      zimmerHinweis = klickHinweis({ message: `\u{1F4AC} Gespr\xE4ch mit ${mit} f\xFChren`, callback: () => {
        zimmerHinweis = null;
        glasFenster(SEITEN + "gespraech.html?zimmer=1&raum=" + encodeURIComponent(String(raum)) + "&t=" + Date.now());
        setTimeout(zimmerHinweisPruefen, 1500);
      } });
    } catch {
    }
  }
  async function zimmerLeisteAuf(id, raum, weiter = false, hoch = false) {
    if (zimmerLeiste) {
      try {
        zimmerLeiste.close();
      } catch {
      }
    }
    zimmerId = id;
    zimmerRaum = raum;
    zimmerHinweisWeg();
    gespHinweisPruefen();
    try {
      zimmerLeiste = await WA.ui.website.open({
        url: SEITEN + "zimmer-leiste.html?id=" + encodeURIComponent(id) + "&raum=" + encodeURIComponent(raum) + (weiter ? "&weiter=1" : "") + (hoch ? "&hoch=1" : "") + "&t=" + Date.now(),
        allowApi: true,
        allowPolicy: "microphone",
        visible: true,
        position: { vertical: "bottom", horizontal: "middle" },
        size: { width: HANDY ? Math.round((screen.width || 390) - 20) + "px" : "560px", height: hoch ? "200px" : "50px" },
        margin: { bottom: HANDY ? "160px" : "64px" }
      });
    } catch {
    }
  }
  function zimmerLeisteZu() {
    if (zimmerLeiste) {
      try {
        zimmerLeiste.close();
      } catch {
      }
    }
    zimmerLeiste = null;
    zimmerId = "";
    zimmerRaum = "";
    zimmerHinweisPruefen();
    gespHinweisPruefen();
  }
  function zimmerAbschluss(id) {
    glasFenster(SEITEN + "gespraech.html?id=" + encodeURIComponent(id) + "&abschluss=1&t=" + Date.now());
  }
  function zimmerBetreten(raum) {
    zimmerAndere.clear();
    zimmerHinweisWeg();
    if (!istBueroRaum(raum)) return;
    zimmerSagen("rein", raum);
    if (zimmerZurueck && zimmerZurueck.raum === raum && Date.now() - zimmerZurueck.t < 3 * 60 * 1e3) {
      const id = zimmerZurueck.id;
      zimmerZurueck = null;
      try {
        glasOffen && glasOffen.handle && glasOffen.handle.close();
      } catch {
      }
      glasOffen = null;
      zimmerLeisteAuf(id, raum, true);
      zimmerSagen("start", raum, id);
    }
  }
  function zimmerVerlassen(raum) {
    if (!istBueroRaum(raum)) {
      if (zimmerId && zimmerRaum === raum) zimmerLeisteZu();
      return;
    }
    zimmerSagen("raus", raum);
    zimmerAndere.clear();
    zimmerHinweisWeg();
    if (zimmerId && zimmerRaum === raum) {
      const id = zimmerId;
      zimmerLeiste && (() => {
        try {
          zimmerLeiste.close();
        } catch {
        }
      })();
      zimmerLeiste = null;
      zimmerId = "";
      zimmerRaum = "";
      zimmerZurueck = { id, raum, t: Date.now() };
      zimmerSagen("ende", raum, id);
      zimmerAbschluss(id);
    }
  }
  var ZIMMER_AKTIONEN = {
    zimmerLeiste: (v) => {
      try {
        glasOffen && glasOffen.handle && glasOffen.handle.close();
      } catch {
      }
      glasOffen = null;
      const raum = String(v.raum || aktuellerBereich || "");
      zimmerLeisteAuf(String(v.id), raum);
      zimmerSagen("start", raum, String(v.id));
    },
    // Besprechungsraum (21.10.2026, Sam: „dort kann man nicht mitschreiben lassen“): läuft ein Gespräch, kommt unten dieselbe Leiste mit 🎙
    // dazu, das große Fenster bleibt offen. Die anderen im Raum bekommen sie über „start“ ebenfalls.
    gespraechLeiste: (v) => {
      const id = String(v.id || ""), raum = String(v.raum || aktuellerBereich || "");
      if (!id || zimmerId === id) return;
      zimmerLeisteAuf(id, raum);
      zimmerSagen("start", raum, id);
    },
    zimmerLeisteZu: () => zimmerLeisteZu(),
    zimmerLeisteGroesse: (v) => {
      if (zimmerId) zimmerLeisteAuf(zimmerId, zimmerRaum, false, !!v.hoch);
    },
    // Glastür zum Anbau: PIN stimmte (glastuer.html) → für diese Sitzung frei, Tür auf (12.10.)
    glastuerAuf: () => {
      anbauFrei = true;
      glastuerOeffnen();
      setTimeout(() => {
        try {
          glasOffen && glasOffen.handle && glasOffen.handle.close();
        } catch {
        }
        glasOffen = null;
        const z = anbauZiel;
        anbauZiel = null;
        if (z) WA.player.moveTo(z.x, z.y, 10).catch(() => {
        });
      }, 1200);
    },
    zimmerEnde: (v) => {
      const id = String(v.id || zimmerId), raum = zimmerRaum;
      zimmerLeisteZu();
      if (raum) zimmerSagen("ende", raum, id);
      zimmerAbschluss(id);
    },
    zimmerAbschluss: (v) => {
      const id = String(v.id || zimmerId);
      zimmerLeisteZu();
      zimmerAbschluss(id);
    },
    gespraechOeffnen: (v) => glasFenster(SEITEN + "gespraech.html?id=" + encodeURIComponent(String(v.id || zimmerId)) + (v.fokus ? "&fokus=" + encodeURIComponent(v.fokus) : "") + "&t=" + Date.now())
  };
  function zimmerGespraeche() {
    try {
      WA.event.on("sw-zimmer").subscribe((ev) => {
        const d = ev && ev.data || {}, wer = String(d.wer || ""), raum = String(d.raum || "");
        if (d.was === "raus" || d.was === "ende") setTimeout(infoLaden, 1500);
        if (!wer || wer === WA.player.name || raum !== aktuellerBereich) return;
        if (d.was === "rein") {
          zimmerAndere.add(wer);
          zimmerSagen("da", raum);
          if (zimmerId && zimmerRaum === raum) zimmerSagen("start", raum, zimmerId);
        }
        if (d.was === "da") zimmerAndere.add(wer);
        if (d.was === "raus") zimmerAndere.delete(wer);
        if (d.was === "start" && d.id && !zimmerId) {
          zimmerAndere.add(wer);
          zimmerLeisteAuf(String(d.id), raum);
          kurzMeldung(`\u{1F4AC} ${wer.split(/\s+/)[0]} hat ein Gespr\xE4ch gestartet` + (istBueroRaum(raum) ? " \u2013 die Zeit l\xE4uft" : " \u2013 \u{1F399} Mitschreiben unten in der Leiste"), 5e3);
        }
        if (d.was === "ende" && d.id && zimmerId === String(d.id)) {
          const id = zimmerId;
          zimmerLeisteZu();
          zimmerAbschluss(id);
        }
        zimmerHinweisPruefen();
      });
    } catch {
    }
  }
  var GLASTUER = [[MI(88 + DX), 29 + DY], [MI(88 + DX), 30 + DY]];
  var anbauFrei = false;
  var glastuerZu = null;
  var anbauZiel = null;
  var anbauPinZuletzt = 0;
  var imAnbau = (px, py) => {
    const x = Math.floor(px / 32), y = Math.floor(py / 32);
    return x >= MI(89 + DX) && x <= MI(113 + DX) && y >= 3 + DY && y <= 33 + DY;
  };
  function glastuer(offen) {
    try {
      WA.room.setTiles(GLASTUER.flatMap(([x, y]) => [{ x, y, tile: offen ? null : kollisionGid, layer: "collisions" }, { x, y, tile: offen ? null : 4104, layer: "walls1" }]));
    } catch {
    }
  }
  function glastuerOeffnen(ms = 15e3) {
    glastuer(true);
    clearTimeout(glastuerZu);
    const zu = async () => {
      try {
        const p = await WA.player.getPosition(), fx2 = Math.floor(p.x / 32), fy = Math.floor(p.y / 32);
        if (fx2 >= MI(87 + DX) && fx2 <= MI(89 + DX) && fy >= 28 + DY && fy <= 31 + DY) {
          glastuerZu = setTimeout(zu, 3e3);
          return;
        }
      } catch {
      }
      glastuer(false);
    };
    glastuerZu = setTimeout(zu, ms);
  }
  function glaswandAgenten() {
    leertasteBereich(
      "glastuer-aussen",
      { x: MI(85 + DX), y: 28 + DY, w: 3, h: 4 },
      () => anbauFrei ? "\u{1F6AA} Leertaste: Glast\xFCr \xF6ffnen" : "\u{1F512} Bereich der KI-Agenten \xB7 Leertaste: PIN eingeben",
      () => {
        if (anbauFrei) glastuerOeffnen();
        else glasFenster(SEITEN + "glastuer.html?t=" + Date.now());
      }
    );
    leertasteBereich("glastuer-innen", { x: MI(89 + DX), y: 28 + DY, w: 3, h: 4 }, "\u{1F6AA} Leertaste: Glast\xFCr \xF6ffnen", () => glastuerOeffnen());
    WA.player.onPlayerMove((e) => {
      if (anbauFrei || !imAnbau(e.x, e.y)) return;
      anbauZiel = { x: e.x, y: e.y };
      WA.player.teleport((86 + DX) * 32 + 16, (29 + DY) * 32 + 16);
      if (Date.now() - anbauPinZuletzt > 5e3) {
        anbauPinZuletzt = Date.now();
        glasFenster(SEITEN + "glastuer.html?t=" + Date.now());
      }
      kurzMeldung("\u{1F512} Bereich der KI-Agenten \u2013 bitte die PIN eingeben", 6e3);
    });
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
    leertasteBereich("kueche-kuehlschrank", { x: MI(67 + DX), y: 37 + DY, w: 4, h: 1 }, "\u{1F9CA} K\xFChlschrank \xF6ffnen \xB7 Leertaste", () => los("kuehlschrank"));
    leertasteBereich("kueche-herd", { x: MI(75 + DX), y: 37 + DY, w: 3, h: 1 }, "\u{1F373} Spiegelei braten \xB7 Leertaste", () => los("herd"));
    leertasteBereich("kueche-kaffee", { x: MI(81 + DX), y: 36 + DY, w: 2, h: 4 }, "\u2615 Kaffee holen \xB7 Leertaste", () => {
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
      ton("klingel", "eingang");
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
      WA.room.area.create({ name: "eingang-klingel", x: (43 + DX) * 32, y: (52 + DY) * 32, width: 4 * 32, height: 2 * 32 });
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
    if (HANDY) return;
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
          const name = String(p.name || ""), vn = name.split(/\s+/)[0], raum = aktuellerBereich;
          if (raum) p.addAction(`\u{1F4E8} In \u201E${raum}\u201C einladen`, () => einladen(name, raum));
          p.addAction(`\u{1F6B6} Ich komme zu ${vn}`, () => unterwegsZu(name));
        } catch {
        }
      });
    } catch {
    }
    einladungenHoeren();
  }
  function einladen(an, raum) {
    try {
      WA.event.broadcast("sw-einladung", { an, von: WA.player.name, raum });
    } catch {
    }
    mitteilung({ art: "info", von: an, kurz: "ist eingeladen", text: `Einladung in \u201E${raum}\u201C an ${an.split(/\s+/)[0]} gesendet.` }, 1e4);
  }
  function unterwegsZu(an) {
    try {
      WA.event.broadcast("sw-unterwegs", { an, von: WA.player.name, raum: aktuellerBereich || "" });
    } catch {
    }
    mitteilung({ art: "info", von: an, kurz: "wei\xDF Bescheid", text: `${an.split(/\s+/)[0]} sieht, dass du unterwegs bist.` }, 8e3);
    zuPerson(an);
  }
  function auchAlsPush(von, text) {
    fetch(ENDPOINT.replace(/melden$/, "chat-eingang"), { method: "POST", headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY }, body: JSON.stringify({ name: WA.player.name, von, text: text.slice(0, 300) }) }).catch(() => {
    });
  }
  function einladungenHoeren() {
    const fuerMich = (d) => d && String(d.an || "").toLowerCase() === String(WA.player.name || "").toLowerCase();
    try {
      WA.event.on("sw-einladung").subscribe((ev) => {
        const d = ev.data || {};
        if (!fuerMich(d)) return;
        mitteilung({ art: "einladung", von: d.von, raum: d.raum, text: `in \u201E${d.raum}\u201C` }, 5 * 6e4);
        auchAlsPush(d.von, `\u{1F4E8} l\xE4dt dich ein in \u201E${d.raum}\u201C`);
      });
      WA.event.on("sw-einladung-antwort").subscribe((ev) => {
        const d = ev.data || {};
        if (!fuerMich(d)) return;
        mitteilung({ art: "info", von: d.von, kurz: d.ja ? "hat angenommen \u2013 ist unterwegs" : "kommt sp\xE4ter", text: d.ja ? `${String(d.von).split(/\s+/)[0]} kommt zu dir${d.raum ? " in \u201E" + d.raum + "\u201C" : ""}.` : "" }, 3e4);
      });
      WA.event.on("sw-unterwegs").subscribe((ev) => {
        const d = ev.data || {};
        if (!fuerMich(d)) return;
        mitteilung({ art: "info", von: d.von, kurz: "ist unterwegs zu dir", text: `${String(d.von).split(/\s+/)[0]} m\xF6chte mit dir sprechen und kommt gerade zu dir.` }, 6e4);
        auchAlsPush(d.von, "\u{1F6B6} ist unterwegs zu dir");
      });
    } catch {
    }
  }
  async function zuPerson(name) {
    try {
      await WA.players.configureTracking({ players: true, movement: true });
      const p = [...WA.players.list()].find((x) => String(x.name || "").toLowerCase() === name.toLowerCase());
      if (p && p.position) {
        await WA.player.moveTo(p.position.x, p.position.y + 32, 10);
        return;
      }
    } catch {
    }
    kurzMeldung("\u{1F6B6} " + name.split(/\s+/)[0] + " ist gerade nicht im B\xFCro", 5e3);
  }
  async function zuRaum(ort) {
    try {
      const k = await ladeKarte(), q = ort.toLowerCase().trim();
      const alle = ((k.layers || []).find((l) => l.name === "floorLayer") || { objects: [] }).objects.filter((o) => o.name && o.width && o.height);
      const r = alle.find((o) => o.name.toLowerCase() === q) || alle.find((o) => q.includes(o.name.toLowerCase()) || o.name.toLowerCase().includes(q));
      if (r) {
        kurzMeldung("\u{1F6B6} Unterwegs zu " + r.name, 4e3);
        await WA.player.moveTo(r.x + r.width / 2, r.y + r.height / 2, 10);
        return;
      }
    } catch {
    }
    kurzMeldung("\u{1F4CD} \u201E" + ort + "\u201C ist kein Raum im B\xFCro", 5e3);
  }
  var SCHILD_PERSON = {
    "Zimmer 1": "Tanja R.",
    "Zimmer 2": "Christiane S.",
    "Zimmer 3": "Jana J.",
    "Zimmer 4": "Kubilay A.",
    "Zimmer 5": "Bin W.",
    "Zimmer 6": "Onur K.",
    "Zimmer 7": "Dilber A.",
    "Zimmer 8": "Fatih K.",
    "Zimmer 9": "Kerstin C.",
    "Zimmer 10": "Angelika T.",
    "Zimmer 11": "",
    "Zimmer 12": "",
    "Zimmer 13": "Ilona S.",
    "Zimmer 14": "Julien M.",
    "Zimmer 15": "Bahjat D.",
    "Zimmer 16": "",
    "B\xFCro Leutrim": "Leutrim S.",
    "B\xFCro Katharina": "Katharina K.",
    "B\xFCro Ferhat": "Ferhat F.",
    "B\xFCro Angelina": "Angelina M.",
    "B\xFCro Sam": "Sam J.",
    "B\xFCro Noura": "Noura A.",
    "B\xFCro Emre": "Emre A.",
    "B\xFCro Kadir": "Kadir K.",
    "B\xFCro Attila": "Attila K."
  };
  if (true) Object.assign(SCHILD_PERSON, { "Zimmer 1": "", "Zimmer 2": "", "B\xFCro Tanja": "Tanja R.", "B\xFCro Jana": "Jana J.", "B\xFCro Kubilay": "Kubilay A.", "B\xFCro Kerstin": "Kerstin C.", "B\xFCro Angelika": "Angelika T.", "B\xFCro Onur": "Onur K.", "B\xFCro Bin": "Bin W.", "B\xFCro Fatih": "Fatih K.", "B\xFCro Dilber": "Dilber A.", "B\xFCro Ilona": "Ilona S.", "B\xFCro Julien": "Julien M.", "B\xFCro Dalo": "Dalo" });
  var schilder = /* @__PURE__ */ new Map();
  function schildStatus(t) {
    {
      const wer = t.offen ? zimmerDaten(t).wer : t.besitzer;
      if (wer && telefoniertGerade(wer)) return "tel";
    }
    if (t.offen ? zimmerDaten(t).s === "zu" : tuerStatus(t) === "fokus") return "fokus";
    return aktuellerBereich === t.raum || (info.belegt || []).includes(t.raum) ? "da" : "weg";
  }
  var schildUrl = (t, n, st) => SEITEN + "schild.html?v=4&n=" + encodeURIComponent(n) + "&raum=" + encodeURIComponent(t.raum) + "&s=" + st;
  async function namensschilder() {
    if (true) return;
    if (HANDY) return;
    for (const t of tueren) {
      const [rx, ry, rw] = t.rechteck, n = t.raum in SCHILD_PERSON ? SCHILD_PERSON[t.raum] : t.besitzer ? t.besitzer.charAt(0).toUpperCase() + t.besitzer.slice(1) : "";
      const st = schildStatus(t);
      void rw;
      try {
        const h = await WA.room.website.create({
          name: "schild-" + t.variable,
          url: schildUrl(t, n, st),
          visible: true,
          allowApi: false,
          origin: "map",
          scale: 1,
          position: { x: Math.round((rx + 0.05) * 32), y: Math.round((ry - 2.35) * 32), width: 46, height: 16 }
        });
        schilder.set(t.variable, { h, n, s: st });
      } catch {
      }
    }
  }
  function schilderAktualisieren() {
    if (true) return;
    for (const t of tueren) {
      const x = schilder.get(t.variable);
      if (!x) continue;
      const st = schildStatus(t);
      if (st === x.s) continue;
      x.s = st;
      try {
        x.h.url = schildUrl(t, x.n, st);
      } catch {
      }
    }
  }
  var grundrissOeffnet = false;
  var grundriss = null;
  var grundrissAn = true;
  var imGespraech = false;
  var arbeitenOffen = false;
  async function grundrissZeigen() {
    if (!HANDY) return;
    const soll = grundrissAn && !imGespraech && !gesperrt && !arbeitenOffen;
    if (!soll) {
      if (grundriss) {
        try {
          grundriss.close();
        } catch {
        }
        grundriss = null;
      }
      return;
    }
    if (grundriss || grundrissOeffnet) return;
    grundrissOeffnet = true;
    try {
      grundriss = await WA.ui.website.open({
        url: SEITEN + "app.html?v=6",
        allowApi: true,
        visible: true,
        position: { vertical: "top", horizontal: "left" },
        size: { width: Math.round(screen.width || 390) + "px", height: "100vh" },
        margin: { top: "0px", left: "0px" }
      });
    } catch {
      grundriss = null;
    }
    grundrissOeffnet = false;
    if (grundriss && !(grundrissAn && !imGespraech && !gesperrt && !arbeitenOffen)) {
      try {
        grundriss.close();
      } catch {
      }
      grundriss = null;
    }
  }
  function grundrissUmschalten(an) {
    grundrissAn = an === void 0 ? !grundrissAn : an;
    mtLage = "";
    if (grundrissAn) {
      try {
        mtFenster && mtFenster.close();
      } catch {
      }
      mtFenster = null;
    } else setTimeout(() => mtZeigen(), 600);
    try {
      WA.player.state.saveVariable("swGrundriss", grundrissAn, { public: false, persist: true });
    } catch {
    }
    grundrissZeigen();
    klassikPruefen();
  }
  var klassik = [];
  var klassikOeffnen = null;
  var klassikOffen = false;
  async function klassikPruefen() {
    if (!HANDY) return;
    const soll = !grundrissAn;
    if (soll && !klassikOffen) {
      klassikOffen = true;
      try {
        klassikOeffnen && await klassikOeffnen();
      } catch {
      }
      try {
        klassik.push(await WA.ui.website.open({ url: SEITEN + "handy-menue.html?v=4&appknopf=1", allowApi: true, visible: true, position: { vertical: "top", horizontal: "middle" }, size: { width: "120px", height: "40px" }, margin: { top: "64px" } }));
      } catch {
      }
    }
    if (!soll && klassikOffen) {
      klassikOffen = false;
      klassik.splice(0).forEach((h) => {
        try {
          h.close();
        } catch {
        }
      });
    }
  }
  async function arbeitenAuf() {
    handyBlattZu();
    arbeitenOffen = true;
    grundrissZeigen();
    try {
      glasOffen && glasOffen.handle && glasOffen.handle.close();
    } catch {
    }
    glasOffen = null;
    try {
      const h = await WA.ui.website.open({
        url: SEITEN + "handy.html?imBuero=1&t=" + Date.now(),
        allowApi: true,
        visible: true,
        position: { vertical: "top", horizontal: "middle" },
        size: { width: Math.round(screen.width || 390) + "px", height: "78vh" },
        margin: { top: "104px" }
      });
      handyBlatt = { name: "arbeiten", h };
    } catch {
      arbeitenOffen = false;
      grundrissZeigen();
    }
  }
  function arbeitenZu() {
    if (handyBlatt && handyBlatt.name === "arbeiten") handyBlattZu();
    arbeitenOffen = false;
    grundrissZeigen();
  }
  async function grundrissRaum(name) {
    const t = tueren.find((x) => x.raum === name);
    if (t && t.draussen) {
      WA.player.teleport(t.draussen[0] * 32 + 16, t.draussen[1] * 32 + 16);
      if (tuerStatus(t) === "frei" || istBesitzer(t)) {
        const [rx, ry, rw, rh] = t.rechteck;
        setTimeout(() => WA.player.moveTo((rx + rw / 2) * 32, (ry + rh / 2) * 32, 10).catch(() => {
        }), 300);
      }
      return;
    }
    zuRaum(name);
  }
  async function grundrissPerson(name) {
    try {
      const p = [...WA.players.list()].find((x) => String(x.name || "") === name);
      if (p && p.position) {
        WA.player.teleport(p.position.x, p.position.y + 32);
        return;
      }
    } catch {
    }
    kurzMeldung("\u{1F6B6} " + name.split(/\s+/)[0] + " ist gerade nicht im B\xFCro", 5e3);
  }
  var raumVon = (px, py) => {
    const fx2 = px / 32, fy = py / 32;
    const t = tueren.find((x) => {
      const [rx, ry, rw, rh] = x.rechteck;
      return fx2 >= rx && fx2 < rx + rw && fy >= ry && fy < ry + rh;
    });
    return t ? t.raum : "";
  };
  function wandGespraeche() {
    let aus = false;
    const c = WA.controls;
    if (!c.disablePlayerProximityMeeting) return;
    try {
      WA.players.configureTracking({ players: true, movement: true });
    } catch {
    }
    setInterval(async () => {
      if (gesperrt) return;
      try {
        const ich = await WA.player.getPosition(), meinRaum = raumVon(ich.x, ich.y);
        const nah = [...WA.players.list()].filter((p) => p.position && Math.hypot(p.position.x - ich.x, p.position.y - ich.y) < 160);
        const fremd = nah.filter((p) => raumVon(p.position.x, p.position.y) !== meinRaum);
        const sperren = fremd.length > 0 && fremd.length === nah.length;
        if (sperren && !aus) {
          aus = true;
          c.disablePlayerProximityMeeting();
        } else if (!sperren && aus) {
          aus = false;
          c.restorePlayerProximityMeeting();
        }
      } catch {
      }
    }, 700);
  }
  var terminGezeigt = /* @__PURE__ */ new Map();
  var terminHinweis = null;
  function raumFuerOrt(ort) {
    const q = String(ort || "").toLowerCase().trim();
    if (!q || !karte) return null;
    const alle = ((karte.layers || []).find((l) => l.name === "floorLayer") || { objects: [] }).objects.filter((o) => o.name && o.width && o.height);
    const r = alle.find((o) => o.name.toLowerCase() === q) || alle.find((o) => q.includes(o.name.toLowerCase()) || o.name.toLowerCase().includes(q));
    return r ? r.name : null;
  }
  function termineErinnern(liste) {
    if (gesperrt) return;
    const jetzt = hm(/* @__PURE__ */ new Date());
    const minBis = (z) => {
      const [h, m] = String(z).split(":").map(Number), n = /* @__PURE__ */ new Date();
      return h * 60 + m - (n.getHours() * 60 + n.getMinutes());
    };
    for (const t of liste) {
      const schon = terminGezeigt.get(t.id) || /* @__PURE__ */ new Set();
      terminGezeigt.set(t.id, schon);
      const raum = raumFuerOrt(t.ort), dort = !!raum && aktuellerBereich === raum, rest = minBis(t.von);
      const stufe = t.von > jetzt && rest <= 5 ? "vorher" : t.von <= jetzt && !dort ? "beginn" : "";
      if (!stufe || schon.has(stufe)) continue;
      schon.add(stufe);
      if (stufe === "beginn" && !raum) continue;
      try {
        terminHinweis && terminHinweis.remove();
      } catch {
      }
      const text = (stufe === "vorher" ? `\u{1F4C5} In ${Math.max(1, rest)} Min: ` : "\u{1F4C5} Dein Termin hat begonnen: ") + t.titel + (t.ort ? " \xB7 " + t.ort : "") + (raum && !dort ? " \xB7 Leertaste = hinlaufen" : "");
      if (!HANDY) {
        mitteilung({ art: "termin", titel: (stufe === "vorher" ? "In " + Math.max(1, rest) + " Min: " : "Hat begonnen: ") + t.titel, text: t.ort ? "\u{1F4CD} " + t.ort : "", raum: raum && !dort ? raum : "" });
        continue;
      }
      ton("klingel");
      terminHinweis = WA.ui.displayActionMessage({ message: text, callback: () => {
        terminHinweis = null;
        if (raum && aktuellerBereich !== raum) zuRaum(raum);
      } });
      const h = terminHinweis;
      setTimeout(() => {
        try {
          if (terminHinweis === h) {
            h.remove();
            terminHinweis = null;
          }
        } catch {
        }
      }, 6e4);
      try {
        WA.ui.banner.openBanner({ id: "sw-termin", text, bgColor: "#1d4ed8", textColor: "#ffffff", closable: true, timeToClose: 3e4 });
      } catch {
      }
    }
  }
  var FUSSBALL = {
    tore: [
      { name: "platz-tor-oben", x: MI(172 + DX), y: 5 + DY, w: 13, h: 6 },
      { name: "platz-tor-unten", x: MI(172 + DX), y: 34 + DY, w: 13, h: 6 },
      { name: "bolzplatz-tor-oben", x: MI(198 + DX), y: 5 + DY, w: 7, h: 4 },
      { name: "bolzplatz-tor-unten", x: MI(198 + DX), y: 23 + DY, w: 7, h: 4 }
    ],
    vereinsheim: { x: MI(194 + DX), y: 38 + DY, w: 14, h: 2 }
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
  function ronPlatz() {
    let fenster = null;
    leertasteBereich("ron-platz", { x: MI(106 + DX), y: 31 + 14, w: 2, h: 2 }, "\u{1F4AC} Ron \xB7 Onboarding \u2013 Leertaste", async () => {
      try {
        fenster = await glasFenster(SEITEN + "ron.html?t=" + Date.now());
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
  function novaPlatz() {
    if (vorname(WA.player.name) !== "sam") return;
    let fenster = null;
    leertasteBereich("nova-platz", { x: 12, y: 27, w: 3, h: 3 }, "\u{1F4AC} NOVA \xB7 deine Assistentin \u2013 Leertaste", async () => {
      try {
        fenster = await glasFenster(SEITEN + "nova.html?t=" + Date.now());
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
  function itPlatz() {
    [["rengid", "Rengid \xB7 IT-Agent", 94], ["olga", "Olga \xB7 IT", 96]].forEach(([k, t, x]) => {
      let fenster = null;
      leertasteBereich("it-" + k + "-platz", { x: x + DX, y: 19 + DY, w: 2, h: 2 }, "\u{1F4AC} " + t + " \u2013 Leertaste", async () => {
        try {
          fenster = await glasFenster(SEITEN + "it-status.html?agent=" + k + "&t=" + Date.now());
        } catch {
        }
      }, () => {
        try {
          fenster && fenster.close();
        } catch {
        }
        fenster = null;
      });
    });
  }
  function jaPlatz() {
    let fenster = null;
    leertasteBereich("ja-abschluss-platz", { x: MI(92 + DX), y: 8 + DY, w: 2, h: 2 }, "\u{1F4AC} Harvey \xB7 Abschluss-Agent \u2013 Leertaste", async () => {
      try {
        fenster = await glasFenster(SEITEN + "ja-team.html?t=" + Date.now());
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
  function utePlatz() {
    let fenster = null;
    leertasteBereich("ute-platz", { x: MI(51 + DX) - (true ? 4 : 0), y: 6 + 14, w: 6, h: 2 }, "\u{1F5D3} Termine mit Donna \u2013 Leertaste: freie Zeiten finden und buchen", async () => {
      try {
        fenster = await glasFenster(SEITEN + "ute.html?t=" + Date.now());
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
  function minaPlatz() {
    [["leon", "Leon \xB7 Recherche", 104], ["mina", "Mina \xB7 Social Media", 106], ["sophie", "Sophie \xB7 Content", 108]].forEach(([k, t, x]) => {
      let fenster = null;
      leertasteBereich(k + "-platz", { x: x + DX, y: 8 + DY, w: 2, h: 2 }, "\u{1F4AC} " + t + " \u2013 Leertaste zum Sprechen", async () => {
        try {
          fenster = await glasFenster(SEITEN + "mina.html?agent=" + k + "&t=" + Date.now());
        } catch {
        }
      }, () => {
        try {
          fenster && fenster.close();
        } catch {
        }
        fenster = null;
      });
    });
  }
  var AMPEL_START = Date.now();
  var AMPEL_KREUZUNGEN = [{ x: MI(115 + DX), y: 67 + DY, sv: 4, sh: 6 }, { x: MI(115 + DX), y: 84 + DY, sv: 4, sh: 4 }];
  var editorAn = null;
  function editorPruefen() {
    if (!Array.isArray(info.editoren)) return;
    const soll = info.editoren.includes(vorname(WA.player.name));
    if (soll === editorAn) return;
    editorAn = soll;
    try {
      const c = WA.controls;
      soll ? c.restoreMapEditor?.() : c.disableMapEditor?.();
    } catch {
    }
  }
  async function infoLaden() {
    try {
      info = await (await fetch(INFO, { headers: { "X-Buero-Key": BUERO_KEY } })).json();
    } catch {
      return;
    }
    try {
      const mt = tueren.find((x) => !x.offen && x.besitzer.toLowerCase() === vorname(WA.player.name));
      const iz = !!(mt && immerZu(mt));
      if (WA.player.state.swTuerImmerZu !== iz) WA.player.state.saveVariable("swTuerImmerZu", iz, { public: false, persist: false });
    } catch {
    }
    editorPruefen();
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
      if (HANDY) return;
      const v = String(WA.player.name || "").split(/\s+/)[0], h = (/* @__PURE__ */ new Date()).getHours();
      const gruss = h < 11 ? "Guten Morgen" : h < 17 ? "Hallo" : "Guten Abend";
      const teile2 = [];
      if ((info.geburtstage || []).some((n) => n.toLowerCase() === v.toLowerCase())) teile2.push("\u{1F389} Alles Gute zum Geburtstag!");
      const andere = (info.geburtstage || []).filter((n) => n.toLowerCase() !== v.toLowerCase());
      if (andere.length) teile2.push(`\u{1F382} ${andere.join(", ")} ${andere.length === 1 ? "hat" : "haben"} heute Geburtstag`);
      if ((info.reservierungen || []).length) teile2.push(`\u{1F4C5} ${info.reservierungen.length} Raum-Reservierung${info.reservierungen.length === 1 ? "" : "en"} heute`);
      kurzMeldung(`${gruss} ${v}! ` + (teile2.join(" \xB7 ") || "Sch\xF6n, dass du da bist."), 9e3);
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
      bereit.then(() => zimmerBetreten(name));
      zimmerRein(name);
    });
    api.onLeave(name).subscribe(() => {
      if (aktuellerBereich === name) aktuellerBereich = null;
      bereit.then(() => melden("betreten"));
      effekte();
      zimmerVerlassen(name);
      zimmerRaus(name);
    });
  }
  var chatOffen = false;
  function chatZu() {
    try {
      WA.chat.close();
    } catch {
    }
    chatOffen = false;
  }
  function chatUmschalten() {
    if (chatOffen) return chatZu();
    if (HANDY) {
      chatZu();
      return handyBlattUmschalten("team", SEITEN + "wer.html?sheet=1&t=" + Date.now(), "78vh");
    }
    try {
      WA.chat.open();
      chatOffen = true;
    } catch {
    }
  }
  function feierabendOeffnen() {
    glasFenster(SEITEN + "kernzeit.html?feierabend=1&t=" + Date.now());
  }
  function kernzeitStarten() {
    let zuletzt = 0;
    const pruefen = async () => {
      if (gesperrt || Date.now() - zuletzt < 30 * 60 * 1e3) return;
      try {
        const r = await fetch(ENDPOINT.replace(/melden$/, "kernzeit/hinweis"), { method: "POST", headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY }, body: JSON.stringify({ name: WA.player.name, kurzZuvor: (() => {
          try {
            const v = Number(WA.player.state.swSchlossZeit || 0);
            return v > 0 && Date.now() - v < 5 * 60 * 1e3;
          } catch {
            return false;
          }
        })() }) });
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
  var HANDY_OFFEN_MS = 12 * 3600 * 1e3;
  var schlossOffen = () => {
    try {
      if (HANDY && Date.now() - Number(localStorage.getItem("swHandyOffen") || 0) < HANDY_OFFEN_MS) return true;
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
    try {
      if (an && HANDY) localStorage.setItem("swHandyOffen", String(Date.now()));
      else if (!an) localStorage.removeItem("swHandyOffen");
    } catch {
    }
    try {
      WA.player.state.saveVariable("swSchlossZeit", an ? Date.now() : 0, { public: false, persist: true });
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
    const sperrWache = setTimeout(() => {
      if (gesperrt && !beendet) {
        beendet = true;
        rausZu(SEITEN + "weg.html?grund=gesperrt");
      }
    }, 10 * 60 * 1e3);
    try {
      WA.ui.modal.closeModal();
    } catch {
    }
    WA.ui.website.getAll().then((alle) => alle.forEach((w) => {
      if (!/leiste-rechts\.html|push-start\.html\?pflicht|info\.html|leiste\.html|schloss\.html|tagescheck\.html\?karte|oben\.html\?v|oben\.html\?alle|handy-menue\.html\?knopf/.test(String(w.url || ""))) w.close().catch(() => {
      });
    })).catch(() => {
    });
    return new Promise((fertig) => {
      let fenster = null, abo = null;
      try {
        abo = WA.player.state.onVariableChange("swSchloss").subscribe((v) => {
          if (!v || v.sitzung !== SITZUNG) return;
          clearTimeout(sperrWache);
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
          grundriss = null;
          grundrissZeigen();
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
    schlossMerken(false);
    rausZu(SEITEN + "weg.html");
  }
  function schlossWache() {
    setInterval(async () => {
      if (HANDY && !gesperrt && !beendet) schlossMerken(true);
      if (gesperrt || HANDY) return;
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
    try {
      if (WA.room.hashParameters && WA.room.hashParameters.handy) HANDY = true;
    } catch {
    }
    try {
      const h = WA.room.hashParameters || {};
      if (HANDY && !h.karte && !h.ziel) {
        beendet = true;
        rausZu(SEITEN + "handy.html?von=start");
        return;
      }
    } catch {
    }
    try {
      const c = WA.controls;
      c.disableInviteButton?.();
      c.disableInviteUserButton?.();
      c.disableMapEditor?.();
    } catch {
    }
    if (HANDY) try {
      WA.ui.displayActionMessage = handyHinweis;
    } catch {
    }
    else hinweiseUeberwachen();
    const frisch = async () => {
      try {
        const r = await fetch(ENDPOINT.replace(/melden$/, "ausweis/frisch"), { method: "POST", headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY }, body: JSON.stringify({ name: WA.player.name }) });
        const d = await r.json();
        if (d.token) ausweisWeitergeben(d.token);
        return !!d.frisch;
      } catch {
        return false;
      }
    };
    if (!schlossOffen()) {
      if (await frisch()) schlossMerken(true);
      else await schliessen();
    }
    if (!gesperrt && await ausweisPruefen() === "fehlt" && !gesperrt) await schliessen();
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
    namensschilder();
    try {
      const z = WA.room.hashParameters && WA.room.hashParameters.ziel;
      if (z) {
        const t = tueren.find((x) => x.raum === z);
        if (t && t.draussen) {
          WA.player.teleport(t.draussen[0] * 32 + 16, t.draussen[1] * 32 + 16);
          kurzMeldung("\u{1F6AA} Du stehst vor " + z + " \u2013 Leertaste = anklopfen, sonst einfach reingehen", 7e3);
        } else zuRaum(String(z));
      }
    } catch {
    }
    let kzAktiv = false, tcAktiv = false, chatDarf = false;
    try {
      const r = await fetch(ENDPOINT.replace(/melden$/, "kernzeit/hinweis"), { method: "POST", headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY }, body: JSON.stringify({ name: WA.player.name }) });
      const h = await r.json();
      kzAktiv = !!h.aktiv;
      tcAktiv = !!h.tc;
    } catch {
    }
    try {
      const r = await fetch(ENDPOINT.replace(/melden$/, "chat/darf"), { method: "POST", headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY }, body: JSON.stringify({ name: WA.player.name }) });
      chatDarf = !!(await r.json()).darf;
    } catch {
    }
    if (tcAktiv && !HANDY) {
      try {
        await WA.ui.website.open({ url: SEITEN + "tagescheck.html?karte=1&v=3", allowApi: true, visible: true, position: { vertical: "top", horizontal: "left" }, size: { width: "280px", height: "150px" }, margin: { top: "64px", left: "10px" } });
      } catch {
      }
    }
    teileLaden();
    effekte();
    setInterval(effekte, 6e4);
    if (!HANDY) wetterTakt();
    if (HANDY) aussenweltAus();
    infoLaden();
    setInterval(infoLaden, 15e3);
    let klassikLeiste = null;
    if (HANDY) {
      klassikOeffnen = async () => {
        try {
          klassik.push(await WA.ui.website.open({
            url: SEITEN + "info.html?v=7&teil=status" + (kzAktiv ? "&kz=1" : ""),
            allowApi: true,
            visible: true,
            position: { vertical: "top", horizontal: "left" },
            size: { width: "150px", height: "36px" },
            margin: { top: "64px", left: "12px" }
          }));
        } catch {
        }
        if (meineTuer()) try {
          klassik.push(await WA.ui.website.open({
            url: SEITEN + "info.html?v=7&teil=tuer",
            allowApi: true,
            visible: true,
            position: { vertical: "top", horizontal: "right" },
            size: { width: "92px", height: "36px" },
            margin: { top: "64px", right: "12px" }
          }));
        } catch {
        }
        try {
          klassik.push(await WA.ui.website.open({
            url: SEITEN + "blick.html?teil=karte&v=6",
            allowApi: true,
            visible: true,
            position: { vertical: "bottom", horizontal: "right" },
            size: { width: "130px", height: "99px" },
            margin: { bottom: "158px", right: "14px" }
          }));
        } catch {
        }
        if (klassikLeiste) await klassikLeiste();
      };
    } else try {
      infoLeiste = await WA.ui.website.open({
        url: "https://samjabbar90.github.io/sw-buero/info.html?v=8&flach=1" + (kzAktiv ? "&kz=1" : ""),
        allowApi: true,
        visible: true,
        // genau so groß wie die Leiste (kein weißer Rand): mit eigener Tür breiter (Tür + Fokus), sonst nur Uhrzeit + Kollegen
        position: { vertical: HANDY ? "top" : "bottom", horizontal: "middle" },
        size: { width: HANDY ? Math.max(300, (screen.width || 390) - 16) + "px" : 520 + (meineTuer() ? 170 : 0) + (kzAktiv ? 160 : 0) + "px", height: HANDY ? "40px" : "38px" },
        margin: HANDY ? { top: "64px" } : { bottom: LEISTE_UNTEN }
      });
    } catch {
    }
    glasBeobachten();
    ideen();
    if (!HANDY) posterAufhaengen();
    helpcenterRoboter();
    lernzimmer();
    if (false) fitnessEmpfang();
    if (false) ranglistenTafel();
    kueche();
    zitatTafel();
    schaufenster();
    dankeWand();
    gespraechsRaeume();
    raumGespraeche();
    leisteRechtsAuf();
    zimmerGespraeche();
    glaswandAgenten();
    fussball();
    minaPlatz();
    utePlatz();
    jaPlatz();
    itPlatz();
    ronPlatz();
    novaPlatz();
    klingel();
    if (!HANDY) hundStarten();
    if (!HANDY) {
      pokemonStarten();
      paradeStarten();
      autosStarten();
      dekoStarten();
      gongStarten();
      fliegerStarten();
      gokuStarten();
    }
    profilKarten();
    wandGespraeche();
    if (HANDY) {
      grundrissAn = false;
      grundrissZeigen();
    }
    kernzeitStarten();
    const breite = (116 + DX + (true ? 8 : 0)) * 32, hoehe = (62 + DY) * 32;
    void karte;
    let blick = 0, uebersichtAn = false;
    const uebersicht = () => {
      uebersichtAn = true;
      try {
        const sw = screen.width || 390, sh = screen.height || 800;
        if (HANDY) {
          const q = sh > sw ? sw / sh : 9 / 19.5;
          WA.camera.set(breite / 2, hoehe / 2, Math.round(hoehe * 0.8 * q), Math.round(hoehe * 0.8), true, true);
        } else WA.camera.set(breite / 2, hoehe / 2, breite, hoehe, false, true);
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
    try {
      const w = WA.ui.website;
      if (!HANDY) await w.open({
        url: SEITEN + "blick.html?teil=stick&v=6",
        allowApi: true,
        visible: true,
        position: { vertical: "bottom", horizontal: "left" },
        size: { width: HANDY ? "96px" : "116px", height: HANDY ? "96px" : "116px" },
        margin: { bottom: HANDY ? "96px" : "20px", left: HANDY ? "8px" : "20px" }
      });
      if (!HANDY) await w.open({
        url: SEITEN + "blick.html?teil=karte&v=6",
        allowApi: true,
        visible: true,
        position: { vertical: "bottom", horizontal: "right" },
        size: { width: HANDY ? "130px" : "232px", height: HANDY ? "99px" : "176px" },
        margin: { bottom: HANDY ? "158px" : "20px", right: HANDY ? "14px" : "92px" }
      });
    } catch {
    }
    const schnellreise = () => {
      try {
        WA.ui.modal.openModal({ title: "Schnellreise", src: SEITEN + "schnellreise.html", allowApi: true, position: HANDY ? "center" : "right" });
      } catch {
      }
    };
    try {
      if (!HANDY) {
        const KNOEPFE = [
          ["sw-uebersicht", "\xDCbersicht", "karte", () => uebersichtAn ? zuMir() : uebersicht()],
          ["sw-zu-mir", "Zu mir", "zumir", zuMir],
          ["sw-schnellreise", "Reise", "reise", schnellreise],
          ["sw-ideen", "Ideen", "ideen", () => ideenOeffnen()],
          ["sw-kalender", "Kalender", "kalender", () => glasFenster(SEITEN + "kalender.html?t=" + Date.now())],
          ["sw-wer", "Wer ist da", "wer", () => glasFenster(SEITEN + "wer.html?t=" + Date.now())],
          // 11.10.: Liste mit Live-Anzeige (Recht „live“)
          ...HANDY ? [] : [["sw-pokedex", "Sammlungen", "pokedex", () => glasFenster(SEITEN + "pokedex.html?name=" + encodeURIComponent(WA.player.name || "") + "&t=" + Date.now())]],
          // 18.10.2026 Sammlungen (nicht am Handy)
          ["sw-mein-profil", "Profil", "profil", () => glasFenster(SEITEN + "profil.html?ich=1&tore=" + toreVon(WA.player.name || "") + "&t=" + Date.now())],
          ...tcAktiv ? [["sw-tagescheck", "Tages-Check", "tagescheck", () => glasFenster(SEITEN + "tagescheck.html?t=" + Date.now())]] : [],
          ...kzAktiv ? [["sw-arbeitszeit", "Arbeitszeit", "arbeitszeit", () => glasFenster(SEITEN + "kernzeit.html?t=" + Date.now())], ["sw-feierabend", "Feierabend", "feierabend", feierabendOeffnen]] : [],
          ...chatDarf ? [["sw-chat", "Chats", "chat", () => glasFenster(SEITEN + "chat.html?s=" + SITZUNG + "&t=" + Date.now())]] : [],
          // 23.10.2026 Chat (seit abends für alle)
          ["sw-toene", "T\xF6ne", "toene", () => glasFenster(SEITEN + "toene.html?t=" + Date.now())],
          // 22.10.2026: Lautstärke je Art
          ["sw-alles-zu", "Alles zu", "alleszu", allesZu]
          // 20.10.2026 (Sam): ein Klick schließt jedes offene Fenster
        ];
        const noetig = 300 + 520 + KNOEPFE.reduce((s2, k) => s2 + 52 + k[1].length * 7.5, 0);
        const breitGenug = (screen.availWidth || screen.width || 0) >= noetig;
        for (const [id, label, bild, cb] of KNOEPFE) {
          try {
            WA.ui.actionBar.addButton({ id, ...breitGenug ? { label } : {}, toolTip: label, imageSrc: SEITEN + "icons/" + (breitGenug ? "" : "u-") + bild + ".svg?v=3", location: "top", callback: cb });
          } catch {
          }
        }
      } else {
        try {
          const v = WA.player.state.swLeisteLage;
          if (v && typeof v === "object") WA.player.state.saveVariable("swLeisteLage", "links", { public: false, persist: true });
        } catch {
        }
        let leiste = null;
        const leisteAuf = async () => {
          let lage = "links";
          try {
            lage = String(WA.player.state.swLeisteLage || "links");
          } catch {
          }
          const sw = Math.round(screen.width || 390), opt = lage === "oben" ? { position: { vertical: "top", horizontal: "middle" }, size: { width: sw - 24 + "px", height: "62px" }, margin: { top: "108px" } } : lage === "mitte" ? { position: { vertical: "bottom", horizontal: "middle" }, size: { width: sw - 24 + "px", height: "62px" }, margin: { bottom: "88px" } } : { position: { vertical: "bottom", horizontal: "left" }, size: { width: sw - 12 - 66 + "px", height: "62px" }, margin: { bottom: "88px", left: "12px" } };
          try {
            leiste && leiste.close();
          } catch {
          }
          if (!klassikOffen) return;
          try {
            leiste = await WA.ui.website.open({ url: SEITEN + "handy-leiste.html?v=4", allowApi: true, visible: true, ...opt });
            klassik.push(leiste);
          } catch {
          }
        };
        klassikLeiste = leisteAuf;
        try {
          WA.player.state.onVariableChange("swLeisteLage").subscribe(() => leisteAuf());
        } catch {
        }
      }
    } catch {
    }
    if (HANDY) klassikPruefen();
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
      const n = m === "karte" ? 4 : 4 + (tcAktiv ? 1 : 0) + (kzAktiv ? 2 : 0);
      menueName = m;
      try {
        menue = await WA.ui.website.open({
          url: SEITEN + "oben.html?menue=" + m + (tcAktiv ? "&tc=1" : "") + (kzAktiv ? "&kz=1" : ""),
          allowApi: true,
          visible: true,
          // unter dem ☰-Knopf (rechts, vor „Teilen“, „Werkzeuge“ und dem eigenen Profil)
          position: { vertical: "top", horizontal: "right" },
          size: { width: "220px", height: n * 37 + 12 + "px" },
          margin: { top: "64px", right: "330px" }
        });
      } catch {
        menueName = "";
      }
    };
    let handyMenue = null;
    const handyMenueZu = () => {
      if (handyMenue) {
        try {
          handyMenue.close();
        } catch {
        }
      }
      handyMenue = null;
      if (handyBlatt && handyBlatt.name === "mehr") handyBlattZu();
    };
    const handyMenueUmschalten = async () => {
      return handyBlattUmschalten("mehr", SEITEN + "handy-menue.html?v=3" + (tcAktiv ? "&tc=1" : "") + (kzAktiv ? "&kz=1" : "") + (meineTuer() ? "&tuer=1" : ""), Math.min(520, Math.round((screen.height || 800) * 0.7)) + "px");
      if (handyMenue) return handyMenueZu();
      try {
        handyMenue = await WA.ui.website.open({
          url: SEITEN + "handy-menue.html?v=1" + (tcAktiv ? "&tc=1" : "") + (kzAktiv ? "&kz=1" : "") + (meineTuer() ? "&tuer=1" : ""),
          allowApi: true,
          visible: true,
          // 12.10.2026: unter der Info-Leiste (oben 108 px) und über der WorkAdventure-Leiste — sonst waren Name und ✕ oben abgeschnitten
          position: { vertical: "top", horizontal: "left" },
          size: { width: Math.min(290, Math.round((screen.width || 390) * 0.78)) + "px", height: Math.max(320, (screen.height || 800) - 108 - 92) + "px" },
          margin: { top: "108px", left: "0px" }
        });
      } catch {
        handyMenue = null;
      }
    };
    let letzteAktion = 0;
    try {
      WA.player.state.onVariableChange("swAktiv").subscribe(() => {
        letzteAktivitaet = Date.now();
      });
    } catch {
    }
    try {
      WA.chat.onChatMessage((text, ev) => {
        const von = ev && ev.author && ev.author.name;
        if (!von || von === WA.player.name) return;
        fetch(ENDPOINT.replace(/melden$/, "chat-eingang"), { method: "POST", headers: { "Content-Type": "application/json", "X-Buero-Key": BUERO_KEY }, body: JSON.stringify({ name: WA.player.name, von, text: String(text || "").slice(0, 300) }) }).catch(() => {
        });
      }, { scope: "bubble" });
    } catch {
    }
    try {
      letzteAktion = Number((WA.player.state.swAktion || {}).t) || 0;
    } catch {
    }
    try {
      WA.player.state.onVariableChange("swAktion").subscribe((v) => {
        if (!v || !v.t || v.t === letzteAktion) return;
        letzteAktion = v.t;
        if (v.was === "chat") return chatUmschalten();
        if (v.was === "leisteLage") {
          try {
            WA.player.state.saveVariable("swLeisteRechtsLage", { r: Number(v.r) || 0, o: Number(v.o) || 0 }, { public: false, persist: true });
          } catch {
          }
          return leisteRechtsAuf();
        }
        if (v.was === "leisteRechts") {
          leisteSchmal = !!v.schmal;
          try {
            WA.player.state.saveVariable("swLeisteSchmal", leisteSchmal, { public: false, persist: true });
          } catch {
          }
          return leisteRechtsAuf();
        }
        if (v.was === "leisteChat") return glasFenster(SEITEN + "chat.html?mit=" + encodeURIComponent(String(v.id || "")) + "&s=" + SITZUNG + "&t=" + Date.now());
        if (v.was === "glasZu") {
          try {
            glasOffen && glasOffen.handle && glasOffen.handle.close();
          } catch {
          }
          glasOffen = null;
          return;
        }
        if (v.was === "leisteProfil") return profilOeffnen(String(v.name || ""));
        if (v.was === "anrufOeffnen") return HANDY ? glasFenster(SEITEN + "anruf.html?id=" + encodeURIComponent(String(v.id || "")) + "&s=" + SITZUNG + "&t=" + Date.now()) : anrufPille(String(v.id || ""), false);
        if (v.was === "anrufZu") {
          try {
            anrufFenster && anrufFenster.close();
          } catch {
          }
          anrufFenster = null;
          return;
        }
        if (v.was === "pushFertig" || v.was === "pushSpaeter") return pushPflichtFertig();
        if (v.was === "freiton") return ton("freiton", "direkt");
        if (v.was === "tonProbe") return ton(v.art === "direkt" ? "klopfen" : "klingel", String(v.art || "gruppe"));
        if (v.was === "toene") {
          menueZu();
          handyMenueZu();
          return glasFenster(SEITEN + "toene.html?t=" + Date.now());
        }
        if (HANDY && v.was !== "hinweisTipp") chatZu();
        if (v.was === "menue") return menueUmschalten(String(v.m || ""));
        if (v.was === "handyMenue") return handyMenueUmschalten();
        if (v.was === "hinweisTipp") return hinweisGetippt(Number(v.nr) || 0);
        if (v.was === "team") return HANDY ? handyBlattUmschalten("team", SEITEN + "wer.html?sheet=1&t=" + Date.now(), "78vh") : glasFenster(SEITEN + "wer.html?t=" + Date.now());
        if (ZIMMER_AKTIONEN[v.was]) return ZIMMER_AKTIONEN[v.was](v);
        if (v.was === "dbFund") return dbGefunden(v);
        if (v.was === "allesZu") return allesZu();
        if (v.was === "shenlongZu") return shenlongZu();
        if (v.was === "shenlongAuf") return shenlongOeffnen();
        if (v.was === "goldRand") {
          goldAn = false;
          return goldRand(v.bis);
        }
        if (v.was === "pokeFang") return pokeGefangen(v);
        if (v.was === "grundrissRaum") return grundrissRaum(String(v.name || ""));
        if (v.was === "grundrissPerson") return grundrissPerson(String(v.name || ""));
        if (v.was === "grundrissAus" || v.was === "appAus") return grundrissUmschalten(false);
        if (v.was === "appAn") return grundrissUmschalten(true);
        if (v.was === "arbeiten") return arbeitenOffen ? arbeitenZu() : arbeitenAuf();
        if (v.was === "arbeitenZu") return arbeitenZu();
        if (v.was === "arbeitenHin") {
          arbeitenZu();
          return grundrissRaum(String(v.name || ""));
        }
        if (v.was === "karte" && HANDY) {
          menueZu();
          handyMenueZu();
          handyBlattZu();
          return grundrissUmschalten();
        }
        if (MT_AKTIONEN[v.was]) {
          const m = mitteilungen.find((x) => x.id === v.id);
          return m ? MT_AKTIONEN[v.was](m) : void 0;
        }
        if (v.was === "feierabendGehen") {
          return melden("verlassen").then(() => {
            beendet = true;
            rausZu(SEITEN + "weg.html?grund=feierabend");
          });
        }
        if (v.was === "handyListe") return melden("verlassen").then(() => {
          beendet = true;
          rausZu(SEITEN + "handy.html?von=karte");
        });
        if (v.was === "abmelden") {
          schlossMerken(false);
          return melden("verlassen").then(() => {
            beendet = true;
            rausZu(SEITEN + "weg.html?grund=abgemeldet");
          });
        }
        menueZu();
        handyMenueZu();
        if (HANDY) handyBlattZu();
        const tuer = meineTuer();
        ({
          ideen: () => ideenOeffnen(),
          uebersicht,
          karte: () => uebersichtAn ? zuMir() : uebersicht(),
          zumir: zuMir,
          reise: schnellreise,
          news: () => newsOeffnen(),
          feierabend: () => feierabendOeffnen(),
          kalender: () => glasFenster(SEITEN + "kalender.html?t=" + Date.now()),
          tagescheck: () => glasFenster(SEITEN + "tagescheck.html?t=" + Date.now()),
          arbeitszeit: () => glasFenster(SEITEN + "kernzeit.html?t=" + Date.now()),
          mehr: () => glasFenster(SEITEN + "mehr.html?tuer=" + (tuer ? encodeURIComponent(tuerStatus(tuer)) : "") + "&t=" + Date.now()),
          hoch: () => blicken(-6),
          runter: () => blicken(6),
          zuPerson: () => zuPerson(String(v.name || "")),
          zuRaum: () => zuRaum(String(v.name || "")),
          meinProfil: () => glasFenster(SEITEN + "profil.html?ich=1&tore=" + toreVon(WA.player.name || "") + "&t=" + Date.now()),
          tuer: () => {
            if (tuer) fokusUmschalten(tuer);
          }
          // 14.10.2026: immer 25 Min, max. 3× am Tag
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
      try {
        const c = WA.controls;
        c.restoreWebcam?.();
        c.restoreMicrophone?.();
      } catch {
      }
      pm.onJoin().subscribe(() => {
        imGespraech = true;
        grundrissZeigen();
      });
      pm.onLeave().subscribe(() => {
        imGespraech = false;
        setTimeout(grundrissZeigen, 800);
      });
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
    setInterval(async () => {
      try {
        const r = await fetch(ENDPOINT.replace(/melden$/, "anruf/eingang"), { headers: { "X-Buero-Key": BUERO_KEY, "X-Buero-Sitzung": SITZUNG } });
        if (!r.ok) return;
        const d = await r.json();
        if (d && d.id) nachrichtZeigen({ von: d.von, vonId: d.vonId, anruf: d.id, text: "\u{1F4DE} ruft an" });
      } catch {
      }
    }, 3e3);
    setInterval(() => melden("heartbeat"), 3e4);
    window.addEventListener("pagehide", (e) => {
      if (!HANDY || !e.persisted) melden("verlassen");
    });
    window.addEventListener("beforeunload", (e) => {
      try {
        if (HANDY || beendet) return;
        const heute = (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
        if (WA.player.state.swFeierabendTag === heute) return;
        e.preventDefault();
        e.returnValue = "Du hast noch nicht auf Feierabend geklickt \u2013 B\xFCro wirklich schlie\xDFen?";
        return e.returnValue;
      } catch {
      }
    });
  });
})();
