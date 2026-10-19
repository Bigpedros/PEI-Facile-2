/** Completed-page sample; the range is heuristic, not a confidence interval. */
export function formatAcquisitionRemaining(sample:{pages:number;seconds:number},totalPages:number,elapsedSeconds:number):string|null {
 if(sample.pages<2||totalPages<=sample.pages||sample.seconds<=0)return null;
 const remaining=sample.seconds/sample.pages*(totalPages-sample.pages)-Math.max(0,elapsedSeconds-sample.seconds);
 if(remaining<=0)return 'Stima in aggiornamento: elaborazione più lunga del previsto';
 if(remaining<60)return 'Completamento in corso: meno di un minuto stimato';
 const lower=Math.max(1,Math.floor(remaining*.8/60));
 const upper=Math.max(lower+1,Math.ceil(remaining*1.3/60));
 return `Tempo rimanente stimato: circa ${lower}–${upper} minuti`;
}
