export function midiBytes(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (
    bytes.length < 14 ||
    bytes[0] !== 77 ||
    bytes[1] !== 84 ||
    bytes[2] !== 104 ||
    bytes[3] !== 100
  ) {
    throw Error(
      '不是有效的 MIDI 文件（缺少 MThd 文件头）；可能保存了网页，请选择真正的 .mid / .midi 文件',
    );
  }
  return bytes;
}
