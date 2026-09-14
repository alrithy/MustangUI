/*
 * Panel geometry across Android display densities.
 *
 * The HMI is composed for 2400x900 CSS pixels, but WebView expresses the
 * CSS viewport in density-independent pixels: by default a 2400px panel
 * gives the page 2400/density CSS px, so only a 160 dpi unit sees the
 * composition it was authored for. public/viewport.js corrects that with
 * the viewport meta tag, measuring the scale rather than assuming a
 * density.
 *
 * This runs that correction at four densities. Chromium is put in mobile
 * emulation so the viewport meta is honoured through the same Blink path
 * WebView uses, with deviceScaleFactor standing in for Android density
 * and the context viewport standing in for the panel in dp.
 *
 * Usage: npm run build && node scripts/verify-panel.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const DIST = path.resolve(__dirname, '../dist');
const NATIVE_ORIGIN = 'https://appassets.androidplatform.net';
const PANEL_W = 2400;
const PANEL_H = 900;
const OUT = process.env.UI_ARTIFACTS || '/tmp/mustang-ui';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/*
 * A 2400x900 physical panel at each density. The dp viewport is
 * physical/density, which is exactly what WebView would hand the page
 * with no correction — the number this test exists to correct.
 */
const DENSITIES = [
  { name: '160 dpi (mdpi, density 1.0)', dpi: 160, density: 1 },
  { name: '240 dpi (hdpi, density 1.5)', dpi: 240, density: 1.5 },
  { name: '320 dpi (xhdpi, density 2.0)', dpi: 320, density: 2 },
  // Vendor-defined densities are common on head units; tvdpi is a real
  // non-power-of-two value and a good stand-in for an odd ro.sf.lcd_density.
  { name: '213 dpi (tvdpi, vendor, density 1.33125)', dpi: 213, density: 213 / 160 },
];

/** Pixel dimensions straight out of the PNG header. */
function pngSize(file) {
  const header = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, header, 0, 24, 0);
  } finally {
    fs.closeSync(fd);
  }
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

/**
 * Fraction of pixels differing from the first capture, for each of the
 * rest. Decoded in the browser, which already has a PNG decoder and a
 * canvas — no image library needed on the host.
 */
