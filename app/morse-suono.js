// Suono del morse con la Web Audio API: il tono del tasto finché resta premuto, i bip
// singoli e la riproduzione di un messaggio intero con i tempi giusti.
//
// Tempi del morse (u = durata di un punto): linea 3u, pausa tra i simboli 1u, tra le
// lettere 3u, tra le parole 7u. Con W parole al minuto, u = 1,2 / W secondi.

const RAMPA = 0.006; // secondi di salita e discesa: senza, ogni bip fa "clic"

export class Suono {
  constructor() {
    this.ctx = null;
    this.acceso = true;
    this.nota = 600;
    this.volume = 0.28;
    this.tono = null;
  }

  // Il contesto audio si crea al primo tocco: su iPhone l'audio parte solo così
  contesto() {
    if (!this.acceso) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      // iPhone: senza questo la Web Audio tace con l'interruttore del silenzioso
      try {
        if (navigator.audioSession) navigator.audioSession.type = "playback";
      } catch {
        /* non tutti i browser lo hanno */
      }
      try {
        this.ctx = new AC();
      } catch {
        return null;
      }
    }
    if (this.ctx.state !== "running") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  _oscillatore(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = this.nota;
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    return { osc, gain };
  }

  // Tono del tasto: parte con inizia(), finisce con ferma()
  inizia() {
    this.ferma();
    const ctx = this.contesto();
    if (!ctx) return;
    const t = ctx.currentTime;
    const v = this._oscillatore(ctx);
    v.gain.gain.setValueAtTime(0, t);
    v.gain.gain.linearRampToValueAtTime(this.volume, t + RAMPA);
    v.osc.start(t);
    this.tono = v;
  }

  ferma() {
    const v = this.tono;
    this.tono = null;
    if (!v || !this.ctx) return;
    const t = this.ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + RAMPA);
    v.osc.stop(t + RAMPA + 0.02);
  }

  // Un bip lungo "durata" secondi (tasto a due pulsanti, prova della nota)
  bip(durata) {
    const ctx = this.contesto();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    const v = this._oscillatore(ctx);
    v.gain.gain.setValueAtTime(0, t);
    v.gain.gain.linearRampToValueAtTime(this.volume, t + RAMPA);
    v.gain.gain.setValueAtTime(this.volume, t + durata - RAMPA);
    v.gain.gain.linearRampToValueAtTime(0, t + durata);
    v.osc.start(t);
    v.osc.stop(t + durata + 0.02);
  }
}

// Tempi di un messaggio. "elementi" è un elenco di { m: ".-" } (una lettera) o
// { pausa: true } (spazio tra le parole). Restituisce i toni { t0, t1, i, j }
// (i = elemento, j = simbolo) e la durata totale, in secondi.
export function tempi(elementi, wpm) {
  const u = 1.2 / wpm;
  const toni = [];
  let t = 0;
  let dopoLettera = false;
  elementi.forEach((el, i) => {
    if (el.pausa) {
      // Le lettere lasciano già 3u dopo di sé: per arrivare a 7u ne mancano 4
      if (dopoLettera) t += 4 * u;
      dopoLettera = false;
      return;
    }
    if (!el.m) return;
    [...el.m].forEach((s, j) => {
      const d = (s === "-" ? 3 : 1) * u;
      toni.push({ t0: t, t1: t + d, i, j });
      t += d + u;
    });
    t += 2 * u;
    dopoLettera = true;
  });
  // Alla fine non serve aspettare la pausa dopo l'ultima lettera
  const durata = toni.length ? toni[toni.length - 1].t1 + u : 0;
  return { toni, durata };
}

// Riproduce un messaggio: suono (se acceso) e chiamate per accendere luci e lettere
export class Riproduttore {
  constructor(suono) {
    this.suono = suono;
    this.attivo = false;
    this._frame = 0;
    this._voce = null;
    this._chiamate = null;
  }

  riproduci(elementi, wpm, chiamate = {}) {
    this.ferma();
    const { toni, durata } = tempi(elementi, wpm);
    if (!toni.length) {
      chiamate.fine?.(false);
      return;
    }
    this.attivo = true;
    this._chiamate = chiamate;

    const ctx = this.suono.contesto();
    const anticipo = 0.08;
    let orologio;
    if (ctx && ctx.state === "running") {
      const inizio = ctx.currentTime + anticipo;
      const v = this.suono._oscillatore(ctx);
      const vol = this.suono.volume;
      for (const tono of toni) {
        v.gain.gain.setValueAtTime(0, inizio + tono.t0);
        v.gain.gain.linearRampToValueAtTime(vol, inizio + tono.t0 + RAMPA);
        v.gain.gain.setValueAtTime(vol, inizio + tono.t1 - RAMPA);
        v.gain.gain.linearRampToValueAtTime(0, inizio + tono.t1);
      }
      v.osc.start(inizio);
      v.osc.stop(inizio + durata + 0.05);
      this._voce = v;
      orologio = () => ctx.currentTime - inizio;
    } else {
      // Senza audio (spento, o non ancora sbloccato) le luci vanno lo stesso
      const inizio = performance.now() / 1000 + anticipo;
      orologio = () => performance.now() / 1000 - inizio;
    }

    let prossimo = 0; // primo tono non ancora iniziato
    let acceso = null; // tono che sta suonando
    const passo = () => {
      if (!this.attivo) return;
      const t = orologio();
      if (acceso && t >= acceso.t1) {
        acceso = null;
        chiamate.tono?.(false);
      }
      while (prossimo < toni.length && t >= toni[prossimo].t0) {
        const tono = toni[prossimo++];
        if (t < tono.t1) {
          acceso = tono;
          chiamate.tono?.(true);
        }
        chiamate.simbolo?.(tono.i, tono.j);
      }
      if (t >= durata) {
        this._fine(false);
        return;
      }
      this._frame = requestAnimationFrame(passo);
    };
    this._frame = requestAnimationFrame(passo);
  }

  ferma() {
    if (!this.attivo) return;
    this._fine(true);
  }

  _fine(interrotto) {
    this.attivo = false;
    cancelAnimationFrame(this._frame);
    const v = this._voce;
    this._voce = null;
    if (v && this.suono.ctx) {
      const t = this.suono.ctx.currentTime;
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(v.gain.gain.value, t);
      v.gain.gain.linearRampToValueAtTime(0, t + RAMPA);
      try {
        v.osc.stop(t + RAMPA + 0.02);
      } catch {
        /* già fermo */
      }
    }
    const chiamate = this._chiamate;
    this._chiamate = null;
    chiamate?.tono?.(false);
    chiamate?.fine?.(interrotto);
  }
}
