// Reconstruct input at a new position, including modifiers for notes crossing the seek point.
export function slicePlan(plan, value = 0) {
  const offset = Math.min(plan.duration, Math.max(0, Number(value) || 0));
  if (!offset) return plan;
  const lead = plan.settings?.lead ?? 0;
  const notes = plan.notes.flatMap((note, index) => {
    const at = Math.max(lead, note.at - offset);
    const hold = note.at + note.hold - offset - at;
    return hold > 0 ? [{ ...note, at, hold, index }] : [];
  });
  const events = [];
  for (const note of notes) {
    for (const code of note.mouse || [])
      events.push({ at: note.at - lead, device: 'mouse', code, down: true });
    events.push({ at: note.at, device: 'key', code: note.key, down: true, index: note.index });
    events.push({ at: note.at + note.hold, device: 'key', code: note.key, down: false });
    for (const code of note.mouse || [])
      events.push({ at: note.at + note.hold, device: 'mouse', code, down: false });
  }
  events.sort((a, b) => a.at - b.at || Number(a.down) - Number(b.down));
  return { ...plan, notes, events, duration: Math.max(0, plan.duration - offset) };
}
