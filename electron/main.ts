import path from 'node:path';
import {
  app,
  BrowserWindow,
  ipcMain,
  utilityProcess,
  type UtilityProcess,
} from 'electron';
import { installMenu } from './menu.js';

// Spec-pinned config dir: ~/Library/Application Support/japanese-learning-app
app.setPath('userData', path.join(app.getPath('appData'), 'japanese-learning-app'));

const ROOT = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
const SERVER_PATH = path.join(__dirname, 'server.cjs');
const READY_TIMEOUT_MS = 20_000;

let win: BrowserWindow | null = null;
let child: UtilityProcess | null = null;
let quitting = false;
let restartedOnce = false;
let stderrTail: string[] = [];

function serverEnv(): Record<string, string> {
  return {
    ...process.env,
    APP_DATA_DIR: app.getPath('userData'),
    GRAMMAR_FALLBACK_PATH: path.join(ROOT, 'grammar-data'),
    WEB_DIST: path.join(ROOT, 'web/dist'),
  } as Record<string, string>;
}

function startServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    stderrTail = [];
    child = utilityProcess.fork(SERVER_PATH, [], { stdio: 'pipe', env: serverEnv() });
    child.stderr?.on('data', (d: Buffer) => {
      stderrTail = [...stderrTail, d.toString()].slice(-30);
      process.stderr.write(d);
    });
    child.stdout?.on('data', (d: Buffer) => process.stdout.write(d));

    const timer = setTimeout(
      () => reject(new Error(`server not ready after ${READY_TIMEOUT_MS / 1000}s\n${stderrTail.join('')}`)),
      READY_TIMEOUT_MS,
    );
    child.on('message', (msg: { type?: string; port?: number }) => {
      if (msg?.type === 'ready' && typeof msg.port === 'number') {
        clearTimeout(timer);
        resolve(msg.port);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (quitting) return;
      if (!restartedOnce) {
        restartedOnce = true;
        console.warn(`[shell] server exited (${code}) — restarting once`);
        boot();
      } else {
        showDiagnostic(`server exited with code ${code}\n${stderrTail.join('')}`);
      }
    });
  });
}

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 680,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
    },
  });
  // Red button hides (Claude Desktop pattern); App menu Quit really quits.
  w.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      w.hide();
    }
  });
  return w;
}

function showDiagnostic(message: string): void {
  win ??= createWindow();
  // diag.html is copied into dist-electron by build:shell, next to main.cjs
  void win.loadFile(path.join(__dirname, 'diag.html'), {
    query: { err: message.slice(0, 4000) },
  });
  win.show();
}

async function boot(): Promise<void> {
  try {
    const port = await startServer();
    win ??= createWindow();
    await win.loadURL(`http://127.0.0.1:${port}`);
    win.show();
  } catch (err) {
    showDiagnostic(String(err instanceof Error ? err.message : err));
  }
}

ipcMain.on('diag-retry', () => {
  restartedOnce = false;
  child?.kill();
  child = null;
  void boot();
});

app.on('before-quit', () => {
  quitting = true;
  child?.kill();
});

app.on('activate', () => {
  win?.show();
});

app.on('window-all-closed', () => {
  /* keep running — lifecycle is hide, not quit */
});

void app.whenReady().then(() => {
  installMenu(() => win);
  return boot();
});
