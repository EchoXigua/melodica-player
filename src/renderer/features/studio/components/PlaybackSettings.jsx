import React from 'react';
import { AudioLines, ArrowUpRight, MousePointer2, Settings2 } from 'lucide-react';

export function PlaybackSettings({ s, setDialog }) {
  return (
    <div className="controls-panel min-w-[0] overflow-hidden rounded-[10px] border-[1px] border-solid border-[#30303d] bg-[#17171f] pb-[0]">
      <div className="panel-header flex h-[53px] items-center justify-between gap-[12px] border-b-[1px] [border-bottom-style:solid] border-b-[#30303d] px-[18px] py-[0]">
        <h3>演奏设置</h3>
        <span className="tiny-label text-[8px] font-[550] tracking-[1.8px]">MAKE IT YOURS</span>
      </div>
      <div className="tempo-row [margin:15px_20px_14px] flex items-center justify-between">
        <label htmlFor="bpm">
          节拍速度
          <span>
            {s.mode === 'midi'
              ? s.midi?.variableTempo
                ? 'MIDI 起始 BPM · 随曲变化'
                : 'MIDI 原始 BPM'
              : 'BPM'}
          </span>
        </label>
        <div className="tempo-value flex items-center gap-[9px]">
          <input
            id="bpm"
            type="number"
            min="20"
            max="300"
            value={s.mode === 'midi' ? Math.round(s.midi?.bpm ?? 120) : s.settings.bpm}
            disabled={s.busy || s.mode === 'midi'}
            onChange={(e) => s.setSettings({ ...s.settings, bpm: e.target.value })}
          />
          <AudioLines size={21} />
        </div>
      </div>
      <div className="two-settings grid grid-cols-[1fr_1fr] gap-[13px] px-[20px] py-[0]">
        <label htmlFor="speed">
          播放倍率
          <select
            id="speed"
            value={s.settings.speed}
            disabled={s.busy}
            onChange={(e) => s.setSettings({ ...s.settings, speed: Number(e.target.value) })}
          >
            {[0.5, 0.75, 1, 1.25, 1.5].map((n) => (
              <option key={n} value={n}>
                {n.toFixed(2).replace(/0$/, '')} ×
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="transpose">
          移调 · 半音
          <input
            id="transpose"
            type="number"
            min="-36"
            max="36"
            value={s.settings.transpose}
            disabled={s.busy}
            onChange={(e) => s.setSettings({ ...s.settings, transpose: e.target.value })}
          />
        </label>
      </div>
      <button
        className="advanced-button [margin:13px_20px_10px] flex items-center gap-[7px] p-[0] text-[9px] text-[#9393a7] [background:none]"
        onClick={() => setDialog('settings')}
      >
        <Settings2 size={16} />
        <span>音高与输入校准</span>
        <ArrowUpRight size={15} />
      </button>
      <div className="output-note flex items-start gap-[7px] px-[20px] py-[10px] text-[#9393a7] [border-top:1px_solid_#292933]">
        <MousePointer2 size={15} />
        <p>
          {s.input.supported
            ? '选择游戏窗口，即可切换到自动演奏。'
            : '当前设备支持曲谱编辑与有声试听。'}
          <span>
            {s.platform === 'darwin'
              ? 'Mac 需授权辅助功能；选择目标应用，5 秒后开始。'
              : '真实键鼠输出支持 macOS 与 Windows 桌面端。'}
          </span>
        </p>
      </div>
    </div>
  );
}
