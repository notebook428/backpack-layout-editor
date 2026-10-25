'use strict';
// Exercise the actual production catalogue/filter helpers against controlled
// records, including missing metadata, compound search and Priestess toggling.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
for(const id of ['filterClass','filterRarity','filterTag','filterBuff','filterDebuff','filterSocket',
                  'filterPriceMin','filterPriceMax','clearCatalogFilters','catalogFilterPanel'])
 assert.ok(html.includes('id="'+id+'"'),'Missing filter control '+id);
assert.ok(html.includes("$('clearCatalogFilters').addEventListener('click',clearCatalogFilters)"));
const start=html.indexOf('function activeCatalogDefs(){');
const end=html.indexOf('function toast(s){',start);
assert.ok(start>0&&end>start,'Could not locate production catalogue filters');
const toggleStart=html.indexOf('function togglePriestessCatalog(){');
const toggleEnd=html.indexOf('function rangeMembers(){',toggleStart);
assert.ok(toggleStart>0&&toggleEnd>toggleStart,'Could not locate Priestess toggle');
function node(tag='div'){
 return{
  tag,style:{},value:'',checked:false,disabled:false,children:[],className:'',
  classList:{add(){}},textContent:'',listeners:{},
  append(...args){this.children.push(...args)},
  replaceChildren(...args){this.children=[...args]},
  addEventListener(k,f){this.listeners[k]=f}
 };
}
const names=['search','category','filterClass','filterRarity','filterTag','filterBuff','filterDebuff',
 'filterSocket','filterPriceMin','filterPriceMax','auditOnly','auditKind','catalogCount','catalog'];
const elements=Object.fromEntries(names.map(id=>[id,node(id)]));
elements.auditKind.value='all';
const fixtures=[
 {id:'common-ice-armor',name:'氷の鎧',alias:'Ice Armor',className:'共通',category:'鎧',
  tags:['氷結'],rarity:'エピック',price:11,socketCount:2,buffs:['シールド','ヒート'],
  debuffs:['フリーズ'],shape:[[0,0]],stars:[],type:'item'},
 {id:'mage-mana-staff',name:'魔法の杖',alias:'Magic Wand',className:'メイジ',category:'武器',
  tags:['魔法','遠隔'],rarity:'レジェンダリー',price:8,socketCount:1,
  buffs:['マナ','ヒート'],debuffs:[],shape:[[0,0]],stars:[],type:'item'},
 {id:'ranger-cold-dagger',name:'氷結の短剣',alias:'Frost Dagger',className:'レンジャー',
  category:'武器',categories:['アクセサリー','武器'],tags:['氷結'],rarity:'エピック',
  price:6,socketCount:0,buffs:[],debuffs:['フリーズ'],shape:[[0,0]],stars:[],type:'item'},
 {id:'common-unknown-pricing',name:'価格未確認',alias:'Unknown Price',className:'共通',
  category:'スキル',tags:[],rarity:null,price:null,socketCount:null,
  buffs:[],debuffs:[],shape:[[0,0]],stars:null,pending:true,type:'item'},
 {id:'priest-healing-star',name:'導きの星図',alias:'Guiding Star Chart',className:'プリーステス',
  category:'アクセサリー',tags:['神聖'],rarity:'ユニーク',price:5,socketCount:0,
  buffs:['リジェネ'],debuffs:[],shape:[[0,0]],stars:[],type:'item'}
];
const ctx=vm.createContext({
 definitions:fixtures,priestessOnly:false,$:id=>elements[id],
 Option:function Option(text,value){return{text,value}},
 document:{createDocumentFragment:()=>node('fragment'),createElement:tag=>node(tag)},
 sorted:(a,b)=>a.name.localeCompare(b.name,'ja'),
 colorFor:()=> '#123456',
 geom:()=>({width:1,height:1}),
 addPreset:()=>{},
 toast:()=>{}
});
vm.runInContext(html.slice(start,end),ctx);
vm.runInContext(html.slice(toggleStart,toggleEnd),ctx);
const code=(str)=>vm.runInContext(str,ctx);
const visible=()=>elements.catalog.children[0].children.map(btn=>btn.children[1].children[0].textContent);
const count=()=>elements.catalogCount.textContent;
const update=(id,value)=>{elements[id].value=value;code('filterCatalog()')};
code('buildCatalog()');
assert.equal(visible().length,4,'Priestess must be opt-in');
assert.ok(elements.filterClass.children.some(o=>o.value==='メイジ'));
assert.ok(elements.filterBuff.children.some(o=>o.value==='シールド'));
assert.ok(!elements.filterClass.children.some(o=>o.value==='プリーステス'));
assert.ok(count().includes('4 / 4'));

update('search','  ICE   armor  ');
assert.deepEqual(visible(),['氷の鎧'],'Multiword English alias search');
update('search','');
update('filterTag','氷結');
assert.deepEqual(visible(),['氷の鎧','氷結の短剣']);
update('filterDebuff','フリーズ');
assert.deepEqual(visible(),['氷の鎧','氷結の短剣']);
update('filterClass','共通');
assert.deepEqual(visible(),['氷の鎧']);
update('filterRarity','エピック');
update('filterSocket','2');
update('filterPriceMin','10');
update('filterPriceMax','11');
assert.deepEqual(visible(),['氷の鎧'],'All metadata filters should combine with AND');
update('filterPriceMax','10');
assert.equal(visible().length,0,'Price upper bound must be inclusive and constrain matches');
code('clearCatalogFilters()');
assert.equal(visible().length,4,'Clear should reset all filters');
assert.equal(elements.filterPriceMin.value,'');
assert.equal(elements.filterClass.value,'');
assert.equal(elements.filterTag.value,'');
assert.equal(elements.auditKind.value,'all');

update('filterPriceMin','0');
assert.equal(visible().length,3,'Unknown prices are excluded when a price filter is active');
update('filterPriceMin','');
update('filterRarity','エピック');
assert.equal(visible().length,2,'Unknown rarity excluded by exact filter');
code('clearCatalogFilters()');

update('category','アクセサリー');
assert.deepEqual(visible(),['氷結の短剣'],'Multiple category aliases remain searchable');
code('clearCatalogFilters()');

update('search','氷');
assert.deepEqual(visible(),['氷の鎧','氷結の短剣'],'Japanese substring search must work');
code('clearCatalogFilters()');
update('search','魔法 マナ');
assert.deepEqual(visible(),['魔法の杖'],'Compound search may match tags and buffs');
code('clearCatalogFilters()');

update('filterClass','共通');
code('togglePriestessCatalog()');
assert.equal(elements.filterClass.value,'共通','Available filter selection should persist after toggling Priestess');
assert.ok(elements.filterClass.children.some(o=>o.value==='プリーステス'));
assert.deepEqual(visible(),['価格未確認','氷の鎧']);
update('filterClass','プリーステス');
assert.deepEqual(visible(),['導きの星図']);
code('togglePriestessCatalog()');
assert.equal(elements.filterClass.value,'','Unavailable class selection should reset');
assert.equal(visible().length,4);
console.log('PASS: combined search, class/rarity/tag/buff/debuff/socket/price, aliases, missing metadata, clear and Priestess toggle.');
