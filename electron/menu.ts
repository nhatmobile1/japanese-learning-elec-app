import { app, Menu, type BrowserWindow } from 'electron';

export function installMenu(getWin: () => BrowserWindow | null): void {
  const send = (id: string) => () => getWin()?.webContents.send('menu-action', id);
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'Cmd+,',
          click: send('toggle-settings'),
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' }, // full Edit roles: copy/paste/select-all — IME needs these
    {
      label: 'View',
      submenu: [
        { label: 'All', accelerator: 'Cmd+1', click: send('view:all') },
        { label: 'Vocab', accelerator: 'Cmd+2', click: send('view:vocab') },
        { label: 'Grammar', accelerator: 'Cmd+3', click: send('view:grammar') },
        { label: 'Sentences', accelerator: 'Cmd+4', click: send('view:sentence') },
        { type: 'separator' },
        { label: 'Focus Search', accelerator: 'Cmd+F', click: send('focus-search') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' }, // minimize, zoom, close(⌘W → our hide handler)
  ]);
  Menu.setApplicationMenu(menu);
}
