// Morse: il tasto con l'albero delle lettere e il traduttore. Tutto gira nel browser:
// niente server, niente cookie; impostazioni e testi restano nella memoria del browser.

import {
  CODICI, GRUPPI, MASSIMO_SIMBOLI, lettera, testoInMorse, morseInTesto, formattaMorse, formattaTesto,
} from "./morse-codici.js";
import { Suono, Riproduttore } from "./morse-suono.js";
import { creaAlbero } from "./morse-albero.js";

const $ = (id) => document.getElementById(id);

// --- Memoria del browser: solo una comodità, se manca l'app funziona lo stesso ---

const memoria = {
  leggi(chiave, predefinito) {
    try {
      const v = localStorage.getItem(`morse.${chiave}`);
      return v === null ? predefinito : JSON.parse(v);
    } catch {
      return predefinito;
    }
  },
  scrivi(chiave, valore) {
    try {
      localStorage.setItem(`morse.${chiave}`, JSON.stringify(valore));
    } catch {
      /* memoria piena o non disponibile */
    }
  },
};

// --- Impostazioni ---

const PREDEFINITE = { wpm: 8, tasti: "uno", fine: "pausa", spazioAuto: true, suono: true, nota: 600 };

function leggiImpostazioni() {
  const salvate = memoria.leggi("impostazioni", {});
  const imp = { ...PREDEFINITE };
  if (salvate && typeof salvate === "object") {
    if (Number.isFinite(salvate.wpm)) imp.wpm = Math.min(25, Math.max(5, Math.round(salvate.wpm)));
    if (salvate.tasti === "uno" || salvate.tasti === "due") imp.tasti = salvate.tasti;
    if (salvate.fine === "pausa" || salvate.fine === "tasto") imp.fine = salvate.fine;
    if (typeof salvate.spazioAuto === "boolean") imp.spazioAuto = salvate.spazioAuto;
    if (typeof salvate.suono === "boolean") imp.suono = salvate.suono;
    if (Number.isFinite(salvate.nota)) imp.nota = Math.min(1000, Math.max(400, Math.round(salvate.nota)));
  }
  return imp;
}

const imp = leggiImpostazioni();

// Tempi del tasto, in millisecondi, dalla velocità (u = durata di un punto)
const unita = () => 1200 / imp.wpm;
const sogliaLinea = () => 2 * unita(); // premuto più a lungo di così: linea
const pausaLettera = () => 5 * unita(); // dopo l'ultimo simbolo: la lettera si chiude
const pausaParola = () => 12 * unita(); // dopo l'ultimo simbolo: arriva lo spazio

const suono = new Suono();
const riproduttore = new Riproduttore(suono);

function applicaImpostazioni() {
  suono.acceso = imp.suono;
  suono.nota = imp.nota;
  const due = imp.tasti === "due";
  $("tasto").hidden = due;
  $("tasto-punto").hidden = !due;
  $("tasto-linea").hidden = !due;
  $("aiuto-tasto").textContent = due
    ? "Un pulsante per il punto e uno per la linea."
    : `Tocco breve = punto, tieni premuto più di ${Math.round(sogliaLinea())} ms = linea.`;
  $("aiuto-tastiera").textContent = due
    ? "Da tastiera: . e -, Invio chiude la lettera."
    : "Da tastiera: barra spaziatrice, Invio chiude la lettera.";
  $("pausa").hidden = imp.fine !== "pausa";
  $("pausa-tacca").hidden = !imp.spazioAuto;
  $("pausa-tacca").style.left = `${(pausaLettera() / pausaParola()) * 100}%`;
}

function salvaImpostazioni() {
  memoria.scrivi("impostazioni", imp);
  applicaImpostazioni();
}

// --- Disegno dei codici con punti e linee (il testo resta ".-" per copiarlo) ---

function codiceVisibile(codice, classe = "codice") {
  const span = document.createElement("span");
  span.className = classe;
  for (const s of codice) {
    const segno = document.createElement("span");
    segno.className = s === "-" ? "l" : "p";
    segno.textContent = s;
    span.append(segno);
  }
  return span;
}

