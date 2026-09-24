import { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
export function EditableName({ value, onSave, className = '', hoverEdit = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const finished = useRef(false);
  function finish(save) {
    if (finished.current) return;
    finished.current = true;
    if (save && draft.trim()) onSave(draft.trim());
    setEditing(false);
  }
  return (
    <div
      className={`relative flex min-w-0 items-center ${hoverEdit ? '' : 'gap-[6px]'} ${className}`}
    >
      {editing ? (
        <input
          aria-label="曲目名称"
          value={draft}
          maxLength={120}
          autoFocus
          ref={(el) => {
            if (el && document.activeElement !== el) {
              el.focus();
              el.select();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') {
              e.preventDefault();
              finish(true);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              finish(false);
            }
          }}
          className="w-full min-w-0 rounded border border-solid border-[#a78bfa] bg-[#17121f] px-[4px] text-inherit outline-none"
        />
      ) : (
        <>
          <span
            className={`min-w-0 flex-1 truncate ${hoverEdit ? 'group-focus-within:pr-[18px] group-hover:pr-[18px]' : ''}`}
            title={value}
          >
            {value}
          </span>
          <button
            type="button"
            aria-label={`修改曲名：${value}`}
            title="修改名称"
            className={`shrink-0 bg-transparent p-[2px] text-[#8f7eaa] hover:text-white ${
              hoverEdit
                ? 'pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:opacity-100'
                : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              finished.current = false;
              setDraft(value);
              setEditing(true);
            }}
          >
            <Pencil size={12} />
          </button>
        </>
      )}
    </div>
  );
}
