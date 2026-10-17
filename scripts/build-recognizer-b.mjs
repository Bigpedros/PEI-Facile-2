import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const crate=path.join(root,'recognizer-b/ocrs-wasm');
const variant=process.argv.includes('--scalar')?'scalar':'simd';
const arg=process.argv.indexOf('--out-dir');
const output=arg>=0?path.resolve(process.argv[arg+1]):path.join(root,'public/recognizer-b/simd');
if(variant==='scalar'&&arg<0)throw Error('Scalar benchmarking requires an explicit --out-dir; shipped fallback is never overwritten.');
const feature=variant==='simd'?'+simd128':'-simd128';
const env={...process.env,RUSTFLAGS:`${process.env.RUSTFLAGS??''} -C target-feature=${feature}`.trim()};
function run(bin,args){const r=spawnSync(bin,args,{cwd:crate,env,encoding:'utf8',stdio:['ignore','pipe','inherit']});if(r.error)throw r.error;if(r.status!==0)throw Error(`${bin} failed (${r.status})`);return r.stdout.trim();}
run('cargo',['build','--locked','--release','--target','wasm32-unknown-unknown']);
const target=path.resolve(crate,env.CARGO_TARGET_DIR??'target');
const bindgen=env.WASM_BINDGEN??'wasm-bindgen';
if(!run(bindgen,['--version']).endsWith('0.2.129'))throw Error('wasm-bindgen CLI 0.2.129 is required.');
fs.mkdirSync(output,{recursive:true});
run(bindgen,['--target','web','--out-name','ocrs_wasm','--out-dir',output,path.join(target,'wasm32-unknown-unknown/release/ocrs_wasm.wasm')]);
const wasm=fs.readFileSync(path.join(output,'ocrs_wasm_bg.wasm'));
const features=WebAssembly.Module.customSections(new WebAssembly.Module(wasm),'target_features').map(b=>new TextDecoder().decode(b)).join('');
if(features.includes('simd128')!==(variant==='simd'))throw Error('Built module has unexpected SIMD features.');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest={variant,rustc:run('rustc',['--version']),wasmBindgen:run(bindgen,['--version']),rustflags:env.RUSTFLAGS,
  cargoLockSha256:hash(path.join(crate,'Cargo.lock')),sourceSha256:hash(path.join(crate,'src/lib.rs')),
  files:Object.fromEntries(['ocrs_wasm.js','ocrs_wasm_bg.wasm'].map(f=>[f,{bytes:fs.statSync(path.join(output,f)).size,sha256:hash(path.join(output,f))}]))};
fs.writeFileSync(path.join(output,'build.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
