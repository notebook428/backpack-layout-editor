'use strict';
// Execute the production pointer listeners in a small event-driven canvas harness.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const first = html.indexOf("canvas.addEventListener('pointerdown',e=>");
const last = html.indexOf('function fileSafe(', first);
assert.ok(first >= 0 && last > first, 'Could not locate editor drag handlers');

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    emit(type, x = 0, y = 0, pointerId = 1) {
      const e = {type, pointerId, button: 0, clientX: x, clientY: y, shiftKey: false};
      for (const fn of listeners.get(type) || []) fn(e);
    }
  };
}
const canvas = Object.assign(eventTarget(), {
  focus() {},
  setPointerCapture() {},
  classList: {add() {}, remove() {}},
  getBoundingClientRect() { return {left: 0, top: 0, right: 90, bottom: 70, width: 90, height: 70}; }
});
const windowMock = eventTarget();
const stashZone = {classList: {toggle() {}, remove() {}}};
const ctx = vm.createContext({
  canvas, window: windowMock, $: name => name === 'stashZone' ? stashZone : {},
  W: 9, H: 7,
  cellFromEvent: e => ({x: Math.floor(e.clientX / 10), y: Math.floor(e.clientY / 10)}),
  isOutsideBoard: e => e.clientX < 0 || e.clientX >= 90 || e.clientY < 0 || e.clientY >= 70,
  showCursorCoord() {}, render() {}, toast() {}, paintDebugAt() {},
  inBoard: (x, y) => x >= 0 && x < 9 && y >= 0 && y < 7,
  clampPos: (a,x,y) => ({x: Math.min(8,Math.max(0,x)),y: Math.min(6,Math.max(0,y))}),
  moveBagGroup: (a,dx,dy) => { a.x += dx; a.y += dy; },
  groupMembers: a => [a],
  chooseRange() {}, toggleRangeMode() {}, moveRange: () => [0,0],
  rangeHit: () => null, rangeMembers: () => [], attachGem: () => false,
  canSocket: () => false,
  absCells: a => a.type==='bag'?[[a.x,a.y],[a.x+1,a.y]]:[[a.x,a.y]],
  shape: a => a.type==='bag'?({width:2,height:1,body:[[0,0],[1,0]]}):({width:1,height:1,body:[[0,0]]}),
  getP: a => ({name:a.presetId}), findSpot: () => ({x:1,y:1})
});
vm.runInContext(`
let bags=[],items=[],stash=[],gems=[],debugMarks=[],selected=null,hovered=null;
let drag=null,rangeDrag=null,rangeMode=false,debugMode=false,mode='auto',undoStack=[],redoStack=[];
let rangeSelection=new Set();
function state(){return JSON.parse(JSON.stringify({bags,items,stash,gems,debugMarks}))}
function restore(s){bags=JSON.parse(JSON.stringify(s.bags));items=JSON.parse(JSON.stringify(s.items));
 stash=JSON.parse(JSON.stringify(s.stash));gems=JSON.parse(JSON.stringify(s.gems));
 debugMarks=JSON.parse(JSON.stringify(s.debugMarks));drag=null;rangeDrag=null;selected=null;hovered=null;render()}
function list(){return [...bags,...items,...gems]}
function record(){undoStack.push(state());redoStack.length=0}
function resetRange(){rangeSelection.clear();rangeDrag=null}
function childrenOf(b){return items.filter(a=>a.linkBag===b.uid)}
function bagUnion(){return new Set(bags.flatMap(a=>absCells(a).map(([x,y])=>y*W+x)))}
function atCell(x,y){return [...bags,...items,...gems.filter(g=>!g.stored)].findLast(a=>a.x===x&&a.y===y)||null}
function reset(type='item',x=1,y=1){
 bags=[];items=[];stash=[];gems=[];undoStack=[];redoStack=[];selected=null;hovered=null;
 drag=null;rangeDrag=null;rangeMode=false;
 const a={uid:'sample',presetId:'sample',type,x,y,rot:0};
 (type==='bag'?bags:type==='gem'?gems:items).push(a);return a;
}
function inspect(){return JSON.stringify({bags,items,stash,gems,undo:undoStack.length,drag:!!drag,rangeDrag:!!rangeDrag})}
`, ctx);
const stashHelperStart=html.indexOf('// Store a bag and its linked contents as one reversible bundle.');
const stashHelperEnd=html.indexOf('function stashAll(){',stashHelperStart);
const stashFnsStart=html.indexOf('function stashSelected(){',stashHelperEnd);
const stashFnsEnd=html.indexOf('const DEBUG_SYMBOLS=',stashFnsStart);
assert.ok(stashHelperStart>0&&stashHelperEnd>stashHelperStart&&stashFnsStart>stashHelperEnd&&stashFnsEnd>stashFnsStart);
vm.runInContext(html.slice(stashHelperStart,stashHelperEnd),ctx);
vm.runInContext(html.slice(stashFnsStart,stashFnsEnd),ctx);
vm.runInContext(html.slice(first,last), ctx);
const reset = (type,x,y) => vm.runInContext(`reset(${JSON.stringify(type)},${x},${y})`, ctx);
const snapshot = () => JSON.parse(vm.runInContext('inspect()', ctx));
const down = (x=15,y=15,id=1) => canvas.emit('pointerdown',x,y,id);
const move = (x,y,id=1) => canvas.emit('pointermove',x,y,id);
const up = (x,y,id=1) => windowMock.emit('pointerup',x,y,id);
const cancel = (x,y,id=1) => windowMock.emit('pointercancel',x,y,id);

