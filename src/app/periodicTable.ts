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

  // Determine group/category color & class name (light-dark() keeps neon in dark mode and rich high-contrast hues in light mode)
  const groups = [
    { name: 'Alkali Metal', class: 'element-alkali', color: 'light-dark(#e11d48, #ff6b6b)' },
    { name: 'Alkaline Earth', class: 'element-alkaline', color: 'light-dark(#d97706, #f7d794)' },
    { name: 'Transition Metal', class: 'element-transition', color: 'light-dark(#2563eb, #54a0ff)' },
    { name: 'Basic Metal', class: 'element-basic-metal', color: 'light-dark(#ea580c, #ff9f43)' },
    { name: 'Semimetal', class: 'element-semimetal', color: 'light-dark(#dc2626, #ee5253)' },
    { name: 'Nonmetal', class: 'element-nonmetal', color: 'light-dark(#db2777, #ff9ff3)' },
    { name: 'Halogen', class: 'element-halogen', color: 'light-dark(#0891b2, #00d2d3)' },
    { name: 'Noble Gas', class: 'element-noble', color: 'light-dark(#7c3aed, #a55eed)' },
    { name: 'Lanthanide', class: 'element-lanthanide', color: 'light-dark(#e11d48, #ff6b81)' },
    { name: 'Actinide', class: 'element-actinide', color: 'light-dark(#4f46e5, #7c4dff)' }
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
