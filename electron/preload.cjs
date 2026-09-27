// WriteMate AI — Electron preload script (Phase C).
//
// Runs in an isolated context (contextIsolation: true, sandbox: true — see
// electron/main.js) before the page's own scripts. Its only job is to
// expose exactly two narrow, safe functions to the page via
// contextBridge — opening the bundled browser-extension folder in the
// system file manager, and reading its path to display it — nothing else
// from Node/Electron is exposed. The page still has zero direct Node
// integration; this is the same security posture Phase A described,
// extended by exactly one deliberate, minimal capability.
//
// CommonJS on purpose (.cjs extension): Electron loads preload scripts
// through Node's module system, and a .cjs file is always treated as
// CommonJS regardless of this project's package.json "type": "module" —
// which matters here since contextBridge/ipcRenderer are most reliably
// used with require(), not import, in a preload context.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('writemate', {
  isElectron: true,
  getExtensionFolderPath: () => ipcRenderer.invoke('get-extension-folder-path'),
  openExtensionFolder: () => ipcRenderer.invoke('open-extension-folder'),
});
