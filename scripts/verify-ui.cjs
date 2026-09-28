/*
 * Drives the built HMI in a real browser, twice: once as the browser
 * prototype and once as the Android launcher, by serving `dist/` on the
 * launcher's own origin and injecting a fake native host.
 *
 * That second pass is the useful one. `isAndroid` is decided by origin,
 * so serving the same bundle from https://appassets.androidplatform.net
 * exercises the exact code path the head unit will run — including the
 * bridge protocol — without an APK or a device.
 *
 * Usage: npm run build && node scripts/verify-ui.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const DIST = path.resolve(__dirname, '../dist');
const NATIVE_ORIGIN = 'https://appassets.androidplatform.net';
const PANEL = { width: 2400, height: 900 };
const OUT = process.env.UI_ARTIFACTS || '/tmp/mustang-ui';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/** Serves dist/ so the prototype pass runs over real HTTP, as it ships. */
function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const rel = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.join(DIST, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/*
 * Stands in for MainActivity + NativeBridge. Same wire format: replies
 * carry the request id, and media arrives as an unsolicited push.
 */
const NATIVE_HOST = ({ mediaLive, lastApp }) => {
  window.__calls = [];
  if (lastApp) {
    localStorage.setItem('mustang.launcher', JSON.stringify({ lastApp }));
  }
  const reply = (message) => setTimeout(() => {
    if (window.MustangHost.onmessage) window.MustangHost.onmessage({ data: JSON.stringify(message) });
  }, 0);

  window.MustangHost = {
    onmessage: null,
    postMessage(raw) {
      const request = JSON.parse(raw);
      window.__calls.push(request);

      if (request.method === 'subscribe') {
        reply({ id: request.id, ok: true, data: true });
        reply({
          event: 'system',
          data: { network: true, gpsEnabled: false, bluetooth: 'off', timeMs: Date.now(), sdk: 30 },
        });
        reply({
          event: 'apps',
          data: [
            { id: 'maps', available: true, label: 'Maps' },
            { id: 'waze', available: false },
            { id: 'spotify', available: true, label: 'Spotify' },
            { id: 'youtube', available: false },
            { id: 'carplay', available: false },
            { id: 'settings', available: true },
            { id: 'bluetooth', available: true },
            { id: 'mediaAccess', available: true },
            { id: 'homeSettings', available: true },
            { id: 'phone', available: true },
          ],
        });
        reply({
          event: 'catalog',
          data: {
            apps: [
              { packageName: 'com.waze', label: 'Waze', icon: '' },
              { packageName: 'com.spotify.music', label: 'Spotify', icon: '' },
              { packageName: 'com.google.android.youtube', label: 'YouTube', icon: '' },
              { packageName: 'com.zhiliaoapp.musically', label: 'TikTok', icon: '' },
              { packageName: 'com.example.files', label: 'Files', icon: '' },
            ],
          },
        });
        if (mediaLive) {
          reply({
            event: 'media',
            data: {
              status: 'live', app: 'com.spotify.music', appLabel: 'Spotify',
              title: 'Verified live track', artist: 'Verified artist', album: 'Verified album',
              playing: false, durationSec: 210, positionSec: 30,
            },
          });
        } else {
          reply({ event: 'media', data: { status: 'unavailable' } });
        }
        return;
      }
      if (request.method === 'systemReport') {
        reply({ id: request.id, ok: true, data: true });
        reply({
          event: 'systemReport',
          data: {
            findings: {
              panel: '2400x900 px, densityDpi 240, 1600x600 dp',
              android: '12 (SDK 32)',
              webview: '120.0.6099.230',
              temperatureSensors: [],
              vendorPackages: ['com.syu.ms', 'com.syu.canbus'],
              vehicleHints: ['property persist.syu.outtemp = 34'],
            },
            packages: { count: 212 },
            sensors: [{}, {}],
            properties: { a: 1 },
            settings: { system: { a: 1 }, global: {}, secure: {} },
          },
        });
        return;
      }
      if (request.method === 'saveReport') {
        reply({ id: request.id, ok: true, data: { path: 'Download/mustang-report-test.json' } });
        return;
      }
      reply({ id: request.id, ok: true, data: true });
    },
  };
};

async function openNative(browser, { mediaLive, lastApp = null }) {
  const page = await browser.newPage({ viewport: PANEL });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.route(`${NATIVE_ORIGIN}/**`, async (route) => {
    const rel = new URL(route.request().url()).pathname;
    const file = path.join(DIST, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      path: file,
      contentType: TYPES[path.extname(file)] || 'application/octet-stream',
    });
  });

  await page.addInitScript(NATIVE_HOST, { mediaLive, lastApp });
  await page.goto(`${NATIVE_ORIGIN}/index.html`);
  await page.waitForSelector('.shell');
  // Let the approved startup sequence finish before asserting on Home.
  await page.waitForTimeout(6000);
  return { page, errors };
}

