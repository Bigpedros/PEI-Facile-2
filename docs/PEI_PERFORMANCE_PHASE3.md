# Letture OCR concorrenti e stima di attesa

Base: 986b014, contenuto equivalente a 77e7c14.

## Intervento

Tesseract e OCRS leggevano la pagina completa uno dopo l’altro. Ora vengono
avviati sulla stessa pagina nei due worker già esistenti. Il confronto dei
risultati, le riletture regionali e l’inferenza attendono entrambi. Tesseract
usa il raster con contrasto, OCRS il raster canonico originale. Le pagine
restano sequenziali; nessun worker aggiuntivo, cambio di DPI, modelli o soglie.
`EngineOptions.parallelIndependentReading=false` mantiene la modalità seriale.
I runner personalizzati e il testo nativo mantengono i percorsi precedenti.

Worker dedicato, caching del runtime e Transferable erano già presenti nella
base: non costituiscono nuove ottimizzazioni di questa fase.

## Tempi

`stageTimingsMs.ocrWall` è il subtotale di primaryOcr + secondaryOcr: non va
sommato di nuovo alle due voci. Con le letture concorrenti, secondaryOcr è
l’attesa residua dopo A, non la durata esclusiva di B. I tempi reali di B
pagina intera e dei ritentativi sono in `ocrReading.timingsMs`.
`ocrReading.executionMode` distingue parallel-full-page da serial.

## Attesa

La finestra osservata è CustomModelManager.tsx. L’avviso iniziale informa che
l’acquisizione può richiedere diversi minuti. La stima usa almeno due pagine
concluse, campionate all’avvio della successiva, e sottrae il tempo corrente.
L’intervallo in minuti è euristico, non un intervallo statistico. In caso di
sforamento informa che la stima è in aggiornamento. Annullamento, tempo
trascorso, pagina e avanzamento restano disponibili.

## Benchmark riproducibile

Il test opt-in phase3RealAcquisition.test.ts adatta il trasporto browser a
worker_threads Node, senza simulare i motori OCR. Impostare PEI_PERF_INPUT,
PEI_PERF_OUTPUT (directory privata fuori dal repository), PEI_PERF_VARIANT=simd,
PEI_PERF_PARALLEL=off oppure on, poi eseguire:

    npx vitest run src/core/documental/phase3RealAcquisition.test.ts

Eseguire le due modalità separatamente e confrontare con:

    node scripts/compare-acquisition-benchmarks.mjs PRIMA DOPO REPORT.json

Il confronto verifica testo, token posizionati dei due lettori, token finali
ed ogni proprietà dei campi tranne UUID casuali. Il PDF canonico Roma pubblico
di 12 pagine è diverso dal documento dell’utente. I risultati Node non sono
una promessa di durata sul suo computer. La verifica browser post-publish
resta distinta. Le evidenze vengono esportate senza nuove letture OCR.

## Risultati verificati il 19 ottobre 2026

Node v24.19.0 Linux x64, Intel Xeon Platinum 8573C, quota 8 vCPU.
Il report `docs/baselines/pei-roma-concurrent-20261019.json` registra input,
ambiente, tempi di ogni pagina e confronti di qualità.

- Acquisizione seriale completa: 302.059 ms (5:02,059).
- Acquisizione concorrente completa: 275.370 ms (4:35,370).
- Due processi distinti eseguiti uno dopo l’altro; una prova per modalità.
- Un ultimo typecheck è coinciso con l’avvio del primo processo. Per escludere
  questo transitorio e il riscaldamento iniziale, il confronto a caldo usa le
  pagine 3–12: 236.240 contro 215.819 ms, riduzione osservata dell’8,64%.
- Risultati identici sulle 12 pagine: testo, token posizionati finali, evidenze
  dei due lettori e tutte le proprietà dei 188 campi, esclusi gli UUID casuali.
- Secondo lettore completato su ogni pagina; nessuna riduzione di DPI o
  variazione delle soglie regionali.

Il beneficio è contenuto e non risolve da solo i tempi sul computer dell’utente.
Il costo interno dell’inferenza OCRS resta il limite principale aperto.

Controlli: 165 test superati in 21 file (3 test facoltativi saltati in quella
suite), più il nuovo benchmark reale eseguito separatamente in entrambe le
modalità. Typecheck e build di produzione riusciti. La suite verifica anche
annullamento, confronto dopo entrambi i lettori, snapshot salvati/riaperti,
calibrazione e geometria. Verifica browser post-publish ancora da eseguire.
