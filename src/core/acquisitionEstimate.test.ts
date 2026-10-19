import {expect,it} from 'vitest';
import {formatAcquisitionRemaining as estimate} from './acquisitionEstimate';
it('non stima dalle pagine in corso o da campioni insufficienti',()=>{
 expect(estimate({pages:1,seconds:60},12,70)).toBeNull();expect(estimate({pages:2,seconds:0},12,0)).toBeNull();
});
it('usa le pagine concluse, sottrae l’attesa corrente e segnala lo sforamento',()=>{
 expect(estimate({pages:2,seconds:120},5,120)).toBe('Tempo rimanente stimato: circa 2–4 minuti');
 expect(estimate({pages:2,seconds:120},5,250)).toBe('Completamento in corso: meno di un minuto stimato');
 expect(estimate({pages:2,seconds:120},5,350)).toBe('Stima in aggiornamento: elaborazione più lunga del previsto');
});