const bello = (codice) => codice.replace(/\./g, "·").replace(/-/g, "−");

// --- Spia nella barra in alto: si accende con ogni bip ---

function spia(accesa) {
  $("spia").classList.toggle("accesa", accesa);
}

// --- Albero ---

const albero = creaAlbero($("albero"), {
  suTocco(codice) {
    if (stato.premuto) return;
    suonaLettere([{ c: lettera(codice), m: codice }], { sullAlbero: true });
  },
});

// --- Tasto: stato e logica ---

const stato = {
  testo: String(memoria.leggi("testo", "") || "").slice(0, 2000),
  seq: "", // simboli della lettera in corso
  premuto: null, // { id, t0 } mentre il tasto è giù
  ultimo: 0, // quando è finito l'ultimo simbolo (performance.now)
  attesaLettera: false,
  attesaSpazio: false,
  ultimaLettera: null, // { c, m } appena scritta, per lo schermo
  errore: null, // { m, fino } codice che non è una lettera
};

let ciclo = 0;

function avviaCiclo() {
  if (!ciclo) ciclo = requestAnimationFrame(passo);
}

// Un solo ciclo per animazioni e tempi: anello del tasto, barra della pausa, chiusura
// della lettera e spazio automatico
function passo() {
  ciclo = 0;
  const ora = performance.now();
  const tasto = $("tasto");

  if (stato.premuto) {
    const p = Math.min(1, (ora - stato.premuto.t0) / sogliaLinea());
    tasto.style.setProperty("--p", p.toFixed(3));
    tasto.classList.toggle("linea", p >= 1);
    $("tasto-simbolo").className = `tasto-simbolo ${p >= 1 ? "segno-linea" : "segno-punto"}`;
  }

  if (stato.attesaLettera && ora - stato.ultimo >= pausaLettera()) chiudiLettera();
  if (stato.attesaSpazio && ora - stato.ultimo >= pausaParola()) {
    stato.attesaSpazio = false;
    aggiungiSpazio();
  }

  const barra = $("pausa-barra");
  if (stato.attesaLettera || stato.attesaSpazio) {
    const totale = imp.spazioAuto ? pausaParola() : pausaLettera();
    const f = Math.min(1, Math.max(0, (ora - stato.ultimo) / totale));
    barra.style.width = `${(f * 100).toFixed(1)}%`;
    barra.classList.toggle("parola", stato.attesaSpazio);
  } else {
    barra.style.width = "0";
  }

  if (stato.errore && ora >= stato.errore.fino) {
    stato.errore = null;
    aggiornaSchermo();
  }

  if (stato.premuto || stato.attesaLettera || stato.attesaSpazio || stato.errore) avviaCiclo();
}

function premi(id) {
  if (stato.premuto) return;
  riproduttore.ferma();
  suono.inizia();
  stato.premuto = { id, t0: performance.now() };
  stato.attesaLettera = stato.attesaSpazio = false;
  const tasto = $("tasto");
  tasto.classList.add("giu");
  tasto.classList.remove("linea");
  tasto.style.setProperty("--p", "0");
  albero.trasmette(true);
  spia(true);
  avviaCiclo();
}

function rilascia(id) {
  if (!stato.premuto || stato.premuto.id !== id) return;
  const ora = performance.now();
  const durata = ora - stato.premuto.t0;
  stato.premuto = null;
  suono.ferma();
  const tasto = $("tasto");
  tasto.classList.remove("giu", "linea");
  tasto.style.setProperty("--p", "0");
  $("tasto-simbolo").className = "tasto-simbolo";
  albero.trasmette(false);
  spia(false);
  aggiungiSimbolo(durata >= sogliaLinea() ? "-" : ".", ora);
}

