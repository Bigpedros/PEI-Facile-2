import {expect,it,vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import {PDFDocument} from 'pdf-lib';
import * as scalar from '../../../public/recognizer-b/ocrs_wasm.js';
import * as simd from '../../../public/recognizer-b/simd/ocrs_wasm.js';

// Adapt only browser-worker transport to Node, keeping the real production
// models, both OCR readers, retry plans and field inference.
vi.mock('./engine/recognizerBWorker',()=>({createWorkerRuntime:async()=>{
 const variant=process.env.PEI_PERF_VARIANT==='simd'?'simd':'scalar';
 const module=variant==='simd'?simd:scalar;
 const dir=variant==='simd'?'public/recognizer-b/simd':'public/recognizer-b';
 module.initSync({module:new Uint8Array(fs.readFileSync(`${dir}/ocrs_wasm_bg.wasm`))});
 const engine=new module.OcrsRecognizer(new Uint8Array(fs.readFileSync('public/models/text-detection.rten')),new Uint8Array(fs.readFileSync('public/models/text-recognition.rten')));
 const line=(engine as any).recognize_line_rgba;
 return {recognize_rgba:engine.recognize_rgba.bind(engine),
  ...(line&&process.env.PEI_PERF_LINE!=='off'?{recognize_line_rgba:line.bind(engine)}:{}),
  runtimeInfo:{variant,moduleUrl:dir,initializationMs:0,supportsLineRecognition:!!line&&process.env.PEI_PERF_LINE!=='off'},free:engine.free.bind(engine)};
}}));
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
 const report={scope:'Node acquisition with real Tesseract + WASM; browser transport is separate',variant:process.env.PEI_PERF_VARIANT??'scalar',pages:summaries,processingTimeMs:result.processingTimeMs,totalFields:summaries.reduce((n,p)=>n+p.fields,0)};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
},1_800_000);
