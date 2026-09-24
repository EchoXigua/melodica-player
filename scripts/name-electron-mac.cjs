// Dev launches the stock Electron.app, so macOS shows "Electron" in the Dock.
// Packaged builds already use productName. This only renames the local dev bundle.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
if (process.platform !== 'darwin') process.exit(0);
const electron = require('electron');
const plist = path.join(path.dirname(electron), '..', 'Info.plist');
const name = 'Melodica Studio';
for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  execFileSync('plutil', ['-replace', key, '-string', name, plist], { stdio: 'ignore' });
}