// Tasto a due pulsanti: il simbolo è deciso dal pulsante, il bip ha la durata giusta
function simboloDiretto(simbolo) {
  if (stato.premuto) return;
  riproduttore.ferma();
  const durata = (simbolo === "-" ? 3 : 1) * unita();
  suono.bip(durata / 1000);
  albero.trasmette(true);
  spia(true);
  setTimeout(() => {
    if (!stato.premuto && !riproduttore.attivo) {
      albero.trasmette(false);
      spia(false);
    }
  }, durata);
  aggiungiSimbolo(simbolo, performance.now() + durata);
}

function aggiungiSimbolo(simbolo, quando) {
  if (stato.seq.length >= MASSIMO_SIMBOLI) {
    // Nessun carattere ha più simboli di così
    segnalaErrore(stato.seq + simbolo);
    stato.seq = "";
    stato.attesaLettera = false;
  } else {
    stato.seq += simbolo;
    stato.attesaLettera = imp.fine === "pausa";
  }
  stato.ultimo = quando;
  stato.attesaSpazio = false;
  stato.ultimaLettera = null;
  aggiornaTasto();
  avviaCiclo();
}

function segnalaErrore(codice) {
  stato.errore = { m: codice, fino: performance.now() + 1400 };
  annuncia(`${bello(codice)} non è una lettera`);
  const box = document.querySelector(".albero-box");
  box.classList.remove("scuoti");
  void box.offsetWidth; // fa ripartire l'animazione
  box.classList.add("scuoti");
}

function chiudiLettera() {
  stato.attesaLettera = false;
  if (!stato.seq) return;
  const codice = stato.seq;
  const c = lettera(codice);
  stato.seq = "";
  if (c) {
    scrivi(stato.testo + c);
    stato.ultimaLettera = { c, m: codice };
    annuncia(c);
    stato.attesaSpazio = imp.fine === "pausa" && imp.spazioAuto;
  } else {
    segnalaErrore(codice);
  }
  aggiornaTasto();
  avviaCiclo();
}

function aggiungiSpazio() {
  if (stato.testo && !stato.testo.endsWith(" ")) {
    scrivi(stato.testo + " ");
    annuncia("spazio");
  }
}

function cancella() {
  stato.attesaSpazio = false;
  if (stato.seq) {
    stato.seq = stato.seq.slice(0, -1);
    stato.attesaLettera = !!stato.seq && imp.fine === "pausa";
    stato.ultimo = performance.now();
  } else if (stato.testo) {
    scrivi([...stato.testo].slice(0, -1).join(""));
  }
  stato.ultimaLettera = null;
  aggiornaTasto();
  avviaCiclo();
}

function scrivi(testo) {
  stato.testo = testo.slice(-2000);
  memoria.scrivi("testo", stato.testo);
  disegnaNastro();
}

function annuncia(testo) {
  $("annuncio").textContent = testo;
}

// --- Disegno della pagina del tasto ---

function aggiornaTasto() {
  if (stato.seq) albero.mostra(stato.seq);
  else albero.spegni();
  aggiornaSchermo();
  disegnaNastro();
}

function aggiornaSchermo() {
  if (stato.errore) {
    albero.schermo("?", stato.errore.m, "", "errore");
  } else if (stato.seq) {
    const c = lettera(stato.seq);
    albero.schermo(c || "…", stato.seq, "", c ? "" : "parziale");
  } else if (stato.ultimaLettera) {
    albero.schermo(stato.ultimaLettera.c, stato.ultimaLettera.m, "", "scritta");
  } else {
    albero.schermo("", "", "pronto");
  }
}

// Nastro del telegrafo: ogni carattere con il suo codice sotto, e la lettera in corso
function disegnaNastro() {
  const nastro = $("nastro");
  const frammento = document.createDocumentFragment();
  const caratteri = [...stato.testo];
  caratteri.forEach((ch, i) => {
    const col = document.createElement("span");
    col.dataset.indice = i;
    if (ch === " ") {
      col.className = "col spazio";
    } else {
      col.className = "col";
      const c = document.createElement("span");
      c.className = "c";
      c.textContent = ch;
      col.append(c, codiceVisibile(CODICI[ch] || ""));
    }
    frammento.append(col);
  });
  if (stato.seq) {
    const col = document.createElement("span");
    col.className = "col in-corso";
    const c = document.createElement("span");
    c.className = "c";
    c.textContent = lettera(stato.seq) || "?";
    col.append(c, codiceVisibile(stato.seq));
    frammento.append(col);
  }
  const cursore = document.createElement("span");
  cursore.className = "cursore";
  frammento.append(cursore);
  if (!caratteri.length && !stato.seq) {
    const vuoto = document.createElement("span");
    vuoto.className = "nastro-vuoto";
    vuoto.textContent = "Premi il tasto: il messaggio compare qui";
    frammento.append(vuoto);
  }
  nastro.replaceChildren(frammento);
  nastro.scrollLeft = nastro.scrollWidth;
}

