/** English count + noun with correct singular/plural ("1 item", "2 items"). Irregular plurals pass `many`. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
