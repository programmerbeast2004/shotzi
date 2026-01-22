export function formatLastSeen(lastActive) {
  if (!lastActive) return null;
  const t = typeof lastActive === 'string' ? new Date(lastActive) : new Date(lastActive);
  if (isNaN(t.getTime())) return null;
  const diff = Date.now() - t.getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff <= 60 * 1000) return { text: 'online', type: 'online' };
  if (diff <= 5 * minute) {
    const m = Math.max(1, Math.round(diff / minute));
    return { text: `last seen ${m}m ago`, type: 'recent' };
  }
  if (diff <= 24 * hour) {
    const h = Math.max(1, Math.round(diff / hour));
    return { text: `last seen ${h}h ago`, type: 'hour' };
  }
  const d = Math.max(1, Math.round(diff / day));
  return { text: `last seen ${d}d ago`, type: 'day' };
}

export function isOnline(lastActive) {
  if (!lastActive) return false;
  const t = new Date(lastActive);
  if (isNaN(t.getTime())) return false;
  return (Date.now() - t.getTime()) <= 60 * 1000;
}
