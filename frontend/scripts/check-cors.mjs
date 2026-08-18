// Temporary diagnostic: load the real app in headless Chrome, then issue the
// same fetch the Login page makes, and report what the browser sees
// (CORS failures surface as TypeError: Failed to fetch with no response).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME =
  process.env.CHROME_BIN ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Hard global timeout so this diagnostic can never hang a CI shell.
setTimeout(() => {
  console.error('TIMEOUT: diagnostic exceeded 45s');
  process.exit(1);
}, 45000).unref();

const userDataDir = mkdtempSync(join(tmpdir(), 'dc-chrome-'));
const port = 9223;

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('Launching headless Chrome…');
  // Wait for the debugging endpoint.
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      targets = await res.json();
      break;
    } catch {
      await sleep(250);
    }
  }
  if (!targets) throw new Error('Chrome did not start');  console.log('Chrome started, grabbing tab…');
  // Grab whatever tab Chrome already has (it was launched with about:blank).
  let list = [];
  for (let i = 0; i < 20; i++) {
    list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    if (list.some((t) => t.type === 'page')) break;
    await sleep(250);
  }
  const tab = list.find((t) => t.type === 'page');
  if (!tab) throw new Error('No page target found');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let id = 0;
  const pending = new Map();
  // Listen for console + network failures.
  const consoleErrors = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push('EXCEPTION: ' + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text));
    }
    if (msg.method === 'Network.loadingFailed') {
      consoleErrors.push(`NETWORK FAILED: ${msg.params.errorText} (${msg.params.type})`);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      const timer = setTimeout(() => {
        pending.delete(msgId);
        reject(new Error(`CDP ${method} timed out`));
      }, 10000);
      pending.set(msgId, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');

  // Navigate to the app and wait for it to boot.
  console.log('Navigating to http://localhost:3000…');
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(4000);
  console.log('Evaluating page state…');

  // Report the page origin and whether the app shell rendered.
  const origin = await send('Runtime.evaluate', {
    expression: 'location.origin',
    returnByValue: true,
  });
  const hasForm = await send('Runtime.evaluate', {
    expression: "!!document.querySelector('form')",
    returnByValue: true,
  });
  console.log('PAGE ORIGIN:', origin.result?.result?.value);
  console.log('LOGIN FORM RENDERED:', hasForm.result?.result?.value);

  // Reproduce the exact fetch the Login page performs (same method, headers,
  // and JSON body) from inside the app's origin.
  const result = await send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        const res = await fetch('http://localhost:8080/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@domesticconnects.com', password: 'wrong-password' }),
        });
        const text = await res.text();
        return { ok: true, status: res.status, corsHeaders: {
          'access-control-allow-origin': res.headers.get('access-control-allow-origin'),
        }, body: text.slice(0, 300) };
      } catch (err) {
        return { ok: false, error: String(err), name: err.name };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('FETCH RESULT:', JSON.stringify(result.result?.result?.value, null, 2));

  if (consoleErrors.length) {
    console.log('\nCONSOLE / NETWORK ERRORS:');
    for (const e of [...new Set(consoleErrors)]) console.log(' -', e);
  }

  ws.close();
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => {
    chrome.kill();
    rmSync(userDataDir, { recursive: true, force: true });
  });
