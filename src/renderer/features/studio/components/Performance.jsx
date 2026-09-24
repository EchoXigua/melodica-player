import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Keyboard } from 'lucide-react';
import { clock, KEYS, MOUSE } from '../data/presets';
import { EditableName } from '../../../shared/ui/EditableName';
import { Timeline } from './Timeline';

export function Performance({ s, enter, reduced }) {
  const active = s.plan?.notes[s.active];
  const inProgress = s.status === 'playing';
  return (
    <motion.section
      className={`performance relative overflow-hidden rounded-[12px] border-[1px] border-solid border-[#30303d] bg-[#101016] text-[#9393a7] shadow-[0_10px_18px_#252d2110] ${inProgress ? 'is-playing' : ''}`}
      {...enter(0.08)}
      aria-label="演奏可视化"
    >
      <div className="performance-top flex items-center justify-between gap-[15px] [padding:23px_26px_0]">
        <div>
          <span className="tiny-label text-[8px] font-[550] tracking-[1.8px]">NOW PLAYING</span>
          <AnimatePresence mode="wait">
            <motion.h2
              className="flex items-center gap-[8px]"
              key={s.song}
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -8 }}
              transition={{ duration: 0.2 }}
              title={s.song}
            >
              <EditableName value={s.song} onSave={(name) => s.renameSong(s.selectedId, name)} />
              <span> / {s.mode === 'midi' ? 'MIDI' : '简谱'}</span>
            </motion.h2>
          </AnimatePresence>
        </div>
        <div className="session-meta flex items-center gap-[21px] text-[8px] text-[#9393a7]">
          <span id="stats">
            <b>{s.plan?.notes.length ?? '—'}</b> 音符
          </span>
          <span>
            <b>{clock(s.plan?.duration || 0)}</b> 时长
          </span>
          <span className="output-tag flex items-center gap-[5px] rounded-[4px] border-[1px] border-solid border-[#30303d] bg-[#101016] px-[8px] py-[6px] text-[#9393a7]">
            <i />
            {s.previewing && s.busy ? '有声试听' : s.dry ? '乐谱试听' : '键鼠演奏'}
          </span>
        </div>
      </div>
      <Timeline plan={s.plan} elapsed={s.elapsed} active={s.active} />
      <div className="keyboard-deck [margin:17px_26px_0] flex items-center gap-[17px] [padding:17px_0_21px] [border-top:1px_solid_#292933]">
        <div className="keyboard-label flex w-[58px] shrink-0 flex-col gap-[7px] text-[#9393a7]">
          <Keyboard size={15} />
          <span>实时键位</span>
        </div>
        <div className="piano-keys grid flex-1 grid-cols-[repeat(8,_1fr)] gap-[5px]">
          {KEYS.map((key, i) => (
            <motion.div
              key={key}
              data-key={key}
              className={`piano-key relative flex h-[58px] flex-col justify-between rounded-[4px] border-[1px] border-b-[4px] border-solid border-[#30303d] border-b-[#30303d] bg-[#17171f] [padding:6px_7px_5px] text-[#f0f0f6] [transition:background_0.12s,_border-color_0.12s] ${active?.key === key ? 'pressed' : ''}`}
              animate={{ y: active?.key === key && !reduced ? 3 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              <span>{i === 7 ? '高 1' : i + 1}</span>
              <b>{key}</b>
              <small>{['do', 're', 'mi', 'fa', 'sol', 'la', 'si', 'do'][i]}</small>
            </motion.div>
          ))}
        </div>
        <div className="modifier-list flex min-w-[105px] flex-col gap-[8px] pl-[15px] [border-left:1px_solid_#292933]">
          {Object.entries(MOUSE).map(([key, label]) => (
            <span key={key} className={active?.mouse.includes(key) ? 'on' : ''}>
              <i />
              {{ left: '左键', right: '右键', middle: '中键' }[key]}
              <b>{label}</b>
            </span>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {s.status === 'countdown' && (
          <motion.div
            className="countdown-overlay absolute inset-0 z-[4] flex flex-col items-center justify-center gap-[10px] bg-[#101016] [backdrop-filter:blur(6px)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span>
              {s.previewing
                ? '有声试听即将开始'
                : s.dry
                  ? '模拟演奏即将开始'
                  : s.platform === 'win32'
                    ? '请切到全屏游戏，并松开鼠标'
                    : '请切到目标窗口，并松开鼠标'}
            </span>
            <AnimatePresence mode="popLayout">
              <motion.strong
                key={s.count}
                initial={{ opacity: 0, scale: reduced ? 1 : 1.3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduced ? 1 : 0.8 }}
              >
                {s.count || 1}
              </motion.strong>
            </AnimatePresence>
            <small>{s.stopHint}</small>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
