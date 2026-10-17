import {afterEach,describe,expect,it,vi} from 'vitest';
import {loadRecognizerRuntime,supportsWasmSimd} from './engine/recognizerBRuntime';
afterEach(()=>vi.restoreAllMocks());
const options={moduleUrl:'https://test.invalid/recognizer-b/ocrs_wasm.js',detectionModelUrl:'https://test.invalid/d.rten',recognitionModelUrl:'https://test.invalid/r.rten'};
function dependencies(simd=true){
 const engine={recognize_rgba:vi.fn(()=> '[]'),free:vi.fn()};
 const module={default:vi.fn(async()=>{}),OcrsRecognizer:vi.fn(function(){return engine;})};
 let clock=0;
 return {engine,module,deps:{bytes:vi.fn(async()=>new Uint8Array([1,2,3])),importModule:vi.fn(async(_url:string)=>module),simdSupported:()=>simd,now:()=>clock+=10}};
}
describe('Selezione accelerata OCRS/RTen',()=>{
 it('usa SIMD con gli stessi modelli e conserva la provenienza',async()=>{
  const {deps,engine}=dependencies();const r=await loadRecognizerRuntime(options,deps);
  expect(r.engine).toBe(engine);expect(r.info).toMatchObject({variant:'simd',moduleUrl:'https://test.invalid/recognizer-b/simd/ocrs_wasm.js',initializationMs:10});
  expect(deps.bytes).toHaveBeenCalledTimes(2);expect(deps.importModule).toHaveBeenCalledTimes(1);
 });
 it('usa il modulo originale quando il browser non supporta SIMD',async()=>{
  const {deps}=dependencies(false);const r=await loadRecognizerRuntime(options,deps);
  expect(r.info).toMatchObject({variant:'scalar',fallbackReason:'WASM_SIMD_NOT_SUPPORTED'});
  expect(deps.importModule).toHaveBeenCalledWith(options.moduleUrl);
 });
 it('se il modulo SIMD fallisce ripiega sul lettore originale senza riscaricare i modelli',async()=>{
  const {deps}=dependencies();deps.importModule.mockRejectedValueOnce(Error('SIMD asset missing'));
  const r=await loadRecognizerRuntime(options,deps);
  expect(r.info).toMatchObject({variant:'scalar',fallbackReason:'SIMD asset missing'});
  expect(deps.bytes).toHaveBeenCalledTimes(2);expect(deps.importModule).toHaveBeenCalledTimes(2);
  expect(deps.importModule).toHaveBeenLastCalledWith(options.moduleUrl);
 });
 it('non maschera l’indisponibilità di entrambi i runtime',async()=>{
  const {deps}=dependencies();deps.importModule.mockRejectedValue(Error('missing'));
  await expect(loadRecognizerRuntime(options,deps)).rejects.toThrow('missing');
 });
 it('non considera valido un modulo privo del costruttore OCR',async()=>{
  const {deps,module}=dependencies();deps.importModule.mockResolvedValueOnce({...module,OcrsRecognizer:undefined} as any);
  const r=await loadRecognizerRuntime(options,deps);expect(r.info.variant).toBe('scalar');
  expect(r.info.fallbackReason).toContain('non esportato');
 });
 it('non tenta inferenza se mancano i modelli',async()=>{
  const {deps}=dependencies();deps.bytes.mockRejectedValue(Error('model unavailable'));
  await expect(loadRecognizerRuntime(options,deps)).rejects.toThrow('model unavailable');expect(deps.importModule).not.toHaveBeenCalled();
 });
 it('verifica la capacità WASM anziché il nome del browser',()=>{
  expect(supportsWasmSimd()).toBe(true);
  vi.spyOn(WebAssembly,'validate').mockReturnValue(false);expect(supportsWasmSimd()).toBe(false);
  vi.mocked(WebAssembly.validate).mockImplementation(()=>{throw Error('unavailable');});expect(supportsWasmSimd()).toBe(false);
 });
});
