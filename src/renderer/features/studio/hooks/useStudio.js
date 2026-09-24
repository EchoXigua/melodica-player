// @refresh reset
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, unwrap } from '../../../platform/client';
import { usePlayback } from './usePlayback';
import { useOutputTarget } from './useOutputTarget';
import { nextSongId, PLAY_ORDERS } from '../../../../shared/queue.mjs';
import { EXAMPLE, SCALE, DEFAULTS } from '../data/presets';
import { BUNDLED_MIDI } from '../data/bundled-presets';

function midiItem(value, { id, title, qualityNote }) {
  const track = value.tracks.find((t) => t.count)?.index ?? 0;
  const metadata = qualityNote
    ? {
        ...value,
        tracks: value.tracks.map((t) => ({
          ...t,
          name: value.tracks.length === 1 ? '主旋律（待校对）' : `轨道 ${t.index + 1}（待校对）`,
        })),
      }
    : value;
  return { id, title, mode: 'midi', midi: metadata, track, qualityNote };
}

export function useStudio() {
  const [library, setLibrary] = useState([
    { id: 'example', title: '小星星', mode: 'score', text: EXAMPLE },
    { id: 'scale', title: '音域校准', mode: 'score', text: SCALE },
  ]);
  const [libraryReady, setLibraryReady] = useState(false);
  const [saveState, setSaveState] = useState('loading');
  const saveSerial = useRef(0);
  const [selectedId, setSelectedId] = useState('example');
  const [playOrder, setPlayOrder] = useState('sequential');
  const [autoNext, setAutoNext] = useState(null);

  const [mode, setMode] = useState('score');
  const [text, setText] = useState(EXAMPLE);
  const [song, setSong] = useState('小星星');
  const [settings, setSettings] = useState(DEFAULTS);
  const [midi, setMidi] = useState(null);
  const [trimMidiStart, setTrimMidiStart] = useState(true);
  const [track, setTrack] = useState(0);
  const [plan, setPlan] = useState(null);
  const [notice, setNotice] = useState({ text: '准备好，把下一段旋律带进游戏。', error: false });
  const planRef = useRef(null),
    requestSerial = useRef(0),
    seenPreview = useRef(null);
  const request = useCallback(
    () => ({ mode, text, track, settings, trimMidiStart, midiId: midi?.id }),
    [mode, text, track, settings, midi, trimMidiStart],
  );
  const fail = useCallback(
    (error) => setNotice({ text: error.message || String(error), error: true }),
    [],
  );
  const preview = useCallback(async () => {
    const serial = ++requestSerial.current;
    const next = await unwrap(api.compile(request()));
    if (serial === requestSerial.current) {
      planRef.current = next;
      setPlan(next);
    }
    return next;
  }, [request]);
  const {
    platform,
    input,
    requestInputPermission,
    stopHint,
    dry,
    outputMode,
    setOutputMode,
    targets,
    target,
    setTarget,
    refreshing,
    refresh,
  } = useOutputTarget({ fail, setNotice });
  const {
    status,
    setStatus,
    count,
    active,
    setActive,
    elapsed,
    setElapsed,
    busy,
    actionLock,
    play,
    stop,
    audition,
    previewing,
    volume,
    setVolume,
    seek,
  } = usePlayback({
    planRef,
    setPlan,
    preview,
    request,
    dry,
    target,
    setNotice,
    fail,
    onCancel: () => setAutoNext(null),
    onComplete: () => {
      const id = nextSongId(library, selectedId, playOrder);
      if (id) {
        activate(library.find((item) => item.id === id));
        setAutoNext(id);
      }
    },
  });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const saved = await unwrap(api.readLibrary());
        let items = saved?.items || library;
        items = await Promise.all(
          items.map(async (item) =>
            item.mode === 'midi'
              ? { ...item, midi: await unwrap(api.restoreMidi(item.midi)) }
              : item,
          ),
        );
        for (const preset of BUNDLED_MIDI) {
          if (items.some((item) => item.id === preset.id)) continue;
          try {
            const value = await unwrap(api.loadBundledMidi(preset.file));
            if (value?.tracks?.some((t) => t.count)) items.push(midiItem(value, preset));
          } catch {
            /* Missing optional bundled files must not discard the user's saved library. */
          }
        }
        if (cancelled) return;
        setLibrary(items);
        const selected = items.find((item) => item.id === saved?.selectedId) || items[0];
        if (selected) activate(selected);
        if (saved?.settings) setSettings(saved.settings);
        if (PLAY_ORDERS.includes(saved?.playOrder)) setPlayOrder(saved.playOrder);
        if (typeof saved?.trimMidiStart === 'boolean') setTrimMidiStart(saved.trimMidiStart);
        setLibraryReady(true);
        setSaveState('saved');
      } catch (error) {
        if (!cancelled) {
          setSaveState('error');
          fail(Error('读取本地曲库失败，已保留原存档：' + error.message));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!libraryReady) return;
    const serial = ++saveSerial.current;
    setSaveState('saving');
    void unwrap(
      api.saveLibrary({
        version: 1,
        items: library,
        selectedId,
        settings,
        playOrder,
        trimMidiStart,
      }),
    )
      .then(() => {
        if (serial === saveSerial.current) setSaveState('saved');
      })
      .catch((error) => {
        if (serial === saveSerial.current) {
          setSaveState('error');
          fail(Error('曲库保存失败：' + error.message));
        }
      });
  }, [libraryReady, library, selectedId, settings, playOrder, trimMidiStart]);

  useEffect(() => {
    if (autoNext && autoNext === selectedId && !busy) {
      setAutoNext(null);
      void (outputMode === 'audition' ? audition() : play());
    }
  }, [autoNext, selectedId, busy]);
  function activate(item) {
    setSelectedId(item.id);
    setMode(item.mode);
    setSong(item.title);
    if (item.mode === 'midi') {
      setMidi(item.midi);
      setTrack(item.track);
    } else setText(item.text);
  }

  useEffect(() => {
    if (busy || seenPreview.current === preview) return;
    seenPreview.current = preview;
    let cancelled = false;
    planRef.current = null;
    setPlan(null);
    setElapsed(0);
    setActive(-1);
    const timer = setTimeout(
      () =>
        preview()
          .then(() => {
            if (!cancelled)
              setNotice({ text: '曲谱已就绪。在底部选择乐谱试听，点击开始试听。', error: false });
          })
          .catch((e) => {
            if (!cancelled) fail(e);
          }),
      180,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
      requestSerial.current++;
    };
  }, [preview, busy]);
  async function importMidi() {
    if (busy || actionLock.current) return;
    try {
      const value = await unwrap(api.importMidi());
      if (!value) return;
      const valid = value.tracks.find((t) => t.count);
      if (!valid) throw Error('该 MIDI 文件没有可演奏音符');
      setMidi(value);
      setTrack(valid?.index ?? 0);
      setSong(value.name.replace(/\.midi?$/i, ''));
      setMode('midi');
      if (valid) {
        const item = {
          id: crypto.randomUUID(),
          title: value.name.replace(/\.midi?$/i, ''),
          mode: 'midi',
          midi: value,
          track: valid.index,
        };
        setLibrary((items) => [...items, item]);
        setSelectedId(item.id);
      }
    } catch (e) {
      fail(e);
    }
  }
  function reset() {
    if (busy) return;
    void seek(0);
    setActive(-1);
    setStatus('idle');
    setNotice({ text: '已回到曲首。', error: false });
  }
  function load(kind) {
    if (busy) return;
    activate(library.find((item) => item.id === (kind === 'scale' ? 'scale' : 'example')));
    setStatus('idle');
  }
  return {
    library,
    saveState,
    renameSong: (id, name) => {
      const title = name.trim().slice(0, 120);
      if (!title) return;
      setLibrary((items) => items.map((item) => (item.id === id ? { ...item, title } : item)));
      if (id === selectedId) setSong(title);
    },
    deleteSong: (id) => {
      if (busy) return;
      const index = library.findIndex((item) => item.id === id);
      if (index < 0) return;
      if (library.length <= 1) {
        setNotice({ text: '至少保留一首曲目。', error: false });
        return;
      }
      const next = library.filter((item) => item.id !== id);
      setLibrary(next);
      if (id === selectedId) {
        setAutoNext(null);
        activate(next[Math.min(index, next.length - 1)]);
        setStatus('idle');
      }
    },
    reorderSongs: (next) => {
      if (busy) return;
      setLibrary((items) => {
        const ids = next.map((item) => item.id);
        if (items.map((item) => item.id).join() === ids.join()) return items;
        const byId = new Map(items.map((item) => [item.id, item]));
        const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
        return ordered.length === items.length ? ordered : items;
      });
    },
    moveSong: (id, targetId) => {
      if (busy || id === targetId) return;
      setLibrary((items) => {
        const from = items.findIndex((item) => item.id === id),
          to = items.findIndex((item) => item.id === targetId);
        if (from < 0 || to < 0) return items;
        const next = [...items];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      });
    },
    trimMidiStart,
    setTrimMidiStart,
    qualityNote: library.find((item) => item.id === selectedId)?.qualityNote,
    selectedId,
    playOrder,
    cycleOrder: () =>
      setPlayOrder(PLAY_ORDERS[(PLAY_ORDERS.indexOf(playOrder) + 1) % PLAY_ORDERS.length]),
    selectSong: (id) => {
      if (!busy) {
        setAutoNext(null);
        activate(library.find((item) => item.id === id));
        setStatus('idle');
      }
    },
    switchSong: async (id) => {
      if (id === selectedId) return;
      const item = library.find((entry) => entry.id === id);
      if (!item) return;
      setAutoNext(null);
      if (busy) await stop();
      activate(item);
      setStatus('idle');
    },
    platform,
    input,
    requestInputPermission,
    stopHint,
    mode,
    setMode: (value) => {
      if (busy || value === mode) return;
      const item = library.find(
        (item) => item.mode === value && (value !== 'midi' || item.midi?.id === midi?.id),
      );
      if (item) {
        setAutoNext(null);
        activate(item);
        setStatus('idle');
      }
    },
    text,
    setText: (value) => {
      setText(value);
      setLibrary((items) =>
        items.map((item) => (item.id === selectedId ? { ...item, text: value } : item)),
      );
    },
    song,
    setSong: (value) => {
      setSong(value);
      setLibrary((items) =>
        items.map((item) => (item.id === selectedId ? { ...item, title: value } : item)),
      );
    },
    settings,
    setSettings,
    midi,
    track,
    setTrack: (value) => {
      setTrack(value);
      setLibrary((items) =>
        items.map((item) => (item.id === selectedId ? { ...item, track: value } : item)),
      );
    },
    plan,
    status,
    count,
    active,
    elapsed,
    notice,
    dry,
    outputMode,
    setOutputMode: (value) => {
      if (busy || actionLock.current) return;
      setOutputMode(value);
      if (value === 'input' && ['win32', 'darwin'].includes(platform)) void refresh();
    },
    targets,
    target,
    setTarget,
    refreshing,
    busy: busy || !libraryReady,
    seek,
    preview: () =>
      preview()
        .then(() => setNotice({ text: '已更新演奏预览。', error: false }))
        .catch(fail),
    play: () => (outputMode === 'audition' ? audition() : play()),
    stop,
    previewing,
    volume,
    setVolume,
    openInputTest: async () => {
      try {
        await unwrap(api.openInputTest());
      } catch (error) {
        fail(error);
      }
    },
    importMidi,
    refresh,
    load,
    reset,
  };
}
