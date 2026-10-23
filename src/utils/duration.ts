// Общее форматирование длительностей.

export function formatDuration(hours: number): string {
  // Округление — до разбиения на дни и часы: иначе 71.6ч давало «2д 24ч»,
  // а 23.96ч — «24.0ч» вместо «1д».
  if (Math.round(hours * 10) / 10 >= 24) {
    const totalHours = Math.round(hours);
    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;
    return remainingHours > 0 ? `${days}д ${remainingHours}ч` : `${days}д`;
  }
  return `${hours.toFixed(1)}ч`;
}

