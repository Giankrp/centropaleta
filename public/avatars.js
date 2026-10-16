/* Avatares proporcionados por Centro Paleta. Conservamos los identificadores de perfil. */
const CPAvatars={options:[
{id:'coral',name:'Exploradora Coral',group:'Exploradores y criaturas',index:0},
{id:'lila',name:'Capitana Marea',group:'Piratas',index:1},
{id:'sol',name:'Guerrera Brasa',group:'Guerreros',index:2},
{id:'ambar',name:'Ninja Violeta',group:'Ninjas',index:3},
{id:'nox',name:'Explorador Nox',group:'Exploradores y criaturas',index:4},
{id:'rio',name:'Corsario Río',group:'Piratas',index:5},
{id:'plata',name:'Guerrero Relámpago',group:'Guerreros',index:6},
{id:'kai',name:'Ninja Kai',group:'Ninjas',index:7},
{id:'nutria',name:'Lobo Turquesa',group:'Exploradores y criaturas',index:8},
{id:'zorro',name:'Corsario Tentáculos',group:'Piratas',index:9},
{id:'buho',name:'Guerrero Esmeralda',group:'Guerreros',index:10},
{id:'tortuga',name:'Guardián Enmascarado',group:'Ninjas',index:11}
],get(id){return this.options.find(a=>a.id===id)||this.options[0]},markup(id,extra=''){const a=this.get(id),col=a.index%4,row=Math.floor(a.index/4);return `<span class="cp-avatar ${extra}" role="img" aria-label="${a.name}" style="background-position:${col*100/3}% ${row*50}%"></span>`}};
