export const PLAY_ORDERS = ['sequential', 'list', 'single', 'shuffle'];
export function nextSongId(items, current, order, random = Math.random) {
  if (!items.length) return null;
  const index = items.findIndex((item) => item.id === current);
  if (index < 0) return null;
  if (order === 'single') return current;
  if (order === 'shuffle') {
    const others = items.filter((item) => item.id !== current);
    return others.length
      ? others[Math.min(others.length - 1, Math.floor(random() * others.length))].id
      : current;
  }
  if (index + 1 < items.length) return items[index + 1].id;
  return order === 'list' ? items[0].id : null;
}
