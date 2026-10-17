import fs from 'node:fs';
import path from 'node:path';
const [before,after,output]=process.argv.slice(2);
if(!before||!after||!output)throw Error('Usage: BEFORE_DIR AFTER_DIR OUTPUT.json');
const baseline=JSON.parse(fs.readFileSync(path.join(before,'report.json'))),optimized=JSON.parse(fs.readFileSync(path.join(after,'report.json')));
if(baseline.pages.length!==optimized.pages.length)throw Error('Page counts differ');
const comparisons=baseline.pages.map(p=>{
 const a=JSON.parse(fs.readFileSync(path.join(before,`page-${p.page}.json`))),b=JSON.parse(fs.readFileSync(path.join(after,`page-${p.page}.json`)));
 const equal=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
 // Engine UUIDs are freshly generated per run, unlike stable exported candidate IDs.
 // Exclude only the UUID; compare every other field property including geometry.
 const fields=items=>items.map(({id:_uuid,...field})=>field);
 return {page:p.page,textIdentical:a.text===b.text,positionedTokensIdentical:equal(a.tokens,b.tokens),
  proposedFieldsIdentical:equal(fields(a.fields),fields(b.fields)),
  primaryEvidenceIdentical:equal(a.ocrReading?.rawTokens,b.ocrReading?.rawTokens),
  fullSecondaryEvidenceIdentical:equal(a.ocrReading?.secondaryTokens,b.ocrReading?.secondaryTokens),
  beforeFields:a.fields.length,afterFields:b.fields.length,beforeMs:a.elapsedMs,afterMs:b.elapsedMs,
  beforeSecondaryMs:a.stageTimingsMs?.secondaryOcr,afterSecondaryMs:b.stageTimingsMs?.secondaryOcr,
  beforeRegionalMs:a.ocrReading?.timingsMs?.regional,afterRegionalMs:b.ocrReading?.timingsMs?.regional,
  regionalExecution:b.ocrReading?.regionalExecution};
});
const qualityGatePassed=comparisons.every(p=>p.textIdentical&&p.positionedTokensIdentical&&p.proposedFieldsIdentical&&p.primaryEvidenceIdentical&&p.fullSecondaryEvidenceIdentical);
const report={scope:'Real Node acquisition on the same source PDF and models; not a browser or user-PC benchmark',qualityGatePassed,
 before:{processingTimeMs:baseline.processingTimeMs,totalFields:baseline.totalFields},after:{processingTimeMs:optimized.processingTimeMs,totalFields:optimized.totalFields},
 speedup:baseline.processingTimeMs/optimized.processingTimeMs,pages:comparisons};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
if(!qualityGatePassed)process.exitCode=1;