// --- Riproduzione (tasto, albero, traduttore, tabella) ---

let fineRiproduzione = null;

// lettere: elenco di { c, m, el? } e { pausa: true }. Con sullAlbero si accendono le luci
// del percorso simbolo per simbolo; "el" viene evidenziato mentre suona.
function suonaLettere(lettere, { sullAlbero = false, pulsante = null } = {}) {
  riproduttore.ferma();
  const etichetta = pulsante?.textContent;
  if (pulsante) pulsante.textContent = "■ Ferma";
  let evidenziato = null;
  const togliEvidenza = () => {
    evidenziato?.classList.remove("suona");
    evidenziato = null;
  };
  fineRiproduzione = () => {
    togliEvidenza();
    if (pulsante) pulsante.textContent = etichetta;
    if (sullAlbero) aggiornaTasto();
  };
  riproduttore.riproduci(lettere, imp.wpm, {
    tono(acceso) {
      spia(acceso);
      if (sullAlbero) albero.trasmette(acceso);
    },
    simbolo(i, j) {
      const l = lettere[i];
      if (l.el && l.el !== evidenziato) {
        togliEvidenza();
        evidenziato = l.el;
        evidenziato.classList.add("suona");
        mostraElemento(evidenziato);
      }
      if (sullAlbero) {
        const parte = l.m.slice(0, j + 1);
        albero.mostra(parte);
        const finita = j === l.m.length - 1;
        albero.schermo(finita ? l.c || lettera(l.m) || "?" : lettera(parte) || "…", parte, "", finita ? "" : "parziale");
      }
    },
    fine() {
      const f = fineRiproduzione;
      fineRiproduzione = null;
      f?.();
    },
  });
}

// Porta in vista la lettera che suona: nel nastro solo di lato, senza far saltare la pagina
function mostraElemento(el) {
  const nastro = $("nastro");
  if (el.parentElement === nastro) {
    nastro.scrollLeft = el.offsetLeft - nastro.clientWidth / 2 + el.offsetWidth / 2;
  } else {
    el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
}

// Pulsante Ascolta che diventa Ferma mentre suona
function interruttoreAscolto(pulsante, prepara) {
  pulsante.addEventListener("click", () => {
    suono.contesto(); // dentro il tocco: sblocca l'audio su iPhone
    if (riproduttore.attivo && pulsante.textContent.startsWith("■")) {
      riproduttore.ferma();
      return;
    }
    const { lettere, ...opzioni } = prepara();
    if (!lettere.some((l) => l.m)) return;
    suonaLettere(lettere, { ...opzioni, pulsante });
  });
}

// --- Pagina del tasto: eventi ---

function collegaPulsante(pulsante, giu, su) {
  pulsante.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    try {
      pulsante.setPointerCapture(e.pointerId);
    } catch {
      /* non serve dappertutto */
    }
    giu(e.pointerId);
  });
  if (su) {
    for (const tipo of ["pointerup", "pointercancel", "lostpointercapture"]) {
      pulsante.addEventListener(tipo, (e) => su(e.pointerId));
    }
  }
  // Niente menu, lente o selezione con la pressione lunga (iPhone)
  pulsante.addEventListener("contextmenu", (e) => e.preventDefault());
  pulsante.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
}

collegaPulsante($("tasto"), premi, rilascia);
collegaPulsante($("tasto-punto"), () => simboloDiretto("."));
collegaPulsante($("tasto-linea"), () => simboloDiretto("-"));

