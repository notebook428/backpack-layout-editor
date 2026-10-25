'use strict';
// The actual production rotation and pointer handlers run in a small canvas VM.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function target(){
 const map=new Map();
 return{
  addEventListener(type,fn){const list=map.get(type)||[];list.push(fn);map.set(type,list)},
  emit(type,x=85,y=65,extra={}){
   const e={type,button:type==='contextmenu'?2:0,pointerId:1,clientX:x,clientY:y,shiftKey:false,
    preventDefault(){this.defaultPrevented=true},...extra};
   for(const fn of map.get(type)||[])fn(e);
   return e;
  }
 };
}
const canvas=Object.assign(target(),{
 focus(){},setPointerCapture(){},
 classList:{add(){},remove(){}},
 getBoundingClientRect(){return{left:0,top:0,right:90,bottom:70,width:90,height:70}}
});
const windowMock=target();
const stashZone={classList:{remove(){},toggle(){}}};
const tabs=Object.assign(target(),{contains(){return false}});
const ctx=vm.createContext({
 canvas,window:windowMock,W:9,H:7,
 $:name=>name==='stashZone'?stashZone:name==='bagOverlapTabs'?tabs:{},
 shape:a=>a.type==='item'?(a.rot%2?{width:1,height:3,body:[[0,0],[0,1],[0,2]]}
                                     :{width:3,height:1,body:[[0,0],[1,0],[2,0]]})
  :{width:1,height:1,body:[[0,0]]},
 inBoard:(x,y)=>x>=0&&y>=0&&x<9&&y<7,
 cellFromEvent:e=>({x:Math.floor(e.clientX/10),y:Math.floor(e.clientY/10)}),
 isOutsideBoard:e=>e.clientX<0||e.clientX>=90||e.clientY<0||e.clientY>=70,
 showCursorCoord(){},setOverlapCell(){},render(){},toast(){},paintDebugAt(){},
 chooseRange(){},toggleRangeMode(){},moveRange:()=>[0,0],rangeHit:()=>null,rangeMembers:()=>[],
 canSocket:()=>false,attachGem:()=>false,moveBagGroup(){},
 clampPos:(a,x,y)=>({x:Math.max(0,Math.min(9-(a.rot%2?1:3),x)),
                    y:Math.max(0,Math.min(7-(a.rot%2?3:1),y))}),
 groupMembers:a=>[a],childrenOf:()=>[],
 deep:x=>JSON.parse(JSON.stringify(x))
});
vm.runInContext(`
let bags=[],items=[],stash=[],gems=[],debugMarks=[],selected=null,hovered=null;
let drag=null,rangeDrag=null,rangeMode=false,debugMode=false,mode='auto',overlapPickedBag=null;
let undoStack=[],redoStack=[],rangeSelection=new Set();
function list(){return [...bags,...items,...gems]}
function state(){return JSON.parse(JSON.stringify({bags,items,stash,gems,debugMarks}))}
function restore(s){bags=s.bags;items=s.items;stash=s.stash;gems=s.gems;debugMarks=s.debugMarks;
 selected=null;hovered=null;drag=null;rangeDrag=null}
function record(){undoStack.push(state());redoStack=[]}
function undo(){if(!drag&&undoStack.length){redoStack.push(state());restore(undoStack.pop())}}
function redo(){if(!drag&&redoStack.length){undoStack.push(state());restore(redoStack.pop())}}
function atCell(x,y){return items.find(a=>{
 const g=shape(a);return g.body.some(([u,v])=>a.x+u===x&&a.y+v===y)})||null}
function topObjectAt(x,y){return atCell(x,y)}
function gemAt(){return null}
function bagUnion(){return new Set()}
function gemCell(g){return {x:g.x,y:g.y}}
function reset(x=6,y=6){
 bags=[];stash=[];gems=[];debugMarks=[];selected=null;hovered=null;drag=null;rangeDrag=null;
 undoStack=[];redoStack=[];rangeMode=false;mode='auto';
 items=[{uid:'wide',type:'item',presetId:'wide',x,y,rot:0}];
}
function inspect(){return JSON.stringify({items,stash,selected,drag:drag&&{id:drag.id,moved:drag.moved},undo:undoStack.length,redo:redoStack.length})}
`,ctx);
const rotationStart=html.indexOf('function moveRotate(a){');
const rotationEnd=html.indexOf('function deleteSelected(){',rotationStart);
const handlerStart=html.indexOf("canvas.addEventListener('contextmenu',e=>",rotationEnd);
const handlerEnd=html.indexOf('function fileSafe(',handlerStart);
assert.ok(rotationStart>=0&&rotationEnd>rotationStart&&handlerStart>rotationEnd&&handlerEnd>handlerStart);
vm.runInContext(html.slice(rotationStart,rotationEnd),ctx);
vm.runInContext(html.slice(handlerStart,handlerEnd),ctx);
const inspect=()=>JSON.parse(vm.runInContext('inspect()',ctx));
const down=(x=85,y=65)=>canvas.emit('pointerdown',x,y);
const right=(x=85,y=65)=>canvas.emit('contextmenu',x,y);
const move=(x=85,y=65)=>canvas.emit('pointermove',x,y);
const up=(x=85,y=65)=>windowMock.emit('pointerup',x,y);
const reset=(x=6,y=6)=>vm.runInContext('reset('+x+','+y+')',ctx);

