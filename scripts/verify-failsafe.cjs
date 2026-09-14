/*
 * Failure paths.
 *
 * A launcher that breaks is not like a web page that breaks: it is the
 * Home screen of a car, and if it fails silently the driver has no way
 * back to Android. The success paths are covered by verify-ui.cjs; this
 * covers what happens when the bridge, the host or React itself does not
 * behave, because those are the paths nobody exercises by accident.
 *
 * Everything here runs against the real bundle on the launcher's own
 * origin, with a deliberately misbehaving host injected.
 *
 * Usage: npm run build && node scripts/verify-failsafe.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const DIST = path.resolve(__dirname, '../dist');
const NATIVE_ORIGIN = 'https://appassets.androidplatform.net';
const PANEL = { width: 2400, height: 900 };

/** host.ts gives a request 5s before it rejects. */
const BRIDGE_TIMEOUT_MS = 5000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/**
 * @param init  runs before any page script; installs the broken host
 * @param wait  ms to settle after the shell appears
 */
async function open(browser, { init = null, initArg = null, wait = 6000 } = {}) {
  const page = await browser.newPage({ viewport: PANEL });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.route(`${NATIVE_ORIGIN}/**`, async (route) => {
    const rel = new URL(route.request().url()).pathname;
    const file = path.join(DIST, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file)) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({
      path: file,
      contentType: TYPES[path.extname(file)] || 'application/octet-stream',
    });
  });

  if (init) await page.addInitScript(init, initArg);
  await page.goto(`${NATIVE_ORIGIN}/index.html`);
  return { page, errors, wait };
}

/* ---------------- misbehaving hosts ---------------- */

/** Records calls and never answers any of them. */
const SILENT_HOST = () => {
  window.__calls = [];
  window.MustangHost = {
    onmessage: null,
    postMessage(raw) { window.__calls.push(JSON.parse(raw)); },
  };
};

/** Answers everything with frames the web layer must refuse to trust. */
const MALFORMED_HOST = () => {
  window.__calls = [];
  const send = (text) => setTimeout(() => {
    if (window.MustangHost.onmessage) window.MustangHost.onmessage({ data: text });
  }, 0);
  window.MustangHost = {
    onmessage: null,
    postMessage(raw) {
      const request = JSON.parse(raw);
      window.__calls.push(request);
      send('this is not json at all');
      send('null');
      send('{"id":"999999","ok":true,"data":{"status":"live","title":"WRONG ID"}}');
      send('{"ok":true,"data":{"status":"live","title":"NO ID"}}');
      send('{"event":"media"}');                       // event with no data
      send('{"event":"media","data":"not an object"}');
      send(JSON.stringify({ id: request.id, ok: true, data: true }));
    },
  };
};

/** Subscribes fine, then refuses every action with a real error code. */
const REFUSING_HOST = () => {
  window.__calls = [];
  const reply = (m) => setTimeout(() => {
    if (window.MustangHost.onmessage) window.MustangHost.onmessage({ data: JSON.stringify(m) });
  }, 0);
  window.MustangHost = {
    onmessage: null,
    postMessage(raw) {
      const request = JSON.parse(raw);
      window.__calls.push(request);
      if (request.method === 'subscribe') {
        reply({ id: request.id, ok: true, data: true });
        reply({ event: 'media', data: { status: 'unavailable' } });
        reply({
          event: 'apps',
          data: [{ id: 'maps', available: true, label: 'Maps' }, { id: 'phone', available: true }],
        });
        return;
      }
      reply({ id: request.id, ok: false, error: 'permission_required' });
    },
  };
};

/** A host present and answering, but the mount point is gone. */
const NO_MOUNT_POINT = () => {
  window.__calls = [];
  window.MustangHost = {
    onmessage: null,
    postMessage(raw) { window.__calls.push(JSON.parse(raw)); },
  };
  const real = document.getElementById.bind(document);
  document.getElementById = (id) => (id === 'hmi-root' ? null : real(id));
};

const checks = [];
const check = (name, fn) => checks.push([name, fn]);