$("cancella").addEventListener("click", cancella);
$("conferma").addEventListener("click", chiudiLettera);
$("spazio").addEventListener("click", () => {
  chiudiLettera();
  stato.attesaSpazio = false;
  aggiungiSpazio();
});

interruttoreAscolto($("ascolta-nastro"), () => {
  chiudiLettera();
  const lettere = [];
  const caratteri = [...stato.testo];
  for (const col of $("nastro").querySelectorAll(".col")) {
    const ch = caratteri[Number(col.dataset.indice)];
    if (ch === " ") lettere.push({ pausa: true });
    else if (CODICI[ch]) lettere.push({ c: ch, m: CODICI[ch], el: col });
  }
  return { lettere, sullAlbero: true };
});

$("copia-nastro").addEventListener("click", (e) => copia(stato.testo.trim(), e.currentTarget));

$("traduci-nastro").addEventListener("click", () => {
  chiudiLettera();
  impostaDirezione("it");
  $("ingresso").value = stato.testo.trim();
  traduci();
  mostraScheda("traduttore");
});

conferma2($("svuota-nastro"), () => {
  riproduttore.ferma();
  stato.seq = "";
  stato.attesaLettera = stato.attesaSpazio = false;
  stato.ultimaLettera = null;
  scrivi("");
  aggiornaTasto();
});

// Tastiera del computer, solo nella pagina del tasto e fuori dai campi di testo
function tastieraAttiva(e) {
  if (schedaAttiva !== "tasto" || $("impostazioni").open) return false;
  const t = e.target;
  return !(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t?.isContentEditable);
}

document.addEventListener("keydown", (e) => {
  if (!tastieraAttiva(e) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === "Space" || e.key === " ") {
    e.preventDefault();
    if (!e.repeat && imp.tasti === "uno") premi("tastiera");
  } else if (e.key === ".") {
    e.preventDefault();
    if (!e.repeat) simboloDiretto(".");
  } else if (e.key === "-") {
    e.preventDefault();
    if (!e.repeat) simboloDiretto("-");
  } else if (e.key === "Enter") {
    e.preventDefault();
    chiudiLettera();
  } else if (e.key === "Backspace") {
    e.preventDefault();
    cancella();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "Space" || e.key === " ") {
    // Su un pulsante con il fuoco, lo spazio lo premerebbe
    if (tastieraAttiva(e)) e.preventDefault();
    rilascia("tastiera");
  }
});

// Se la pagina va in secondo piano con il tasto premuto, lo si rilascia
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (stato.premuto) rilascia(stato.premuto.id);
    riproduttore.ferma();
  }
});

// --- Traduttore ---

let direzione = memoria.leggi("direzione", "it") === "morse" ? "morse" : "it";
const traduzione = { testo: "", lettere: [] };

function impostaDirezione(d) {
  direzione = d;
  memoria.scrivi("direzione", d);
  const daMorse = d === "morse";
  $("lingua-da").textContent = daMorse ? "Morse" : "Italiano";
  $("lingua-a").textContent = daMorse ? "Italiano" : "Morse";
  $("etichetta-ingresso").textContent = daMorse ? "Morse da tradurre" : "Testo da tradurre";
  $("ingresso").placeholder = daMorse
    ? "Scrivi il morse: .- per A, uno spazio tra le lettere, / tra le parole"
    : "Scrivi qui in italiano…";
  $("ingresso").classList.toggle("morse", daMorse);
  $("tastiera").hidden = !daMorse;
}

const SOLO_MORSE = /^[\s.\-·•−–—_/|]+$/;

