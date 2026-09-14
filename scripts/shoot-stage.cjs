/*
 * Renders the phone-stage prototype at the panel's real size so the
 * design can be judged from pixels rather than from a description.
 *
 * Everything is driven through the interface itself — the rail, the
 * Apps tile, the bench panel behind the wordmark long-press — so the
 * captures prove the screen is reachable, not just that it renders.
 *
 * Usage: npm run build && node scripts/shoot-stage.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const DIST = path.resolve(__dirname, '..', process.env.DIST_DIR || 'dist');
const OUT = process.env.UI_ARTIFACTS || '/tmp/mustang-stage';
const PANEL = { width: 2400, height: 900 };

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/** The bench panel opens on a long press of the wordmark, as documented. */
async function bench(page, open) {
  const isOpen = await page.locator('.devpanel').count() > 0;
  if (isOpen === open) return;
  if (open) {
    const mark = page.locator('.statusbar__mark');
    await mark.dispatchEvent('pointerdown');
    await page.waitForTimeout(1100);
    await mark.dispatchEvent('pointerup');
  } else {
    await page.locator('.devpanel__close').click();
  }
  await page.waitForTimeout(400);
}

async function chip(page, label) {
  await bench(page, true);
  await page.locator('.devpanel button', { hasText: new RegExp(`^${label}$`) }).first().click();
  await page.waitForTimeout(300);
}

/** Apps → عرض الهاتف, the route a driver actually takes. */
async function openStage(page) {
  await page.getByRole('button', { name: 'التطبيقات', exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.locator('.apps__tile', { hasText: 'عرض الهاتف' }).first().click();
  await page.waitForTimeout(700);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--force-device-scale-factor=1'],
  });
  const page = await browser.newPage({ viewport: PANEL });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.route('http://panel.test/**', async (route) => {
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

  await page.goto('http://panel.test/index.html');
  await page.waitForSelector('.shell');
  await page.waitForTimeout(5200); // the approved startup sequence

  const shot = async (name) => {
    await bench(page, false);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(`  ${name}.png`);
  };

  await chip(page, 'متوقفة');
  await bench(page, false);
  await openStage(page);
  await shot('01-stage-night');

  // Route surface — Waze guidance, re-rendered by the car.
  await page.locator('.shelf__tile', { hasText: 'ويز' }).first().click();
  await page.waitForTimeout(700);
  await shot('02-stage-route');

  // Messages surface.
  await page.locator('.shelf__tile', { hasText: 'واتساب' }).first().click();
  await page.waitForTimeout(700);
  await shot('03-stage-messages');

  // Back to media, then handoff to the phone.
  await page.locator('.shelf__tile', { hasText: 'أنغامي' }).first().click();
  await page.waitForTimeout(600);
  await page.locator('.spine__choice', { hasText: 'الهاتف' }).click();
  await page.waitForTimeout(700);
  await shot('04-stage-handoff');
  await page.locator('.spine__choice', { hasText: 'الشاشة' }).click();
  await page.waitForTimeout(600);

  // Day mode, same screen.
  await chip(page, 'نهار');
  await shot('05-stage-day');
  await chip(page, 'ليل');

  // Grand Touring theme.
  await chip(page, 'Grand Touring');
  await shot('06-stage-gt');
  await chip(page, 'Stealth');

  // Moving: parked-only apps are held on the shelf.
  await chip(page, 'قيادة');
  await shot('07-stage-moving');

  if (errors.length) {
    console.error('PAGE ERRORS:', errors);
    process.exitCode = 1;
  } else {
    console.log(`\nno page errors. ${OUT}`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
