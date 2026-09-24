import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, CircleHelp } from 'lucide-react';
import { ease } from '../../shared/lib/motion';
import { useStudio } from './hooks/useStudio';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { PageHeading } from './components/PageHeading';
import { Performance } from './components/Performance';
import { ScoreEditor } from './components/ScoreEditor';
import { PlaybackSettings } from './components/PlaybackSettings';
import { Player } from './components/Player';
import { Dialog } from './components/Dialog';

export function StudioPage() {
  const s = useStudio();
  const [dialog, setDialog] = useState(null);
  const reduced = useReducedMotion();
  const quietNotice =
    !s.notice.error && /曲谱已就绪|准备好，把下一段|已更新演奏预览/.test(s.notice.text);
  const enter = (delay = 0) => ({
    initial: { opacity: 0, y: reduced ? 0 : 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.65, delay: reduced ? 0 : delay, ease },
  });
  return (
    <div className="app-shell flex min-h-screen">
      <Sidebar s={s} setDialog={setDialog} />

      <div className="main-column ml-[214px] w-[calc(100%_-_214px)] min-w-[0] pb-[116px]">
        <Topbar />

        <main>
          <PageHeading enter={enter} />

          <Performance s={s} enter={enter} reduced={reduced} />

          <motion.section
            className="workspace-panels mt-[20px] grid grid-cols-[1.6fr_1fr] gap-[20px]"
            {...enter(0.16)}
          >
            <ScoreEditor s={s} reduced={reduced} />
            <PlaybackSettings s={s} setDialog={setDialog} />
          </motion.section>
          {s.plan?.warnings.length > 0 && (
            <div className="warnings [padding:10px_0_0] text-[10px] text-[#9393a7]" role="status">
              {s.plan.warnings.join(' ')}
            </div>
          )}
          <div
            className={`status-line mt-[16px] flex items-start justify-between gap-[15px] text-[9px] text-[#9393a7] ${quietNotice ? 'hidden' : ''}`}
          >
            <span id="message" role="status" className={s.notice.error ? 'error' : ''}>
              {s.notice.error ? <CircleHelp size={14} /> : <Check size={14} />}
              <span>{s.notice.text}</span>
            </span>
            <span title={s.stopHint}>{s.stopHint}</span>
          </div>
        </main>
        <Player s={s} enter={enter} reduced={reduced} />
      </div>
      {dialog && <Dialog type={dialog} onClose={() => setDialog(null)} s={s} />}
    </div>
  );
}
