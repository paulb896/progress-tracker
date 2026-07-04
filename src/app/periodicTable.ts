export type PeriodicElement = {
  symbol: string
  atomicNumber: number
  groupName: string
  groupClass: string
  color: string
  mass: string
}

export const getPeriodicElement = (name: string): PeriodicElement => {
  const clean = name.trim().replace(/[^a-zA-Z\s]/g, '');
  const words = clean.split(/\s+/);
  let symbol = 'Ex';
  
  if (words.length >= 2) {
    const firstChar = words[0][0] ? words[0][0].toUpperCase() : 'E';
    const secondChar = words[1][0] ? words[1][0].toLowerCase() : 'x';
    symbol = firstChar + secondChar;
  } else if (clean.length >= 2) {
    symbol = clean[0].toUpperCase() + clean[1].toLowerCase();
  } else if (clean.length === 1) {
    symbol = clean[0].toUpperCase();
  }

  // Deterministic Atomic Number from name hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const atomicNumber = Math.abs(hash % 118) + 1;

  // Detemine group/category color & class name
  const groups = [
    { name: 'Alkali Metal', class: 'element-alkali', color: '#ff6b6b' },
    { name: 'Alkaline Earth', class: 'element-alkaline', color: '#f7d794' },
    { name: 'Transition Metal', class: 'element-transition', color: '#54a0ff' },
    { name: 'Basic Metal', class: 'element-basic-metal', color: '#ff9f43' },
    { name: 'Semimetal', class: 'element-semimetal', color: '#ee5253' },
    { name: 'Nonmetal', class: 'element-nonmetal', color: '#ff9ff3' },
    { name: 'Halogen', class: 'element-halogen', color: '#00d2d3' },
    { name: 'Noble Gas', class: 'element-noble', color: '#a55eed' },
    { name: 'Lanthanide', class: 'element-lanthanide', color: '#ff6b81' },
    { name: 'Actinide', class: 'element-actinide', color: '#5f27cd' }
  ];
  const groupIdx = Math.abs(hash) % groups.length;
  const group = groups[groupIdx];

  const mass = (Math.abs(hash % 300) + 1.008).toFixed(3);

  return {
    symbol,
    atomicNumber,
    groupName: group.name,
    groupClass: group.class,
    color: group.color,
    mass
  };
}
