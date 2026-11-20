// L'albero del morse disegnato in SVG, come la tessera con le lucine: dall'antenna
// un punto porta a destra (E) e una linea a sinistra (T); ogni simbolo dopo sposta di un
// passo. I cerchi sono le lettere che finiscono con un punto, i rettangoli quelle che
// finiscono con una linea. Mentre si batte, si accendono le luci del percorso: verdi i
// punti, rosse le linee.

const NS = "http://www.w3.org/2000/svg";

const COLONNE = [72, 158, 244, 356, 420, 484, 546];
const RIGHE = [150, 228, 306, 384, 462, 540, 618];
const RADICE = { x: 300, y: 150 };

// codice, lettera, colonna, riga, dove va la scritta
const NODI = [
  [".", "E", 3, 0, "su"], ["..", "I", 4, 0, "su"], ["...", "S", 5, 0, "su"], ["....", "H", 6, 0, "su"],
  ["-", "T", 2, 0, "su"], ["--", "M", 1, 0, "su"], ["---", "O", 0, 0, "su"],
  ["..-", "U", 4, 1, "sinistra"], ["..-.", "F", 4, 2, "destra"], ["...-", "V", 5, 1, "destra"],
  [".-", "A", 3, 3, "sinistra-giu"], [".-.", "R", 4, 3, "giu"], [".-..", "L", 5, 3, "destra"],
  [".--", "W", 3, 5, "sinistra-giu"], [".--.", "P", 4, 5, "destra"], [".---", "J", 3, 6, "destra"],
  ["--.", "G", 1, 1, "destra"], ["--.-", "Q", 0, 1, "giu"], ["--..", "Z", 1, 2, "destra"],
  ["-.", "N", 2, 3, "destra-su"], ["-.-", "K", 1, 3, "su"], ["-.--", "Y", 0, 3, "su"], ["-.-.", "C", 1, 4, "destra"],
  ["-..", "D", 2, 5, "destra-su"], ["-..-", "X", 1, 5, "sinistra"], ["-...", "B", 2, 6, "sinistra"],
];

// Schermo in basso a destra: lettera grande e codice
const SCHERMO = { x: 464, y: 440, w: 118, h: 200 };

function el(nome, attributi = {}, figli = []) {
  const e = document.createElementNS(NS, nome);
  for (const [k, v] of Object.entries(attributi)) e.setAttribute(k, String(v));
  for (const f of figli) e.append(f);
  return e;
}

function testo(x, y, contenuto, classe, attributi = {}) {
  const t = el("text", { x, y, class: classe, ...attributi });
  t.textContent = contenuto;
  return t;
}

// Codice disegnato con cerchietti e trattini, centrato in (cx, cy), largo al massimo maxL
function disegnaCodice(gruppo, codice, cx, cy, maxL) {
  gruppo.replaceChildren();
  if (!codice) return;
  const r = 6, linea = 22, spazio = 7;
  const larghezze = [...codice].map((s) => (s === "-" ? linea : 2 * r));
  const totale = larghezze.reduce((a, b) => a + b, 0) + spazio * (codice.length - 1);
  const scala = Math.min(1, maxL / totale);
  let x = -totale / 2;
  const interno = el("g", { transform: `translate(${cx} ${cy}) scale(${scala})` });
  [...codice].forEach((s, i) => {
    if (s === "-") interno.append(el("rect", { x, y: -r + 1, width: linea, height: 2 * r - 2, rx: 2, class: "simbolo linea" }));
    else interno.append(el("circle", { cx: x + r, cy: 0, r, class: "simbolo punto" }));
    x += larghezze[i] + spazio;
  });
  gruppo.append(interno);
}

