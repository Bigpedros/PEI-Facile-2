# Prestazioni: SIMD e riletture locali mirate

Repository operativo: `Bigpedros/PEI-Facile-2`, base `effa729`.

## Modifica

- Il worker verifica il supporto WebAssembly SIMD e carica il modulo accelerato
  da `public/recognizer-b/simd/`. Se non supportato o non caricabile, usa il modulo
  originale, che rimane invariato. Nessun requisito SharedArrayBuffer/COOP/COEP.
- I modelli RTen, Tesseract, la risoluzione 200 dpi, i limiti dei retry e le regole
  di scelta del testo e inferenza dei campi rimangono invariati.
- Per piccoli ritagli testuali già posizionati, relativi a disaccordi critici o
  segmentazione incoerente, il nuovo metodo esegue una vera nuova lettura della
  riga, evitando il detector a dimensione fissa. Non riutilizza i token della
  lettura completa come se fossero una nuova evidenza ottica.
- Il percorso diretto richiede altezza del ritaglio 8–80 px e larghezza <=16 volte
  l'altezza. Testo mancante, regioni grandi e altri motivi mantengono il detector.
  Letture dirette vuote/fallite ripiegano sul detector; l'annullamento si propaga.
- Un solo worker e runtime per acquisizione. Nessuna nuova elaborazione implicita
  è introdotta nel calibratore o nell'esportazione della diagnostica.
- `ocrReading.runtimeInfo` riporta variante reale, URL, tempo di inizializzazione,
  supporto lettura di riga ed eventuale motivo del fallback.
  `regionalExecution` distingue chiamate dirette, detector e fallback regionali.

## Build e distribuzione

I binari necessari sono già presenti nel repository: AI Studio deve eseguire solo
la normale build npm, senza installare Rust o compilare il WASM.

Per ricostruire: toolchain Rust 1.99.0, target wasm32-unknown-unknown,
wasm-bindgen CLI 0.2.129, quindi `npm run build:recognizer-b`.
Le versioni OCRS/RTen e wasm-bindgen sono fissate; Cargo.lock è incluso.
Il manifest `public/recognizer-b/simd/build.json` registra flags, versioni e hash.
Il modulo scalar originale non viene sovrascritto dallo script di build.
Il nuovo WASM occupa circa 4,88 MB (il fallback circa 2,86 MB): il vantaggio
misurato è nel calcolo, non in una riduzione dei dati da caricare la prima volta.

## Confronto reale completato

Stesso PDF canonico A4 Comune di Roma del repository, 12 pagine, entrambi i lettori
reali. Solo il trasporto browser-worker viene adattato al filesystem Node.

| Misura | Prima | Dopo |
| --- | ---: | ---: |
| Acquisizione completa | 425.544 ms | 204.887 ms |
| Campi proposti | 188 | 188 |

Riduzione indicativa del tempo: 51,85% (circa 2,08x). Entrambe le esecuzioni hanno
completato tutte le pagine. Il confronto automatico conferma, su ogni pagina:
testo finale, token posizionati, evidenze primarie e secondarie complete, e tutte
le proprietà dei campi identiche. Sono esclusi solo gli UUID casuali interni.
Sono state eseguite 16 letture regionali dirette e 51 con detector.

I processi hanno avuto parte dell'esecuzione sovrapposta sullo stesso host
(quota 8 vCPU): la misura non è un microbenchmark CPU isolato. Non rappresenta
il tempo sul PC dell'utente né la prova sul suo originale di 13 pagine.
Il report aggregato è in `docs/baselines/pei-roma-performance-20261017.json`.

Primi confronti seriali di sola seconda lettura sui raster anonimo e Roma pagina 3:
26,889→11,364 s e 22,633→9,646 s, output completo identico. Non sono tempi di
acquisizione totale. Il miglioramento non dimostra accuratezza assoluta del testo.

## Riproduzione

`phase2RealAcquisition.test.ts` è opt-in: impostare PEI_PERF_INPUT, PEI_PERF_OUTPUT
(directory privata fuori dal repository) e PEI_PERF_VARIANT=scalar oppure simd.
Eseguire lo stesso PDF con entrambe le varianti. Il test usa Tesseract e i modelli
reali; non inventa risultati OCR. PEI_PERF_LINE=off disabilita solo il percorso di
riga nel benchmark, senza cambiare la build di produzione.

`node scripts/compare-acquisition-benchmarks.mjs PRIMA DOPO OUTPUT.json`
confronta risultati e tempi e fallisce se testo/campi/coordinate cambiano.
`benchmark-recognizer-b.mjs` confronta solo l'inferenza su PNG già renderizzati.

## Verifica dopo sincronizzazione e republish

1. Acquisire nuovamente il PDF anonimo: le evidenze già salvate non vanno ricalcolate.
2. Esportare il JSON e verificare `ocrReading.runtimeInfo.variant = simd` e
   `secondReader.execution = completed`. In caso di scalar, leggere fallbackReason.
3. Verificare `regionalExecution` e i tempi reali di acquisizione.
4. Ripetere sul documento reale completo mantenendo copia di sicurezza.

I test automatici coprono selezione/fallback, modelli caricati una sola volta,
riuso/annullamento worker, guardie dei ritagli, coordinate, conservazione dei campi,
manifest e una vera lettura di riga con il WASM e i modelli distribuiti.
Verifica finale: 146 test mirati superati in 18 file; il benchmark lungo opt-in
è saltato nella suite ordinaria, dopo essere stato eseguito separatamente con
entrambi i runtime. TypeScript e build di produzione riusciti.
La verifica del nuovo worker nell'app pubblicata resta da eseguire dopo republish.
