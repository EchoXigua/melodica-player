const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { native } = require('../adapters/input.cjs');
const { slicePlan } = require('../../shared/seek.mjs');
const { simulate } = require('../../shared/simulation.mjs');
function createPlayback({
  getPlan,
  emit,
  onIdle,
  platform = process.platform,
  launch = native,
  getTempPath = () => app.getPath('temp'),
}) {
  let job = null;
  async function stop() {
    const current = job;
    if (!current) return { requested: false };
    current.cancelled = true;
    if (current.stopFile) {
      try {
        await fs.writeFile(current.stopFile, 'stop');
      } catch (error) {
        if (job === current) throw error;
      }
    }
    return { requested: true };
  }
  async function play(request) {
    if (job) throw Error('已有演奏任务，请先停止');
    const plan = slicePlan(getPlan(request), request.startAt);
    if (!request.dry && !['win32', 'darwin'].includes(platform))
      throw Error('键鼠演奏需要 macOS 或 Windows 桌面端');
    const targetPattern = platform === 'darwin' ? /^mac:[1-9]\d*$/ : /^\d+:\d+$/;
    if (!request.dry && platform !== 'win32' && !targetPattern.test(request.target || ''))
      throw Error('请先选择目标窗口或应用');
    if (!request.dry && platform === 'win32' && request.target && !targetPattern.test(request.target))
      throw Error('请先选择目标窗口或应用');
    const nativeTarget =
      !request.dry && platform === 'win32' && !request.target ? 'foreground' : request.target;
    const current = { cancelled: false, stopFile: null };
    job = current;
    const finish = (state) => {
      if (job !== current) return;
      job = null;
      emit(state);
      onIdle();
    };
    if (request.dry) {
      let terminal;
      simulate(
        plan,
        current,
        (state) => {
          if (['done', 'stopped'].includes(state.type)) terminal = state;
          else emit(state);
        },
        { countdown: request.audition || request.seekResume ? 0 : 3000 },
      )
        .then(() => finish(terminal))
        .catch((error) => finish({ type: 'error', message: error.message }));
    } else {
      let dir;
      try {
        dir = await fs.mkdtemp(path.join(getTempPath(), 'melodica-'));
        current.stopFile = path.join(dir, 'stop');
        const file = path.join(dir, 'plan.tsv');
        await fs.writeFile(
          file,
          plan.events
            .map((e) => [e.at, e.device, e.code, e.down ? 1 : 0, e.index ?? ''].join('\t'))
            .concat(`${Math.ceil(plan.duration)}\tend`)
            .join('\n'),
        );
        if (current.cancelled) {
          await fs.rm(dir, { recursive: true, force: true });
          finish({ type: 'stopped' });
          return { notes: plan.notes.length };
        }
        const child = launch('play', [
          '-Plan',
          file,
          '-Target',
          nativeTarget,
          '-Owner',
          String(process.pid),
          '-StopFile',
          current.stopFile,
          ...(platform === 'darwin' &&
          Array.isArray(request.testPoint) &&
          request.testPoint.length === 2 &&
          request.testPoint.every(Number.isFinite)
            ? ['-TestPoint', request.testPoint.join(':')]
            : []),
        ]);
        let buffer = '',
          stderr = '',
          terminal,
          processError;
        const line = (text) => {
          const [kind, ...rest] = text.split(' '),
            detail = rest.join(' ');
          if (kind === 'COUNTDOWN') emit({ type: 'countdown', seconds: Number(detail) });
          if (kind === 'PLAYING') emit({ type: 'playing' });
          if (kind === 'NOTE') emit({ type: 'note', index: Number(detail) });
          // Terminal stdout is only confirmed after child close, after native key release.
          if (['DONE', 'STOP', 'ERROR'].includes(kind)) {
            // Windows native (InputEngine.cs) base64-encodes this detail because piped
            // Windows PowerShell stdout mangles non-ASCII text under the system ANSI
            // codepage; macOS native prints plain UTF-8 already.
            const state = {
              type: kind === 'DONE' ? 'done' : kind === 'STOP' ? 'stopped' : 'error',
              message:
                platform === 'win32' && detail
                  ? Buffer.from(detail, 'base64').toString('utf8')
                  : detail,
            };
            if (terminal?.type !== 'error') terminal = state;
          }
        };
        child.stdout.on('data', (bytes) => {
          buffer += bytes.toString();
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop();
          lines.forEach(line);
        });
        child.stderr.on('data', (bytes) => {
          stderr = (stderr + bytes).slice(-8000);
        });
        child.on('error', (error) => {
          processError = error;
        });
        child.once('close', async (code) => {
          if (buffer.trim()) line(buffer.trim());
          let state =
            processError || code || !terminal
              ? {
                  type: 'error',
                  message:
                    processError?.message ||
                    terminal?.message ||
                    stderr ||
                    '输入进程意外退出，释放状态未知',
                }
              : terminal;
          try {
            await fs.rm(dir, { recursive: true, force: true });
          } catch (error) {
            state = {
              type: 'error',
              message: `输入进程已退出，但清理临时文件失败：${error.message}`,
            };
          }
          finish(state);
        });
      } catch (error) {
        try {
          if (dir) await fs.rm(dir, { recursive: true, force: true });
        } finally {
          if (job === current) {
            job = null;
            onIdle();
          }
        }
        throw error;
      }
    }
    return { notes: plan.notes.length };
  }
  return {
    play,
    stop,
    get busy() {
      return Boolean(job);
    },
  };
}
module.exports = { createPlayback };
