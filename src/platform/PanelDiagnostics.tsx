/* ============================================================
   PANEL DIAGNOSTICS OVERLAY
   Reachable on the bench by long-pressing the MUSTANG wordmark —
   the same gesture that opens the developer panel in the browser.

   It answers one question directly: is the CSS viewport the HMI is
   laid out in actually the approved 2400x900 composition, and if
   not, what did the device report instead?
   ============================================================ */

import { useEffect, useState } from 'react';
import {
  PANEL_HEIGHT, PANEL_WIDTH, nativeMetrics, pageMetrics, viewportAdapter,
  type NativeMetrics, type PageMetrics, type ViewportAdapter,
} from './diagnostics';
import './PanelDiagnostics.css';

const round = (value: number, places = 3) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export function PanelDiagnostics({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState<PageMetrics | null>(null);
  const [native, setNative] = useState<NativeMetrics | null>(null);
  const [adapter, setAdapter] = useState<ViewportAdapter | null>(null);

  useEffect(() => {
    const read = () => {
      setPage(pageMetrics());
      setAdapter(viewportAdapter());
    };
    read();
    window.addEventListener('resize', read);
    void nativeMetrics().then(setNative);
    return () => window.removeEventListener('resize', read);
  }, []);

  if (!page) return null;

  const fits = page.matchesPanel;

  return (
    <div className="paneldiag" role="dialog" aria-label="تشخيص اللوحة">
      <header className="paneldiag__head">
        <span className="latin paneldiag__title">PANEL DIAGNOSTICS</span>
        <span className={`latin paneldiag__verdict${fits ? ' is-ok' : ' is-bad'}`}>
          {fits ? 'VIEWPORT OK' : 'VIEWPORT MISMATCH'}
        </span>
        <button type="button" className="paneldiag__close" onClick={onClose}>إغلاق</button>
      </header>

      <div className="paneldiag__grid">
        <Group title="Composition">
          <Row k="target" v={`${PANEL_WIDTH} x ${PANEL_HEIGHT} css px`} />
          <Row k="css viewport" v={`${page.clientWidth} x ${page.clientHeight}`} bad={!fits} />
          <Row k="root font-size" v={`${round(page.rootFontSizePx, 2)} px`} />
        </Group>

        <Group title="Page">
          <Row k="devicePixelRatio" v={String(round(page.devicePixelRatio))} />
          <Row k="innerWidth" v={String(page.innerWidth)} />
          <Row k="innerHeight" v={String(page.innerHeight)} />
          <Row k="clientWidth" v={String(page.clientWidth)} />
          <Row k="clientHeight" v={String(page.clientHeight)} />
          <Row
            k="visualViewport"
            v={page.visualViewportWidth === null
              ? 'unsupported'
              : `${round(page.visualViewportWidth, 1)} x ${round(page.visualViewportHeight ?? 0, 1)} @ ${round(page.visualViewportScale ?? 1)}`}
          />
          <Row k="screen" v={`${page.screenWidth} x ${page.screenHeight}`} />
          <Row
            k="effective physical"
            v={`${page.effectivePhysicalWidth} x ${page.effectivePhysicalHeight} px`}
          />
          <Row k="fully visible" v={String(page.fullyVisible)} bad={!page.fullyVisible} />
        </Group>

        <Group title="Viewport adapter">
          {adapter ? (
            <>
              <Row k="mode" v={adapter.mode} />
              <Row k="applied" v={String(adapter.applied)} />
              <Row k="measured dip" v={`${adapter.dipWidth} x ${adapter.dipHeight}`} />
              <Row k="initial-scale" v={String(round(adapter.scale, 5))} />
              {adapter.error && <Row k="error" v={adapter.error} bad />}
            </>
          ) : (
            <Row k="state" v="viewport.js did not run" bad />
          )}
        </Group>

        <Group title="Native display">
          {native ? (
            <>
              <Row k="density" v={String(round(native.density))} />
              <Row k="densityDpi" v={String(native.densityDpi)} />
              <Row k="fontScale" v={String(round(native.fontScale))} />
              <Row k="window px" v={`${native.windowWidthPx} x ${native.windowHeightPx}`} />
              <Row k="display px" v={`${native.displayWidthPx} x ${native.displayHeightPx}`} />
              <Row k="webview px" v={`${native.webViewWidthPx} x ${native.webViewHeightPx}`} />
              <Row
                k="css without fix"
                v={`${round(native.defaultCssWidth, 1)} x ${round(native.defaultCssHeight, 1)}`}
              />
              <Row k="xdpi / ydpi" v={`${round(native.xdpi, 1)} / ${round(native.ydpi, 1)}`} />
              <Row k="sdk" v={`${native.sdk} (${native.release})`} />
              <Row k="device" v={`${native.model} / ${native.device} / ${native.hardware}`} />
            </>
          ) : (
            <Row k="state" v="unavailable — browser or release build" />
          )}
        </Group>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="paneldiag__group">
      <h3 className="latin paneldiag__grouptitle">{title}</h3>
      <dl className="paneldiag__rows">{children}</dl>
    </section>
  );
}

function Row({ k, v, bad = false }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className={`paneldiag__row${bad ? ' is-bad' : ''}`}>
      <dt className="latin paneldiag__key">{k}</dt>
      <dd className="latin paneldiag__val">{v}</dd>
    </div>
  );
}
