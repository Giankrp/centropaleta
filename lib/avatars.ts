export type Avatar = { id: string; name: string; grupo: string; index: number };

export function avatarMarkup(avatarId: string, extra = ""): string {
  const avatar = opcionesAvatares.find((a) => a.id === avatarId) ?? opcionesAvatares[0];
  const col = avatar.index % 4;
  const row = Math.floor(avatar.index / 4);
  return `<span class="cp-avatar ${extra}" role="img" aria-label="${avatar.name}" style="background-position:${(col * 100) / 3}% ${row * 50}%"></span>`;
}

export const opcionesAvatares: Avatar[] = [
  { id: "coral", name: "Exploradora Coral", grupo: "Exploradores y criaturas", index: 0 },
  { id: "lila", name: "Capitana Marea", grupo: "Piratas", index: 1 },
  { id: "sol", name: "Guerrera Brasa", grupo: "Guerreros", index: 2 },
  { id: "ambar", name: "Ninja Violeta", grupo: "Ninjas", index: 3 },
  { id: "nox", name: "Explorador Nox", grupo: "Exploradores y criaturas", index: 4 },
  { id: "rio", name: "Corsario Río", grupo: "Piratas", index: 5 },
  { id: "plata", name: "Guerrero Relámpago", grupo: "Guerreros", index: 6 },
  { id: "kai", name: "Ninja Kai", grupo: "Ninjas", index: 7 },
  { id: "nutria", name: "Lobo Turquesa", grupo: "Exploradores y criaturas", index: 8 },
  { id: "zorro", name: "Corsario Tentáculos", grupo: "Piratas", index: 9 },
  { id: "buho", name: "Guerrero Esmeralda", grupo: "Guerreros", index: 10 },
  { id: "tortuga", name: "Guardián Enmascarado", grupo: "Ninjas", index: 11 },
];
