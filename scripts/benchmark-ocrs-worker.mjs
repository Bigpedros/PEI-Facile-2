import {parentPort,workerData} from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {root,variant,line}=workerData;
const dir=path.join(root,'public/recognizer-b',variant==='simd'?'simd':'');
const start=performance.now();
const module=await import(pathToFileURL(path.join(dir,'ocrs_wasm.js')).href);
module.initSync({module:new Uint8Array(fs.readFileSync(path.join(dir,'ocrs_wasm_bg.wasm')))});
const engine=new module.OcrsRecognizer(new Uint8Array(fs.readFileSync(path.join(root,'public/models/text-detection.rten'))),new Uint8Array(fs.readFileSync(path.join(root,'public/models/text-recognition.rten'))));
parentPort.postMessage({ready:true,info:{variant,moduleUrl:dir,initializationMs:Math.round(performance.now()-start),supportsLineRecognition:!!line&&typeof engine.recognize_line_rgba==='function'}});
parentPort.on('message',data=>{
 try{const read=data.singleLine&&line&&engine.recognize_line_rgba?engine.recognize_line_rgba:engine.recognize_rgba;
  parentPort.postMessage({id:data.id,result:read.call(engine,new Uint8Array(data.pixels),data.width,data.height)});
 }catch(error){parentPort.postMessage({id:data.id,error:String(error)});}
});
