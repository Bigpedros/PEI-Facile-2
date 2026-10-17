import type {OcrsWasmInstance,OcrsWasmRecognizerBOptions,RecognizerBRuntimeInfo} from '../vendor/motore-ocr-ai/src/core/ocr/recognizerB';

// A minimal v128.const probe; no UA sniffing or shared-memory threads.
export function supportsWasmSimd():boolean {
 try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,22,1,20,0,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11]));}
 catch{return false;}
}
interface Module {
 default:()=>Promise<unknown>;
 OcrsRecognizer:new(detection:Uint8Array,recognition:Uint8Array)=>OcrsWasmInstance;
}
interface Dependencies {
 importModule:(url:string)=>Promise<Module>;
 bytes:(url:string)=>Promise<Uint8Array>;
 simdSupported:()=>boolean;
 now:()=>number;
}
export async function loadRecognizerRuntime(options:OcrsWasmRecognizerBOptions,deps:Dependencies):Promise<{engine:OcrsWasmInstance;info:RecognizerBRuntimeInfo}> {
 const start=deps.now(),scalar=options.moduleUrl!;
 const simd=new URL('simd/ocrs_wasm.js',scalar).href;
 const [detection,recognition]=await Promise.all([deps.bytes(options.detectionModelUrl!),deps.bytes(options.recognitionModelUrl!)]);
 async function load(url:string){const module=await deps.importModule(url);await module.default();if(typeof module.OcrsRecognizer!=='function')throw Error('OcrsRecognizer non esportato');return new module.OcrsRecognizer(detection,recognition);}
 let engine:OcrsWasmInstance,variant:RecognizerBRuntimeInfo['variant'],fallbackReason:string|undefined;
 if(deps.simdSupported()){
  try{engine=await load(simd);variant='simd';}
  catch(error){fallbackReason=error instanceof Error?error.message:String(error);engine=await load(scalar);variant='scalar';}
 }else{engine=await load(scalar);variant='scalar';fallbackReason='WASM_SIMD_NOT_SUPPORTED';}
 return {engine,info:{variant,moduleUrl:variant==='simd'?simd:scalar,initializationMs:Math.round(deps.now()-start),supportsLineRecognition:typeof engine.recognize_line_rgba==='function',...(fallbackReason?{fallbackReason}:{})}};
}
