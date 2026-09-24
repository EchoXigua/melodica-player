import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Keyboard, X } from 'lucide-react';
import { ease } from '../../../shared/lib/motion';
import { IconButton } from '../../../shared/ui/IconButton';

export function Dialog({ type, onClose, s }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClose={onClose}
      className="dialog w-[490px] max-w-[calc(100vw_-_40px)] rounded-[16px] border-[1px] border-solid border-[#30303d] bg-[#17171f] p-[26px] text-[#f0f0f6] shadow-[0_30px_100px_#151e1240]"
      aria-labelledby="dialog-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease }}
      >
        <div className="dialog-top flex items-center justify-between">
          <span className="eyebrow flex items-center gap-[7px] text-[8px] font-semibold tracking-[2px] text-[#9393a7]">
            {type === 'settings' ? 'FINE TUNING' : 'QUICK START'}
          </span>
          <IconButton label="关闭" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <h2 id="dialog-title">{type === 'settings' ? '找到你的音准。' : '从一段旋律开始。'}</h2>
        {type === 'settings' ? (
          <>
            <p>为游戏中的口风琴调整音高、换音间隔和鼠标时序。</p>
            <div className="calibration-fields mt-[26px]">
              {[
                ['base', 'Z 的 MIDI 音高', 24, 96, '默认 60 / C4，实际音高需在游戏中校准'],
                ['gap', '音间隔 · ms', 5, 200, '留出松键时间，让重复音清楚分开'],
                ['lead', '鼠标提前量 · ms', 0, 100, '先切换音区，再触发音符'],
              ].map(([id, label, min, max, hint]) => (
                <label
                  key={id}
                  className="calibration-field flex items-center justify-between gap-[15px] border-b-[1px] [border-bottom-style:solid] border-b-[#30303d] px-[0] py-[15px] text-[12px]"
                >
                  <span>
                    {label}
                    <small>{hint}</small>
                  </span>
                  <input
                    id={id}
                    type="number"
                    min={min}
                    max={max}
                    value={s.settings[id]}
                    disabled={s.busy}
                    onChange={(e) => s.setSettings({ ...s.settings, [id]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <button
              className="button dark inline-flex items-center justify-center gap-[10px] rounded-[7px] border-[1px] border-solid border-[#30303d] bg-[#17171f] px-[16px] py-[11px] text-[11px] whitespace-nowrap"
              disabled={s.busy}
              onClick={() => {
                s.load('scale');
                onClose();
              }}
            >
              <Keyboard size={16} />
              载入音域校准曲
              <ArrowUpRight size={16} />
            </button>
          </>
        ) : (
          <>
            <div className="help-steps mx-[0] my-[22px]">
              <article>
                <span>01</span>
                <div>
                  <h3>写简谱，或导入 MIDI</h3>
                  <p>
                    空格分音，<code>&lt;1</code> 低音，<code>&gt;1</code> 高音，<code>#4</code>{' '}
                    升半音。<code>1:2</code> 两拍，<code>0</code> 休止。
                  </p>
                </div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <h3>选择播放模式</h3>
                  <p>
                    底部“乐谱试听”会播放当前曲谱的声音，不发送键鼠；“键鼠演奏”向选定窗口发送真实输入，支持
                    macOS 和 Windows 桌面端。Mac 首次使用需授权辅助功能。
                  </p>
                </div>
              </article>
              <article>
                <span>03</span>
                <div>
                  <h3>进入游戏的乐器界面</h3>
                  <p>
                    选择目标窗口（Mac 选择应用），开始后有 5
                    秒切换时间。松开鼠标和乐器键；目标失去焦点自动停止，F8 随时停止。Mac 功能键需按
                    Fn+F8；也可使用 ⌘/Ctrl+Shift+S，快捷键状态显示在页面底部。
                  </p>
                </div>
              </article>
            </div>
            <p className="subtle">
              当前版本为单旋律。MIDI 和弦取最高音，重叠音会截短。Windows 游戏内接收尚待实测。
            </p>
          </>
        )}
      </motion.div>
    </dialog>
  );
}
