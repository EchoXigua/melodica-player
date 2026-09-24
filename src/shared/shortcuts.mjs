export function isStopShortcut(event) {
  const key = (event.key || '').toLowerCase();
  return Boolean(
    key === 'f8' ||
    event.code === 'F8' ||
    ((event.ctrlKey || event.metaKey || event.control || event.meta) &&
      (event.shiftKey || event.shift) &&
      (key === 's' || event.code === 'KeyS')),
  );
}
export function shortcutHint(info) {
  const mac = info.platform === 'darwin';
  const local = info.platform === 'browser';
  const fallback = mac ? '⌘⇧S' : 'Ctrl+Shift+S';
  const keys = mac ? 'Fn+F8 / ⌘⇧S' : 'F8 / Ctrl+Shift+S';
  if (local) return 'F8 / Ctrl或⌘+Shift+S（页面聚焦时）';
  if (info.shortcuts?.f8 === false)
    return info.shortcuts?.fallback
      ? `F8 被占用，请用 ${fallback}`
      : '全局停止快捷键不可用，请使用停止按钮';
  return info.shortcuts?.fallback === false ? `${mac ? 'Fn+F8' : 'F8'}（备用快捷键被占用）` : keys;
}
