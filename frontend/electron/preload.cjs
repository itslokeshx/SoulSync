const { contextBridge } = require("electron");

// Expose a minimal, safe API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
    isElectron: true,
    platform: process.platform, // 'linux', 'darwin', 'win32'
});
