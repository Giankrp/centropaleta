(async()=>{
 const cover=document.createElement('div');cover.id='cloud-loading';cover.style.cssText='position:fixed;inset:0;background:#f8fafc;z-index:99999;display:grid;place-items:center;text-align:center;padding:24px;color:#18374b;font:18px system-ui';cover.textContent='Cargando Centro Paleta…';document.body.append(cover);
 let snapshot,pending=0;
 const fail=error=>{cover.replaceChildren();const box=document.createElement('div'),p=document.createElement('p'),b=document.createElement('button');p.textContent=error.message;b.textContent='Volver a intentar';b.onclick=()=>location.reload();box.append(p,b);cover.append(box)};
  async function get(){const response=await fetch('/api/inventory',{cache:'no-store',credentials:'same-origin'});const data=await response.json();if(!response.ok)throw Error(data.error||'No se puede cargar el catálogo');return data}
 try{
  snapshot=await get();window.CPCloud={admin:snapshot.admin,refresh:async()=>{if(pending)return;snapshot=await get();return snapshot},legacy:()=>{try{return JSON.parse(localStorage.getItem('cpInventoryDemoV1')||'null')}catch{return null}}};
  async function mutate(operation,args){
   if(operation==='sale'&&args[1]!=='Tienda física'){let data=structuredClone(snapshot.state);const memory={getItem:()=>JSON.stringify(data),setItem:(_,v)=>{data=JSON.parse(v)}};const result=createCPStock(memory).sale(...args);let demos=[];try{demos=JSON.parse(localStorage.getItem('cpOnlineSalesDemoV2')||'[]')}catch{}demos.unshift(result);localStorage.setItem('cpOnlineSalesDemoV2',JSON.stringify(demos));return result}

   if(pending)throw Error('Hay un guardado en curso. Espera a que termine antes de continuar.');
   if(!CPCloud.admin)throw Error('Solo la cuenta propietaria puede modificar el inventario');
   const id=crypto.randomUUID(),p=snapshot.state.products.find(p=>p.id===Number(args[0]));
   const body=JSON.stringify({operation,args,requestId:id,productVersion:operation==='updateProduct'&&args[2]!==undefined?args[2]:p?._version||0});pending++;
   try{
     let response;for(let attempt=0;attempt<2;attempt++){try{response=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body});break}catch(error){if(attempt)throw Error('No se ha podido confirmar el guardado. Comprueba tu conexión y actualiza antes de repetir.')}}
    const data=await response.json();if(!response.ok){if(data.error?.includes('otro dispositivo'))snapshot=await get();throw Error(data.error||'No se pudo guardar')}
    snapshot=data;return data.result;
   }finally{pending--}
  }
  function attachStock(){CPStock.read=()=>structuredClone(snapshot.state);CPStock.product=id=>CPStock.read().products.find(p=>p.id===Number(id));CPStock.findByCode=code=>CPStock.read().products.find(p=>p.code===String(code).trim()||(p.barcodes||[]).includes(String(code).trim()));for(const name of ['addProduct','updateProduct','deleteProduct','configure','replenish','describe','configureOffer','removeOffer','associateCode','receive','sale','importProducts'])CPStock[name]=(...args)=>mutate(name,args)}
  for(const original of document.querySelectorAll('script[type="text/cp-script"]')){
   const script=document.createElement('script');if(original.src){script.src=original.src;await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('No se ha podido cargar un componente de la página'));document.body.append(script)})}else{script.textContent=original.textContent;document.body.append(script)}
   if(original.src?.endsWith('/stock.js'))attachStock();
   if(original.src?.endsWith('/demo-access.js')){
     CPAccess.requireAdmin=()=>{if(CPCloud.admin)return true;location.replace('/cuenta.html?next=panel');return false};
     if(CPCloud.admin){CPAccess.get=()=>({role:'admin',name:'Centro Paleta',id:'owner',user:'centropaleta'});CPAccess.logout=()=>{sessionStorage.removeItem(CPAccess.key);fetch('/api/auth/logout',{method:'POST'}).finally(()=>location.assign('/cuenta.html'))}}
   }
  }
  cover.remove();
  setInterval(async()=>{if(document.hidden||pending)return;try{const old=snapshot.revision,data=await get();snapshot=data;if(old!==data.revision)window.dispatchEvent(new StorageEvent('storage',{key:CPStock.key}))}catch{/* Keep last confirmed snapshot. Writes still require server confirmation. */}},20000);
 }catch(error){fail(error)}
})();