(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'index.html')), 'run `npm run build` first');

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });

  try {
    /* ---- the bundle cannot mount at all ---- */
    const unmounted = await open(browser, { init: NO_MOUNT_POINT });
    await unmounted.page.waitForTimeout(2000);

    check('a bundle that cannot mount tells the host instead of dying quietly', async () => {
      const called = await unmounted.page.evaluate(
        () => window.__calls.filter((c) => c.method === 'uiFailure'));
      assert.equal(called.length, 1, 'the host must be told exactly once');
      assert.match(called[0].args.message, /hmi-root/);
    });

    /* ---- the host never answers ---- */
    const silent = await open(browser, { init: SILENT_HOST });
    await silent.page.waitForSelector('.shell');
    // Past the bridge timeout, so the subscribe promise has rejected.
    await silent.page.waitForTimeout(BRIDGE_TIMEOUT_MS + 3000);

    check('a host that never answers still leaves a usable HMI', async () => {
      assert.equal(await silent.page.locator('.shell').count(), 1);
      assert.equal(await silent.page.locator('.mapstage').count(), 1);
    });

    check('an unanswered bridge reports no media rather than hanging', async () => {
      await silent.page.getByRole('button', { name: 'الوسائط', exact: true }).first().click();
      await silent.page.waitForTimeout(400);
      const body = await silent.page.locator('body').innerText();
      assert.match(body, /لا يوجد مصدر وسائط/);
      // The demo queue must not reappear as a consolation prize.
      assert.equal(await silent.page.locator('.music__row').count(), 0);
    });

    check('an unanswered bridge never fabricates vehicle data', async () => {
      assert.equal(await silent.page.locator('.bvb__speedval').innerText(), '—');
      assert.equal(await silent.page.locator('.bvb__gear.is-active').count(), 0);
    });

    check('screens still navigate with the bridge dead', async () => {
      await silent.page.getByRole('button', { name: 'الإعدادات', exact: true }).first().click();
      await silent.page.waitForTimeout(300);
      assert.equal(await silent.page.locator('.settings').count(), 1);
    });

    check('a silent host raises no page errors', async () => {
      assert.deepEqual(silent.errors, []);
    });

    /* ---- the host answers with garbage ---- */
    const malformed = await open(browser, { init: MALFORMED_HOST });
    await malformed.page.waitForSelector('.shell');
    await malformed.page.waitForTimeout(6000);

    check('malformed frames cannot move state', async () => {
      const body = await malformed.page.locator('body').innerText();
      // Replies carrying an unknown id, or no id, must be dropped — not
      // matched to whatever request happens to be outstanding.
      assert.doesNotMatch(body, /WRONG ID/);
      assert.doesNotMatch(body, /NO ID/);
    });

    check('malformed frames raise no page errors', async () => {
      assert.deepEqual(malformed.errors, []);
    });

    check('the HMI still works after a stream of garbage', async () => {
      await malformed.page.getByRole('button', { name: 'التطبيقات', exact: true }).first().click();
      await malformed.page.waitForTimeout(300);
      assert.equal(await malformed.page.locator('.apps').count(), 1);
    });

    /* ---- the host refuses an action ---- */
    const refusing = await open(browser, { init: REFUSING_HOST });
    await refusing.page.waitForSelector('.shell');
    await refusing.page.waitForTimeout(6000);

    check('a refused action tells the driver why, in their language', async () => {
      await refusing.page.getByRole('button', { name: 'التطبيقات', exact: true }).first().click();
      await refusing.page.waitForTimeout(300);
      await refusing.page.locator('.apps__tile', { hasText: 'الخرائط' }).first().click();
      await refusing.page.waitForTimeout(600);

      const sent = await refusing.page.evaluate(
        () => window.__calls.some((c) => c.method === 'launch' && c.args.app === 'maps'));
      assert.ok(sent, 'the launch must have reached the host');

      // The refusal surfaces in the status bar's existing centre slot,
      // not as new chrome over the approved design.
      const notice = await refusing.page.locator('.statusbar__center').innerText();
      assert.match(notice, /إذن|أندرويد/,
        `expected a permission notice, got "${notice}"`);
    });

    check('a refusal notice clears itself', async () => {
      await refusing.page.waitForTimeout(5000);
      const notice = await refusing.page.locator('.statusbar__center').innerText();
      assert.doesNotMatch(notice, /إذن/, 'the slot must vacate, not hold the message');
    });

    check('a refusing host raises no page errors', async () => {
      assert.deepEqual(refusing.errors, []);
    });

    /* ---- run ---- */
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
      ? `\n${checks.length} failsafe checks passed.`
      : `\n${failed} of ${checks.length} failsafe checks FAILED.`);
    process.exitCode = failed === 0 ? 0 : 1;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
