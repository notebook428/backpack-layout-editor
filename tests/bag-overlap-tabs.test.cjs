'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

function target(){
 const listeners=new Map();
 return {
  addEventListener(type,fn){const a=listeners.get(type)||[];a.push(fn);listeners.set(type,a)},
  emit(type,x=0,y=0,pointerId=1){
   const e={type,clientX:x,clientY:y,pointerId,button:0,shiftKey:false,
    relatedTarget:null,preventDefault(){},stopPropagation(){}};
   for(const fn of listeners.get(type)||[])fn(e);
   return e;
  }
 };
}
function node(tagName='div'){
 const n=Object.assign(target(),{
  tagName:tagName.toUpperCase(),dataset:{},attributes:{},style:{},children:[],
  className:'',textContent:'',hidden:true,offsetWidth:39,offsetHeight:33,
  append(...nodes){this.children.push(...nodes)},
  replaceChildren(...nodes){this.children=[...nodes]},
  querySelectorAll(selector){return selector==='button'?this.children.filter(c=>c.tagName==='BUTTON'):[]},
  setAttribute(name,value){this.attributes[name]=String(value)},
  contains(el){return this.children.includes(el)}
 });
 return n;
}
const tabs=node();
const stashZone={classList:{remove(){},toggle(){}}};
const moveTogether={checked:false};
const canvas=Object.assign(target(),{
 focus(){},setPointerCapture(){},
 classList:{add(){},remove(){}},
 getBoundingClientRect(){return{left:0,top:0,right:90,bottom:70,width:90,height:70}},
 parentElement:{getBoundingClientRect(){return{left:0,top:0}}}
});
const windowMock=target();
const ctx=vm.createContext({
 W:9,H:7,canvas,window:windowMock,document:{createElement:node},
 $:name=>name==='bagOverlapTabs'?tabs:name==='stashZone'?stashZone:
  name==='moveTogether'?moveTogether:{},
 inBoard:(x,y)=>x>=0&&x<9&&y>=0&&y<7,
 cellFromEvent:e=>({x:Math.floor(e.clientX/10),y:Math.floor(e.clientY/10)}),
 isOutsideBoard:e=>e.clientX<0||e.clientX>=90||e.clientY<0||e.clientY>=70,
 showCursorCoord(){},paintDebugAt(){},toast(){},
 deep:x=>JSON.parse(JSON.stringify(x)),
 getP:a=>({name:a.presetId}),
 absCells:a=>a.type==='bag'?[[a.x,a.y],[a.x+1,a.y]]:[[a.x,a.y]],
 shape:a=>a.type==='bag'?{width:2,height:1,body:[[0,0],[1,0]]}:{width:1,height:1,body:[[0,0]]},
 clampPos:(a,x,y)=>({x:Math.min(8,Math.max(0,x)),y:Math.min(6,Math.max(0,y))}),
 moveBagGroup:(a,dx,dy)=>{a.x+=dx;a.y+=dy},
 canSocket:()=>false,attachGem:()=>false,
 chooseRange(){},moveRange:()=>[0,0],rangeHit:()=>null,
 toggleRangeMode(){}
});
vm.runInContext(`
let bags=[],items=[],stash=[],gems=[],debugMarks=[],selected=null,hovered=null;
let mode='auto',drag=null,rangeDrag=null,rangeMode=false,debugMode=false;
let overlapCell=null,overlapTabKey='';
let undoStack=[],redoStack=[],rangeSelection=new Set();
function list(){return [...bags,...items,...gems]}
function state(){return JSON.parse(JSON.stringify({bags,items,stash,gems,debugMarks}))}
function restore(s){bags=s.bags;items=s.items;stash=s.stash;gems=s.gems;debugMarks=s.debugMarks;drag=null;render()}
function record(){undoStack.push(state());redoStack=[]}
function resetRange(){rangeSelection.clear();rangeDrag=null}
function linkedBag(a){return bags.find(b=>b.uid===a.linkBag)||null}
function childrenOf(b){return items.filter(a=>linkedBag(a)?.uid===b.uid)}
function groupMembers(b){return [b]}
function render(){renderBagOverlapTabs()}
function atCell(x,y){
 return [...bags,...items,...gems.filter(g=>!g.stored)]
  .findLast(a=>absCells(a).some(([u,v])=>u===x&&v===y))||null;
}
function reset(){
 bags=[
  {uid:'bag-a',presetId:'Bag A',type:'bag',x:1,y:1,rot:0},
  {uid:'bag-b',presetId:'Bag B',type:'bag',x:2,y:1,rot:0}
 ];
 items=[];stash=[];gems=[];debugMarks=[];selected=null;hovered=null;
 mode='auto';drag=null;rangeDrag=null;rangeMode=false;debugMode=false;
 overlapCell=null;overlapTabKey='';undoStack=[];redoStack=[];
}
function inspect(){return JSON.stringify({bags,items,stash,selected,drag:drag&&{id:drag.id,offx:drag.offx},overlapCell,undo:undoStack.length})}
`,ctx);
const stashStart=html.indexOf('// Store a bag and its linked contents as one reversible bundle.');
const stashEnd=html.indexOf('function stashAll(){',stashStart);
const overlapStart=html.indexOf('// Only cells occupied by two or more bags show the selector.');
const overlapEnd=html.indexOf('function topObjectAt(',overlapStart);
const dragStart=html.indexOf("canvas.addEventListener('pointerdown',e=>");
const dragEnd=html.indexOf('function fileSafe(',dragStart);
assert.ok(stashStart>0&&stashEnd>stashStart);
assert.ok(overlapStart>0&&overlapEnd>overlapStart);
assert.ok(dragStart>0&&dragEnd>dragStart);
vm.runInContext(html.slice(stashStart,stashEnd),ctx);
vm.runInContext(html.slice(overlapStart,overlapEnd),ctx);
vm.runInContext(html.slice(dragStart,dragEnd),ctx);
const inspect=()=>JSON.parse(vm.runInContext('inspect()',ctx));
const buttons=()=>tabs.querySelectorAll('button');
const hover=(x,y)=>canvas.emit('pointermove',x,y);
const reset=()=>{vm.runInContext('reset()',ctx);tabs.replaceChildren();tabs.hidden=true};

