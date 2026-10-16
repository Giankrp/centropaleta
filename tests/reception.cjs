const fs=require('fs'),vm=require('vm'),assert=require('assert');
const data=new Map(),ctx={localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},crypto:require('crypto').webcrypto};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/products.js','utf8')+fs.readFileSync('public/stock.js','utf8')+'\nglobalThis.stock=CPStock;globalThis.make=createCPStock;',ctx);
const s=ctx.stock;
assert(s.findByCode('CP-001'));assert(!s.findByCode('unknown'));
s.associateCode(1,'1234567890128');assert.equal(s.findByCode('1234567890128').id,1);assert.equal(s.findByCode('CP-001').id,1);
assert.throws(()=>s.associateCode(2,'1234567890128'));
assert.throws(()=>s.configure(2,20,5,24,'1234567890128'));
const old=s.product(1).stock;
s.receive(1,6,'Descripción revisada','reception-1');assert.equal(s.product(1).stock,old+6);assert.equal(s.product(1).description,'Descripción revisada');
assert(s.receive(1,6,'Duplicado','reception-1').duplicate);assert.equal(s.product(1).stock,old+6);assert.equal(s.product(1).description,'Descripción revisada');
for(const q of [0,-1,1.2,NaN])assert.throws(()=>s.receive(1,q,'x','invalid-'+q));
assert.throws(()=>s.receive(1,1,'x'.repeat(5001),'large'));
assert.equal(s.read().moves.filter(m=>m.token==='reception-1').length,1);
const m=new Map(),sample=ctx.make({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)},'test');sample.receive(1,3,'sample','sample1');assert.equal(s.product(1).stock,old+6);
console.log('PASS códigos conocidos/desconocidos, asociación, colisiones, cantidad, descripción, duplicados y aislamiento');
// Eventos de interfaz sin navegador: valida renderizado y confirmación real del módulo.
function element(){return {innerHTML:'',textContent:'',value:'',hidden:true,srcObject:null,replaceChildren(){this.innerHTML=''},getTracks(){return []}}}
const nodes={},confirm=element(),associate=element(),button=element();confirm.querySelector=()=>button;
const result=element();result.querySelector=selector=>selector==='[data-confirm]'?confirm:selector==='[data-associate]'?associate:element();
const root={innerHTML:'',querySelector(sel){if(sel==='[data-result]')return result;return nodes[sel]??=element()},querySelectorAll(){return []}};
ctx.document={addEventListener(){},hidden:false};ctx.window={addEventListener(){}};
vm.runInContext(fs.readFileSync('public/reception.js','utf8')+'\nglobalThis.receiveUI=CPReception;',ctx);
const ui=ctx.receiveUI.mount(root,{inventory:s});ui.lookup('CP-001');assert(result.innerHTML.includes('Descripción revisada'));assert(result.innerHTML.includes('Sobre Pokémon'));
confirm.onsubmit({preventDefault(){},target:{quantity:{value:'2'},description:{value:'Texto de recepción'},querySelector:()=>button}});assert.equal(s.product(1).stock,old+8);assert(button.disabled);
confirm.onsubmit({preventDefault(){},target:{quantity:{value:'2'},description:{value:'Otra'},querySelector:()=>button}});assert.equal(s.product(1).stock,old+8);
ui.lookup('nuevo-ean');assert(result.innerHTML.includes('No inventaremos'));associate.onsubmit({preventDefault(){},target:{product:{value:'2'}}});assert.equal(s.findByCode('nuevo-ean').id,2);assert(result.innerHTML.includes('Sobre One Piece'));
ui.lookup('CP-001');assert(result.innerHTML.includes('Texto de recepción'));
console.log('PASS interfaz recupera ficha, confirma stock, bloquea doble guardado y resuelve código nuevo');
