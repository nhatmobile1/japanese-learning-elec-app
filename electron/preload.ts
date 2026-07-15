import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  onMenuAction: (cb: (id: string) => void) => {
    ipcRenderer.on('menu-action', (_e, id: string) => cb(id));
  },
  retry: () => ipcRenderer.send('diag-retry'),
});
