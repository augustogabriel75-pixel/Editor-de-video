/**
 * MotionCut para Windows/PC (Electron).
 *
 * - Serve o editor (pasta www/) pelo protocolo app://motioncut, uma origem fixa: os projetos salvos
 *   (IndexedDB) continuam lá entre uma abertura e outra.
 * - Traz o FFmpeg junto: vídeos que o Chromium não decodifica (HEVC/H.265 do iPhone, ProRes…)
 *   são convertidos para H.264 + AAC na importação. Vídeos HDR (HLG/Dolby Vision/HDR10) têm as
 *   cores convertidas para SDR (tonemapping).
 */
const { app, BrowserWindow, protocol, net, ipcMain, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SCHEME = 'app';
const HOST = 'motioncut';
const WWW = path.join(__dirname, 'www');
const TMP = path.join(os.tmpdir(), 'MotionCut');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, codeCache: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

/** FFmpeg: embutido no instalador (resources/ffmpeg), MOTIONCUT_FFMPEG ou o do PATH. */
function ffmpegPath() {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const candidates = [process.env.MOTIONCUT_FFMPEG, path.join(process.resourcesPath || '', 'ffmpeg', exe), path.join(__dirname, 'ffmpeg', exe)].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || exe;
}

function serveFile(file) {
  return net.fetch(pathToFileURL(file).toString());
}

function registerProtocol() {
  protocol.handle(SCHEME, (req) => {
    const url = new URL(req.url);
    let p = decodeURIComponent(url.pathname);
    // vídeos convertidos (pasta temporária)
    if (p.startsWith('/__converted/')) {
      const file = path.join(TMP, path.basename(p));
      return fs.existsSync(file) ? serveFile(file) : new Response('não encontrado', { status: 404 });
    }
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(WWW, p));
    if (!file.startsWith(WWW) || !fs.existsSync(file)) return new Response('não encontrado', { status: 404 });
    return serveFile(file);
  });
}

/* ------------------------------------------------------------------ FFmpeg */

function run(args, onLine) {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath(), args, { windowsHide: true });
    let err = '';
    child.stderr.on('data', (d) => (err += d.toString()));
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      lines.forEach((l) => onLine?.(l));
    });
    child.on('error', (e) => resolve({ code: -1, err: String(e.message || e) }));
    child.on('close', (code) => resolve({ code, err }));
  });
}

async function probe(input) {
  const { err } = await run(['-hide_banner', '-i', input]);
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(err);
  const duration = m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
  const videoLine = (err.match(/Stream #.*Video:.*$/m) || [''])[0];
  const hdr = /arib-std-b67|smpte2084|bt2020/i.test(videoLine) || /DOVI configuration/i.test(err);
  return { duration, hdr, hasAudio: /Stream #.*Audio:/.test(err), videoLine: videoLine.trim(), ok: /Stream #.*Video:/.test(err) };
}

const TONEMAP = 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p';

async function convert(event, { inputPath }) {
  if (!inputPath || !fs.existsSync(inputPath)) return { ok: false, error: 'Arquivo não encontrado' };
  fs.mkdirSync(TMP, { recursive: true });
  const info = await probe(inputPath);
  if (!info.ok) return { ok: false, error: 'O FFmpeg não encontrou vídeo neste arquivo' };
  const name = `${path.basename(inputPath).replace(/\.[^.]+$/, '').replace(/[^\w\- ]+/g, '_')}-${Date.now()}.mp4`;
  const out = path.join(TMP, name);
  const attempt = async (tonemap) => {
    const args = [
      '-hide_banner', '-y', '-i', inputPath,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
      ...(tonemap ? ['-vf', TONEMAP] : []),
      '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
      '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', out,
    ];
    return run(args, (line) => {
      const m = /^out_time_(?:us|ms)=(\d+)/.exec(line);
      if (m && info.duration) event.sender.send('motioncut:convert-progress', { inputPath, progress: Math.min(1, +m[1] / 1e6 / info.duration) });
    });
  };
  let r = await attempt(info.hdr);
  if (r.code !== 0 && info.hdr) r = await attempt(false); // FFmpeg sem zscale: converte sem tonemapping
  if (r.code !== 0) return { ok: false, error: r.err.split('\n').slice(-4).join(' ').trim() || `FFmpeg saiu com código ${r.code}` };
  return { ok: true, url: `${SCHEME}://${HOST}/__converted/${encodeURIComponent(name)}`, name, hdr: info.hdr, size: fs.statSync(out).size };
}

/* ------------------------------------------------------------------ janela */

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#07080b',
    title: 'MotionCut',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false, spellcheck: false },
  });
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
  // links externos abrem no navegador padrão
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`${SCHEME}://`)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`${SCHEME}://`)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  win.loadURL(`${SCHEME}://${HOST}/index.html`);
  return win;
}

app.on('second-instance', () => {
  const [w] = BrowserWindow.getAllWindows();
  if (w) {
    if (w.isMinimized()) w.restore();
    w.focus();
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerProtocol();
  ipcMain.handle('motioncut:info', async () => {
    const r = await run(['-hide_banner', '-version']);
    return { version: app.getVersion(), ffmpeg: r.code === 0 || /ffmpeg version/.test(r.err), platform: process.platform };
  });
  ipcMain.handle('motioncut:convert', convert);
  createWindow();
});

app.on('window-all-closed', () => {
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  app.quit();
});