function traduci() {
  riproduttore.ferma();
  const valore = $("ingresso").value;
  memoria.scrivi("ingresso", valore.slice(0, 5000));
  const uscita = $("uscita");
  const note = [];
  const frammento = document.createDocumentFragment();
  const lettere = [];
  let suggerimento = "";

  if (direzione === "it") {
    const r = testoInMorse(valore);
    r.righe.forEach((riga) => {
      const div = document.createElement("div");
      div.className = "riga";
      riga.forEach((parola, k) => {
        if (k > 0) {
          const sep = document.createElement("span");
          sep.className = "sep";
          sep.textContent = " / ";
          div.append(sep);
          lettere.push({ pausa: true });
        }
        parola.forEach((l, n) => {
          if (n > 0) div.append(" ");
          const span = codiceVisibile(l.m, "lettera codice");
          span.title = l.c;
          div.append(span);
          lettere.push({ ...l, el: span });
        });
      });
      frammento.append(div);
      lettere.push({ pausa: true });
    });
    traduzione.testo = formattaMorse(r.righe).trim();
    if (r.accenti) note.push("Le lettere accentate sono scritte senza accento (è → e): il morse internazionale non le ha.");
    if (r.saltati.length) note.push(`Saltati, perché non esistono in morse: ${r.saltati.join(" ")}`);
    const pulito = valore.trim();
    if (pulito.length >= 2 && SOLO_MORSE.test(pulito)) suggerimento = "Sembra morse.";
  } else {
    const r = morseInTesto(valore);
    r.righe.forEach((riga) => {
      const div = document.createElement("div");
      div.className = "riga";
      riga.forEach((parola, k) => {
        if (k > 0) {
          div.append(" ");
          lettere.push({ pausa: true });
        }
        for (const l of parola) {
          const span = document.createElement("span");
          span.className = l.c ? "lettera" : "lettera ignoto";
          span.textContent = l.c || "□";
          span.title = l.m ? bello(l.m) : l.x;
          div.append(span);
          if (l.m) lettere.push({ ...l, el: span });
        }
      });
      frammento.append(div);
      lettere.push({ pausa: true });
    });
    traduzione.testo = formattaTesto(r.righe).trim();
    if (r.sconosciuti.length) note.push(`Questi codici non corrispondono a nessun carattere: ${r.sconosciuti.map(bello).join("  ")}`);
    if (r.estranei) {
      note.push("Nel morse vanno solo punti (.) e linee (-), uno spazio tra le lettere e / tra le parole.");
      if (/[a-zàèéìòù0-9]/i.test(valore)) suggerimento = "Sembra italiano.";
    }
  }

  traduzione.lettere = lettere;
  if (!traduzione.testo) {
    const vuoto = document.createElement("span");
    vuoto.className = "uscita-vuota";
    vuoto.textContent = "La traduzione compare qui";
    uscita.replaceChildren(vuoto);
  } else {
    uscita.replaceChildren(frammento);
  }
  uscita.classList.toggle("morse", direzione === "it");
  $("note").textContent = note.join(" ");
  $("suggerimento").hidden = !suggerimento;
  $("suggerimento-testo").textContent = suggerimento;
  const vuota = !traduzione.testo;
  for (const id of ["ascolta-uscita", "albero-uscita", "copia-uscita", "condividi-uscita"]) $(id).disabled = vuota;
}

function inverti() {
  const testo = traduzione.testo;
  impostaDirezione(direzione === "it" ? "morse" : "it");
  $("ingresso").value = testo;
  traduci();
}

$("ingresso").addEventListener("input", traduci);
$("inverti").addEventListener("click", inverti);
$("suggerimento-btn").addEventListener("click", () => {
  // Il testo resta quello scritto: cambia solo il verso
  impostaDirezione(direzione === "it" ? "morse" : "it");
  traduci();
});
$("svuota-ingresso").addEventListener("click", () => {
  $("ingresso").value = "";
  traduci();
  $("ingresso").focus();
});

