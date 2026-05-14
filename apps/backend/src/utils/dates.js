export function parseISODateOnly(s) {
  // expects YYYY-MM-DD
  const [y, m, d] = String(s || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // noon UTC to avoid DST issues
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  // [start, end) overlap check
  return aStart < bEnd && bStart < aEnd;
}
