import {afterEach,describe,expect,it,vi} from 'vitest';
import {createWorkerRuntime} from './engine/recognizerBWorker';
class TestWorker {
 static instances:TestWorker[]=[];
 onmessage:((event:{data:any})=>void)|undefined;
 onerror:((event:{message:string})=>void)|undefined;
 postMessage=vi.fn();terminate=vi.fn();
 constructor(){TestWorker.instances.push(this);}
}
afterEach(()=>{vi.unstubAllGlobals();TestWorker.instances=[];});
describe('Trasporto worker del runtime accelerato',()=>{
 it('riusa un solo worker e comunica il runtime effettivo',async()=>{
  vi.stubGlobal('Worker',TestWorker);
  const runtime=await createWorkerRuntime({moduleUrl:'https://test.invalid/ocrs_wasm.js'}),worker=TestWorker.instances[0];
  expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({kind:'initialize'}));
  const pending=runtime.recognize_rgba(new Uint8Array(4),1,1);
  worker.onmessage!({data:{kind:'ready',runtimeInfo:{variant:'simd',initializationMs:15}}});worker.onmessage!({data:{id:0,result:'[]'}});
  expect(await pending).toBe('[]');expect(runtime.runtimeInfo).toMatchObject({variant:'simd',initializationMs:15});
  const second=runtime.recognize_rgba(new Uint8Array(4),1,1);worker.onmessage!({data:{id:1,result:'[]'}});
  await second;expect(TestWorker.instances).toHaveLength(1);runtime.free!();
 });
 it('termina anche un worker in inizializzazione e rifiuta richieste pendenti',async()=>{
  vi.stubGlobal('Worker',TestWorker);const runtime=await createWorkerRuntime({});
  const pending=runtime.recognize_rgba(new Uint8Array(4),1,1);const rejection=expect(pending).rejects.toThrow('terminato');runtime.free!();await rejection;
  expect(TestWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
 });
 it('trasmette la richiesta di lettura ottica della riga',async()=>{
  vi.stubGlobal('Worker',TestWorker);const runtime=await createWorkerRuntime({}),worker=TestWorker.instances[0];
  const pending=runtime.recognize_line_rgba!(new Uint8Array(4),1,1);
  expect(worker.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({kind:'recognize',singleLine:true}),expect.any(Array));
  worker.onmessage!({data:{id:0,result:'[]'}});await pending;runtime.free!();
 });
});
