import {afterEach,describe,expect,it,vi} from 'vitest';
import {createCanvas} from '@napi-rs/canvas';
import {OcrsWasmRecognizerB} from './vendor/motore-ocr-ai/src/core/ocr/recognizerB';
afterEach(()=>vi.unstubAllGlobals());
const word=JSON.stringify([{text:'7',rect:[1,1,8,8]}]);
function setup(){
 const image=createCanvas(600,800);vi.stubGlobal('HTMLCanvasElement',image.constructor);
 const ctx=image.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,600,800);
 const runtime={recognize_rgba:vi.fn(async()=>word),recognize_line_rgba:vi.fn(async()=>word)};
 const reader=new OcrsWasmRecognizerB({},async()=>runtime);
 const input={image:image as unknown as HTMLCanvasElement,pageNumber:1,width:600,height:800};
 const region={box:{x:50,y:50,width:30,height:20},kind:'text' as const,reason:'critical-disagreement'};
 return {reader,runtime,input,region};
}
describe('Riletture ottiche locali senza rilevamento ridondante',()=>{
 it('legge nuovamente un piccolo testo e riporta le coordinate sulla pagina',async()=>{
  const {reader,runtime,input,region}=setup();const tokens=await reader.recognizeRegions(input,[region]);
  expect(runtime.recognize_line_rgba).toHaveBeenCalledTimes(1);expect(runtime.recognize_rgba).not.toHaveBeenCalled();
  expect(tokens[0].text).toBe('7');expect(tokens[0].box).toEqual({x:48,y:47,width:7,height:7});expect(reader.lastRegionStats).toEqual({directLine:1,detector:0,fallback:0});
 });
 it('mantiene il rilevamento completo per regioni grandi o testo mancante',async()=>{
  const {reader,runtime,input,region}=setup();await reader.recognizeRegions(input,[{...region,reason:'missing-primary-text'},{...region,box:{...region.box,height:100}}]);
  expect(runtime.recognize_line_rgba).not.toHaveBeenCalled();expect(runtime.recognize_rgba).toHaveBeenCalledTimes(2);
 });
 it('mantiene il percorso originale quando manca il metodo di lettura di riga',async()=>{
  const {runtime,input,region}=setup();const reader=new OcrsWasmRecognizerB({},async()=>({recognize_rgba:runtime.recognize_rgba}));
  expect(await reader.recognizeRegions(input,[region])).toHaveLength(1);expect(runtime.recognize_rgba).toHaveBeenCalledTimes(1);
 });
 it('ritenta con il rilevatore se la lettura diretta è vuota',async()=>{
  const {reader,runtime,input,region}=setup();runtime.recognize_line_rgba.mockResolvedValue('[]');expect(await reader.recognizeRegions(input,[region])).toHaveLength(1);
  expect(reader.lastRegionStats).toEqual({directLine:1,detector:1,fallback:1});
 });
 it('propaga l’annullamento senza avviare un fallback',async()=>{
  const {reader,runtime,input,region}=setup();const controller=new AbortController();runtime.recognize_line_rgba.mockImplementation(async()=>{controller.abort();throw Error('aborted');});
  await expect(reader.recognizeRegions(input,[region],controller.signal)).rejects.toMatchObject({name:'AbortError'});expect(runtime.recognize_rgba).not.toHaveBeenCalled();
 });
 it('azzera i contatori quando inizia una nuova pagina',async()=>{
  const {reader,input,region}=setup();await reader.recognizeRegions(input,[region]);expect(reader.lastRegionStats.directLine).toBe(1);await reader.recognize(input);
  expect(reader.lastRegionStats).toEqual({directLine:0,detector:0,fallback:0});
 });
 it('rispetta la capacità dichiarata dal fallback anche quando il proxy espone il metodo',async()=>{
  const {runtime,input,region}=setup();const reader=new OcrsWasmRecognizerB({},async()=>({...runtime,runtimeInfo:{variant:'scalar',moduleUrl:'legacy',initializationMs:0,supportsLineRecognition:false}}));
  await reader.recognizeRegions(input,[region]);expect(runtime.recognize_line_rgba).not.toHaveBeenCalled();expect(runtime.recognize_rgba).toHaveBeenCalledTimes(1);
 });
});
