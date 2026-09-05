import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isDev = !app.isPackaged;

function createWindow(): BrowserWindow {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icons/icon.png')
    : path.join(__dirname, '../build/icons/icon.png');

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: true,
    fullscreenable: false,
    frame: false,
    title: 'Watch List',
    show: false,
    backgroundColor: '#ffffff',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      allowRunningInsecureContent: false,
    },
  });

  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  const entryFile = path.normalize(path.join(__dirname, '../dist/watch-list/browser/index.html'));
  const entryDir = path.dirname(entryFile);

  const isAllowedNavigation = (url: string): boolean => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.username !== '' || parsed.password !== '') return false;
    if (isDev) {
      return (
        parsed.protocol === 'http:' && parsed.hostname === 'localhost' && parsed.port === '4200'
      );
    }
    if (parsed.protocol !== 'file:' || parsed.host !== '') return false;
    let filePath: string;
    try {
      const fileUrl = new URL(url);
      fileUrl.hash = '';
      fileUrl.search = '';
      filePath = path.normalize(fileURLToPath(fileUrl));
    } catch {
      return false;
    }
    if (filePath === entryFile) return true;
    const relative = path.relative(entryDir, filePath);
    return (
      relative !== '' &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    );
  };

  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault();
  });
  win.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault();
  });

  if (isDev) {
    win.loadURL('http://localhost:4200');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(entryFile);
  }

  win.once('ready-to-show', () => win.show());

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