async function pixelDiffs(browser, files) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const dataUrls = files.map(
      (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`);
    return await page.evaluate(async (urls) => {
      const load = (url) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const images = [];
      for (const url of urls) images.push(await load(url));

      // Emulating a fractional density needs an integer dp viewport, so a
      // capture can land a pixel short. Compare the region both captures
      // actually cover rather than calling that a mismatch.
      const width = Math.min(...images.map((i) => i.naturalWidth));
      const height = Math.min(...images.map((i) => i.naturalHeight));

      /*
       * Compared at quarter resolution. A fractional density rasterises
       * at a non-integer effective scale, so every hairline in the design
       * picks up a slightly different antialiasing — visually identical,
       * but enough to trip a per-pixel threshold at full resolution.
       * Downsampling averages that away while any real geometric shift,
       * which moves whole elements, survives it.
       */
      const w = Math.floor(width / 4);
      const h = Math.floor(height / 4);

      const pixels = (img) => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h).data;
      };

      const base = pixels(images[0]);
      const out = [];
      for (let i = 1; i < images.length; i += 1) {
        const other = pixels(images[i]);
        let differing = 0;
        for (let p = 0; p < base.length; p += 4) {
          // Small per-channel tolerance: identical geometry can still
          // rasterise a sub-pixel differently between page scales.
          if (Math.abs(base[p] - other[p]) > 8
            || Math.abs(base[p + 1] - other[p + 1]) > 8
            || Math.abs(base[p + 2] - other[p + 2]) > 8) differing += 1;
        }
        out.push(differing / (base.length / 4));
      }
      return out;
    }, dataUrls);
  } catch {
    return files.slice(1).map(() => null);
  } finally {
    await context.close();
  }
}

async function openPanel(browser, density, { disableAdapter = false } = {}) {
  const dipWidth = Math.round(PANEL_W / density);
  const dipHeight = Math.round(PANEL_H / density);

  const context = await browser.newContext({
    viewport: { width: dipWidth, height: dipHeight },
    deviceScaleFactor: density,
    // Mobile emulation is what makes Blink honour the viewport meta tag,
    // which is the mechanism the correction relies on.
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.route(`${NATIVE_ORIGIN}/**`, async (route) => {
    const rel = new URL(route.request().url()).pathname;
    // The control case: serve everything except the correction, which
    // reproduces exactly what a 2400px panel showed before this fix.
    if (disableAdapter && rel === '/viewport.js') {
      return route.fulfill({ status: 200, contentType: TYPES['.js'], body: '' });
    }
    const file = path.join(DIST, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file)) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({
      path: file,
      contentType: TYPES[path.extname(file)] || 'application/octet-stream',
    });
  });

  // No native host: this test is about geometry, and the HMI must lay
  // itself out correctly before any bridge traffic arrives.
  await page.goto(`${NATIVE_ORIGIN}/index.html`);
  await page.waitForSelector('.shell');
  await page.waitForTimeout(6000);

  return { context, page, errors, dipWidth, dipHeight };
}

async function measure(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const touch = document.querySelector('.rail__item, .ibtn--lg, .tbtn--lg');
    const shell = document.querySelector('.shell');
    return {
      clientWidth: root.clientWidth,
      clientHeight: root.clientHeight,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: root.scrollWidth,
      scrollHeight: root.scrollHeight,
      devicePixelRatio: window.devicePixelRatio,
      visualViewport: window.visualViewport
        ? {
          width: window.visualViewport.width,
          height: window.visualViewport.height,
          scale: window.visualViewport.scale,
        }
        : null,
      rootFontSize: parseFloat(getComputedStyle(root).fontSize),
      adapter: window.__mustangViewport || null,
      shellWidth: shell ? shell.getBoundingClientRect().width : 0,
      shellHeight: shell ? shell.getBoundingClientRect().height : 0,
      touchSelector: touch ? touch.className : null,
      touchWidth: touch ? touch.getBoundingClientRect().width : 0,
      touchHeight: touch ? touch.getBoundingClientRect().height : 0,
    };
  });
}

const checks = [];
const check = (name, fn) => checks.push([name, fn]);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  assert.ok(fs.existsSync(path.join(DIST, 'index.html')), 'run `npm run build` first');
  assert.ok(fs.existsSync(path.join(DIST, 'viewport.js')), 'viewport.js must ship in dist/');

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });

  /** Baseline to compare every other density against. */
  let baseline = null;

  try {
    for (const density of DENSITIES) {
      const opened = await openPanel(browser, density.density);
      const m = await measure(opened.page);
      const shotPath = path.join(OUT, `panel-${density.dpi}dpi.png`);
      await opened.page.screenshot({ path: shotPath });
      opened.shot = pngSize(shotPath);

      const label = density.name;

      check(`${label}: viewport adapter ran and measured, not guessed`, () => {
        assert.ok(m.adapter, 'viewport.js did not run');
        assert.equal(m.adapter.mode, 'panel');
        assert.equal(m.adapter.applied, true, 'correction was not applied');
        assert.equal(m.adapter.dipWidth, opened.dipWidth,
          'adapter must measure the dp viewport, not assume it');
        assert.ok(Math.abs(m.adapter.scale - opened.dipWidth / PANEL_W) < 1e-9);
      });

      check(`${label}: CSS viewport is the approved 2400 composition`, () => {
        assert.ok(Math.abs(m.clientWidth - PANEL_W) <= 1,
          `expected ~${PANEL_W} CSS px, got ${m.clientWidth}`);
      });

      check(`${label}: whole composition is on screen, nothing cropped`, () => {
        assert.ok(m.visualViewport, 'visualViewport is needed to judge cropping');
        assert.ok(m.visualViewport.width >= m.clientWidth - 1,
          `only ${m.visualViewport.width} of ${m.clientWidth} CSS px visible`);
        assert.ok(m.visualViewport.height >= m.clientHeight - 1,
          `only ${m.visualViewport.height} of ${m.clientHeight} CSS px visible`);
      });

      check(`${label}: page scale is exactly what the adapter asked for`, () => {
        // devicePixelRatio does NOT include page scale — Blink keeps that
        // in visualViewport.scale. Physical span is css x scale x dpr.
        assert.ok(Math.abs(m.visualViewport.scale - m.adapter.scale) < 1e-3,
          `engine applied ${m.visualViewport.scale}, adapter asked ${m.adapter.scale}`);
        const physicalW = m.clientWidth * m.visualViewport.scale * m.devicePixelRatio;
        assert.ok(Math.abs(physicalW - PANEL_W) <= 2,
          `composition spans ${physicalW} physical px, panel is ${PANEL_W}`);
      });

      check(`${label}: renders at exactly ${PANEL_W}x${PANEL_H} physical pixels`, () => {
        // The least theoretical proof available: what the compositor
        // actually produced. A crop or letterbox would show up here.
        assert.ok(Math.abs(opened.shot.width - PANEL_W) <= 2,
          `rendered ${opened.shot.width}px wide, panel is ${PANEL_W}`);
        assert.ok(Math.abs(opened.shot.height - PANEL_H) <= 2,
          `rendered ${opened.shot.height}px tall, panel is ${PANEL_H}`);
      });

      check(`${label}: no scrolling in either axis`, () => {
        assert.ok(m.scrollWidth <= m.clientWidth + 1,
          `horizontal overflow: ${m.scrollWidth} > ${m.clientWidth}`);
        assert.ok(m.scrollHeight <= m.clientHeight + 1,
          `vertical overflow: ${m.scrollHeight} > ${m.clientHeight}`);
      });

      check(`${label}: shell occupies the full composition`, () => {
        assert.ok(Math.abs(m.shellWidth - PANEL_W) <= 1, `shell width ${m.shellWidth}`);
        assert.ok(Math.abs(m.shellHeight - PANEL_H) <= 1, `shell height ${m.shellHeight}`);
      });

      if (baseline === null) {
        baseline = m;
      } else {
        const ref = baseline;
        check(`${label}: type scale identical to the 160 dpi baseline`, () => {
          // The rem base is derived from vh/vw, so a wrong viewport shows
          // up here first: it would clamp to 13px instead of 20px.
          assert.equal(m.rootFontSize, ref.rootFontSize,
            `root font-size ${m.rootFontSize}px vs baseline ${ref.rootFontSize}px`);
        });

        check(`${label}: touch targets identical to the 160 dpi baseline`, () => {
          assert.ok(ref.touchWidth > 0, 'no touch target found to measure');
          assert.equal(m.touchSelector, ref.touchSelector);
          assert.ok(Math.abs(m.touchWidth - ref.touchWidth) <= 0.5,
            `touch width ${m.touchWidth} vs ${ref.touchWidth}`);
          assert.ok(Math.abs(m.touchHeight - ref.touchHeight) <= 0.5,
            `touch height ${m.touchHeight} vs ${ref.touchHeight}`);
        });
      }

      check(`${label}: no page errors`, () => {
        assert.deepEqual(opened.errors, []);
      });

      await opened.context.close();
    }

    /*
     * A control: the same unit with the correction removed, which is
     * exactly what this panel showed before the fix. It calibrates the
     * threshold below against a real regression instead of a guess, and
     * proves the comparison has the power to detect one.
     */
    const control = await openPanel(browser, 2, { disableAdapter: true });
    const controlMetrics = await measure(control.page);
    const controlPath = path.join(OUT, 'panel-320dpi-uncorrected.png');
    await control.page.screenshot({ path: controlPath });
    await control.context.close();

    check('control: without the adapter a 320 dpi panel gets the wrong viewport', () => {
      assert.equal(controlMetrics.adapter, null,
        'the control must run with no adapter at all');
      assert.equal(controlMetrics.clientWidth, 1200,
        'uncorrected, WebView hands the page physical/density CSS px');
      assert.ok(controlMetrics.rootFontSize < 20,
        `the vh/vw type scale should collapse, got ${controlMetrics.rootFontSize}px`);
    });

    /*
     * Optical identity. The geometric assertions above already prove the
     * layout matches; this checks the rendered result, against the
     * 160 dpi capture.
     */
    const diffs = await pixelDiffs(browser, [
      ...DENSITIES.map((d) => path.join(OUT, `panel-${d.dpi}dpi.png`)),
      controlPath,
    ]);
    const controlDiff = diffs[diffs.length - 1];

    /*
     * Stated as a ratio, not an absolute. The HMI picks day or night
     * from the wall clock, and the two palettes put the absolute diff
     * anywhere from ~17% to ~25% for the identical fault — an absolute
     * threshold calibrated at midday quietly fails after dark. What
     * actually matters is that a real geometry fault is an order of
     * magnitude louder than antialiasing, which holds in both palettes.
     */
    const worstCorrected = Math.max(...diffs.slice(0, DENSITIES.length - 1));

    check('control: a wrong viewport is plainly visible in the render', () => {
      assert.ok(controlDiff !== null, 'could not decode the captures');
      assert.ok(controlDiff > worstCorrected * 5,
        `control differs by ${(controlDiff * 100).toFixed(2)}% but the worst correct `
        + `render differs by ${(worstCorrected * 100).toFixed(2)}% — too close to tell apart`);
      assert.ok(controlDiff > 0.05,
        `only ${(controlDiff * 100).toFixed(2)}% differs — the check lacks power`);
    });

    for (let i = 1; i < DENSITIES.length; i += 1) {
      const label = DENSITIES[i].name;
      const ratio = diffs[i - 1];
      check(`${label}: render optically identical to the 160 dpi baseline`, () => {
        assert.ok(ratio !== null, 'could not decode the captures to compare');
        /*
         * Where the effective raster scale is integral (density 1.5 with
         * page scale 2/3, density 2 with 1/2) the render is essentially
         * bit-identical. A fractional density rasterises every hairline
         * in the design with slightly different antialiasing, which is
         * inherent and does not average away — but it stays an order of
         * magnitude below a real geometry regression, which the control
         * above pins at >20%.
         */
        assert.ok(ratio < 0.05,
          `${(ratio * 100).toFixed(3)}% of pixels differ from the baseline`);
      });
    }

    /* The browser prototype must be untouched by any of this. */
    const web = await browser.newContext({ viewport: { width: PANEL_W, height: PANEL_H } });
    const webPage = await web.newPage();
    const webErrors = [];
    webPage.on('pageerror', (e) => webErrors.push(e.message));
    await webPage.route('http://prototype.test/**', async (route) => {
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
    await webPage.goto('http://prototype.test/index.html');
    await webPage.waitForSelector('.shell');
    await webPage.waitForTimeout(3000);
    const webMetrics = await measure(webPage);

    check('browser prototype: viewport adapter stands down', () => {
      assert.ok(webMetrics.adapter, 'viewport.js should still load');
      assert.equal(webMetrics.adapter.mode, 'browser');
      assert.equal(webMetrics.adapter.applied, false,
        'the adapter must never touch a browser viewport');
      assert.equal(webMetrics.clientWidth, PANEL_W);
      assert.deepEqual(webErrors, []);
    });

    await web.close();

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
      ? `\n${checks.length} panel-geometry checks passed. Screenshots in ${OUT}`
      : `\n${failed} of ${checks.length} panel-geometry checks FAILED. Screenshots in ${OUT}`);
    process.exitCode = failed === 0 ? 0 : 1;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
