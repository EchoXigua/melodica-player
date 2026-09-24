import { useEffect, useRef, useState } from 'react';
import { api, unwrap } from '../../../platform/client';
import { createSynth } from '../../../shared/audio/synth.mjs';
import { isStopShortcut } from '../../../../shared/shortcuts.mjs';
export function usePlayback({
  planRef,
  setPlan,
  preview,
  request,
  dry,
  target,
  setNotice,
  fail,
  onComplete,
  onCancel,
}) {
  const position = useRef(0),
    seekSerial = useRef(0),
    stopWaiter = useRef(null);
  const callbacks = useRef({ onComplete, onCancel });
  callbacks.current = { onComplete, onCancel };
  const [status, setStatus] = useState('idle');
  const [count, setCount] = useState(0),
    [active, setActive] = useState(-1),
    [elapsed, setElapsed] = useState(0);
  const [previewing, setPreviewing] = useState(false),
    [volume, setVolume] = useState(35);
  const synth = useRef(null);
  if (!synth.current) synth.current = createSynth();
  const releaseTimer = useRef(),
    countTimer = useRef(),
    startTime = useRef(0),
    actionLock = useRef(false),
    stopRequested = useRef(false),
    auditionRun = useRef(false),
    mounted = useRef(true),
    ticking = useRef(false);
  const busy = ['preparing', 'countdown', 'playing', 'stopping'].includes(status);
  useEffect(() => {
    if (!actionLock.current) position.current = 0;
  }, [request]);
  useEffect(() => {
    synth.current.setVolume(volume / 100);
  }, [volume]);
  function cancelLocally() {
    callbacks.current.onCancel?.();
    stopRequested.current = true;
    ticking.current = false;
    synth.current.stop();
    clearTimeout(releaseTimer.current);
    clearInterval(countTimer.current);
    setActive(-1);
    if (actionLock.current) {
      setStatus('stopping');
      setNotice({ text: '正在停止，等待播放任务结束…', error: false });
    }
  }
  useEffect(() => {
    mounted.current = true;
    const off = api.onPlayback((state) => {
      if (state.type === 'stop-error') {
        fail(Error(state.message));
        return;
      }
      if (state.type === 'stop-requested') {
        if (!state.seeking) {
          seekSerial.current++;
          position.current = 0;
        }
        cancelLocally();
        return;
      }
      if (state.diagnostic) return;
      if (state.type === 'countdown') {
        setStatus(stopRequested.current ? 'stopping' : 'countdown');
        setNotice({ text: '倒计时中，可随时停止。', error: false });
        setCount(state.seconds);
        setElapsed(position.current);
        setActive(-1);
        clearInterval(countTimer.current);
        countTimer.current = setInterval(() => setCount((n) => Math.max(0, n - 1)), 1000);
      }
      if (state.type === 'playing') {
        clearInterval(countTimer.current);
        if (stopRequested.current) return;
        ticking.current = true;
        setStatus('playing');
        startTime.current = performance.now() - position.current;
        if (auditionRun.current) {
          try {
            synth.current.start(planRef.current, position.current);
          } catch (error) {
            fail(error);
            void api.stop();
            return;
          }
        }
        setNotice({
          text: auditionRun.current
            ? '有声试听中 · 合成音色，不发送键鼠'
            : '演奏进行中 · 可用停止按钮或紧急快捷键结束',
          error: false,
        });
      }
      if (state.type === 'note' && !stopRequested.current) {
        setActive(state.index);
        clearTimeout(releaseTimer.current);
        releaseTimer.current = setTimeout(
          () => setActive(-1),
          planRef.current?.notes[state.index]?.hold || 100,
        );
      }
      if (['done', 'stopped', 'error'].includes(state.type)) {
        ticking.current = false;
        synth.current.stop();
        actionLock.current = false;
        clearInterval(countTimer.current);
        clearTimeout(releaseTimer.current);
        setActive(-1);
        setStatus(state.type);
        if (stopWaiter.current) {
          stopWaiter.current(state.type);
          stopWaiter.current = null;
        }
        if (state.type === 'done') position.current = 0;
        if (state.type === 'done') setElapsed(planRef.current?.duration || 0);
        if (state.type === 'done' && !stopRequested.current) callbacks.current.onComplete?.();
        setNotice({
          text:
            state.type === 'done'
              ? '演奏完成。下一首，继续。'
              : state.type === 'error'
                ? `执行失败：${state.message}`
                : state.message
                  ? `已停止：${state.message}`
                  : '已停止。',
          error: state.type === 'error',
        });
      }
    });
    const onKey = (event) => {
      if (isStopShortcut(event)) {
        event.preventDefault();
        void stop();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      mounted.current = false;
      stopRequested.current = true;
      off();
      window.removeEventListener('keydown', onKey, true);
      clearInterval(countTimer.current);
      clearTimeout(releaseTimer.current);
      synth.current.dispose();
      seekSerial.current++;
      stopWaiter.current?.('stopped');
      if (actionLock.current) void api.stop();
    };
  }, []);
  useEffect(() => {
    if (status !== 'playing') return;
    let frame;
    function update() {
      if (!ticking.current) return;
      setElapsed(Math.min(performance.now() - startTime.current, planRef.current?.duration || 0));
      frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [status]);
  async function start(audition, offset = position.current, seekResume = false) {
    if (actionLock.current) return;
    if (offset >= (planRef.current?.duration || Infinity)) offset = 0;
    position.current = offset;
    actionLock.current = true;
    stopRequested.current = false;
    auditionRun.current = audition;
    setPreviewing(audition);
    setStatus('preparing');
    setNotice({ text: '正在准备曲谱…', error: false });
    try {
      // Resume synchronously from the button gesture, before asynchronous compilation.
      if (audition) await synth.current.prepare();
      const next = await preview();
      if (stopRequested.current || !mounted.current) {
        actionLock.current = false;
        synth.current.stop();
        if (mounted.current) {
          setStatus('stopped');
          setNotice({ text: '已取消演奏。', error: false });
        }
        return;
      }
      planRef.current = next;
      setPlan(next);
      await unwrap(
        api.play({
          ...request(),
          dry: audition || dry,
          audition,
          target,
          startAt: offset,
          seekResume: seekResume && audition,
        }),
      );
    } catch (error) {
      actionLock.current = false;
      synth.current.stop();
      if (mounted.current) {
        setStatus('error');
        fail(error);
      }
    }
  }
  async function stop() {
    seekSerial.current++;
    position.current = 0;
    cancelLocally();
    try {
      await unwrap(api.stop());
    } catch (error) {
      fail(error);
    } // Keep the run locked until backend termination is confirmed.
  }
  async function seek(value) {
    if (['preparing', 'countdown', 'stopping'].includes(status)) return;
    const at = Math.max(0, Math.min(Number(value) || 0, planRef.current?.duration || 0));
    const serial = ++seekSerial.current;
    const resume = actionLock.current;
    const listening = auditionRun.current;
    if (resume) {
      cancelLocally();
      const stopped = new Promise((resolve) => {
        stopWaiter.current = resolve;
      });
      try {
        const result = await unwrap(api.stop({ seeking: true }));
        if (!result.requested) {
          stopWaiter.current?.('stopped');
          stopWaiter.current = null;
          actionLock.current = false;
        }
        const terminal = await stopped;
        if (terminal === 'error' || serial !== seekSerial.current || !mounted.current) return;
      } catch (error) {
        stopWaiter.current = null;
        fail(error);
        return;
      }
    }
    position.current = at;
    setElapsed(at);
    setActive(-1);
    if (resume && at < (planRef.current?.duration || 0)) await start(listening, at, true);
    else setStatus('idle');
  }
  return {
    seek,
    status,
    setStatus,
    count,
    active,
    setActive,
    elapsed,
    setElapsed,
    busy,
    actionLock,
    play: () => start(false),
    audition: () => start(true),
    stop,
    previewing,
    volume,
    setVolume,
  };
}
