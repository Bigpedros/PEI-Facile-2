import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createCanvas} from '@napi-rs/canvas';
import * as simd from '../../../public/recognizer-b/simd/ocrs_wasm.js';
const root='public/recognizer-b/simd/';
describe('Asset reali OCRS/RTen distribuiti',()=>{
 it('include un modulo SIMD coerente con il manifest riproducibile',()=>{
  const manifest=JSON.parse(fs.readFileSync(root+'build.json','utf8'));
  for(const name of ['ocrs_wasm.js','ocrs_wasm_bg.wasm']){
   const bytes=fs.readFileSync(root+name);
   expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(manifest.files[name].sha256);
   expect(bytes.length).toBe(manifest.files[name].bytes);
  }
  expect(crypto.createHash('sha256').update(fs.readFileSync('recognizer-b/ocrs-wasm/src/lib.rs')).digest('hex')).toBe(manifest.sourceSha256);
  expect(crypto.createHash('sha256').update(fs.readFileSync('recognizer-b/ocrs-wasm/Cargo.lock')).digest('hex')).toBe(manifest.cargoLockSha256);
  const features=WebAssembly.Module.customSections(new WebAssembly.Module(fs.readFileSync(root+'ocrs_wasm_bg.wasm')),'target_features');
  expect(features.map(b=>new TextDecoder().decode(b)).join('')).toContain('simd128');
 });
 it('conserva il runtime originale privo di requisito SIMD',()=>{
  const features=WebAssembly.Module.customSections(new WebAssembly.Module(fs.readFileSync('public/recognizer-b/ocrs_wasm_bg.wasm')),'target_features');
  expect(features.map(b=>new TextDecoder().decode(b)).join('')).not.toContain('simd128');
 });
 it('esegue una vera lettura ottica locale con i modelli distribuiti',()=>{
  simd.initSync({module:fs.readFileSync(root+'ocrs_wasm_bg.wasm')});
  const engine=new simd.OcrsRecognizer(fs.readFileSync('public/models/text-detection.rten'),fs.readFileSync('public/models/text-recognition.rten'));
  try{
   const canvas=createCanvas(140,60),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,140,60);ctx.fillStyle='black';ctx.font='32px sans-serif';ctx.fillText('TEST',10,42);
   const words=JSON.parse(engine.recognize_line_rgba(new Uint8Array(ctx.getImageData(0,0,140,60).data),140,60));
   expect(words.map((w:any)=>w.text).join(' ')).toBe('TEST');
   for(const w of words){expect(w.rect[0]).toBeGreaterThanOrEqual(0);expect(w.rect[1]).toBeGreaterThanOrEqual(0);expect(w.rect[2]).toBeLessThanOrEqual(140);expect(w.rect[3]).toBeLessThanOrEqual(60);}
  }finally{engine.free();}
 },30000);
});
