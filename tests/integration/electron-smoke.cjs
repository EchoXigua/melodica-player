const { app, dialog } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Midi } = require('@tonejs/midi');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.setAppPath(path.resolve(__dirname, '../..'));
app.setPath(
  'userData',
  require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'melodica-react-smoke-')),
);
require('../../src/main/index.cjs');
let primarySeen = false;
app.on('browser-window-created', (_e, win) => {
  if (primarySeen) return;
  primarySeen = true;
  const errors = [];
  win.webContents.on('console-message', (details) => {
    if (details.level === 'error') errors.push(details.message);
  });
  win.webContents.once('did-finish-load', async () => {
    let tmp;
    const js = async (code) => {
      try {
        return await win.webContents.executeJavaScript(code);
      } catch (error) {
        throw Error(`UI script failed: ${code}`, { cause: error });
      }
    };
    const value = async (selector, next) =>
      js(
        `(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(next)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
      );
    const click = (selector) => js(`document.querySelector(${JSON.stringify(selector)}).click()`);
    async function until(code, regex, timeout = 5000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const result = await js(code);
        if (regex.test(String(result))) return result;
        await wait(80);
      }
      throw Error(`Timed out: ${code} -> ${await js(code)}`);
    }
    try {
      await until('document.getElementById("stats")?.textContent', /42 音符/);
      assert.equal(
        await js('document.getElementById("audition").getAttribute("aria-checked")'),
        'true',
      );
      await until(
        'Array.from(document.querySelectorAll(".note-bar")).every(el=>Number(getComputedStyle(el).opacity)>.99)',
        /true/,
      );
      await wait(250);
      assert.equal(await js('!!window.melodica'), true);
      assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'), true);
      if (process.env.MELODICA_SCREENSHOT)
        await fs.writeFile(
          process.env.MELODICA_SCREENSHOT,
          (await win.webContents.capturePage()).toPNG(),
        );
      await until(
        'Array.from(document.querySelectorAll(".song-item")).some(b=>b.textContent.includes("父亲"))',
        /true/,
      );
      await js(
        'Array.from(document.querySelectorAll(".song-item")).find(b=>b.textContent.includes("父亲")).click()',
      );
      await until('document.getElementById("stats").textContent', /442 音符/);
      assert.equal(await js('document.getElementById("bpm").value'), '65');
      const localWidth = await js('parseFloat(document.querySelector(".note-bar").style.width)');
      assert.ok(localWidth > 1);
      await click('#timeline-zoom');
      const overviewWidth = await js('parseFloat(document.querySelector(".note-bar").style.width)');
      assert.ok(localWidth > overviewWidth * 4);
      await click('#timeline-zoom');
      await click('[aria-label="下一段音符"]');
      assert.match(await js('document.querySelector(".timeline-ruler").textContent'), /00:20/);
      await click('[aria-label="上一段音符"]');
      await wait(700);
      if (process.env.MELODICA_FATHER_SCREENSHOT)
        await fs.writeFile(
          process.env.MELODICA_FATHER_SCREENSHOT,
          (await win.webContents.capturePage()).toPNG(),
        );
      const rejected = await js('window.melodica.loadBundledMidi("fuqin-ref.mid")');
      assert.equal(rejected.ok, false);
      assert.match(rejected.error, /MThd/);
      await js(
        'Array.from(document.querySelectorAll(".song-item")).find(b=>b.textContent.includes("小星星")).click()',
      );
      await until('document.getElementById("stats").textContent', /42 音符/);
      // The library heading stays outside the scrollable song list.
      const headingY = await js(
        'document.querySelector(".library-heading").getBoundingClientRect().y',
      );
      await js('document.querySelector(".song-list").scrollTop = 10000');
      assert.equal(
        await js('document.querySelector(".library-heading").getBoundingClientRect().y'),
        headingY,
      );
      await js('document.querySelector(".song-list").scrollTop = 0');
      await click('.song-item[data-song-id="example"] [aria-label^="曲目操作"]');
      await click('[aria-label^="修改曲名"]');
      await value('[aria-label="曲目名称"]', '侧栏改名');
      await js(
        'document.querySelector("[aria-label=曲目名称]").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))',
      );
      await until('document.querySelector(".performance h2").textContent', /侧栏改名/);
      await wait(300); // Wait for the title's exit/enter transition before editing it.
      await click('.performance [aria-label^="修改曲名"]');
      await value('[aria-label="曲目名称"]', '小星星');
      await wait(80); // Let the controlled input commit before triggering blur.
      await js('document.querySelector("[aria-label=曲目名称]").blur()');
      await until(
        'document.querySelector(".song-item[data-song-id=example]").textContent',
        /小星星/,
      );
      await js(
        'document.querySelector(\'[data-song-id="example"] [data-reorder]\').dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowDown",altKey:true,bubbles:true}))',
      );
      assert.equal(await js('document.querySelector(".song-item").dataset.songId'), 'scale');
      await js(
        'document.querySelector(\'[data-song-id="example"] [data-reorder]\').dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowUp",altKey:true,bubbles:true}))',
      );
      assert.equal(await js('document.querySelector(".song-item").dataset.songId'), 'example');
      await value('#score', '1 1 <#2 >1');
      await until('document.getElementById("stats").textContent', /4 音符/);
      await click('#play');
      await until('document.getElementById("message").textContent', /有声试听中/);
      assert.equal(await js('document.querySelector(".countdown-overlay")'), null);
      assert.equal(await js('document.getElementById("score").disabled'), true);
      assert.equal(await js('document.getElementById("play").disabled'), false);
      await click('#play');
      await until('document.getElementById("message").textContent', /已停止/);
      // A DOM shortcut delivered during asynchronous compilation must cancel the pending start.
      await js(
        `document.getElementById('play').click(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F8', code: 'F8', bubbles: true }));`,
      );
      await until('document.getElementById("message").textContent', /已取消|已停止/);
      await wait(250);
      assert.equal(await js('document.getElementById("play").disabled'), false);
      await value('#score', '1:8');
      await until('document.getElementById("stats").textContent', /1 音符/);
      await click('#audition');
      await click('#play');
      await until('document.getElementById("message").textContent', /有声试听中/);
      await value('#progress', '2500');
      await js(
        'document.getElementById("progress").dispatchEvent(new PointerEvent("pointerup", {bubbles:true}))',
      );
      await until('document.getElementById("play").dataset.state', /^playing$/);
      await until('Number(document.getElementById("progress").value) >= 2500', /true/);
      const audioDeadline = Date.now() + 2500;
      while (!win.webContents.isCurrentlyAudible() && Date.now() < audioDeadline) await wait(50);
      assert.equal(
        win.webContents.isCurrentlyAudible(),
        true,
        'audition should produce an audio signal',
      );
      // This tests Electron shortcut delivery, not OS key injection.
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F8' });
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'F8' });
      await until('document.getElementById("message").textContent', /已停止/);
      const quietDeadline = Date.now() + 2500;
      while (win.webContents.isCurrentlyAudible() && Date.now() < quietDeadline) await wait(50);
      assert.equal(win.webContents.isCurrentlyAudible(), false, 'stop must silence audio');
      await click('#play');
      await until('document.getElementById("message").textContent', /有声试听中/);
      win.webContents.sendInputEvent({
        type: 'keyDown',
        keyCode: 'S',
        modifiers: ['control', 'shift'],
      });
      win.webContents.sendInputEvent({
        type: 'keyUp',
        keyCode: 'S',
        modifiers: ['control', 'shift'],
      });
      await until('document.getElementById("message").textContent', /已停止/);
      await until('document.getElementById("play").disabled', /false/);
      await value('#score', '1');
      await until('document.getElementById("play").disabled', /false/);
      await click('#play-order');
      await click('#play-order');
      assert.match(
        await js('document.getElementById("play-order").getAttribute("aria-label")'),
        /单曲循环/,
      );
      await click('#play');
      await until('document.getElementById("play").dataset.state', /playing/);
      await click('#play');
      await until('document.getElementById("play").dataset.state', /stopped/);
      await wait(450);
      assert.equal(await js('document.getElementById("play").dataset.state'), 'stopped');
      await click('#play-order');
      await click('#play-order');
      await value('#score', '8');
      await until('document.getElementById("message").textContent', /无法识别/);
      assert.equal(await js('document.getElementById("play").disabled'), true);
      await click('[aria-label="打开使用指南"]');
      await until('document.querySelector("dialog")?.open', /true/);
      await click('dialog [aria-label="关闭"]');
      await until('document.querySelector("dialog") === null', /true/);
      await js(
        'Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("音高与输入校准")).click()',
      );
      await until('document.getElementById("base")?.value', /^60$/);
      await js(
        'Array.from(document.querySelectorAll("dialog button")).find(b=>b.textContent.includes("载入音域校准曲")).click()',
      );
      await until('document.querySelector(".performance h2").textContent', /音域校准/);
      const midi = new Midi();
      midi
        .addTrack()
        .addNote({ midi: 60, time: 29.54, duration: 0.5 })
        .addNote({ midi: 62, time: 30.04, duration: 0.5 });
      tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'melodica-react-test-'));
      const file = path.join(tmp, 'test.mid');
      await fs.writeFile(file, Buffer.from(midi.toArray()));
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
      await click('#import');
      await until('document.getElementById("stats").textContent', /2 音符/);
      await until('document.getElementById("filename")?.textContent', /test.mid/);
      assert.equal(await js('document.getElementById("trim-midi-start").checked'), true);
      assert.ok(await js('document.getElementById("progress").max < 2000'));
      await click('#play');
      await until('document.getElementById("message").textContent', /演奏完成/, 7000);
      assert.equal(
        await js(
          'document.getElementById("progress").value===document.getElementById("progress").max',
        ),
        true,
      );
      await click('#scoreTab');
      await until('document.querySelector(".song-item.chosen").textContent', /test/);
      await until('document.getElementById("score-panel")?.textContent', /当前曲目是 MIDI/);
      await click('#midiTab');
      await until('document.getElementById("filename")?.textContent', /test.mid/);
      await until('document.getElementById("stats").textContent', /2 音符/);
      await wait(300); // Wait for the title's exit/enter transition before editing it.
      await click('.performance [aria-label^="修改曲名"]');
      await value('[aria-label="曲目名称"]', '保存后的 MIDI');
      await js(
        'document.querySelector("[aria-label=曲目名称]").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))',
      );
      await until('document.querySelector(".song-item.chosen").textContent', /保存后的 MIDI/);
      await js(
        'document.querySelector(".song-item.chosen [data-reorder]").dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowUp",altKey:true,bubbles:true}))',
      );
      const savedOrder = await js(
        'Array.from(document.querySelectorAll(".song-item")).map(e=>e.dataset.songId)',
      );
      await until('!!document.querySelector("[aria-label=曲库已保存]")', /true/);
      const stored = await js('window.melodica.readLibrary()');
      assert.equal(stored.ok, true);
      assert.equal(
        stored.value.items.find((i) => i.title === '保存后的 MIDI').midi.data.tracks[0].notes
          .length,
        2,
      );
      await fs.unlink(file);
      win.webContents.reload();
      await until('document.querySelector(".song-item.chosen")?.textContent', /保存后的 MIDI/);
      await until('document.getElementById("stats").textContent', /2 音符/);
      assert.deepEqual(
        await js('Array.from(document.querySelectorAll(".song-item")).map(e=>e.dataset.songId)'),
        savedOrder,
      );
      if (process.platform !== 'win32') {
        await click('#input-mode');
        assert.equal(await js('document.getElementById("play").disabled'), true);
        await click('#audition');
        assert.equal(await js('document.getElementById("play").disabled'), false);
        const r = await js('window.melodica.play({mode:"score",text:"1",settings:{},dry:false})');
        assert.equal(r.ok, false);
      }
      win.setSize(980, 720);
      await wait(250);
      assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'), true);
      assert.equal(
        await js('document.getElementById("play").getBoundingClientRect().bottom<=innerHeight'),
        true,
      );
      const { BrowserWindow } = require('electron');
      await click('#input-test');
      let receiver;
      for (let attempt = 0; attempt < 60; attempt++) {
        receiver = BrowserWindow.getAllWindows().find((w) => w !== win);
        if (
          receiver &&
          (await receiver.webContents
            .executeJavaScript('!!document.getElementById("input-pad")')
            .catch(() => false))
        )
          break;
        await wait(50);
      }
      assert.ok(receiver);
      const receive = (code) => receiver.webContents.executeJavaScript(code);
      assert.equal(await receive('!!document.getElementById("input-pad")'), true);
      const denied = await receive(
        `window.melodica.compile({mode:'score',text:'1'}).then(() => false, () => true)`,
      );
      assert.equal(denied, true, 'receiver cannot invoke unrestricted main-window IPC');
      if (!['win32', 'darwin'].includes(process.platform)) {
        const result = await receive('window.melodica.startInputTest()');
        assert.equal(result.ok, false);
        assert.match(result.error, /Windows/);
      }
      await receive(
        `document.getElementById('input-pad').focus(); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', key: 'z', bubbles: true }));`,
      );
      await wait(100);
      assert.match(
        await receive('document.getElementById("probe-events").textContent'),
        /脚本事件/,
      );
      if (process.env.MELODICA_PROBE_SCREENSHOT)
        await fs.writeFile(
          process.env.MELODICA_PROBE_SCREENSHOT,
          (await receiver.webContents.capturePage()).toPNG(),
        );
      // Exercise the browser adapter without preload; these are UI tests, not OS injection.
      const browser = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          backgroundThrottling: false,
        },
      });
      await browser.loadFile(path.join(__dirname, '../../build/renderer/index.html'));
      const browserJs = (code) => browser.webContents.executeJavaScript(code, true);
      async function browserUntil(code, regex) {
        for (let i = 0; i < 80; i++) {
          if (regex.test(String(await browserJs(code)))) return;
          await wait(60);
        }
        throw Error(`Browser adapter timeout: ${code}`);
      }
      await browserUntil('document.getElementById("stats")?.textContent', /42 音符/);
      assert.equal(await browserJs('!!window.melodica'), false);
      await browserJs(
        'document.getElementById("audition").click(); document.getElementById("play").click()',
      );
      await browserUntil('document.getElementById("message").textContent', /有声试听中/);
      await browserJs(
        `window.dispatchEvent(new KeyboardEvent('keydown', {key:'F8', code:'F8', bubbles:true}))`,
      );
      await browserUntil('document.getElementById("message").textContent', /已停止/);
      assert.equal(await browserJs('document.getElementById("play").disabled'), false);
      browser.destroy();
      receiver.close();
      assert.deepEqual(errors, []);
      console.log(
        'PASS React/Electron: preview, controlled editor, countdown, simulation, stop, validation, help, calibration, MIDI import/completion, platform guard, compact layout, audio signal and silence, F8/fallback/preparation cancellation, receiver IPC isolation, no console errors',
      );
      await fs.rm(tmp, { recursive: true, force: true });
      app.quit();
    } catch (e) {
      console.error(e);
      if (errors.length) console.error(errors);
      if (tmp) await fs.rm(tmp, { recursive: true, force: true });
      app.exit(1);
    }
  });
});
setTimeout(() => {
  console.error('Electron smoke timed out');
  app.exit(1);
}, 75000).unref();
