// Inventario efímero exclusivo de la prueba. No altera localStorage de la tienda.
const sampleStorage={getItem:k=>CPSampleStorage.get(k)||null,setItem:(k,v)=>CPSampleStorage.set(k,v)};
CPReception.mount(document.getElementById('example-app'),{demo:true,inventory:createCPStock(sampleStorage,'cpReceiveExample')});
