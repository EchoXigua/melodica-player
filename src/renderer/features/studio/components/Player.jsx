import { useState } from 'react';
import { motion } from 'motion/react';
import {
  AudioLines,
  Headphones,
  Keyboard,
  LoaderCircle,
  Play,
  RotateCcw,
  Square,
  Repeat,
  Repeat1,
  Shuffle,
  ListMusic,
  Volume2,
} from 'lucide-react';
import { IconButton } from '../../../shared/ui/IconButton';
import { clock } from '../data/presets';
export function Player({ s, enter, reduced }) {
  const [scrub, setScrub] = useState(null);
  function commitSeek(value) {
    setScrub(null);
    void s.seek(Number(value));
  }
  const listening = s.outputMode === 'audition';
  const unavailable =
    !listening && (!s.input.supported || !s.input.granted || !s.input.ready || !s.target);
  const stopping = s.status === 'stopping';
  const label = stopping
    ? '正在停止…'
    : s.busy
      ? s.status === 'preparing' || s.status === 'countdown'
        ? '取消开始'
        : listening
          ? '停止试听'
          : '停止演奏'
      : listening
        ? '开始试听'
        : '开始演奏';
  const shown = scrub ?? s.elapsed;
  const duration = s.plan?.duration || 1;
  const ratio = Math.min(1, Math.max(0, shown / duration));
  return (
    <motion.footer
      className="player fixed right-0 bottom-0 left-[214px] z-10 grid h-[96px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6 bg-[#121118]/95 px-6 pt-[12px] [backdrop-filter:blur(18px)] [border-top:1px_solid_#2a2633]"
      style={{ '--progress': `${ratio * 100}%` }}
      {...enter(0.24)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <input
        type="range"
        min="0"
        step="1"
        disabled={!s.plan || ['preparing', 'countdown', 'stopping'].includes(s.status)}
        onChange={(e) => setScrub(Number(e.target.value))}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setScrub(Number(e.currentTarget.value));
        }}
        onPointerUp={(e) => commitSeek(e.currentTarget.value)}
        onPointerCancel={() => setScrub(null)}
        onKeyUp={(e) => {
          if (
            [
              'ArrowLeft',
              'ArrowRight',
              'ArrowUp',
              'ArrowDown',
              'Home',
              'End',
              'PageUp',
              'PageDown',
            ].includes(e.key)
          )
            commitSeek(e.currentTarget.value);
        }}
        onBlur={(e) => {
          if (scrub !== null) commitSeek(e.currentTarget.value);
        }}
        id="progress"
        value={shown}
        max={s.plan?.duration || 1}
        aria-label="播放进度"
      />
      <div className="player-song flex min-w-0 flex-1 items-center gap-3">
        <div
          className={`player-icon grid h-12 w-12 shrink-0 place-items-center rounded-[12px] border border-solid border-[#463459] bg-[#2b2338] text-[#c5a1ee] ${s.status === 'playing' ? 'playing' : ''}`}
        >
          <AudioLines size={20} />
        </div>
        <div className="min-w-0">
          <strong className="block truncate text-[13px] font-semibold text-[#f4eefe]">
            {s.song}
          </strong>
          <small
            className="mt-[2px] block truncate text-[11px] text-[#8d849c]"
            title={listening ? '乐谱试听 · 有声音，不发送键鼠' : '键鼠演奏 · 发送真实键鼠输入'}
          >
            {listening ? '乐谱试听' : '键鼠演奏'}
          </small>
        </div>
      </div>
      <div className="player-center flex shrink-0 items-center gap-3">
        <span className="w-12 shrink-0 text-right text-[11px] whitespace-nowrap text-[#8a8098] tabular-nums">
          {clock(shown)}
        </span>
        <IconButton label="重置播放进度" disabled={s.busy} onClick={s.reset}>
          <RotateCcw size={16} />
        </IconButton>
        <motion.button
          id="play"
          data-state={s.status}
          aria-label={label}
          title={`${label}。${s.stopHint}`}
          className="play-button flex h-[48px] w-[76px] items-center justify-center rounded-full bg-[#d7c4f6] text-[#1a1224]"
          disabled={stopping || (!s.busy && (!s.plan || unavailable))}
          whileHover={reduced ? {} : { scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={s.busy ? s.stop : s.play}
        >
          {stopping ? (
            <LoaderCircle size={18} className="spin" />
          ) : s.busy ? (
            <Square size={15} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className="ml-[2px]" />
          )}
        </motion.button>
        <IconButton
          id="play-order"
          label={
            { sequential: '顺序播放', list: '列表循环', single: '单曲循环', shuffle: '随机播放' }[
              s.playOrder
            ] + ' · 点击切换'
          }
          onClick={s.cycleOrder}
          aria-live="polite"
        >
          {s.playOrder === 'single' ? (
            <Repeat1 size={18} />
          ) : s.playOrder === 'shuffle' ? (
            <Shuffle size={18} />
          ) : s.playOrder === 'list' ? (
            <Repeat size={18} />
          ) : (
            <ListMusic size={18} />
          )}
        </IconButton>
        <span className="w-12 shrink-0 text-[11px] whitespace-nowrap text-[#8a8098] tabular-nums">
          {clock(s.plan?.duration || 0)}
        </span>
      </div>
      <div className="player-tools flex min-w-0 items-center justify-end gap-2">
        <div role="radiogroup" aria-label="播放模式" className="flex items-center gap-1">
          {[
            ['input', '键鼠', '键鼠演奏', Keyboard],
            ['audition', '试听', '乐谱试听', Headphones],
          ].map(([value, name, full, Icon]) => (
            <button
              key={value}
              id={value === 'audition' ? 'audition' : 'input-mode'}
              role="radio"
              aria-checked={s.outputMode === value}
              aria-label={full}
              title={full}
              disabled={s.busy}
              onClick={() => s.setOutputMode(value)}
              className={`flex h-7 items-center gap-1 rounded-full px-3 text-[12px] ${s.outputMode === value ? 'bg-[#3c3150] text-[#f4e9ff]' : 'bg-[#221f2a] text-[#b7aec4] hover:bg-[#2a2633]'}`}
            >
              <Icon size={13} />
              {name}
            </button>
          ))}
        </div>
        {listening && (
          <label className="flex shrink-0 items-center gap-2 text-[#a398b4]">
            <Volume2 size={16} />
            <input
              id="volume"
              aria-label="试听音量"
              type="range"
              min="0"
              max="100"
              value={s.volume}
              onChange={(e) => s.setVolume(Number(e.target.value))}
              className="player-volume w-[72px]"
              style={{ '--volume': `${s.volume}%` }}
            />
          </label>
        )}
        <div className="player-output flex shrink-0 items-center gap-2">
          {!listening && s.platform === 'darwin' && !s.input.granted && (
            <button
              id="input-permission"
              onClick={s.requestInputPermission}
              aria-label="授权辅助功能"
              title="在系统设置中允许辅助功能，授权后重启应用"
              className="flex h-7 shrink-0 items-center rounded-full bg-[#3c3150] px-3 text-[12px] whitespace-nowrap text-[#f4e9ff]"
            >
              授权
            </button>
          )}
          {!listening && s.platform === 'darwin' && !s.input.ready && (
            <span className="shrink-0 text-[11px] whitespace-nowrap text-red-300">
              请运行 pnpm native:mac
            </span>
          )}

          {!listening && s.input.supported && (
            <div className="target-row flex items-center">
              <select
                id="target"
                aria-label="目标窗口"
                value={s.target}
                disabled={s.busy || s.refreshing}
                onChange={(e) => s.setTarget(e.target.value)}
              >
                <option value="">
                  {s.platform === 'darwin' ? '选择目标应用' : '选择目标窗口'}
                </option>
                {s.targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <IconButton
                id="refresh"
                label="刷新窗口"
                disabled={s.busy || s.refreshing}
                onClick={s.refresh}
              >
                {s.refreshing ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <RotateCcw size={14} />
                )}
              </IconButton>
            </div>
          )}
          <button
            id="input-test"
            onClick={s.openInputTest}
            disabled={s.busy}
            title="键鼠测试"
            className="hidden"
          >
            <Keyboard size={13} />
            测试
          </button>
        </div>
      </div>
    </motion.footer>
  );
}
