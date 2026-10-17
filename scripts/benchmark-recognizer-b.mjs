import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createCanvas,loadImage} from '@napi-rs/canvas';
// Real inference on identical raster pixels and models, no OCR test doubles.
const [output,...images]=process.argv.slice(2);
if(!output||!images.length)throw Error('Provide a private output directory and rendered images.');
fs.mkdirSync(output,{recursive:true});
const detection=fs.readFileSync('public/models/text-detection.rten'),recognition=fs.readFileSync('public/models/text-recognition.rten');
const report={scope:'Node WASM inference, not complete browser acquisition',cases:[]};
for(const [variant,dir] of [['shipped-scalar','public/recognizer-b'],['simd','public/recognizer-b/simd']]){
 const module=await import(pathToFileURL(path.resolve(dir,'ocrs_wasm.js')));const start=performance.now();
 module.initSync({module:fs.readFileSync(path.join(dir,'ocrs_wasm_bg.wasm'))});const runtime=new module.OcrsRecognizer(detection,recognition);
 const initializationMs=Math.round(performance.now()-start);
 try{for(const imagePath of images){
  const image=await loadImage(imagePath),canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
  const pixels=new Uint8Array(ctx.getImageData(0,0,canvas.width,canvas.height).data),begin=performance.now();
  const words=JSON.parse(runtime.recognize_rgba(pixels,canvas.width,canvas.height));
  const entry={variant,image:path.basename(imagePath),width:canvas.width,height:canvas.height,initializationMs,inferenceMs:Math.round(performance.now()-begin),words:words.length};
  fs.writeFileSync(path.join(output,`${variant}-${path.basename(imagePath)}.json`),JSON.stringify(words));report.cases.push(entry);console.log(JSON.stringify(entry));
 }}finally{runtime.free();}
}
for(const imagePath of images){
 const image=path.basename(imagePath),a=JSON.parse(fs.readFileSync(path.join(output,`shipped-scalar-${image}.json`))),b=JSON.parse(fs.readFileSync(path.join(output,`simd-${image}.json`)));
 const x=report.cases.find(c=>c.image===image&&c.variant==='shipped-scalar'),y=report.cases.find(c=>c.image===image&&c.variant==='simd');
 report.cases.push({image,comparison:true,wordSequenceIdentical:JSON.stringify(a.map(w=>w.text))===JSON.stringify(b.map(w=>w.text)),outputIdentical:JSON.stringify(a)===JSON.stringify(b),speedup:x.inferenceMs/y.inferenceMs});
}
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