// Two distinct overlapping bags should show exactly two named tabs.
reset();
hover(25,15);
assert.equal(tabs.hidden,false,'Tabs should appear on an overlapping cell');
assert.equal(buttons().length,2);
assert.equal(buttons()[0].dataset.bagId,'bag-b','Top bag is first');
assert.equal(buttons()[1].dataset.bagId,'bag-a','Lower bag stays selectable');
assert.match(buttons()[0].textContent,/Bag B/);
assert.match(buttons()[1].textContent,/Bag A/);
assert.ok(tabs.style.left.endsWith('px')&&tabs.style.top.endsWith('px'));

// Keyboard/click selection should work without creating Undo entries.
buttons()[1].emit('click');
assert.equal(inspect().selected,'bag-a');
assert.equal(inspect().undo,0);
assert.equal(buttons()[1].attributes['aria-pressed'],'true');
hover(15,15);
assert.equal(tabs.hidden,true,'No selector on a non-overlapping cell');

// A tab must bypass an item covering the overlapping cell in auto mode.
reset();
vm.runInContext("items.push({uid:'item',presetId:'An item',type:'item',x:2,y:1,rot:0})",ctx);
hover(25,15);
assert.equal(buttons().length,2);
buttons()[1].emit('pointerdown',25,15);
assert.equal(inspect().drag.id,'bag-a','Dragging lower tab must grab that bag');
assert.equal(inspect().selected,'bag-a');
canvas.emit('pointermove',45,15);
windowMock.emit('pointerup',45,15);
assert.equal(inspect().bags.find(x=>x.uid==='bag-a').x,3);
assert.equal(inspect().bags.find(x=>x.uid==='bag-b').x,2);
assert.equal(inspect().items[0].x,2,'Unrelated item must not move');
assert.equal(inspect().undo,1,'Tab drag should be Undoable');

// Outside drop from the lower tab must store the intended bag only.
reset();
hover(25,15);
buttons()[1].emit('pointerdown',25,15);
canvas.emit('pointermove',120,90);
windowMock.emit('pointerup',120,90);
assert.deepEqual(inspect().bags.map(a=>a.uid),['bag-b']);
assert.deepEqual(inspect().stash.map(a=>a.uid),['bag-a']);
assert.equal(inspect().undo,1);

// Tabs disappear when editing a different layer or there is no overlap.
reset();
vm.runInContext("mode='gem'",ctx);
hover(25,15);
assert.equal(tabs.hidden,true);
vm.runInContext("mode='bag'",ctx);
hover(25,15);
assert.equal(tabs.hidden,false);
vm.runInContext("bags.pop()",ctx);
vm.runInContext('renderBagOverlapTabs()',ctx);
assert.equal(tabs.hidden,true);
console.log('PASS: overlap hover tab order, click selection, lower-bag direct drag, stash, Undo and layer visibility.');
