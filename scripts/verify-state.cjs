/*
 * Runs the real reducer, in both platform modes, with no browser and no
 * Android device.
 *
 * The thing most worth protecting is the split: on the head unit the
 * simulation must be genuinely dead, not merely hidden by the UI, and
 * live media must be able to move the store. Both are properties of the
 * reducer, so they can be checked here — cheaply, on every change —
 * rather than only on hardware.
 *
 * Usage: node scripts/verify-state.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

/**
 * Loads src/state/systemStore.tsx with `isAndroid` forced either way.
 * React and the native transport are stubbed: the reducer is a pure
 * function and must not need either to be exercised.
 */
function loadStore(isAndroid) {
  const cache = new Map();

  const hostStub = {
    isAndroid,
    NATIVE_ORIGIN: 'https://appassets.androidplatform.net',
    request: () => Promise.reject(new Error('unavailable')),
    on: () => () => {},
    act: () => {},
    notify: () => {},
    onNotice: () => () => {},
  };

  const reactStub = {
    createContext: (value) => ({ value }),
    useContext: () => undefined,
    useReducer: () => [undefined, () => {}],
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: () => ({ current: undefined }),
    useCallback: (fn) => fn,
  };

  const load = (file) => {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);

    const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.DEV', 'false');
    const js = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText;

    const localRequire = (name) => {
      if (name === 'react') return reactStub;
      if (name === 'react/jsx-runtime') return {};
      if (name.includes('platform/host')) return hostStub;
      const base = path.resolve(path.dirname(file), name);
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        if (fs.existsSync(base + ext)) return load(base + ext);
      }
      throw new Error(`unresolved import ${name} from ${file}`);
    };

    vm.runInNewContext(js, {
      module,
      exports: module.exports,
      require: localRequire,
      localStorage: { getItem: () => null, setItem: () => {} },
      document: { hidden: false },
      window: {},
      Date,
      Math,
      JSON,
      console,
    });
    return module.exports;
  };

  return load(path.resolve(__dirname, '../src/state/systemStore.tsx'));
}

const checks = [];
const check = (name, fn) => checks.push([name, fn]);

/* ---------------- head unit ---------------- */

const android = loadStore(true);

check('head unit starts with no simulated sources', () => {
  const s = android.initialState;
  assert.equal(s.sources.vehicle, 'unavailable');
  assert.equal(s.sources.media, 'unavailable');
  assert.equal(s.sources.phone, 'unavailable');
  assert.equal(s.sources.nav, 'unavailable');
  assert.equal(s.sources.system, 'live');
  assert.equal(s.media.playing, false, 'must not claim to be playing before a session exists');
});

check('every simulation action is inert on the head unit', () => {
  const s = android.initialState;
  const inert = [
    { type: 'tick' },
    { type: 'scenario', id: 'driving' },
    { type: 'set-gear', gear: 'D' },
    { type: 'set-drive-mode', mode: 'sport' },
    { type: 'climate-fan', delta: 1 },
    { type: 'climate-temp', seat: 'driver', delta: 1 },
    { type: 'call-dial', contactId: 'c-01' },
    { type: 'call-incoming' },
    { type: 'nav-start', destination: { id: 'd', distanceKm: 4, etaMin: 6 } },
    { type: 'media-toggle' },
    { type: 'media-step', delta: 1 },
    { type: 'media-seek', ratio: 0.5 },
  ];
  for (const action of inert) {
    assert.equal(android.reducer(s, action), s, `${action.type} must not change state`);
  }
});

check('live media moves the store and reports its provenance', () => {
  const live = android.reducer(android.initialState, {
    type: 'native-media',
    value: {
      status: 'live', app: 'com.spotify.music', title: 'Real track',
      artist: 'Real artist', playing: true, positionSec: 42, durationSec: 200,
    },
  });
  assert.equal(live.sources.media, 'live');
  assert.equal(live.media.playing, true);
  assert.equal(live.media.positionSec, 42);
  assert.equal(live.native.media.title, 'Real track');
});

