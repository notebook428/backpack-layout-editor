'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'item-catalog.json'),'utf8')).records;
const updates=JSON.parse(fs.readFileSync(path.join(root,'item-catalog-updates.json'),'utf8')).records;
const history=JSON.parse(fs.readFileSync(path.join(root,'docs/legacy-gem-id-history-2026-10-24.json'),'utf8'));
const legacy=history.oldToCanonicalIds;
const keys=Object.keys(legacy);
assert.equal(keys.length,12,'All 12 gem ID aliases must be archived');
assert.equal(history.legacyBaseRecords.length,12,'All originals must be archived');
assert.equal(catalog.length,560,'Base catalogue should contain 560 canonical entries');
assert.ok(updates.length>=442,'Verified ledger must retain all records from the 2026-10-24 migration baseline');
assert.equal(new Set(updates.map(x=>x.id)).size,updates.length,'Confirmed IDs must remain unique as the ledger grows');
assert.ok(catalog.every(x=>!x.id.startsWith('gem-')),'No deprecated gems in active base catalogue');
assert.ok(updates.every(x=>!x.id.startsWith('gem-')),'No deprecated gems in confirmed ledger');
const verified=updates.find(x=>x.id==='common-flawless-emerald');
assert.equal(verified.oldId,'gem-emerald-flawless');
assert.equal(verified.price,8);
assert.equal(verified.rarity,'レジェンダリー');
assert.deepEqual(verified.buffs,['リジェネ']);
assert.deepEqual(verified.debuffs,['毒']);
assert.ok(verified.verified.includes('確認済み'));
const names=new Map();
for(const p of catalog.filter(x=>x.category==='宝石')){
  assert.ok(!names.has(p.name),'Duplicate gem display name: '+p.name);
  names.set(p.name,p.id);
}
const catalogStart=html.indexOf('const PRESETS = [');
const catalogEnd=html.indexOf('\n];',catalogStart);
assert.ok(catalogStart>=0&&catalogEnd>catalogStart,'Cannot locate editor preset source');
const migrationStart=html.indexOf('const LEGACY_GEM_ID_MAP=');
const migrationEnd=html.indexOf('function canExportImage()',migrationStart);
assert.ok(migrationStart>=0&&migrationEnd>migrationStart,'Cannot locate actual layout importer');
const exportStart=html.indexOf('function makeLayoutDocument(){');
const exportEnd=html.indexOf('function exportJSON()',exportStart);
assert.ok(exportStart>=0&&exportEnd>exportStart,'Cannot locate actual export serializer');
const ctx=vm.createContext({
  W:9,H:7,
  validateDef:p=>!!(p&&typeof p.id==='string'&&Array.isArray(p.shape)&&p.shape.length&&['item','bag'].includes(p.type)),
  inBoard:(x,y)=>x>=0&&x<9&&y>=0&&y<7,
  geom:(p,rot)=>({body:p.shape,width:Math.max(...p.shape.map(c=>c[0]))+1,height:Math.max(...p.shape.map(c=>c[1]))+1}),
  uid:()=>('test-id-'+Math.random()),
  colorFor:()=>('#123456'),
  isGemPreset:p=>p.category==='宝石'&&p.id!=='original-stone',
  record:()=>{},resetRange:()=>{},buildCatalog:()=>{},render:()=>{},toast:()=>{}
});
vm.runInContext(html.slice(catalogStart,catalogEnd+3),ctx);
vm.runInContext("let definitions=[...PRESETS],byId=new Map(definitions.map(x=>[x.id,x]));let bags=[],items=[],stash=[],gems=[],debugMarks=[],selected=null,mode='item',hovered=null;function list(){return [...bags,...items,...gems]}function state(){return {bags,items,stash,gems,debugMarks}}",ctx);
vm.runInContext(html.slice(migrationStart,migrationEnd),ctx);
vm.runInContext(html.slice(exportStart,exportEnd),ctx);
const actualMap=JSON.parse(vm.runInContext('JSON.stringify(LEGACY_GEM_ID_MAP)',ctx));
assert.deepEqual(actualMap,legacy);
const presetIds=JSON.parse(vm.runInContext('JSON.stringify(PRESETS.map(p=>p.id))',ctx));
assert.equal(new Set(presetIds).size,presetIds.length,'Duplicate editor ID');
assert.ok(presetIds.every(x=>!x.startsWith('gem-')),'Old gem preset still active');
assert.ok(Object.values(legacy).every(x=>presetIds.includes(x)),'Every alias must resolve to a real preset');
assert.equal(presetIds.filter(x=>x==='common-flawless-emerald').length,1);
assert.ok(!html.includes("if(a?.presetId==='common-flawless-emerald')a={...a,presetId:'gem-emerald-flawless'}"));
const makeGem=(id,n)=>({uid:'gem-'+n,presetId:id,x:n%9,y:Math.floor(n/9),rot:0,stored:false,hostId:null,slot:null});
const oldLayout={
  format:'recho-backpack-editor',version:2,grid:{width:9,height:7},
  bags:[],items:[makeGem('gem-ruby-chipped',13)],
  stash:[makeGem('gem-emerald-flawless',14)],
  gems:keys.map(makeGem),
  definitions:[history.originalVerifiedFlawlessEmeraldPreset]
};
ctx.input=JSON.stringify(oldLayout);
vm.runInContext('loadJSON(input)',ctx);
const loaded=JSON.parse(vm.runInContext('JSON.stringify({bags,items,stash,gems,definitions})',ctx));
assert.equal(loaded.items.length,0,'Old v0.7 ordinary item gems must migrate to gem layer');
assert.equal(loaded.stash.length,0,'Old v0.7 stash gems must migrate to gem layer');
assert.equal(loaded.gems.length,14,'All gems must survive migration');
for(const g of loaded.gems)assert.ok(Object.values(legacy).includes(g.presetId),'Old ID failed to resolve: '+g.presetId);
assert.ok(loaded.definitions.every(p=>!p.id.startsWith('gem-')),'Legacy definitions must not resurrect');
const exported=JSON.parse(vm.runInContext('JSON.stringify(makeLayoutDocument())',ctx));
assert.equal(exported.format,'recho-backpack-editor');
assert.equal(exported.gems.length,14);
assert.ok(exported.gems.every(g=>!g.presetId.startsWith('gem-')),'Export still contains legacy gem IDs');
assert.ok(exported.definitions.every(p=>!p.id.startsWith('gem-')),'Export still contains legacy definitions');
ctx.input=JSON.stringify(exported);
vm.runInContext('loadJSON(input)',ctx);
const loadedAgain=JSON.parse(vm.runInContext('JSON.stringify({gems,items,stash})',ctx));
assert.equal(loadedAgain.gems.length,14,'Roundtrip gem count changed');
assert.deepEqual(loadedAgain.gems.map(g=>g.presetId),loaded.gems.map(g=>g.presetId));
assert.deepEqual(loadedAgain.gems.map(g=>g.uid),loaded.gems.map(g=>g.uid));
ctx.input=JSON.stringify({
  format:'recho-backpack-editor',grid:{width:9,height:7},bags:[],items:[],
  gems:[{uid:'bad',presetId:'gem-unknown',x:0,y:0,rot:0}]
});
assert.throws(()=>vm.runInContext('loadJSON(input)',ctx),/不正な宝石/,'Unknown gems must still be rejected');
// Registration assistant must not reintroduce old IDs or replace canonical data.
const registration=fs.readFileSync(path.join(root,'item-registration.html'),'utf8');
assert.ok(registration.includes('const legacyGemIdMap='));
assert.ok(registration.includes('currentIds.has(id)'));
assert.ok(registration.includes('d.records.filter(item=>!Object.prototype.hasOwnProperty.call(legacyGemIdMap,item.id))'));
console.log('PASS: 12 legacy gem IDs, actual layout importer, v0.7 migration, JSON roundtrip, rejection, catalogue uniqueness, confirmed data and registration aliases.');