// Release is intentionally sent to window, not canvas: regression for missing drops.
reset('item',1,1);
down(); move(115,85); up(115,85);
assert.equal(snapshot().stash.length,1,'Off-board item should be stored');
assert.equal(snapshot().items.length,0);
assert.equal(snapshot().undo,1,'Storage must be undoable');
assert.equal(snapshot().drag,false);

// Even after moving within the board, a later outside release must stash the item.
reset('item',1,1);
down();move(35,35);move(120,90);up(120,90);
assert.equal(snapshot().stash.length,1);

// Bags can now be stored by dragging outside the board.
reset('bag',1,1);
down();move(120,90);up(120,90);
assert.equal(snapshot().bags.length,0);
assert.equal(snapshot().stash.length,1);
assert.equal(snapshot().stash[0].type,'bag');
assert.equal(snapshot().undo,1);
vm.runInContext("returnFromStash('sample')",ctx);
assert.equal(snapshot().bags.length,1);
assert.equal(snapshot().stash.length,0);
assert.equal(snapshot().bags[0].x,1,'Return should prefer its saved placement');

// Moving a bag with linked items must preserve child identity, attachment
// and relative placement, even if the bag is moved outside directly.
reset('bag',1,1);
vm.runInContext(`
items.push({uid:'child',presetId:'armor',type:'item',x:2,y:1,rot:0,linkBag:'sample'});
gems.push({uid:'gem-1',presetId:'ruby',type:'gem',x:2,y:1,rot:0,hostId:'child',slot:0,stored:false});
`,ctx);
down();move(120,90);up(120,90);
let bundled=snapshot();
assert.equal(bundled.bags.length,0);
assert.equal(bundled.items.length,0);
assert.equal(bundled.stash.length,2);
assert.equal(bundled.stash[1].storedWithBag,'sample');
assert.equal(bundled.gems[0].hostId,'child','Mounted gem host must survive stashing');
assert.equal(bundled.undo,1);
vm.runInContext("returnFromStash('sample')",ctx);
bundled=snapshot();
assert.equal(bundled.bags.length,1);
assert.equal(bundled.items.length,1);
assert.equal(bundled.stash.length,0);
assert.equal(bundled.items[0].x-bundled.bags[0].x,1,'Item offset must survive');
assert.equal(bundled.gems[0].hostId,'child');
assert.equal(bundled.items[0].storedWithBag,undefined);
vm.runInContext('restore(undoStack.pop())',ctx);
assert.equal(snapshot().stash.length,2,'Undo return should restore the bag bundle');

// The toolbar storage path also supports bags with their contents.
reset('bag',1,1);
vm.runInContext("items.push({uid:'child',presetId:'armor',type:'item',x:2,y:1,rot:0,linkBag:'sample'});selected='sample';stashSelected()",ctx);
assert.equal(snapshot().stash.length,2);
assert.equal(snapshot().undo,1);
vm.runInContext("rotateInStash('sample')",ctx);
assert.equal(snapshot().stash[0].rot,0,'Bundled bag cannot be rotated in storage');
vm.runInContext("deleteFromStash('sample')",ctx);
assert.equal(snapshot().stash.length,1,'Deleting a stashed bag preserves its contents');
assert.equal(snapshot().stash[0].storedWithBag,undefined);
assert.equal(snapshot().stash[0].linkBag,null);

// When no room exists for the contents, return must leave the bundle in storage.
reset('bag',1,1);
vm.runInContext("items.push({uid:'child',presetId:'armor',type:'item',x:2,y:1,rot:0,linkBag:'sample'});selected='sample';stashSelected()",ctx);
vm.runInContext("for(let y=0;y<7;y++)for(let x=0;x<9;x++)items.push({uid:'block-'+x+'-'+y,type:'item',presetId:'block',x,y,rot:0})",ctx);
const undoBefore=snapshot().undo;
vm.runInContext("returnFromStash('sample')",ctx);
assert.equal(snapshot().stash.length,2);
assert.equal(snapshot().undo,undoBefore);

// A tiny accidental move over the canvas edge is not an intentional drop.
reset('item',8,1);
down(88,15);up(91,15);
assert.equal(snapshot().items.length,1);
assert.equal(snapshot().stash.length,0);

// A second pointer must not finish the original pointer's drag.
reset('item',1,1);
down(15,15,4);
up(115,85,5);
assert.equal(snapshot().drag,true);
assert.equal(snapshot().stash.length,0);
up(115,85,4);
assert.equal(snapshot().stash.length,1);

// Interruptions rollback in-flight changes without writing an undo snapshot.
reset('item',1,1);
down();move(35,35);cancel(35,35);
assert.equal(snapshot().items[0].x,1);
assert.equal(snapshot().items[0].y,1);
assert.equal(snapshot().undo,0);
assert.equal(snapshot().drag,false);

// Losing pointer capture should cancel safely rather than create a ghost drag.
reset('item',1,1);
down();move(35,35);canvas.emit('lostpointercapture',35,35);
assert.equal(snapshot().items[0].x,1);
assert.equal(snapshot().drag,false);

// A window focus loss also rolls back the pending drag.
reset('item',1,1);
down();move(35,35);windowMock.emit('blur');
assert.equal(snapshot().items[0].x,1);
assert.equal(snapshot().drag,false);

// Gem dropped outside is stored, with a single undo step.
reset('gem',1,1);
down();move(115,85);up(115,85);
assert.equal(snapshot().gems.length,1);
assert.equal(snapshot().gems[0].stored,true);
assert.equal(snapshot().undo,1);
console.log('PASS: item/gem/bag storage, bundled restore/undo/delete, no-room protection, threshold and pointer cancellation.');