// Tastierina del morse: scrive dove c'è il cursore senza aprire la tastiera del telefono
$("tastiera").addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) e.preventDefault();
});
$("tastiera").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-inserisci]");
  if (!b) return;
  const area = $("ingresso");
  const testo = area.value;
  const attiva = document.activeElement === area;
  const inizio = attiva ? area.selectionStart : testo.length;
  const fine = attiva ? area.selectionEnd : testo.length;
  const cosa = b.dataset.inserisci;
  let nuovo, cursore;
  if (cosa === "⌫") {
    const da = inizio === fine ? Math.max(0, inizio - 1) : inizio;
    nuovo = testo.slice(0, da) + testo.slice(fine);
    cursore = da;
  } else {
    // Niente doppioni di separatori
    let pezzo = cosa;
    const prima = testo.slice(0, inizio);
    if (cosa === " " && (prima === "" || /\s$/.test(prima))) pezzo = "";
    if (cosa === " / ") pezzo = prima === "" ? "" : /\s$/.test(prima) ? "/ " : " / ";
    nuovo = prima + pezzo + testo.slice(fine);
    cursore = inizio + pezzo.length;
  }
  area.value = nuovo;
  if (attiva) area.setSelectionRange(cursore, cursore);
  traduci();
  // Bip del simbolo appena scritto
  if (cosa === "." || cosa === "-") suono.bip(((cosa === "-" ? 3 : 1) * unita()) / 1000);
});

interruttoreAscolto($("ascolta-uscita"), () => ({ lettere: traduzione.lettere }));

$("albero-uscita").addEventListener("click", () => {
  suono.contesto();
  const lettere = traduzione.lettere.map(({ el, ...l }) => l);
  if (!lettere.some((l) => l.m)) return;
  mostraScheda("tasto");
  suonaLettere(lettere, { sullAlbero: true, pulsante: $("ascolta-nastro") });
});

$("copia-uscita").addEventListener("click", (e) => copia(traduzione.testo, e.currentTarget));

if (navigator.share) {
  $("condividi-uscita").hidden = false;
  $("condividi-uscita").addEventListener("click", () => {
    navigator.share({ text: traduzione.testo }).catch(() => {});
  });
}

// Tabella dei codici
function disegnaTabella() {
  const box = $("tabella");
  for (const gruppo of GRUPPI) {
    const titolo = document.createElement("h3");
    titolo.textContent = gruppo.nome;
    const griglia = document.createElement("div");
    griglia.className = "griglia-codici";
    for (const ch of gruppo.caratteri) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cella";
      b.setAttribute("aria-label", `${ch}: ${bello(CODICI[ch])}`);
      const c = document.createElement("span");
      c.className = "c";
      c.textContent = ch;
      b.append(c, codiceVisibile(CODICI[ch]));
      b.addEventListener("click", () => {
        suono.contesto();
        suonaLettere([{ c: ch, m: CODICI[ch], el: b }]);
      });
      griglia.append(b);
    }
    box.append(titolo, griglia);
  }
}

// --- Copia negli appunti (anche in http, dove navigator.clipboard non c'è) ---

async function copia(testo, pulsante) {
  if (!testo) return;
  let fatto = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(testo);
      fatto = true;
    }
  } catch {
    /* si prova nell'altro modo */
  }
  if (!fatto) {
    const area = document.createElement("textarea");
    area.value = testo;
    area.setAttribute("readonly", "");
    area.className = "fuori-schermo";
    document.body.append(area);
    area.select();
    area.setSelectionRange(0, testo.length);
    try {
      fatto = document.execCommand("copy");
    } catch {
      fatto = false;
    }
    area.remove();
  }
  avvisoBreve(pulsante, fatto ? "Copiato ✓" : "Non riesco");
}

function avvisoBreve(pulsante, messaggio) {
  if (!pulsante.dataset.etichetta) pulsante.dataset.etichetta = pulsante.textContent;
  pulsante.textContent = messaggio;
  clearTimeout(pulsante._timer);
  pulsante._timer = setTimeout(() => {
    pulsante.textContent = pulsante.dataset.etichetta;
    delete pulsante.dataset.etichetta;
  }, 1500);
}