export function creaAlbero(svg, { suTocco } = {}) {
  svg.setAttribute("viewBox", "0 0 600 680");
  svg.replaceChildren();

  const nodi = new Map(); // codice → { gruppo, etichetta, ramo }
  for (const [codice, lettera, col, riga, posto] of NODI) {
    nodi.set(codice, { codice, lettera, x: COLONNE[col], y: RIGHE[riga], posto });
  }
  const padre = (codice) => (codice.length > 1 ? nodi.get(codice.slice(0, -1)) : RADICE);

  // Sfumature e bagliore
  const defs = el("defs", {}, [
    el("linearGradient", { id: "morse-sfondo", x1: 0, y1: 0, x2: 0.3, y2: 1 }, [
      el("stop", { offset: "0", class: "sfondo-1" }),
      el("stop", { offset: "1", class: "sfondo-2" }),
    ]),
    el("filter", { id: "morse-bagliore", x: "-100%", y: "-100%", width: "300%", height: "300%" }, [
      el("feGaussianBlur", { stdDeviation: 7 }),
    ]),
  ]);
  svg.append(defs);

  // Tessera
  svg.append(el("rect", { x: 6, y: 6, width: 588, height: 668, rx: 28, class: "tessera" }));
  svg.append(el("rect", { x: 17, y: 17, width: 566, height: 646, rx: 19, class: "tessera-bordo" }));
  svg.append(testo(150, 72, "CODICE", "titolo"));
  svg.append(testo(450, 72, "MORSE", "titolo"));

  // Antenna, con le onde che compaiono mentre trasmette
  const antenna = el("g", { class: "antenna" }, [
    el("path", { d: `M300 ${RADICE.y} V98 M300 98 L281 60 H319 Z M300 60 V98`, class: "antenna-asta" }),
  ]);
  const onde = el("g", { class: "onde" }, [
    el("path", { d: "M330 46 A32 32 0 0 1 330 86" }),
    el("path", { d: "M270 46 A32 32 0 0 0 270 86" }),
    el("path", { d: "M342 34 A50 50 0 0 1 342 98" }),
    el("path", { d: "M258 34 A50 50 0 0 0 258 98" }),
  ]);
  antenna.append(onde);
  svg.append(antenna);

  // Rami (dal padre al figlio: sempre orizzontali o verticali)
  const rami = el("g", { class: "rami" });
  for (const n of nodi.values()) {
    const p = padre(n.codice);
    n.ramo = el("line", { x1: p.x, y1: p.y, x2: n.x, y2: n.y, class: "ramo" });
    n.orizzontale = p.y === n.y;
    rami.append(n.ramo);
  }
  svg.append(rami);

  // Lucine
  const gruppi = el("g", { class: "nodi" });
  for (const n of nodi.values()) {
    const linea = n.codice.endsWith("-");
    const g = el("g", { class: `nodo ${linea ? "linea" : "punto"}` });
    g.append(el("circle", { cx: n.x, cy: n.y, r: 26, class: "alone", filter: "url(#morse-bagliore)" }));
    let mezzaL, mezzaA;
    if (!linea) {
      mezzaL = mezzaA = 16;
      g.append(el("circle", { cx: n.x, cy: n.y, r: 16, class: "forma" }));
    } else {
      [mezzaL, mezzaA] = n.orizzontale ? [25, 13] : [13, 25];
      g.append(el("rect", { x: n.x - mezzaL, y: n.y - mezzaA, width: 2 * mezzaL, height: 2 * mezzaA, rx: 4, class: "forma" }));
    }
    // Scritta accanto alla lucina
    let lx = n.x, ly = n.y;
    if (n.posto === "su") ly = n.y - 34;
    if (n.posto === "giu") ly = n.y + mezzaA + 22;
    if (n.posto === "destra") lx = n.x + mezzaL + 16;
    if (n.posto === "sinistra") lx = n.x - mezzaL - 16;
    if (n.posto === "destra-su") [lx, ly] = [n.x + 28, n.y - 27];
    if (n.posto === "sinistra-giu") [lx, ly] = [n.x - mezzaL - 15, n.y + 27];
    n.etichetta = testo(lx, ly, n.lettera, "etichetta");
    g.append(n.etichetta);
    // Zona da toccare, più grande della lucina
    const zona = el("circle", { cx: n.x, cy: n.y, r: 30, class: "tocca" });
    zona.dataset.codice = n.codice;
    const titolo = el("title");
    titolo.textContent = `${n.lettera}: ${n.codice.replace(/\./g, "·").replace(/-/g, "−")}`;
    zona.append(titolo);
    g.append(zona);
    n.gruppo = g;
    gruppi.append(g);
  }
  svg.append(gruppi);

  // Schermo
  const s = SCHERMO;
  svg.append(el("rect", { x: s.x, y: s.y, width: s.w, height: s.h, rx: 14, class: "schermo" }));
  const schermoLettera = testo(s.x + s.w / 2, s.y + 92, "", "schermo-lettera");
  const schermoCodice = el("g", { class: "schermo-codice" });
  const schermoNota = testo(s.x + s.w / 2, s.y + 160, "", "schermo-nota");
  svg.append(schermoLettera, schermoCodice, schermoNota);

  svg.addEventListener("click", (e) => {
    const zona = e.target.closest?.(".tocca");
    if (zona && suTocco) suTocco(zona.dataset.codice);
  });

  let accesi = [];

  function spegni() {
    for (const n of accesi) {
      n.gruppo.classList.remove("acceso", "corrente");
      n.ramo.classList.remove("acceso");
    }
    accesi = [];
  }

  // Accende il percorso di un codice; l'ultima lucina raggiunta è la "corrente"
  function mostra(codice) {
    spegni();
    for (let k = 1; k <= codice.length; k++) {
      const n = nodi.get(codice.slice(0, k));
      if (!n) break;
      n.gruppo.classList.add("acceso");
      n.ramo.classList.add("acceso");
      accesi.push(n);
    }
    const ultimo = accesi[accesi.length - 1];
    if (ultimo && ultimo.codice === codice) ultimo.gruppo.classList.add("corrente");
  }

  // Schermo: lettera grande, codice, e una nota piccola (es. "pronto")
  function schermo(lettera, codice, nota = "", stato = "") {
    schermoLettera.textContent = lettera || "";
    schermoLettera.setAttribute("class", `schermo-lettera ${stato}`.trim());
    disegnaCodice(schermoCodice, codice, s.x + s.w / 2, s.y + 160, s.w - 18);
    schermoNota.textContent = codice ? "" : nota;
  }

  function trasmette(si) {
    svg.classList.toggle("trasmette", si);
  }

  return { mostra, spegni, schermo, trasmette };
}
