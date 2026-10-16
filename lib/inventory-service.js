import { createCPStock } from './stock-core.js';
const methods=new Set(['addProduct','updateProduct','deleteProduct','configure','replenish','describe','configureOffer','removeOffer','associateCode','receive','sale','importProducts']);
const empty=()=>({products:[],sales:[],moves:[],nextProductId:1});
function checkProduct(p){
 if(!p||!Number.isSafeInteger(p.id)||p.id<1)throw Error('Identificador de producto inválido');
 for(const [key,max] of [['name',200],['code',128],['description',5000],['set',200],['condition',100],['badge',100]])if(p[key]!=null&&(typeof p[key]!=='string'||p[key].length>max))throw Error('Campo inválido: '+key);
 if(p.image!=null&&!/^[a-zA-Z0-9_-]{1,80}$/.test(p.image))throw Error('Referencia de imagen inválida');
 if(p.barcodes!=null&&(!Array.isArray(p.barcodes)||p.barcodes.length>100||p.barcodes.some(b=>typeof b!=='string'||!b.trim()||b.length>128)))throw Error('Códigos adicionales inválidos');
 if(p.photo!=null&&(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photo)||p.photo.length>700000))throw Error('Imagen inválida o demasiado grande');
 if(!['Pokémon','One Piece','Lorcana','Dragon Ball','Naruto','Otro TCG'].includes(p.cat)||!['cartas','sellado','mistery-packs'].includes(p.type))throw Error('Universo o tipo inválido');
 if(typeof p.name!=='string'||!p.name.trim()||typeof p.code!=='string'||!p.code.trim()||!Number.isFinite(p.price)||p.price<=0||!Number.isSafeInteger(Math.round(p.price*100)))throw Error('Revisa nombre, código y precio');
 if(![p.stock,p.min,p.target].every(n=>Number.isSafeInteger(n)&&n>=0)||p.target<p.min)throw Error('Niveles de inventario inválidos');
 if(p.offerActive!=null&&typeof p.offerActive!=='boolean')throw Error('Oferta inválida');
 if(p.offerActive&&(!Number.isInteger(p.offerPercent)||p.offerPercent<1||p.offerPercent>99))throw Error('Descuento inválido');
}
export async function loadInventory(db){
 const results=await db.batch([db.prepare('SELECT revision,next_id FROM inventory_revision WHERE id=1'),db.prepare("SELECT key,kind,payload FROM inventory_records WHERE kind IN ('product','sale','move') ORDER BY key")]);
 const meta=results[0].results[0],s=empty();s.nextProductId=meta?.next_id||1;
 for(const row of results[1].results){const item=JSON.parse(row.payload);s[row.kind==='product'?'products':row.kind==='sale'?'sales':'moves'].push(item)}
 s.sales.sort((a,b)=>b.date.localeCompare(a.date));s.moves.sort((a,b)=>b.date.localeCompare(a.date));
 return {state:s,revision:meta?.revision||0};
}
function records(s){const m=new Map();for(const [kind,list] of [['product',s.products],['sale',s.sales],['move',s.moves]])for(const item of list){if(kind==='move'&&!item._recordId)item._recordId=crypto.randomUUID();m.set(kind+':'+(kind==='move'?item._recordId:item.id),{kind,payload:JSON.stringify(item)})}return m}
export async function mutateInventory(db,body){
 const {operation,args,requestId,productVersion}=body;
 if(!methods.has(operation)||!Array.isArray(args)||args.length>10||typeof requestId!=='string'||!/^[a-zA-Z0-9-]{10,100}$/.test(requestId))throw Error('Solicitud inválida');
 for(let retry=0;retry<5;retry++){
  const previous=await db.prepare("SELECT payload FROM inventory_records WHERE key=? AND kind='request'").bind('request:'+requestId).first();
  if(previous)return {result:JSON.parse(previous.payload),...(await loadInventory(db))};
  const {state:old,revision}=await loadInventory(db),s=structuredClone(old),before=records(old);
  if(['updateProduct','deleteProduct','configure','describe','configureOffer','removeOffer'].includes(operation)){
   const p=s.products.find(p=>p.id===Number(args[0]));if(!p)throw Error('El producto ya no existe');
   if(productVersion!==(p._version||0))throw Error('Este producto cambió en otro dispositivo. Actualiza los datos antes de guardar.');
  }
  let result;const storage={getItem:()=>JSON.stringify(s),setItem:(_,v)=>{Object.assign(s,JSON.parse(v))}};
  if(operation==='importProducts'){
   if(!Array.isArray(args[0])||!args[0].length||args[0].length>100)throw Error('Importa entre 1 y 100 productos por vez');
   if(s.products.length)throw Error('La importación inicial requiere un catálogo vacío para no sobrescribir productos');
   s.products=args[0].map(p=>{const out={};for(const key of ['id','name','description','cat','type','set','code','price','stock','min','target','condition','art','image','photo','badge','barcodes','offerActive','offerPercent'])if(p[key]!==undefined)out[key]=p[key];checkProduct(out);return out});
   s.nextProductId=Math.max(...s.products.map(p=>p.id))+1;
   s.moves.unshift({date:new Date().toISOString(),name:'Importación inicial',qty:s.products.length,kind:'Importación de productos'});result={imported:s.products.length};
  }else{
    if(operation==='sale'&&args[1]!=='Tienda física'&&args[1]!=='Online')throw Error('La compra online sigue siendo de demostración y no registra pedidos en el inventario compartido');
   if(operation==='updateProduct'){const safe={};for(const key of ['name','description','cat','type','set','code','price','stock','min','target','condition','photo','badge','offerActive','offerPercent'])if(args[1]?.[key]!==undefined)safe[key]=args[1][key];args[1]=safe}
   result=createCPStock(storage)[operation](...args);
  }
  const ids=new Set(),codes=new Map();for(const p of s.products){checkProduct(p);if(ids.has(p.id))throw Error('Identificador duplicado');ids.add(p.id);for(const code of [p.code,...(p.barcodes||[])]){if(codes.has(code)&&codes.get(code)!==p.id)throw Error('Código de producto duplicado: '+code);codes.set(code,p.id)}
   const oldProduct=old.products.find(x=>x.id===p.id);if(JSON.stringify(oldProduct)!==JSON.stringify(p)){p._version=(oldProduct?._version||0)+1;p.updatedAt=new Date().toISOString();p.createdAt=oldProduct?.createdAt||p.updatedAt}}
  // Refresh returned product metadata after server-side validation.
  if(result?.id&&s.products.some(p=>p.id===result.id))result=s.products.find(p=>p.id===result.id);
  const after=records(s),mutation=crypto.randomUUID();
  const statements=[db.prepare('INSERT OR IGNORE INTO inventory_revision(id,revision,mutation,next_id) VALUES(1,0,\'\',1)'),db.prepare('UPDATE inventory_revision SET revision=revision+1,mutation=?,next_id=? WHERE id=1 AND revision=?').bind(mutation,s.nextProductId,revision)];
  for(const [key,item] of after)if(before.get(key)?.payload!==item.payload)statements.push(db.prepare('INSERT INTO inventory_records(key,kind,payload) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM inventory_revision WHERE id=1 AND mutation=?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload').bind(key,item.kind,item.payload,mutation));
  for(const key of before.keys())if(!after.has(key))statements.push(db.prepare('DELETE FROM inventory_records WHERE key=? AND EXISTS(SELECT 1 FROM inventory_revision WHERE id=1 AND mutation=?)').bind(key,mutation));
  statements.push(db.prepare("INSERT INTO inventory_records(key,kind,payload) SELECT ?,'request',? WHERE EXISTS(SELECT 1 FROM inventory_revision WHERE id=1 AND mutation=?)").bind('request:'+requestId,JSON.stringify(result??null),mutation));
  const saved=await db.batch(statements);if(saved[1].meta.changes)return {result:result??null,...(await loadInventory(db))};
 }
 throw Error('Otro dispositivo está actualizando el inventario. Inténtalo de nuevo.');
}