check('losing media access clears live metadata rather than stranding it', () => {
  const live = android.reducer(android.initialState, {
    type: 'native-media',
    value: { status: 'live', title: 'Real track', playing: true, positionSec: 42 },
  });
  const lost = android.reducer(live, { type: 'native-media', value: { status: 'unavailable' } });
  assert.equal(lost.sources.media, 'unavailable');
  assert.equal(lost.native.media, null);
  assert.equal(lost.media.playing, false);
  assert.equal(lost.media.positionSec, 0);
});

check('navigation and preferences still work on the head unit', () => {
  const s = android.initialState;
  assert.equal(android.reducer(s, { type: 'navigate', screen: 'apps' }).screen, 'apps');
  assert.equal(android.reducer(s, { type: 'set-theme', theme: 'gt' }).settings.theme, 'gt');
  assert.equal(
    android.reducer(s, { type: 'set-rail-side', side: 'right' }).settings.railSide, 'right');
});

check('native connectivity and app inventory reach the store', () => {
  const s = android.initialState;
  const sys = android.reducer(s, {
    type: 'native-system',
    value: { network: true, gpsEnabled: false, bluetooth: 'on', timeMs: 1, sdk: 30 },
  });
  assert.equal(sys.native.system.bluetooth, 'on');
  assert.equal(sys.native.system.gpsEnabled, false);

  const apps = android.reducer(s, {
    type: 'native-apps',
    value: [{ id: 'maps', available: true }, { id: 'waze', available: false }],
  });
  assert.equal(apps.native.apps.length, 2);
});

/* ---------------- browser prototype ---------------- */

const web = loadStore(false);

check('the browser prototype keeps its simulation', () => {
  const s = web.initialState;
  assert.equal(s.sources.vehicle, 'demo');
  assert.equal(s.sources.media, 'demo');
  assert.equal(s.media.playing, true);

  assert.equal(web.reducer(s, { type: 'tick' }).clock, 1);
  assert.equal(web.reducer(s, { type: 'set-gear', gear: 'D' }).vehicle.gear, 'D');
  assert.equal(web.reducer(s, { type: 'climate-fan', delta: 1 }).climate.fan, s.climate.fan + 1);
  assert.equal(web.reducer(s, { type: 'media-toggle' }).media.playing, false);
  assert.equal(web.reducer(s, { type: 'scenario', id: 'driving' }).vehicle.speedKph, 92);
});

check('the simulation tick still advances the prototype vehicle', () => {
  const driving = web.reducer(web.initialState, { type: 'scenario', id: 'driving' });
  const after = web.reducer(driving, { type: 'tick' });
  assert.notEqual(after.vehicle.speedKph, driving.vehicle.speedKph);
  assert.equal(after.clock, driving.clock + 1);
});

/* The most-used shelf is only honest if the counts are real, so the
   reducer has to record them — on the head unit too, where the rest of
   the simulation is inert. */
check('opening a projected app records the use and moves the stage', () => {
  const before = web.initialState.usage.podcasts;
  const once = web.reducer(web.initialState, { type: 'cast-open', id: 'podcasts' });
  assert.equal(once.castApp, 'podcasts');
  assert.equal(once.usage.podcasts, before + 1);

  const twice = web.reducer(once, { type: 'cast-open', id: 'podcasts' });
  assert.equal(twice.usage.podcasts, before + 2);
  // No other count moves.
  assert.equal(twice.usage.anghami, web.initialState.usage.anghami);
});

check('use counts are recorded on the head unit, not simulated away', () => {
  const opened = android.reducer(android.initialState, { type: 'cast-open', id: 'waze' });
  assert.equal(opened.castApp, 'waze');
  assert.equal(opened.usage.waze, (android.initialState.usage.waze ?? 0) + 1);
});

check('an app with no recorded history still counts from its first open', () => {
  const opened = web.reducer(web.initialState, { type: 'cast-open', id: 'unheard-of' });
  assert.equal(opened.usage['unheard-of'], 1);
});

/* ---------------- run ---------------- */

let failed = 0;
for (const [name, fn] of checks) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL  ${name}\n        ${error.message}`);
  }
}
console.log(failed === 0
  ? `\n${checks.length} state checks passed.`
  : `\n${failed} of ${checks.length} state checks FAILED.`);
process.exit(failed === 0 ? 0 : 1);
