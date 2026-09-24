import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ease } from '../../../shared/lib/motion';
import { timelineWindow, visibleNotes } from '../data/timeline.mjs';
import { clock } from '../data/presets';

export function Timeline({ plan, elapsed, active }) {
  const duration = plan?.duration || 1;
  const notes = plan?.notes || [];
  const [overview, setOverview] = useState(false);
  const [page, setPage] = useState(null);
  useEffect(() => {
    setPage(null);
  }, [plan]);
  useEffect(() => {
    setPage(null);
  }, [elapsed]);
  const window = timelineWindow(duration, elapsed, overview, page);
  const display = visibleNotes(notes, window);
  const base = plan?.settings.base || 60;
  const progress = ((elapsed - window.start) / window.span) * 100;
  return (
    <div
      className="timeline relative [margin:15px_26px_0] h-[133px]"
      aria-label="按音高和时间排列的音符轨迹"
    >
      {duration > 20000 && (
        <div className="absolute top-[-20px] right-0 flex items-center gap-[9px] text-[9px] text-[#b7a7ce]">
          {!overview && (
            <>
              <button
                aria-label="上一段音符"
                disabled={window.index === 0}
                onClick={() => setPage(window.index - 1)}
              >
                ‹
              </button>
              <span>
                {clock(window.start)}–{clock(window.end)}
              </span>
              <button
                aria-label="下一段音符"
                disabled={window.index === window.lastPage}
                onClick={() => setPage(window.index + 1)}
              >
                ›
              </button>
            </>
          )}
          <button
            id="timeline-zoom"
            aria-pressed={overview}
            onClick={() => {
              setOverview(!overview);
              setPage(null);
            }}
            className="rounded bg-[#292135] px-[6px] py-[2px]"
          >
            {overview ? '查看局部' : '查看全曲'}
          </button>
        </div>
      )}
      <div className="timeline-grid absolute top-[0] right-[0] bottom-[20px] left-[31px] [background-image:linear-gradient(#ffffff06_1px,_transparent_1px),_linear-gradient(90deg,_#ffffff05_1px,_transparent_1px)] [background-size:100%_28px,_12.5%_100%]" />
      <div className="timeline-labels absolute top-[10px] bottom-[29px] left-[0] flex flex-col justify-between text-[6px] tracking-[0.7px] text-[#f0f0f6]">
        <span>HIGH</span>
        <span>MID</span>
        <span>LOW</span>
      </div>
      <div className="timeline-plot absolute top-[0] right-[0] bottom-[20px] left-[31px]">
        {display.map(({ note: n, index: i, left, width }) => (
          <motion.span
            className={`note-bar absolute block h-[5px] min-w-[2px] origin-left rounded-[2px] bg-[#101016] [transition:background_0.18s,_box-shadow_0.18s] ${notes[active] === n ? 'current' : ''} ${n.at < elapsed ? 'past' : ''}`}
            key={`${n.at}-${n.pitch}-${i}`}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.45, delay: Math.min(i * 0.012, 0.35), ease }}
            style={{
              left: `${left}%`,
              width: `${width}%`,
              bottom: `${((n.pitch - base + 12) / 38) * 84 + 6}%`,
            }}
            title={`MIDI ${n.pitch} · ${n.key} · ${(n.hold / 1000).toFixed(2)} 秒`}
          />
        ))}
        {plan && progress >= 0 && progress <= 100 && (
          <div
            className="playhead absolute top-[0] bottom-[0] w-[1px] bg-[#101016] [will-change:left]"
            style={{ left: `${progress}%` }}
          >
            <span />
          </div>
        )}
        {!plan && (
          <div className="chart-empty grid h-full place-items-center text-[11px] text-[#9393a7]">
            编辑曲谱，生成你的旋律轨迹。
          </div>
        )}
      </div>
      <div className="timeline-ruler absolute right-[0] bottom-[0] left-[31px] flex justify-between text-[7px] text-[#9393a7] tabular-nums">
        {[0, 0.25, 0.5, 0.75, 1].map((n) => (
          <span key={n}>{clock(window.start + window.span * n)}</span>
        ))}
      </div>
    </div>
  );
}
