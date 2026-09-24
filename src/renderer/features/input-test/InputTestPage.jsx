import { useEffect, useRef, useState } from 'react';
import { api, unwrap } from '../../platform/client';
import { isStopShortcut, shortcutHint } from '../../../shared/shortcuts.mjs';
import { Keyboard, MousePointer2, Square, ArrowLeft } from 'lucide-react';
const keyNames = {
  KeyZ: 'Z',
  KeyX: 'X',
  KeyC: 'C',
  KeyV: 'V',
  KeyB: 'B',
  KeyN: 'N',
  KeyM: 'M',
  Comma: ',',
};
export function InputTestPage() {
  const [info, setInfo] = useState({ platform: 'loading' }),
    [events, setEvents] = useState([]),
    [state, setState] = useState('idle'),
    [message, setMessage] = useState('点击下面的接收区，启动桌面端真实键鼠测试。'),
    [result, setResult] = useState(null);
  const busy = useRef(false),
    collecting = useRef(false),
    manual = useRef(true),
    pad = useRef(null);
  const update = useRef(null);
  update.current = (event) => {
    if (!manual.current && !collecting.current) return;
    setEvents((previous) => [
      ...previous.slice(-199),
      { ...event, time: performance.now().toFixed(0) },
    ]);
    if (collecting.current) api.reportInput(event);
  };
  useEffect(() => {
    unwrap(api.info())
      .then(setInfo)
      .catch((error) => setMessage(error.message));
    const off = api.onInputTest((event) => {
      if (event.type === 'begin') {
        busy.current = true;
        collecting.current = false;
        manual.current = false;
        setEvents([]);
        setResult(null);
        setState('countdown');
      }
      if (event.type === 'result') {
        busy.current = false;
        collecting.current = false;
        setState(event.terminal);
        setResult(event);
        setMessage(
          event.terminal === 'done'
            ? event.passed
              ? '通过：接收窗口收到的真实事件与计划逐项一致。'
              : '未通过：收到的事件与计划不一致，请检查权限、焦点和人工按键干扰。'
            : event.terminal === 'stopped'
              ? '测试已停止，下面保留已收到的事件。'
              : `测试失败：${event.message}`,
        );
      }
      if (event.type === 'failure') {
        busy.current = false;
        collecting.current = false;
        setState('error');
        setMessage(event.message);
      }
    });
    const offPlayback = api.onPlayback((event) => {
      if (event.type === 'countdown') {
        setState('countdown');
        setMessage(`${event.seconds} 秒后开始。保持窗口在前台，鼠标留在接收区，松开按键和鼠标。`);
      }
      if (event.type === 'playing') {
        collecting.current = true;
        setState('playing');
        setMessage('正在发送真实键鼠事件，请勿操作键鼠或切换窗口。');
      }
      if (event.type === 'stop-requested' && busy.current) {
        setState('stopping');
        setMessage('正在停止，等待原生进程释放输入…');
      }
    });
    const key = (event) => {
      if (event.type === 'keydown' && isStopShortcut(event)) {
        event.preventDefault();
        void api.stop();
        return;
      }
      const code = keyNames[event.code];
      if (!code || event.repeat) return;
      if (!pad.current?.contains(document.activeElement) && !busy.current) return;
      event.preventDefault();
      update.current({
        device: 'key',
        code,
        down: event.type === 'keydown',
        trusted: event.isTrusted,
      });
    };
    const mouse = (event) => {
      if (!busy.current && !pad.current?.contains(event.target)) return;
      const code = ['left', 'middle', 'right'][event.button];
      if (!code) return;
      update.current({
        device: 'mouse',
        code,
        down: event.type === 'mousedown',
        trusted: event.isTrusted,
      });
      if (busy.current) event.preventDefault();
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', key, true);
    window.addEventListener('mousedown', mouse, true);
    window.addEventListener('mouseup', mouse, true);
    return () => {
      off();
      offPlayback();
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('keyup', key, true);
      window.removeEventListener('mousedown', mouse, true);
      window.removeEventListener('mouseup', mouse, true);
      if (busy.current) void api.stop();
    };
  }, []);
  async function start() {
    pad.current?.focus();
    if (busy.current || !['win32', 'darwin'].includes(info.platform) || !manual.current) return;
    busy.current = true;
    manual.current = false;
    setResult(null);
    setEvents([]);
    setState('preparing');
    try {
      await unwrap(api.startInputTest());
    } catch (error) {
      busy.current = false;
      manual.current = true;
      setState('error');
      setMessage(error.message);
    }
  }
  function reset() {
    if (busy.current) return;
    manual.current = true;
    setEvents([]);
    setResult(null);
    setState('idle');
    setMessage('已重置，可再次点击接收区。');
  }
  return (
    <div className="mx-auto max-w-[1050px] p-[28px] text-ink">
      <div className="flex items-start justify-between gap-[15px]">
        <div>
          <div className="mb-[8px] text-[10px] tracking-[2px] text-accent">INPUT LAB</div>
          <h2 className="text-[25px] font-semibold">键盘与鼠标 · 接收测试</h2>
        </div>
        {!window.melodica && (
          <a href={location.pathname} className="flex items-center gap-[6px] text-[12px]">
            <ArrowLeft size={15} />
            返回工作台
          </a>
        )}
        <button
          id="probe-stop"
          onClick={() => api.stop()}
          className="flex items-center gap-[7px] rounded-[7px] bg-[#101016] px-[14px] py-[10px] text-white"
        >
          <Square size={14} />
          停止测试
        </button>
      </div>
      <p className="mt-[12px] text-[12px] leading-[1.8] text-[#9393a7]">
        自动测试与演奏共用输入引擎：Windows 使用 SendInput，Mac 使用 CGEvent，覆盖 Z X C V B N M ,
        及鼠标左、右、中键。这里记录的是接收窗口的事件，而非播放计划回显。测试期间请勿人工输入。
      </p>
      <p id="probe-platform" className="mt-[10px] text-[12px] text-accent">
        {['win32', 'darwin'].includes(info.platform)
          ? `${info.platform === 'darwin' ? 'macOS' : 'Windows'} · 可进行真实键鼠测试`
          : '浏览器仅支持手动接收检测，请使用桌面端进行真实键鼠测试。'}{' '}
        · {shortcutHint(info)}
      </p>
      {info.platform === 'darwin' && (
        <div className="mt-2 text-[12px] text-[#b7aec4]">
          <span>
            {info.input?.granted ? '辅助功能已授权。' : '首次使用请授权辅助功能，授权后重启应用。'}
          </span>
          <button
            id="probe-permission"
            className="ml-2 rounded bg-[#3c3150] px-3 py-1"
            onClick={async () => {
              try {
                await unwrap(api.requestInputPermission());
                setInfo(await unwrap(api.info()));
              } catch (error) {
                setMessage(error.message);
              }
            }}
          >
            打开权限设置
          </button>
        </div>
      )}
      <div
        ref={pad}
        id="input-pad"
        role="button"
        tabIndex={0}
        onClick={start}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void start();
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        onAuxClick={(e) => e.preventDefault()}
        className="mt-[20px] flex min-h-[155px] cursor-pointer flex-col items-center justify-center gap-[12px] rounded-[12px] border-[1px] border-dashed border-[#30303d] bg-[#17171f] p-[22px] text-center outline-offset-4 focus-visible:outline-accent"
      >
        <div className="flex gap-[12px] text-[#9393a7]">
          <Keyboard size={28} />
          <MousePointer2 size={28} />
        </div>
        <strong>
          {state === 'idle'
            ? ['win32', 'darwin'].includes(info.platform)
              ? '点击这里开始 · 鼠标保持在此区域'
              : '点击聚焦后，手动按乐器键或鼠标按钮'
            : message}
        </strong>
        <span className="text-[11px] text-[#9393a7]">
          F8 或 ⌘/Ctrl+Shift+S 停止；系统媒体播放键并不等于 F8。
        </span>
      </div>
      <div className="my-[15px] flex items-center justify-between gap-[12px] text-[12px]">
        <span id="probe-status">{message}</span>
        <button
          id="probe-reset"
          disabled={busy.current}
          onClick={reset}
          className="shrink-0 rounded-[6px] bg-[#17171f] px-[12px] py-[7px]"
        >
          清空 / 再测
        </button>
      </div>
      {result && (
        <div id="probe-result" className="mb-[14px] rounded-[8px] bg-white p-[12px] text-[12px]">
          {result.passed && result.terminal === 'done'
            ? 'PASS'
            : result.terminal === 'stopped'
              ? 'STOPPED'
              : 'FAIL'}{' '}
          · 预计 {result.expected} 条 / 可信接收 {result.received} 条 / 非可信 {result.untrusted} 条
          · 未释放：{result.held.length ? result.held.join(', ') : '无'}
          {result.mismatch >= 0 && ` · 首个差异：第 ${result.mismatch + 1} 条`}
        </div>
      )}
      <div className="max-h-[280px] overflow-auto rounded-[8px] border-[1px] border-solid border-[#30303d] bg-white">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="sticky top-0 bg-[#17171f]">
            <tr>
              {['时间 ms', '设备', '按键', '动作', '可信事件'].map((x) => (
                <th key={x} className="px-[12px] py-[9px] font-medium">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody id="probe-events">
            {events.map((event, i) => (
              <tr key={i} className="border-0 border-b-[1px] border-solid border-[#30303d]">
                <td className="px-[12px] py-[6px] tabular-nums">{event.time}</td>
                <td>{event.device}</td>
                <td>{event.code}</td>
                <td>{event.down ? '按下' : '释放'}</td>
                <td>{event.trusted ? '是' : '否（脚本事件）'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!events.length && (
          <p className="p-[20px] text-center text-[12px] text-[#9393a7]">等待接收事件…</p>
        )}
      </div>
      <p className="mt-[10px] text-[11px] leading-[1.7] text-[#9393a7]">
        可信事件也可能来自手动输入，因此自动测试时请保持双手离开键鼠。此处通过只说明该接收窗口收到输入，游戏能否接收仍需在游戏内验证。
      </p>
    </div>
  );
}
