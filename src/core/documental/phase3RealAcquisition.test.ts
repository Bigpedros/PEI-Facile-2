import {expect,it,vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import {PDFDocument} from 'pdf-lib';
// Adapt only transport: real WASM inference runs off-thread, as in the browser.
vi.mock('./engine/recognizerBWorker',()=>({createWorkerRuntime:async()=>{
 const {Worker}=await import('node:worker_threads');
 const variant=process.env.PEI_PERF_VARIANT==='simd'?'simd':'scalar';
 const worker=new Worker(path.resolve('scripts/benchmark-ocrs-worker.mjs'),{workerData:{root:process.cwd(),variant,line:process.env.PEI_PERF_LINE!=='off'}});
 let next=0,info:any;const pending=new Map<number,any>();
 const fail=(error:Error)=>{for(const p of pending.values())p.reject(error);pending.clear();};
 worker.on('error',fail);
 worker.on('message',data=>{if(data.ready){info=data.info;return;}const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);});
 const read=(pixels:Uint8Array,width:number,height:number,singleLine=false)=>new Promise<string>((resolve,reject)=>{
  const id=next++;pending.set(id,{resolve,reject});const buffer=pixels.buffer as ArrayBuffer;
  worker.postMessage({id,pixels:buffer,width,height,singleLine},[buffer]);
 });
 return {get runtimeInfo(){return info;},recognize_rgba:read,
  ...(variant==='simd'&&process.env.PEI_PERF_LINE!=='off'?{recognize_line_rgba:(p:Uint8Array,w:number,h:number)=>read(p,w,h,true)}:{}),
  free:()=>{fail(Error('Benchmark worker terminated'));void worker.terminate();}};
}}));
vi.mock('./engine',async importOriginal=>{
 const actual=await importOriginal<typeof import('./engine')>();
 return {...actual,analyzeDocument:(file:File,options:any)=>actual.analyzeDocument(file,{...options,parallelIndependentReading:process.env.PEI_PERF_PARALLEL==='on'})};
});
import {processDocumentAcquisition} from '../documentAcquisitionService';
const input=process.env.PEI_PERF_INPUT,output=process.env.PEI_PERF_OUTPUT;
it.skipIf(!input||!output)('benchmark reale di acquisizione e geometria, senza risultati OCR simulati',async()=>{
 const out=path.resolve(output!);
 if(out===process.cwd()||out.startsWith(process.cwd()+path.sep))throw Error('Use a private output directory outside the repository.');
 fs.mkdirSync(out,{recursive:true});vi.stubGlobal('HTMLCanvasElement',createCanvas(1,1).constructor);
 const summaries:any[]=[];
 const result=await processDocumentAcquisition(new Uint8Array(fs.readFileSync(input!)),'benchmark-source.pdf',{
  onDocumentalPage:page=>{
   const {image:_image,...evidence}=page;fs.writeFileSync(path.join(out,`page-${page.pageNumber}.json`),JSON.stringify(evidence));
   const summary={page:page.pageNumber,fields:page.fields.length,tokens:page.tokens.length,secondReader:page.secondReader,elapsedMs:page.elapsedMs,stageTimingsMs:page.stageTimingsMs,runtimeInfo:page.ocrReading?.runtimeInfo,regionalExecution:page.ocrReading?.regionalExecution};
   summaries.push(summary);console.log(JSON.stringify(summary));
  },
 });
 const pdf=await PDFDocument.load(result.canonicalDocument!);expect(pdf.getPageCount()).toBe(summaries.length);expect(summaries.length).toBeGreaterThan(0);
 for(const p of result.documentalResult!.pages){
  expect(p.secondReader?.execution).toBe('completed');
  for(const f of p.fields){expect(f.box.x).toBeGreaterThanOrEqual(0);expect(f.box.y).toBeGreaterThanOrEqual(0);expect(f.box.x+f.box.width).toBeLessThanOrEqual(p.width+1);expect(f.box.y+f.box.height).toBeLessThanOrEqual(p.height+1);}
 }
 const report={scope:'Node acquisition with real Tesseract + WASM; browser transport is separate',variant:process.env.PEI_PERF_VARIANT??'scalar',parallel:process.env.PEI_PERF_PARALLEL==='on',pages:summaries,processingTimeMs:result.processingTimeMs,totalFields:summaries.reduce((n,p)=>n+p.fields,0)};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
},1_800_000);
