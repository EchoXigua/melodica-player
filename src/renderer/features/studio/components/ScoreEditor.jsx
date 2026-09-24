import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, FileMusic, Plus } from 'lucide-react';

export function ScoreEditor({ s, reduced }) {
  const [tab, setTab] = useState(s.mode);
  useEffect(() => setTab(s.mode), [s.mode]);
  function edit(value) {
    s.setText(value);
  }
  return (
    <div className="score-panel min-w-[0] overflow-hidden rounded-[10px] border-[1px] border-solid border-[#30303d] bg-[#17171f]">
      <div className="panel-header flex h-[53px] items-center justify-between gap-[12px] border-b-[1px] [border-bottom-style:solid] border-b-[#30303d] px-[18px] py-[0]">
        <div className="segmented flex h-full gap-[20px]" role="tablist" aria-label="曲谱来源">
          {[
            ['score', '简谱编辑'],
            ['midi', 'MIDI 轨道'],
          ].map(([id, label]) => (
            <button
              role="tab"
              aria-selected={tab === id}
              aria-controls={`${id}-panel`}
              id={`${id}Tab`}
              key={id}
              disabled={s.busy}
              onClick={() => setTab(id)}
            >
              {tab === id && (
                <motion.span
                  layoutId="tab-indicator"
                  className="tab-highlight absolute right-[0] bottom-[0] left-[0] h-[2px] rounded-[2px] bg-[#101016]"
                  transition={{ type: 'spring', stiffness: 420, damping: 35 }}
                />
              )}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          role="tabpanel"
          id={`${tab}-panel`}
          initial={{ opacity: 0, x: reduced ? 0 : 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduced ? 0 : -8 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'score' && s.mode !== 'score' ? (
            <div className="midi-panel flex h-[166px] flex-col items-center justify-center gap-[9px] px-[22px] py-[10px] text-[#9393a7]">
              <strong>当前曲目是 MIDI</strong>
              <p>没有简谱文本。要编辑简谱，请在左侧选择一首简谱曲目。</p>
            </div>
          ) : tab === 'score' ? (
            <>
              <div className="editor-wrap [margin:15px_0_0] flex h-[127px]">
                <div
                  className="line-numbers w-[47px] shrink-0 overflow-hidden [padding:3px_10px_0_18px] text-[10px] leading-[25px] text-[#9393a7] select-none"
                  aria-hidden="true"
                >
                  {Array.from({ length: Math.max(4, s.text.split('\n').length) }, (_, i) => (
                    <span key={i}>{String(i + 1).padStart(2, '0')}</span>
                  ))}
                </div>
                <textarea
                  id="score"
                  aria-label="简谱"
                  value={s.text}
                  spellCheck={false}
                  disabled={s.busy}
                  onChange={(e) => edit(e.target.value)}
                  onScroll={(e) => {
                    e.target.previousElementSibling.scrollTop = e.target.scrollTop;
                  }}
                />
              </div>
              <div className="syntax [margin:13px_18px_0_47px] flex gap-[13px] text-[8px] whitespace-nowrap text-[#9393a7]">
                <span>
                  <code>&lt;1</code> 低音
                </span>
                <span>
                  <code>&gt;1</code> 高音
                </span>
                <span>
                  <code>#4</code> 半音
                </span>
                <span>
                  <code>1:2</code> 两拍
                </span>
                <span>
                  <code>0</code> 休止
                </span>
              </div>
            </>
          ) : (
            <div className="midi-panel flex h-[166px] flex-col items-center justify-center gap-[9px] px-[22px] py-[10px] text-[#9393a7]">
              {s.mode === 'midi' && s.midi ? (
                <>
                  <FileMusic size={28} />
                  <strong id="filename">{s.midi.name}</strong>
                  <label htmlFor="track">选择主旋律轨道</label>
                  <select
                    id="track"
                    value={s.track}
                    disabled={s.busy}
                    onChange={(e) => s.setTrack(Number(e.target.value))}
                  >
                    {s.midi.tracks
                      .filter((t) => t.count)
                      .map((t) => (
                        <option key={t.index} value={t.index}>
                          {t.name} · {t.count} 音
                        </option>
                      ))}
                  </select>
                  <label className="flex items-center gap-[6px] text-[10px] text-[#b7a7ce]">
                    <input
                      id="trim-midi-start"
                      type="checkbox"
                      checked={s.trimMidiStart}
                      disabled={s.busy}
                      onChange={(e) => s.setTrimMidiStart(e.target.checked)}
                      className="accent-[#a78bfa]"
                    />
                    跳过开头空白（保留曲中休止）
                  </label>
                </>
              ) : (
                <>
                  <FileMusic size={30} />
                  <strong>让 MIDI 成为你的下一首曲子</strong>
                  <p>支持 .mid / .midi，选择单旋律轨道效果更好。</p>
                  <button
                    className="button inline-flex items-center justify-center gap-[10px] rounded-[7px] border-[1px] border-solid border-[#30303d] bg-[#17171f] px-[16px] py-[11px] text-[11px] whitespace-nowrap"
                    onClick={s.importMidi}
                    disabled={s.busy}
                  >
                    <Plus size={15} />
                    选择文件
                  </button>
                </>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {s.qualityNote && (
        <p role="note" className="mx-[17px] my-[10px] text-[11px] leading-[1.6] text-[#d7b68a]">
          {s.qualityNote}
        </p>
      )}
      <div className="editor-footer mt-[17px] flex items-center justify-between px-[17px] py-[12px] text-[9px] [border-top:1px_solid_#292933]">
        <span>
          <i />
          {s.plan ? '自动预览已更新' : '等待有效曲谱'}
        </span>
        <button
          id="compile"
          className="text-button inline-flex items-center gap-[6px] p-[0] text-[9px] text-[#9393a7] [background:none]"
          disabled={s.busy}
          onClick={s.preview}
        >
          更新预览
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
