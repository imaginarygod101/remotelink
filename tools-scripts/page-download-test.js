// Drives headless Chrome over CDP: opens the public download page, clicks "Download" for given files, waits for the in-page SHA-256 check, reports status text and saved files.
const WS = require('ws'); const [, , page, dir, ...names] = process.argv;
(async () => {
  const v = await (await fetch('http://127.0.0.1:9444/json/version')).json(); const w = new WS(v.webSocketDebuggerUrl); await new Promise(r => w.on('open', r));
  let id = 0; const call = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; w.on('message', function h(d) { const m = JSON.parse(d); if (m.id === i) { w.off('message', h); r(m.result || m.error); } }); w.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' }); const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  await call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
  await call('Page.navigate', { url: page }, sessionId); await new Promise(r => setTimeout(r, 4000));
  const ev = async e => (await call('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId)).result.value;
  console.log('signaling shown on page:', await ev("document.getElementById('sig').textContent"));
  for (const n of names) { const t0 = Date.now(); await ev(`document.querySelector('button[data-f="${n}"]').click()`);
    let s; for (;;) { s = await ev(`document.querySelector('button[data-f="${n}"]').parentElement.querySelector('.pr').textContent`); if (/Saved|Failed/.test(s)) break; await new Promise(r => setTimeout(r, 500)); }
    console.log(n, '=>', s, `(${((Date.now() - t0) / 1000).toFixed(1)} s)`); }
  await new Promise(r => setTimeout(r, 3000)); process.exit();
})();
