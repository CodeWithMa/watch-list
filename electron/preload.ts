import { contextBridge } from 'electron';

// Expose a minimal, secure API surface. Extend here when IPC is needed.
// Keeping contextIsolation + sandbox enabled (see main.ts).
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
