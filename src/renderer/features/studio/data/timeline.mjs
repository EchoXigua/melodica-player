// Display coordinates only: never changes the playback plan or skips notes.
export function timelineWindow(duration, elapsed, overview = false, page = null) {
  const total = Math.max(1, duration || 1);
  const span = overview ? total : Math.min(total, 20000);
  const lastPage = Math.max(0, Math.ceil(total / span) - 1);
  const index = overview ? 0 : Math.max(0, Math.min(lastPage, page ?? Math.floor(elapsed / span)));
  const start = index * span;
  const end = Math.min(total, start + span);
  return { start, end, span: end - start, index, lastPage };
}
export function visibleNotes(notes, window) {
  return notes.flatMap((note, index) => {
    const start = Math.max(window.start, note.at);
    const end = Math.min(window.end, note.at + note.hold);
    return end > start
      ? [
          {
            note,
            index,
            left: ((start - window.start) / window.span) * 100,
            width: ((end - start) / window.span) * 100,
          },
        ]
      : [];
  });
}
