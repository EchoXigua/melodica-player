import { useEffect, useRef, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import {
  GripVertical,
  AudioLines,
  Check,
  CircleHelp,
  Copy,
  EllipsisVertical,
  Layers3,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react';
import { TRANSCRIBE_PROMPT } from '../data/transcribePrompt';
import { api, unwrap } from '../../../platform/client';

function SongRow({
  item,
  index,
  s,
  menu,
  setMenu,
  renamingId,
  draft,
  setDraft,
  finishRename,
  onDragEnd,
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="div"
      value={item}
      dragListener={false}
      dragControls={controls}
      data-song-id={item.id}
      onClick={() => s.selectSong(item.id)}
      onDoubleClick={() => s.switchSong(item.id)}
      title={s.busy && s.selectedId !== item.id ? '双击切换，需手动点击开始' : undefined}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.03, zIndex: 3, boxShadow: '0 10px 24px #00000066' }}
      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
      className={`song-item group relative my-[4px] flex w-full cursor-pointer items-center gap-[8px] rounded-[8px] px-[6px] py-[10px] text-left ${s.selectedId === item.id ? 'chosen bg-[#20202c] text-white' : 'bg-transparent text-[#c8c8d6] hover:bg-[#181820]'}`}
    >
      <button
        data-reorder
        aria-label={`拖动排序：${item.title}`}
        title="拖动排序；Alt + 上下方向键也可移动"
        disabled={s.busy}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          if (s.busy) return;
          e.stopPropagation();
          controls.start(e);
        }}
        onKeyDown={(e) => {
          if (e.altKey && ['ArrowUp', 'ArrowDown'].includes(e.key)) {
            e.preventDefault();
            const next = s.library[index + (e.key === 'ArrowUp' ? -1 : 1)];
            if (next) s.moveSong(item.id, next.id);
          }
        }}
        className="grid h-[28px] w-[28px] shrink-0 cursor-grab place-items-center bg-transparent p-0 text-[#8d879c] active:cursor-grabbing"
      >
        <span className="col-start-1 row-start-1 text-[13px] tabular-nums group-focus-within:opacity-0 group-hover:opacity-0">
          {index + 1}
        </span>
        <GripVertical
          size={15}
          className="col-start-1 row-start-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
        />
      </button>
      <div className="min-w-0 flex-1">
        {renamingId === item.id ? (
          <input
            aria-label="曲目名称"
            value={draft}
            maxLength={120}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => finishRename(true)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Enter') {
                e.preventDefault();
                finishRename(true);
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                finishRename(false);
              }
            }}
            className="w-full min-w-0 rounded border border-solid border-[#a78bfa] bg-[#17121f] px-[4px] text-[13px] text-inherit outline-none"
          />
        ) : (
          <span
            className="block min-w-0 truncate text-[13px] leading-[1.3] font-medium"
            title={item.title}
          >
            {item.title}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            s.selectSong(item.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            s.switchSong(item.id);
          }}
          aria-label={`播放曲目：${item.title}`}
          className="mt-[2px] block w-full truncate bg-transparent p-0 text-left text-[11px] whitespace-nowrap text-[#8d879c]"
        >
          {item.qualityNote ? 'MIDI 草稿 · 待校对' : item.mode === 'midi' ? 'MIDI 曲谱' : '简谱'}
        </button>
      </div>
      <button
        type="button"
        data-song-menu
        aria-label={`曲目操作：${item.title}`}
        title="更多"
        disabled={s.busy}
        className={`grid h-[28px] w-[28px] shrink-0 place-items-center bg-transparent p-0 text-[#8f7eaa] hover:text-white ${menu?.id === item.id ? 'opacity-100' : 'pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:opacity-100'}`}
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setMenu(
            menu?.id === item.id
              ? null
              : { id: item.id, top: rect.bottom + 4, right: window.innerWidth - rect.right },
          );
        }}
      >
        <EllipsisVertical size={15} />
      </button>
    </Reorder.Item>
  );
}

