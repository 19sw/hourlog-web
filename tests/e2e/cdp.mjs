// Minimal Chrome DevTools Protocol helper (no dependencies; needs Node 22+ for
// the global WebSocket). Launches a local static server and headless Chrome.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Serve `webDir` at http://127.0.0.1:<port>/hourlog-web/ (the GitHub Pages subpath) and start headless Chrome. */
export async function launch({ webDir, chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hourlog-e2e-'));
  const site = path.join(tmp, 'site');
  fs.mkdirSync(site);
  fs.symlinkSync(webDir, path.join(site, 'hourlog-web'));
  const httpPort = await freePort();
  const cdpPort = await freePort();
  const server = spawn('python3', ['-m', 'http.server', String(httpPort), '--bind', '127.0.0.1'], { cwd: site, stdio: 'ignore' });
  const browser = spawn(chrome, ['--headless=new', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${path.join(tmp, 'profile')}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try { await fetch(`http://127.0.0.1:${cdpPort}/json/version`); await fetch(`http://127.0.0.1:${httpPort}/hourlog-web/`); break; } catch { await sleep(150); }
  }
  return {
    base: `http://127.0.0.1:${httpPort}/hourlog-web/`,
    origin: `http://127.0.0.1:${httpPort}`,
    cdpPort, tmp,
    stop() { browser.kill(); server.kill(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ } },
  };
}

/** Open a new tab and return a small page API. */
export async function openPage(cdpPort, { lang = 'zh-CN' } = {}) {
  const tgt = await (await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    else if (m.method) listeners.forEach((f) => f(m));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const requests = [];
  const consoleMsgs = [];
  listeners.push((m) => {
    if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type !== 'log') consoleMsgs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    if (m.method === 'Runtime.exceptionThrown') consoleMsgs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  // navigator.language(s) follow acceptLanguage; headless ignores --lang.
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', acceptLanguage: lang });
  const loadEvent = () => new Promise((r) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(f), 1); r(); } }; listeners.push(f); });
  const page = {
    send, requests, consoleMsgs,
    wait: sleep,
    async size(w, h) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true }); },
    async dark(on) { await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: on ? 'dark' : 'light' }] }); },
    async goto(url) { const d = loadEvent(); await send('Page.navigate', { url }); await d; await sleep(400); },
    async reload() { const d = loadEvent(); await send('Page.reload'); await d; await sleep(400); },
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, userGesture: true });
      if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) + '\n' + expr.slice(0, 300));
      return r.result.value;
    },
    /** Screenshot; tall=true expands the viewport to the scroll height of <main>. */
    async shot(file, tall = false) {
      const { cssLayoutViewport } = await send('Page.getLayoutMetrics');
      const w = cssLayoutViewport.clientWidth, h0 = cssLayoutViewport.clientHeight;
      if (tall) {
        const h = await page.eval(`const m=document.querySelector('main'); return Math.ceil(m.scrollHeight + document.querySelector('.topbar').offsetHeight + document.querySelector('.tabs').offsetHeight + 10);`);
        await page.size(w, Math.min(h, 6000)); await sleep(250);
      }
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      if (tall) { await page.size(w, h0); await sleep(150); }
    },
    close() { ws.close(); },
  };
  return page;
}
