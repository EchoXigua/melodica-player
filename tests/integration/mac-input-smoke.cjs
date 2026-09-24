// Explicit native-input test. Sends events ONLY while our receiver is foreground.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
if (process.platform !== 'darwin') throw Error('Run this test on macOS');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'melodica-mac-test-'));
app.setAppPath(path.resolve(__dirname, '../..'));
app.setPath('userData', path.join(temp, 'profile'));
require('../../src/main/index.cjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let primarySeen = false;
app.on('browser-window-created', (_event, main) => {
  if (primarySeen) return;
  primarySeen = true;
  main.webContents.once('did-finish-load', async () => {
    let receiver;
    try {
      const run = (code) => receiver.webContents.executeJavaScript(code);
      const until = async (code, pattern, duration = 15000) => {
        const deadline = Date.now() + duration;
        while (Date.now() < deadline) {
          const value = await run(code);
          if (pattern.test(String(value))) return value;
          await wait(50);
        }
        throw Error(`Timeout: ${code}: ${await run(code)}`);
      };
      const info = await main.webContents.executeJavaScript('window.melodica.info()');
      assert.equal(info.value.input.ready, true);
      if (!info.value.input.granted) throw Error('辅助功能未授权；此测试没有改变系统权限');
      await main.webContents.executeJavaScript('window.melodica.openInputTest()');
      receiver = BrowserWindow.getAllWindows().find((w) => w !== main);
      await until('!!document.getElementById("input-pad")', /true/);
      // Move only into our test receiver, not arbitrary user applications.
      const cursorSource = path.join(temp, 'cursor.swift');
      const cursor = path.join(temp, 'cursor');
      fs.writeFileSync(
        cursorSource,
        'import CoreGraphics\nlet a = CommandLine.arguments\nCGWarpMouseCursorPosition(CGPoint(x: Double(a[1])!, y: Double(a[2])!))\n',
      );
      execFileSync('xcrun', ['swiftc', cursorSource, '-o', cursor]);
      const focus = async () => {
        app.focus({ steal: true });
        receiver.show();
        receiver.focus();
        await wait(300);
        const rect = await run(
          '(()=>{const r=document.getElementById("input-pad").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()',
        );
        const bounds = receiver.getContentBounds();
        execFileSync(cursor, [String(bounds.x + rect.x), String(bounds.y + rect.y)]);
        await run('document.getElementById("input-pad").focus()');
      };
      await focus();
      await run(
        `window.__mouse=[];window.addEventListener('mousedown', e=>window.__mouse.push({x:e.clientX,y:e.clientY,target:e.target.id}), true)`,
      );
      await run('document.getElementById("input-pad").click()');
      const completed = await until(
        'document.getElementById("probe-result")?.textContent',
        /PASS|FAIL|STOPPED/,
        22000,
      );
      if (!completed.startsWith('PASS'))
        console.log(await run('document.getElementById("probe-events").textContent'));
      if (!completed.startsWith('PASS'))
        console.log(
          'mouse debug',
          await run(
            'JSON.stringify({events:window.__mouse,rect:document.getElementById("input-pad").getBoundingClientRect()})',
          ),
        );
      assert.match(completed, /^PASS/);
      assert.match(completed, /非可信 0/);
      assert.match(completed, /未释放：无/);
      console.log('PASS macOS CGEvent full key/mouse sequence:', completed);
      await run('document.getElementById("probe-reset").click()');
      await focus();
      await run('document.getElementById("input-pad").click()');
      await until('document.getElementById("probe-events").textContent', /按下/);
      await run('window.melodica.stop()');
      const stopped = await until(
        'document.getElementById("probe-result")?.textContent',
        /STOPPED/,
      );
      assert.match(stopped, /未释放：无/);
      console.log('PASS macOS mid-note stop releases input:', stopped);
      await run('document.getElementById("probe-reset").click()');
      await focus();
      await run('document.getElementById("input-pad").click()');
      await run('window.melodica.stop()');
      const countdown = await until(
        'document.getElementById("probe-result")?.textContent',
        /STOPPED/,
      );
      assert.match(countdown, /可信接收 0/);
      console.log('PASS macOS countdown cancellation sends no input');
      receiver.close();
      main.close();
      fs.rmSync(temp, { recursive: true, force: true });
      app.quit();
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});
setTimeout(() => {
  console.error('macOS native test timed out');
  app.exit(1);
}, 65000).unref();
