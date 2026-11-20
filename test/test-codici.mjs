// Prove delle tabelle e del traduttore: node test/test-codici.mjs
import assert from "node:assert/strict";
import {
  CODICI, MASSIMO_SIMBOLI, lettera, testoInMorse, morseInTesto, formattaMorse, formattaTesto, normalizzaMorse,
} from "../app/morse-codici.js";
import { tempi } from "../app/morse-suono.js";

let prove = 0;
function prova(nome, f) {
  f();
  prove++;
  console.log(`ok - ${nome}`);
}

prova("codici unici e fatti solo di punti e linee", () => {
  const visti = new Set();
  for (const [c, m] of Object.entries(CODICI)) {
    assert.match(m, /^[.-]+$/, c);
    assert.ok(!visti.has(m), `codice doppio ${m}`);
    visti.add(m);
    assert.equal(lettera(m), c);
  }
  assert.equal(MASSIMO_SIMBOLI, 7);
});

prova("alcuni codici noti", () => {
  assert.equal(CODICI.S, "...");
  assert.equal(CODICI.O, "---");
  assert.equal(CODICI.L, ".-..");
  assert.equal(CODICI["0"], "-----");
  assert.equal(CODICI["?"], "..--..");
  assert.equal(lettera("........"), null);
});

prova("italiano → morse", () => {
  const r = testoInMorse("Ciao a tutti");
  assert.equal(formattaMorse(r.righe), "-.-. .. .- --- / .- / - ..- - - ..");
  assert.deepEqual(r.saltati, []);
  assert.equal(r.accenti, false);
});

prova("accenti tolti, apostrofi tipografici, caratteri saltati", () => {
  const r = testoInMorse("Perché l’acqua è 10€");
  assert.equal(formattaMorse(r.righe), ".--. . .-. -.-. .... . / .-.. .----. .- -.-. --.- ..- .- / . / .---- -----");
  assert.equal(r.accenti, true);
  assert.deepEqual(r.saltati, ["€"]);
});

prova("righe e spazi multipli", () => {
  const r = testoInMorse("sos\n\n  ok  ");
  assert.equal(formattaMorse(r.righe), "... --- ...\n\n--- -.-");
});

prova("morse → italiano, separatori diversi", () => {
  assert.equal(formattaTesto(morseInTesto("-.-. .. .- --- / .- / - ..- - - ..").righe), "CIAO A TUTTI");
  assert.equal(formattaTesto(morseInTesto("... --- ...|.- .-").righe), "SOS AA");
  assert.equal(formattaTesto(morseInTesto("...  ---").righe), "S O");
  assert.equal(formattaTesto(morseInTesto("·−·· —·—").righe), "LK");
  assert.equal(formattaTesto(morseInTesto("..--.- _").righe), "_T");
});

prova("morse → italiano: codici sconosciuti e pezzi estranei", () => {
  const r = morseInTesto(".- ........ ciao");
  assert.equal(formattaTesto(r.righe), "A□□");
  assert.deepEqual(r.sconosciuti, ["........"]);
  assert.equal(r.estranei, true);
});

prova("andata e ritorno", () => {
  const testo = "QUESTA È UNA PROVA: 1+1=2, (VERO)? SÌ! 'OK' \"CIAO\" A@B.IT $5 _X_ -Y- /Z/ &;";
  const andata = formattaMorse(testoInMorse(testo).righe);
  const ritorno = formattaTesto(morseInTesto(andata).righe);
  assert.equal(ritorno, testo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " "));
});

prova("normalizzaMorse", () => {
  assert.equal(normalizzaMorse("·•−–—_"), "..----");
});

prova("tempi: punto, linea, pause tra lettere e parole", () => {
  // 12 parole al minuto: u = 0,1 s
  const { toni, durata } = tempi([{ m: ".-" }, { pausa: true }, { m: "." }], 12);
  const arrotonda = (x) => Math.round(x * 1000) / 1000;
  assert.deepEqual(
    toni.map((t) => [arrotonda(t.t0), arrotonda(t.t1), t.i, t.j]),
    [
      [0, 0.1, 0, 0], // punto
      [0.2, 0.5, 0, 1], // pausa 1u, linea 3u
      [1.2, 1.3, 2, 0], // dopo la lettera 3u + 4u = 7u tra le parole
    ],
  );
  assert.equal(arrotonda(durata), 1.4);
});

prova("tempi: niente pause in testa né doppie", () => {
  const { toni } = tempi([{ pausa: true }, { m: "." }, { pausa: true }, { pausa: true }, { m: "." }], 12);
  assert.equal(Math.round(toni[0].t0 * 1000), 0);
  assert.equal(Math.round(toni[1].t0 * 1000), 800);
});

console.log(`\n${prove} prove superate`);