// Pulsante che chiede conferma con un secondo tocco
function conferma2(pulsante, azione) {
  const etichetta = pulsante.textContent;
  let timer = 0;
  pulsante.addEventListener("click", () => {
    if (pulsante.classList.contains("sicuro")) {
      clearTimeout(timer);
      pulsante.classList.remove("sicuro");
      pulsante.textContent = etichetta;
      azione();
      return;
    }
    pulsante.classList.add("sicuro");
    pulsante.textContent = "Sicuro?";
    timer = setTimeout(() => {
      pulsante.classList.remove("sicuro");
      pulsante.textContent = etichetta;
    }, 3000);
  });
}

// --- Schede ---

let schedaAttiva = "tasto";

function mostraScheda(nome) {
  if (nome !== schedaAttiva) window.scrollTo(0, 0);
  schedaAttiva = nome;
  memoria.scrivi("scheda", nome);
  for (const b of document.querySelectorAll(".scheda-btn")) {
    b.setAttribute("aria-selected", String(b.dataset.scheda === nome));
  }
  $("s-tasto").hidden = nome !== "tasto";
  $("s-traduttore").hidden = nome !== "traduttore";
  if (nome !== "tasto" && stato.premuto) rilascia(stato.premuto.id);
  if (nome === "tasto") disegnaNastro();
}

for (const b of document.querySelectorAll(".scheda-btn")) {
  b.addEventListener("click", () => {
    riproduttore.ferma();
    mostraScheda(b.dataset.scheda);
  });
}

// --- Finestra delle impostazioni ---

function descriviVelocita() {
  const u = Math.round(unita());
  $("imp-wpm-valore").textContent = `${imp.wpm} parole al minuto`;
  $("imp-wpm-aiuto").textContent =
    `Punto ${u} ms, linea ${3 * u} ms. Con il tasto: linea se lo tieni più di ${2 * u} ms; ` +
    `la lettera si chiude dopo ${(pausaLettera() / 1000).toFixed(1).replace(".", ",")} s di pausa.`;
  $("imp-nota-valore").textContent = `${imp.nota} Hz`;
}

function riempiImpostazioni() {
  $("imp-wpm").value = imp.wpm;
  for (const r of document.querySelectorAll("input[name=imp-tasti]")) r.checked = r.value === imp.tasti;
  for (const r of document.querySelectorAll("input[name=imp-fine]")) r.checked = r.value === imp.fine;
  $("imp-spazio").checked = imp.spazioAuto;
  $("imp-spazio").disabled = imp.fine !== "pausa";
  $("imp-suono").checked = imp.suono;
  $("imp-nota").value = imp.nota;
  $("imp-nota").disabled = !imp.suono;
  $("imp-prova").disabled = !imp.suono;
  descriviVelocita();
}

$("apri-impostazioni").addEventListener("click", () => {
  riempiImpostazioni();
  const d = $("impostazioni");
  if (typeof d.showModal === "function") d.showModal();
  else d.setAttribute("open", "");
});
$("chiudi-impostazioni").addEventListener("click", () => {
  const d = $("impostazioni");
  if (typeof d.close === "function") d.close();
  else d.removeAttribute("open");
});
// Tocco fuori dalla finestra: si chiude
$("impostazioni").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close?.();
});

$("impostazioni").addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "imp-wpm") imp.wpm = Number(t.value);
  if (t.name === "imp-tasti") imp.tasti = t.value;
  if (t.name === "imp-fine") {
    imp.fine = t.value;
    if (imp.fine === "tasto") stato.attesaLettera = stato.attesaSpazio = false;
  }
  if (t.id === "imp-spazio") imp.spazioAuto = t.checked;
  if (t.id === "imp-suono") imp.suono = t.checked;
  if (t.id === "imp-nota") imp.nota = Number(t.value);
  salvaImpostazioni();
  riempiImpostazioni();
});

$("imp-prova").addEventListener("click", () => {
  suono.contesto();
  suonaLettere([{ c: "A", m: ".-" }]);
});

// --- Avvio ---

applicaImpostazioni();
disegnaTabella();
impostaDirezione(direzione);
$("ingresso").value = String(memoria.leggi("ingresso", "") || "");
traduci();
aggiornaTasto();
mostraScheda(memoria.leggi("scheda", "tasto") === "traduttore" ? "traduttore" : "tasto");