export function Sidebar({ s, setDialog }) {
  const [menu, setMenu] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptError, setPromptError] = useState('');
  const renameDone = useRef(false);
  const [order, setOrder] = useState(s.library);
  const orderRef = useRef(s.library);
  useEffect(() => {
    orderRef.current = s.library;
    setOrder(s.library);
  }, [s.library]);
  useEffect(() => {
    if (!menu) return;
    function close(event) {
      if (!event.target.closest?.('[data-song-menu]')) setMenu(null);
    }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);
  function finishRename(save) {
    if (renameDone.current) return;
    renameDone.current = true;
    if (save && draft.trim()) s.renameSong(renamingId, draft);
    setRenamingId(null);
  }
  async function copyPrompt() {
    try {
      await unwrap(api.copyText(TRANSCRIBE_PROMPT));
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1800);
      setDialog('transcribe');
    } catch (error) {
      setPromptError(error.message);
      setTimeout(() => setPromptError(''), 3000);
    }
  }
  return (
    <aside className="sidebar fixed inset-y-0 left-0 z-20 flex w-[214px] flex-col border-0 border-r border-solid border-[#22222c] bg-[#101015] px-[18px] py-[28px]">
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className="wordmark flex items-center gap-[10px] px-[8px] text-[23px] font-extrabold tracking-[-1px] text-white"
        aria-label="Melodica Studio"
      >
        <AudioLines className="text-accent" size={27} />
        <span>melodica</span>
      </a>
      <div className="mt-[28px] mb-[28px] space-y-[6px]">
        <button
          className="nav-item selected flex w-full items-center gap-[10px] rounded-[8px] bg-[#252034] px-[12px] py-[12px] text-[13px] text-[#cfbaff]"
          aria-current="page"
        >
          <Layers3 size={17} />
          演奏工作台
        </button>
        <button
          className="nav-item flex w-full items-center gap-[10px] rounded-[8px] bg-transparent px-[12px] py-[12px] text-[13px] text-[#9292a8] hover:bg-[#1a1a24]"
          onClick={() => setDialog('settings')}
        >
          <Settings2 size={17} />
          演奏设置
        </button>
      </div>
      <div className="scores flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="library-heading mb-[13px] flex shrink-0 items-center justify-between px-[8px] text-[13px] font-medium text-[#9b95a8]">
          <span
            aria-label={s.saveState === 'saved' ? '曲库已保存' : '曲库保存状态'}
            title={
              s.saveState === 'saved'
                ? '曲库已保存到本地'
                : s.saveState === 'saving'
                  ? '正在保存…'
                  : s.saveState === 'error'
                    ? '曲库读写失败，请查看页面提示'
                    : '读取曲库…'
            }
          >
            我的曲谱
          </span>
          <span>{s.library.length.toString().padStart(2, '0')}</span>
        </div>
        <Reorder.Group
          as="div"
          axis="y"
          values={order}
          onReorder={(next) => {
            orderRef.current = next;
            setOrder(next);
          }}
          className="song-list min-h-0 flex-1 overflow-y-auto"
          aria-label="曲谱列表"
        >
          {order.map((item, index) => (
            <SongRow
              key={item.id}
              item={item}
              index={index}
              s={s}
              menu={menu}
              setMenu={setMenu}
              renamingId={renamingId}
              draft={draft}
              setDraft={setDraft}
              finishRename={finishRename}
              onDragEnd={() => s.reorderSongs(orderRef.current)}
            />
          ))}
        </Reorder.Group>
        <button
          id="import"
          className="mt-[13px] flex w-full shrink-0 items-center gap-[8px] rounded-[8px] border border-dashed border-[#353543] bg-transparent px-[12px] py-[11px] text-[13px] text-[#b0aabd] hover:border-[#a78bfa]"
          disabled={s.busy}
          onClick={s.importMidi}
        >
          <Plus size={15} />
          导入曲谱
        </button>
        <button
          id="copy-transcribe-prompt"
          type="button"
          className="mt-[8px] flex w-full shrink-0 items-center gap-[8px] rounded-[8px] border border-dashed border-[#353543] bg-transparent px-[12px] py-[11px] text-[13px] text-[#b0aabd] hover:border-[#a78bfa]"
          onClick={copyPrompt}
          title="复制提示词，配合简谱图片发给 AI，让它转写成简谱文本"
        >
          {promptCopied ? <Check size={15} /> : <Copy size={15} />}
          {promptCopied ? '已复制' : '复制图片转谱提示词'}
        </button>
        {promptError && (
          <p role="alert" className="mt-[6px] text-[11px] text-[#e29a9a]">
            {promptError}
          </p>
        )}
      </div>
      <div className="sidebar-bottom mt-[24px] border-0 border-t border-solid border-[#24242f] pt-[16px]">
        <button
          onClick={() => setDialog('help')}
          aria-label="打开使用指南"
          className="flex items-center gap-[9px] bg-transparent px-[10px] py-[9px] text-[13px] text-[#9a94a6]"
        >
          <CircleHelp size={16} />
          使用指南
        </button>
      </div>
      {menu && (
        <div
          data-song-menu
          role="menu"
          className="fixed z-30 w-[132px] rounded-[8px] border border-solid border-[#343242] bg-[#1b1b24] p-[4px] shadow-[0_12px_28px_#00000066]"
          style={{ top: menu.top, right: menu.right }}
        >
          <button
            type="button"
            role="menuitem"
            aria-label={`修改曲名：${s.library.find((item) => item.id === menu.id)?.title || ''}`}
            className="flex w-full items-center gap-[8px] rounded-[6px] bg-transparent px-[8px] py-[7px] text-left text-[12px] text-[#e6e1ef] hover:bg-[#2a2836]"
            onClick={(e) => {
              e.stopPropagation();
              const item = s.library.find((entry) => entry.id === menu.id);
              setMenu(null);
              if (!item) return;
              renameDone.current = false;
              setDraft(item.title);
              setRenamingId(item.id);
            }}
          >
            <Pencil size={13} />
            重命名
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label={`删除曲目：${s.library.find((item) => item.id === menu.id)?.title || ''}`}
            className="flex w-full items-center gap-[8px] rounded-[6px] bg-transparent px-[8px] py-[7px] text-left text-[12px] text-[#f0a8b0] hover:bg-[#2a2836]"
            onClick={(e) => {
              e.stopPropagation();
              const id = menu.id;
              setMenu(null);
              s.deleteSong(id);
            }}
          >
            <Trash2 size={13} />
            删除
          </button>
        </div>
      )}
    </aside>
  );
}
