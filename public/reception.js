/* Recepción de stock. La demo persiste solo en este navegador. */
const CPReception=(()=>{
 const activeStops=new Set(),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function description(p){const seed=CPProducts.find(x=>x.id===p.id&&x.name===p.name);return typeof p.description==='string'?p.description:seed?.description||''}
 function mount(root,{onSaved=()=>{},onNew=null,demo=false,inventory=CPStock}={}){
  let reader=null,revision=0,selected=null,token=null;
  root.innerHTML=`<div class="reception-head"><div><span class="overline">ENTRADA DE MERCANCÍA</span><h2>Escanea. Revisa. Añade stock.</h2><p>Recuperamos los datos de los productos asociados a tu inventario.</p></div><button class="primary" data-camera>Abrir cámara</button></div><div class="receive-notice">${demo?'Prueba independiente: los cambios no afectan al catálogo de la tienda.':'Maqueta: el inventario se guarda en este navegador, sin sincronización entre dispositivos.'} El código de barras no contiene la descripción: la recuperamos de la ficha asociada.</div><div class="receive-camera" hidden><video autoplay playsinline muted></video><button class="outline" data-stop>Detener cámara</button></div><form class="receive-code"><label>Código de barras o QR<div class="code-row"><input name="code" maxlength="128" placeholder="Escanea o escribe el código" required autocomplete="off"><button class="primary">Reconocer producto</button></div></label></form><p data-status role="status" aria-live="polite"></p><div class="receive-examples"><span>Prueba rápida:</span><button class="outline" data-example="CP-001">Pokémon · CP-001</button><button class="outline" data-example="CP-002">One Piece · CP-002</button><button class="outline" data-example="CP-NUEVO">Código desconocido</button></div><div data-result></div>`;
  const status=root.querySelector('[data-status]'),result=root.querySelector('[data-result]'),video=root.querySelector('video'),camera=root.querySelector('.receive-camera'),input=root.querySelector('[name=code]');
  function stop(){revision++;if(reader){reader.reset();reader=null}video.srcObject?.getTracks().forEach(t=>t.stop());video.srcObject=null;camera.hidden=true}
  activeStops.add(stop);
  function lookup(code){stop();selected=null;token=null;result.replaceChildren();code=String(code||'').trim();input.value=code;
   if(!code||code.length>128){status.textContent='Introduce un código válido.';return}
   const p=inventory.findByCode(code);
   if(!p){status.textContent='Código aún no asociado: '+code;result.innerHTML=`<section class="receive-card"><h3>Vamos a identificarlo una sola vez</h3><p>No inventaremos el nombre ni la descripción. Asocia este código a una ficha existente o crea el producto con sus datos.</p><form data-associate><label>Producto del catálogo<select name="product" required><option value="">Selecciona un producto…</option>${inventory.read().products.map(x=>`<option value="${x.id}">${escape(x.name)} · ${escape(x.code)}</option>`).join('')}</select></label><button class="primary">Asociar código y recuperar ficha</button></form>${onNew?'<button class="outline" data-new>Crear producto nuevo</button>':''}<p class="micro">La asociación se guarda para futuros escaneos y mantiene el código interno de tus etiquetas.</p></section>`;
    result.querySelector('[data-associate]').onsubmit=async e=>{e.preventDefault();try{inventory.associateCode(Number(e.target.product.value),code);lookup(code)}catch(err){status.textContent=err.message}};
    if(onNew)result.querySelector('[data-new]').onclick=()=>onNew(code);return;
   }
   selected=p.id;token=crypto.randomUUID();status.textContent='Producto reconocido. Revisa la descripción y confirma las unidades recibidas.';
   result.innerHTML=`<section class="receive-card"><div class="receive-product">${(p.image||p.photo)?`<img src="${escape(CPStock.imageSource(p))}" alt="">`:'<span>📦</span>'}<div><small>${escape(p.cat)} · ${escape(p.set||'')}</small><h3>${escape(p.name)}</h3><p>Código leído: <strong>${escape(code)}</strong></p><p>En inventario: <strong>${p.stock} unidades</strong></p></div></div><form data-confirm><label>Descripción recuperada<textarea name="description" rows="4" maxlength="5000" placeholder="Añade aquí la descripción si la ficha aún no la tiene">${escape(description(p))}</textarea></label><p class="micro">Puedes corregirla antes de guardar. No se añaden detalles de idioma o contenido que no tengamos confirmados.</p><label>Unidades recibidas<input name="quantity" type="number" min="1" step="1" value="1" required></label><button class="primary" type="submit">Confirmar y añadir stock</button></form></section>`;
   result.querySelector('[data-confirm]').onsubmit=async e=>{e.preventDefault();try{const r=inventory.receive(selected,Number(e.target.quantity.value),e.target.description.value,token);e.target.querySelector('button').disabled=true;status.textContent=r.duplicate?'Esta recepción ya estaba guardada. No se han duplicado unidades.':'Recepción guardada: '+r.product.stock+' unidades en inventario. Descripción disponible en su ficha.';onSaved();}catch(err){status.textContent=err.message}};
  }
  root.querySelector('.receive-code').onsubmit=async e=>{e.preventDefault();lookup(input.value)};
  root.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>lookup(b.dataset.example));
  root.querySelector('[data-stop]').onclick=()=>{stop();status.textContent='Cámara detenida. Puedes introducir el código manualmente.'};
  root.querySelector('[data-camera]').onclick=async()=>{stop();const run=revision;status.textContent='Permite la cámara y enfoca el código del producto.';
   if(!navigator.mediaDevices?.getUserMedia||typeof ZXing==='undefined'){status.textContent='Cámara no disponible. Usa un lector o escribe el código.';return}
   camera.hidden=false;
   try{reader=new ZXing.BrowserMultiFormatReader();const current=reader;await current.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'}}},video,(hit)=>{if(hit&&run===revision)lookup(hit.getText())});if(run!==revision){current.reset();if(reader===current)reader=null;video.srcObject?.getTracks().forEach(t=>t.stop());video.srcObject=null;camera.hidden=true;}}
   catch(err){if(run===revision){stop();status.textContent='No se pudo abrir la cámara. Revisa el permiso o introduce el código manualmente.'}}
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('pagehide',stop);
  return {lookup,stop};
 }
 return {mount,description,stopAll:()=>activeStops.forEach(stop=>stop())};
})();
