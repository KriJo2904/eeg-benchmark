export const bezKropek = (label: string) => label.replace(/\.+$/, '');

export function domyslneElektrody(kanaly: string[]): string[] {
  if (kanaly.length <= 6) return kanaly;
  const ruchowe = kanaly.filter((k) => ['C3', 'CZ', 'C4'].includes(bezKropek(k).toUpperCase()));
  return ruchowe.length ? ruchowe : kanaly.slice(0, 3);
}
