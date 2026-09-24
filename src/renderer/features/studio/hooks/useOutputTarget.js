import { useEffect, useState } from 'react';
import { shortcutHint } from '../../../../shared/shortcuts.mjs';
import { api, unwrap } from '../../../platform/client';
export function useOutputTarget({ fail, setNotice }) {
  const [stopHint, setStopHint] = useState('正在检查停止快捷键…');
  const [platform, setPlatform] = useState('loading');
  const [outputMode, setOutputMode] = useState('audition');
  const [input, setInput] = useState({ supported: false, granted: false, ready: false });
  const dry = outputMode === 'audition';
  const [targets, setTargets] = useState([]);
  const [target, setTarget] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    unwrap(api.info())
      .then((info) => {
        setPlatform(info.platform);
        setInput(info.input || { supported: false, granted: false, ready: false });
        setStopHint(shortcutHint(info));
      })
      .catch(fail);
  }, [fail]);
  async function refresh() {
    setRefreshing(true);
    try {
      const info = await unwrap(api.info());
      setInput(info.input || { supported: false, granted: false, ready: false });
      const value = await unwrap(api.targets());
      setTargets(value);
      if (!value.some((t) => t.id === target)) setTarget('');
      if (!value.length)
        setNotice({ text: '没有找到可用目标，请先打开接收应用或游戏。', error: false });
    } catch (e) {
      fail(e);
    } finally {
      setRefreshing(false);
    }
  }
  async function requestInputPermission() {
    try {
      setInput(await unwrap(api.requestInputPermission()));
    } catch (error) {
      fail(error);
    }
  }
  useEffect(() => {
    if (platform !== 'darwin') return;
    const update = () => {
      void unwrap(api.info())
        .then((info) => setInput(info.input))
        .catch(fail);
    };
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, [platform, fail]);
  return {
    input,
    requestInputPermission,
    platform,
    stopHint,
    dry,
    outputMode,
    setOutputMode,
    targets,
    target,
    setTarget,
    refreshing,
    refresh,
  };
}