const checks = [];
const check = (name, fn) => checks.push([name, fn]);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  assert.ok(fs.existsSync(path.join(DIST, 'index.html')), 'run `npm run build` first');

  const { server, port } = await serve();
  // CHROMIUM_PATH lets a machine whose Chromium build does not match the
  // installed Playwright (a pre-provisioned CI image, for instance) point
  // at the browser it actually has instead of downloading another.
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    // The panel is composed at 1 device pixel per CSS pixel; scaling the
    // test viewport would measure something the head unit never renders.
    args: ['--no-sandbox', '--force-device-scale-factor=1'],
  });

  try {
    /* ---------- browser prototype ---------- */
    const web = await browser.newPage({ viewport: PANEL });
    const webErrors = [];
    web.on('pageerror', (e) => webErrors.push(e.message));
    await web.goto(`http://127.0.0.1:${port}/`);
    await web.waitForSelector('.shell');
    await web.waitForTimeout(6000);
    await web.screenshot({ path: path.join(OUT, 'prototype-home.png') });

    check('prototype Home is the player and four large app tiles', async () => {
      assert.equal(await web.locator('.rail__item').count(), 3);
      assert.equal(await web.locator('.player').count(), 1);
      assert.equal(await web.locator('.apptile--home').count(), 4);
      assert.equal(await web.locator('.bvb').count(), 0, 'no duplicate media bar on Home');
      const play = await web.locator('.player__btn--play').boundingBox();
      assert.ok(play.height >= 200, `play target is ${play.height}px of 900`);
      const rail = await web.locator('.rail__item').first().boundingBox();
      assert.ok(rail.height >= 200, `rail target is ${rail.height}px of 900`);
    });

    check('prototype raises no page errors', async () => {
      assert.deepEqual(webErrors, []);
    });

    /* ---------- head unit, live media ---------- */
    const live = await openNative(browser, { mediaLive: true });
    await live.page.screenshot({ path: path.join(OUT, 'native-home.png') });

    check('head unit keeps the approved 2400x900 composition', async () => {
      const box = await live.page.locator('.shell').boundingBox();
      assert.equal(Math.round(box.width), PANEL.width);
      assert.equal(Math.round(box.height), PANEL.height);
    });

    check('head unit shows no invented vehicle data', async () => {
      assert.equal(await live.page.locator('.statusbar__tempval').count(), 0,
        'outside temperature stays out until the unit reports it');
      assert.equal(await live.page.locator('.statusbar__gear.is-active').count(), 0,
        'no gear may be highlighted without a vehicle source');
    });

    check('head unit shows live media from the bridge, not demo tracks', async () => {
      const player = await live.page.locator('.player').innerText();
      assert.match(player, /Verified live track/);
      assert.match(player, /Spotify/);
    });

    check('power-on resumes the player through the bridge', async () => {
      const asked = await live.page.evaluate(() => window.__calls.some((c) => c.method === 'mediaResume'));
      assert.ok(asked);
    });

    check('transport press reaches the bridge as a real command', async () => {
      await live.page.locator('.player__btn--play').click();
      const call = await live.page.evaluate(() => window.__calls.find((c) => c.method === 'mediaControl'));
      assert.ok(call, 'mediaControl must reach the bridge');
      assert.equal(call.args.command, 'play');
    });

    check('Home tiles are the unit\'s own apps and open by package', async () => {
      const labels = await live.page.locator('.apptile--home .apptile__label').allInnerTexts();
      assert.deepEqual(labels.sort(), ['Spotify', 'TikTok', 'Waze', 'YouTube']);
      await live.page.locator('.apptile--home', { hasText: 'YouTube' }).click();
      const call = await live.page.evaluate(() => window.__calls.find((c) => c.method === 'launchPackage'));
      assert.equal(call.args.package, 'com.google.android.youtube');
    });

    check('the rail opens Waze itself', async () => {
      await live.page.locator('.rail__item', { hasText: 'Waze' }).click();
      const calls = await live.page.evaluate(() => window.__calls.filter((c) => c.method === 'launchPackage'));
      assert.equal(calls[calls.length - 1].args.package, 'com.waze');
    });

    check('Apps lists every launchable app and can hide one', async () => {
      await live.page.locator('.rail__item', { hasText: 'التطبيقات' }).click();
      await live.page.waitForTimeout(300);
      assert.equal(await live.page.locator('.apptile--grid').count(), 5);
      const files = live.page.locator('.apptile--grid', { hasText: 'Files' });
      const box = await files.boundingBox();
      await live.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await live.page.mouse.down();
      await live.page.waitForTimeout(800);
      await live.page.mouse.up();
      await live.page.getByRole('button', { name: /إخفاء من القائمة/ }).click();
      assert.equal(await live.page.locator('.apptile--grid').count(), 4);
      await live.page.screenshot({ path: path.join(OUT, 'native-apps.png') });
    });

    check('the system report collects, shows findings and saves', async () => {
      await live.page.locator('.apps__sys', { hasText: 'تقرير النظام' }).click();
      await live.page.waitForSelector('.report__facts');
      const text = await live.page.locator('.report').innerText();
      assert.match(text, /2400x900/);
      assert.match(text, /com\.syu\.canbus/);
      await live.page.screenshot({ path: path.join(OUT, 'native-report.png') });
      await live.page.getByRole('button', { name: /حفظ ومشاركة/ }).click();
      await live.page.waitForSelector('.report__saved');
      const call = await live.page.evaluate(() => window.__calls.find((c) => c.method === 'saveReport'));
      assert.equal(call.args.share, true);
      await live.page.getByRole('button', { name: 'إغلاق' }).click();
    });

    check('the Home intent returns the HMI to Home', async () => {
      await live.page.evaluate(() => window.dispatchEvent(new Event('mustang:home')));
      await live.page.waitForTimeout(300);
      assert.equal(await live.page.locator('.player').count(), 1);
    });

    check('head unit raises no page errors', async () => {
      assert.deepEqual(live.errors, []);
    });

    /* ---------- head unit, no media session, app left open ---------- */
    const none = await openNative(browser, { mediaLive: false, lastApp: 'com.waze' });
    await none.page.screenshot({ path: path.join(OUT, 'native-no-media.png') });

    check('the app open at power-off is reopened at power-on', async () => {
      const call = await none.page.evaluate(() => window.__calls.find((c) => c.method === 'launchPackage'));
      assert.ok(call, 'last app must be reopened');
      assert.equal(call.args.package, 'com.waze');
    });

    check('no media session is stated plainly, never as a demo track', async () => {
      const player = await none.page.locator('.player').innerText();
      assert.match(player, /اضغط تشغيل/);
      assert.doesNotMatch(player, /ليلة عمر/);
    });

    check('play with no session wakes the last player', async () => {
      await none.page.evaluate(() => { window.__calls.length = 0; });
      await none.page.locator('.player__btn--play').click();
      const asked = await none.page.evaluate(() => window.__calls.some((c) => c.method === 'mediaResume'));
      assert.ok(asked);
    });

    check('media access can be requested from settings', async () => {
      await none.page.locator('.rail__item', { hasText: 'التطبيقات' }).click();
      await none.page.locator('.apps__sys', { hasText: /^الإعدادات$/ }).click();
      await none.page.getByRole('button', { name: 'الاتصالات' }).click();
      await none.page.getByRole('button', { name: /الوصول للوسائط/ }).first().click();
      const asked = await none.page.evaluate(() => window.__calls.some(
        (c) => c.method === 'launch' && c.args.app === 'mediaAccess'));
      assert.ok(asked);
    });

    check('no-media head unit raises no page errors', async () => {
      assert.deepEqual(none.errors, []);
    });

    /* ---------- run ---------- */
    let failed = 0;
    for (const [name, fn] of checks) {
      try {
        await fn();
        console.log(`  PASS  ${name}`);
      } catch (error) {
        failed += 1;
        console.error(`  FAIL  ${name}\n        ${error.message}`);
      }
    }
    console.log(failed === 0
      ? `\n${checks.length} UI checks passed. Screenshots in ${OUT}`
      : `\n${failed} of ${checks.length} UI checks FAILED. Screenshots in ${OUT}`);
    process.exitCode = failed === 0 ? 0 : 1;
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
