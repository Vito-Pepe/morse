// Codici morse internazionali (ITU-R M.1677-1, più "!" che è d'uso comune) e funzioni per
// tradurre tra testo e morse. Nessuna dipendenza dalla pagina: si prova anche con Node
// (test/test-codici.mjs).

export const CODICI = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
  I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
  Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..",
  1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....",
  6: "-....", 7: "--...", 8: "---..", 9: "----.", 0: "-----",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--",
  "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...",
  ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "_": "..--.-",
  '"': ".-..-.", "$": "...-..-", "@": ".--.-.",
};

const INVERSO = Object.fromEntries(Object.entries(CODICI).map(([c, m]) => [m, c]));

// Il codice più lungo dell'elenco ($): oltre, nessun carattere
export const MASSIMO_SIMBOLI = Math.max(...Object.values(CODICI).map((m) => m.length));

// Gruppi per la tabella dei codici
export const GRUPPI = [
  { nome: "Lettere", caratteri: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  { nome: "Numeri", caratteri: "1234567890" },
  { nome: "Punteggiatura", caratteri: ".,?'!/()&:;=+-_\"$@" },
];

// Carattere di un codice (".-" → "A"), oppure null se non esiste
export function lettera(codice) {
  return INVERSO[codice] || null;
}

// Segni tipografici che hanno un equivalente semplice in morse
function sostituisciSegni(testo) {
  return testo
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»„]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...");
}

// Testo → morse. Restituisce le righe, ognuna fatta di parole, ognuna fatta di lettere
// { c: carattere, m: codice }. Le lettere accentate perdono l'accento (il morse
// internazionale non le ha); i caratteri senza codice finiscono in "saltati".
export function testoInMorse(testo) {
  const nfd = sostituisciSegni(String(testo)).normalize("NFD");
  const accenti = /[̀-ͯ]/.test(nfd);
  const pulito = nfd.replace(/[̀-ͯ]/g, "").toUpperCase();
  const saltati = new Set();
  const righe = pulito.split(/\r?\n/).map((riga) =>
    riga
      .split(/\s+/)
      .map((parola) => {
        const lettere = [];
        for (const ch of parola) {
          const m = CODICI[ch];
          if (m) lettere.push({ c: ch, m });
          else saltati.add(ch);
        }
        return lettere;
      })
      .filter((parola) => parola.length > 0),
  );
  return { righe, saltati: [...saltati], accenti };
}

// Punti e linee scritti in altri modi (·, •, −, –, —, _) diventano "." e "-"
export function normalizzaMorse(testo) {
  return String(testo)
    .replace(/[·•∙⋅●◦*]/g, ".")
    .replace(/[−–—‐‑‒_]/g, "-");
}

// Morse → testo. Lettere separate da spazi, parole da "/" (o "|", o due spazi),
// righe da un a capo. Ogni lettera è { c: carattere o null, m: codice }; un pezzo che
// non è fatto di punti e linee è { c: null, m: null, x: pezzo } e accende "estranei".
export function morseInTesto(morse) {
  const sconosciuti = new Set();
  let estranei = false;
  const righe = normalizzaMorse(morse)
    .split(/\r?\n/)
    .map((riga) =>
      riga
        .split(/\s*[/|]\s*| {2,}|\t+/)
        .map((parola) => {
          const lettere = [];
          for (const pezzo of parola.trim().split(/\s+/)) {
            if (!pezzo) continue;
            if (/^[.-]+$/.test(pezzo)) {
              const c = lettera(pezzo);
              if (!c) sconosciuti.add(pezzo);
              lettere.push({ c, m: pezzo });
            } else {
              estranei = true;
              lettere.push({ c: null, m: null, x: pezzo });
            }
          }
          return lettere;
        })
        .filter((parola) => parola.length > 0),
    );
  return { righe, sconosciuti: [...sconosciuti], estranei };
}

// Righe → morse da copiare: spazio tra le lettere, " / " tra le parole
export function formattaMorse(righe) {
  return righe
    .map((riga) => riga.map((parola) => parola.map((l) => l.m).join(" ")).join(" / "))
    .join("\n");
}

// Righe → testo da copiare; un codice che non esiste diventa "□"
export function formattaTesto(righe) {
  return righe
    .map((riga) => riga.map((parola) => parola.map((l) => l.c || "□").join("")).join(" "))
    .join("\n");
}
