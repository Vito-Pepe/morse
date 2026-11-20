# morse

Per scrivere e parlare in codice morse: un **tasto del telegrafo** con l'**albero delle lettere** che si accende mentre si batte, e un **traduttore** da italiano a morse e viceversa. Pagina statica servita da nginx in un container Docker sul Raspberry Pi: tutto gira nel browser, niente server, niente account, niente cookie, niente dati salvati sul Pi.

- Pagina: `https://morse.<tailnet>.ts.net` dalla tailnet (indirizzo della repo `ingressi-https`), oppure `http://IP-DEL-PI:8095` (o `http://vito:8095`) come riserva.
- Si apre anche dal riquadro **Morse** della homepage.

## Il tasto

L'albero è disegnato come le tessere "morse code" con le lucine: si parte dall'antenna, **un punto porta a destra** (E) e **una linea a sinistra** (T); ogni simbolo dopo sposta di un passo lungo i rami. I cerchi sono le lettere che finiscono con un punto, i rettangoli quelle che finiscono con una linea.

- **Tocco breve = punto, tieni premuto = linea.** Mentre tieni premuto, l'anello intorno al tasto si riempie: quando diventa rosso è una linea.
- Si accendono le luci del percorso (verdi i punti, rosse le linee) e lo schermino in basso a destra mostra la lettera a cui sei arrivato.
- Dopo una breve pausa la lettera si scrive sul nastro in alto, con il suo codice sotto; dopo una pausa più lunga arriva lo spazio. La barretta sotto il tasto mostra quanto manca (la tacca segna la lettera, la fine della barra lo spazio).
- `⌫` toglie l'ultimo simbolo (o l'ultima lettera), `✓ Lettera` la chiude subito, `Spazio` aggiunge uno spazio.
- `Ascolta` ripete il messaggio con il suono e le luci che corrono sull'albero; `Traduci` lo porta nel traduttore.
- Toccando una lettera dell'albero se ne vede e sente il codice (senza scriverla).
- Dal computer: barra spaziatrice come tasto, `.` e `-` per punto e linea, Invio chiude la lettera, Backspace cancella.

Nelle **impostazioni** (icona in alto a destra):
- **velocità** in parole al minuto (5–25; dalla velocità dipendono la durata di punto e linea, quanto tenere premuto per una linea e la pausa che chiude la lettera);
- **due tasti** al posto di uno, uno per il punto e uno per la linea;
- **fine della lettera** solo con `✓ Lettera`: ci si muove sull'albero senza fretta, come con la tessera;
- spazio automatico, suono e nota del bip.

## Il traduttore

- **Italiano → morse** mentre scrivi: lettere separate da uno spazio, parole da ` / `, righe come nel testo. Le lettere accentate perdono l'accento (il morse internazionale non le ha: è → e); i caratteri che non esistono in morse vengono saltati e segnalati sotto.
- **Morse → italiano**: si possono usare `.` e `-` ma anche `·`, `•`, `−`, `–`, `_`; tra le parole `/`, `|` o due spazi. Sotto il riquadro c'è una tastierina (punto, linea, spazio tra le lettere, `/` tra le parole) che non apre la tastiera del telefono. Un codice che non esiste diventa `□`.
- `⇄` inverte il verso e porta la traduzione nel riquadro da tradurre.
- `Ascolta` la suona (con la lettera che si illumina), `Sull'albero` la fa vedere sul tasto, `Copia` la copia, `Condividi` (in HTTPS, dal telefono) la manda a un'altra app.
- In fondo c'è la **tabella dei codici**: toccando un carattere lo si sente.

Codici: ITU-R M.1677-1 (lettere, numeri e punteggiatura), più `!` (`-.-.--`) che è d'uso comune.

Note sul suono: su iPhone l'audio parte al primo tocco e, con un iOS aggiornato, si sente anche con il silenzioso; si spegne dalle impostazioni. Mentre suona, si accende la spia accanto al nome in alto.

## Installazione sul Raspberry Pi

```bash
cd ~
git clone https://github.com/Vito-Pepe/morse.git
cd morse
docker compose up -d --build
curl -I http://127.0.0.1:8095
```

Risposta attesa: `HTTP/1.1 200 OK`.

Aggiornamento automatico ogni 5 minuti (senza sudo):

```bash
(crontab -l 2>/dev/null; echo "*/5 * * * * cd $HOME/morse && ./update.sh >> $HOME/morse/update.log 2>&1") | crontab -
```

Indirizzo HTTPS senza porta: servizio `morse` nella repo `ingressi-https` (vedi il suo README). Il guardiano (repo `guardiano`) lo tiene acceso: la cartella `morse` è nel suo `app.conf`.

## Prove

```bash
node test/test-codici.mjs   # tabelle, traduzione nei due versi, tempi del morse
```

Per provare la pagina sul PC senza Docker basta un server di file statici nella cartella `app/` (i moduli JavaScript non partono aprendo `index.html` con un doppio clic), per esempio `python3 -m http.server -d app 8095`.

## File

| File | Cosa fa |
|---|---|
| `app/index.html` | la pagina |
| `app/morse.js` | tasto, traduttore, impostazioni |
| `app/morse-albero.js` | l'albero disegnato in SVG e le sue luci |
| `app/morse-codici.js` | i codici e la traduzione (si prova anche con Node) |
| `app/morse-suono.js` | il bip e la riproduzione con i tempi del morse |
| `app/morse.css` | lo stile (nomi propri dei file: altre app sullo stesso indirizzo non li prendono dalla cache) |

## Sicurezza

Il container è in sola lettura (`read_only`, con le cartelle temporanee di nginx in memoria), senza capacità di Linux tranne le tre che servono a nginx per partire con l'utente `nginx`, `no-new-privileges` e limite di processi; ha un `healthcheck`, così il guardiano lo riavvia se si blocca. La pagina non chiama nessun indirizzo esterno (Content-Security-Policy `default-src 'self'`), non usa cookie e niente esce su Internet. Testo, impostazioni e ultima scheda aperta restano solo nella memoria del browser.

## Porte

| Uso | Porta |
|---|---|
| Pagina (LAN e tailnet, http) | 8095 (8080–8094 sono di altre app) |
