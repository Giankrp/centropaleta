export type DemoProducto = { id: number; name: string; cat: string; set: string; price: number; condition: string; type: string; art: string; image: string; badge: string; description: string };

const base: Omit<DemoProducto, "description">[] = [
  { id: 1, name: "Sobre Pokémon Escarlata y Púrpura 151", cat: "Pokémon", set: "151", price: 5.95, condition: "Sellado", type: "sellado", art: "📦", image: "p1", badge: "NUEVO" },
  { id: 2, name: "Sobre One Piece OP-09 Emperors in the New World", cat: "One Piece", set: "OP-09", price: 5.5, condition: "Sellado", type: "sellado", art: "📦", image: "p2", badge: "NUEVO" },
  { id: 3, name: "Sobre Dragon Ball Fusion World FB01", cat: "Dragon Ball", set: "FB01", price: 4.95, condition: "Sellado", type: "sellado", art: "📦", image: "p3", badge: "NUEVO" },
  { id: 4, name: "Caja Pokémon 151 (Japonesa)", cat: "Pokémon", set: "151", price: 69.95, condition: "Sellado", type: "sellado", art: "📦", image: "p4", badge: "NUEVO" },
  { id: 5, name: "Deck One Piece Starter Deck Azul", cat: "One Piece", set: "Starter Deck", price: 24.95, condition: "Sellado", type: "sellado", art: "📦", image: "p5", badge: "NUEVO" },
];

export const products: DemoProducto[] = base.map((p) => ({
  ...p,
  description: p.name + ". Producto sellado de " + p.cat + " de la colección " + p.set + ". Consulta las características y el idioma de esta referencia antes de comprar.",
}));