// Four right-click rotations at the upper-right edge must stay anchored,
// keep pointer capture and complete a full round trip.
reset();down();
for(let i=1;i<=4;i++){
 const evt=right();
 assert.equal(evt.defaultPrevented,true);
 const view=inspect();
 assert.equal(view.drag.id,'wide','Right-click must not terminate drag');
 assert.deepEqual([view.items[0].x,view.items[0].y],[6,6],'No boundary snap during drag');
 assert.equal(view.items[0].rot,i%4,'Each right-click rotates 90 degrees');
 assert.equal(view.undo,0,'Intermediate rotations should not create separate Undo entries');
}
up();
assert.deepEqual([inspect().items[0].x,inspect().items[0].y],[6,6]);
assert.equal(inspect().undo,0,'Four rotations ending at original state need no Undo');

// Release after one rotation clamps once to fit, as a single Undo step.
reset();down();right();
assert.equal(inspect().items[0].y,6);
up();
assert.deepEqual([inspect().items[0].x,inspect().items[0].y],[6,4]);
assert.equal(inspect().items[0].rot,1);
assert.equal(inspect().undo,1);
vm.runInContext('undo()',ctx);
assert.deepEqual([inspect().items[0].x,inspect().items[0].y,inspect().items[0].rot],[6,6,0]);
vm.runInContext('redo()',ctx);
assert.deepEqual([inspect().items[0].x,inspect().items[0].y,inspect().items[0].rot],[6,4,1]);

// Moving while in a rotated state may temporarily extend outside the grid,
// but finishing the drag clamps only once.
reset();down();right();move(75,55);
assert.deepEqual([inspect().items[0].x,inspect().items[0].y],[5,5]);
up(75,55);
assert.deepEqual([inspect().items[0].x,inspect().items[0].y],[5,4]);
assert.equal(inspect().undo,1);

// 'R' rotation while holding an item uses the same non-clamping behavior.
reset();down();vm.runInContext('rotateSelected()',ctx);vm.runInContext('rotateSelected()',ctx);
assert.equal(inspect().drag.id,'wide');
assert.deepEqual([inspect().items[0].x,inspect().items[0].y,inspect().items[0].rot],[6,6,2]);
up();
assert.equal(inspect().undo,1);

// If pointer capture is interrupted, all intermediate rotations rollback.
reset();down();right();right();windowMock.emit('pointercancel');
assert.deepEqual([inspect().items[0].x,inspect().items[0].y,inspect().items[0].rot],[6,6,0]);
assert.equal(inspect().undo,0);
assert.equal(inspect().drag,null);

// Drop to storage after a drag-rotation remains reversible.
reset();down();right();move(120,90);up(120,90);
assert.equal(inspect().items.length,0);
assert.equal(inspect().stash[0].rot,1);
assert.equal(inspect().undo,1);
vm.runInContext('undo()',ctx);
assert.deepEqual([inspect().items[0].x,inspect().items[0].y,inspect().items[0].rot],[6,6,0]);

// Ordinary right click, with no drag, still clamps as before.
reset();right();
assert.equal(inspect().drag,null);
assert.deepEqual([inspect().items[0].x,inspect().items[0].y,inspect().items[0].rot],[6,4,1]);
assert.equal(inspect().undo,1);
console.log('PASS: four rotations without snap, R key, drag release clamp, Undo/Redo, cancel, stash and ordinary right-click.');
