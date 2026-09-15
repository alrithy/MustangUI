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
const NATIVE_HOST = ({ mediaLive }) => {
  window.__calls = [];
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
      reply({ id: request.id, ok: true, data: true });
    },
  };
};

async function openNative(browser, { mediaLive }) {
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

  await page.addInitScript(NATIVE_HOST, { mediaLive });
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

    check('prototype shell, persistent map stage and simulated speed', async () => {
      assert.equal(await web.locator('.mapstage').count(), 1);
      const speed = await web.locator('.bvb__speedval').innerText();
      assert.match(speed, /^\d+$/, `expected a simulated number, got ${speed}`);
      assert.equal(await web.locator('.bvb__gear.is-active').count(), 1);
    });

    /* The index is the complete list of what this panel can open, and
       the phone stage's shelf is the short most-used row. Each has to
       hold its own job: neither is a copy of the other. */
    check('the apps index lists every app the panel can open', async () => {
      await web.getByRole('button', { name: 'التطبيقات', exact: true }).first().click();
      await web.waitForTimeout(500);
      await web.screenshot({ path: path.join(OUT, 'prototype-apps.png') });

      const index = await web.locator('.apps').innerText();
      for (const name of ['الخرائط', 'الوسائط', 'الإعدادات', 'الفيديو']) {
        assert.match(index, new RegExp(name), `the car's ${name} is missing from the index`);
      }
      for (const name of ['أنغامي', 'ويز', 'واتساب', 'المكالمات', 'بودكاست', 'يوتيوب']) {
        assert.match(index, new RegExp(name), `the phone's ${name} is missing from the index`);
      }
      assert.equal(await web.locator('.apps__band--phone .apps__tile').count(), 8);
    });

    check('the index fits the panel — no band is pushed off the glass', async () => {
      const fits = await web.evaluate(() => {
        const apps = document.querySelector('.apps');
        return apps.scrollHeight <= Math.ceil(apps.getBoundingClientRect().height);
      });
      assert.ok(fits, 'the apps index must not overflow the 900px panel');
    });

    check('a phone app opens the stage on that app', async () => {
      await web.locator('.apps__band--phone .apps__tile', { hasText: 'ويز' }).first().click();
      await web.waitForTimeout(700);
      assert.equal(await web.locator('.stage').count(), 1, 'the phone stage must open');
      const source = await web.locator('.stage__source').innerText();
      assert.match(source, /ويز/, 'the stage must show the app that was pressed');
    });

    check('the shelf is ordered by use, most used first', async () => {
      const names = () => web.$$eval('.shelf__name', (n) => n.map((x) => x.textContent.trim()));
      const before = await names();
      // One press must not reshuffle a shelf the driver is reading.
      await web.locator('.shelf__tile', { hasText: 'بودكاست' }).first().click();
      await web.waitForTimeout(300);
      assert.deepEqual(await names(), before, 'a single open must not churn the order');

      for (let i = 0; i < 45; i += 1) {
        await web.locator('.shelf__tile', { hasText: 'بودكاست' }).first().click();
      }
      await web.waitForTimeout(300);
      assert.equal((await names())[0], 'بودكاست', 'the most-used app must lead the shelf');
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
      const overflow = await live.page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.equal(overflow, 0, 'the panel must not scroll horizontally');
    });

    check('head unit shows no invented vehicle data', async () => {
      assert.equal(await live.page.locator('.bvb__speedval').innerText(), '—');
      assert.equal(await live.page.locator('.bvb__rangeval').innerText(), '—');
      assert.equal(await live.page.locator('.statusbar__tempval').innerText(), '—');
      assert.equal(await live.page.locator('.bvb__gear.is-active').count(), 0,
        'an unknown gear must not light a gear pill');
    });

    check('head unit shows live media from the bridge, not demo tracks', async () => {
      const body = await live.page.locator('body').innerText();
      assert.match(body, /Verified live track/);
      assert.doesNotMatch(body, /هاتف عبدالله/, 'demo source label must not appear');
      // The source line must name the real player, not a prototype input.
      // t-label uppercases Latin text, so match case-insensitively.
      const head = await live.page.locator('.ctx--media .ctx__head').innerText();
      assert.match(head, /spotify/i);
      assert.doesNotMatch(head, /بلوتوث/);
    });

    check('transport press reaches the bridge as a real command', async () => {
      await live.page.locator('.bvb__media button[aria-label="تشغيل"]').click();
      const sent = await live.page.evaluate(() => window.__calls.some(
        (c) => c.method === 'mediaControl' && c.args.command === 'play'));
      assert.ok(sent, 'play must be sent to the host');
      // The host said nothing changed, so the UI must not flip itself.
      assert.equal(await live.page.locator('.bvb__media button[aria-label="تشغيل"]').count(), 1,
        'playback state is owned by the session, not by the button press');
    });

    check('the simulation clock is not running on the head unit', async () => {
      const first = await live.page.locator('.bvb__speedval').innerText();
      await live.page.waitForTimeout(2500);
      assert.equal(await live.page.locator('.bvb__speedval').innerText(), first);
    });

    check('apps grid is curated, and uninstalled entries are inert', async () => {
      await live.page.getByRole('button', { name: 'التطبيقات', exact: true }).first().click();
      await live.page.waitForTimeout(400);
      await live.page.screenshot({ path: path.join(OUT, 'native-apps.png') });

      const waze = live.page.locator('.apps__tile', { hasText: 'Waze' }).first();
      assert.ok(await waze.isDisabled(), 'an uninstalled package must not be pressable');

      const maps = live.page.locator('.apps__tile', { hasText: 'الخرائط' }).first();
      await maps.click();
      const launched = await live.page.evaluate(() => window.__calls.some(
        (c) => c.method === 'launch' && c.args.app === 'maps'));
      assert.ok(launched, 'an installed package must launch through the bridge');
    });

    check('parked-only content stays held while motion is unverified', async () => {
      const parked = live.page.locator('.apps__band--parked');
      assert.match(await parked.innerText(), /حالة الوقوف غير متاحة/);
      const video = parked.locator('.apps__tile', { hasText: 'الفيديو' }).first();
      assert.ok(await video.isDisabled() || await video.locator('.apps__lock').count() > 0);
    });

    check('phone keypad dials through the system dialer, not a fake call', async () => {
      await live.page.getByRole('button', { name: 'الهاتف', exact: true }).first().click();
      await live.page.waitForTimeout(400);
      const body = await live.page.locator('body').innerText();
      assert.doesNotMatch(body, /هاتف عبدالله/, 'no demo contact may appear');

      await live.page.waitForSelector('.phone__keypad');
      // A key renders its digit and a letter sub-label, so the digit has
      // to be matched on the number span rather than the whole button.
      for (const digit of ['0', '5', '5', '1']) {
        await live.page.locator('.phone__key')
          .filter({ has: live.page.locator('.phone__keynum', { hasText: new RegExp(`^${digit}$`) }) })
          .first()
          .click();
      }
      await live.page.getByRole('button', { name: /اتصال/ }).first().click();
      const dialed = await live.page.evaluate(() => window.__calls.find((c) => c.method === 'dial'));
      assert.ok(dialed, 'dial must reach the bridge');
      assert.equal(dialed.args.number, '0551');
    });

    check('the Home intent returns the HMI to Home', async () => {
      await live.page.evaluate(() => window.dispatchEvent(new Event('mustang:home')));
      await live.page.waitForTimeout(300);
      assert.equal(await live.page.locator('.mapstage').count(), 1);
    });

    check('head unit raises no page errors', async () => {
      assert.deepEqual(live.errors, []);
    });

    /* ---------- head unit, no media access ---------- */
    const none = await openNative(browser, { mediaLive: false });
    await none.page.screenshot({ path: path.join(OUT, 'native-no-media.png') });

    check('no media session is stated plainly, never as a demo track', async () => {
      await none.page.getByRole('button', { name: 'الوسائط', exact: true }).first().click();
      await none.page.waitForTimeout(400);
      const body = await none.page.locator('body').innerText();
      assert.match(body, /لا يوجد مصدر وسائط/);
      assert.doesNotMatch(body, /هاتف عبدالله/);
      assert.equal(await none.page.locator('.music__row').count(), 0,
        'demo queue must not appear beside an absent player');
    });

    check('media access can be requested from the HMI', async () => {
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
