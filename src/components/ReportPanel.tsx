/* ============================================================
   SYSTEM REPORT
   One button that gathers what the next integration steps need to
   know about this unit, without a laptop: panel geometry, Android and
   WebView versions, vendor packages, sensors, settings and system
   properties. The findings are shown here; the full report is saved
   to Downloads and can be sent from the share sheet.
   ============================================================ */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { pageMetrics, viewportAdapter } from '../platform/diagnostics';
import { isAndroid, notify, on, request } from '../platform/host';
import { Icon } from '../system/icons';
import './ReportPanel.css';

interface Findings {
  panel: string;
  android: string;
  webview: string;
  temperatureSensors: string[];
  vendorPackages: string[];
  vehicleHints: string[];
}

interface Report {
  error?: string;
  findings?: Findings;
  packages?: { count: number };
  sensors?: unknown[];
  properties?: Record<string, unknown>;
  settings?: { system: object; global: object; secure: object };
}

type Phase = 'collecting' | 'ready' | 'failed';

const count = (o: object | undefined) => (o ? Object.keys(o).length : 0);

/** The page's half of the geometry: what the WebView actually handed the
 *  HMI, and what the viewport adapter did about it. This is the half that
 *  explains why the UI renders at the size it does. */
function webGeometry() {
  const page = pageMetrics();
  const adapter = viewportAdapter();
  const meta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';
  const initial = /initial-scale=([0-9.]+)/.exec(meta);
  return {
    innerWidth: page.innerWidth,
    innerHeight: page.innerHeight,
    devicePixelRatio: page.devicePixelRatio,
    visualViewportWidth: page.visualViewportWidth,
    visualViewportHeight: page.visualViewportHeight,
    visualViewportScale: page.visualViewportScale,
    clientWidth: page.clientWidth,
    clientHeight: page.clientHeight,
    rootFontSizePx: page.rootFontSizePx,
    adapterApplied: adapter?.applied ?? false,
    adapterMode: adapter?.mode ?? 'missing',
    adapterError: adapter?.error ?? '',
    measuredDipWidth: adapter?.dipWidth ?? null,
    measuredDipHeight: adapter?.dipHeight ?? null,
    initialScale: initial ? Number(initial[1]) : null,
    viewportMeta: meta,
    effectivePhysicalWidth: page.effectivePhysicalWidth,
    effectivePhysicalHeight: page.effectivePhysicalHeight,
    matchesPanel: page.matchesPanel,
    fullyVisible: page.fullyVisible,
    cropped: !page.fullyVisible,
  };
}

export function ReportPanel({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('collecting');
  const [report, setReport] = useState<Report | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const collect = () => {
    setPhase('collecting');
    setSaved(null);
    if (!isAndroid) {
      window.setTimeout(() => setPhase('failed'), 600);
      return;
    }
    void request('systemReport', { web: webGeometry() }).catch(() => setPhase('failed'));
  };

  useEffect(() => {
    const off = on<Report>('systemReport', (value) => {
      setReport(value);
      setPhase(value.error || !value.findings ? 'failed' : 'ready');
    });
    collect();
    return off;
  }, []);

  const save = (share: boolean) => {
    setBusy(true);
    void request<{ path: string }>('saveReport', { share })
      .then((r) => setSaved(r.path))
      .catch(() => setSaved(''))
      .finally(() => setBusy(false));
  };

  const copy = () => {
    setBusy(true);
    void request('copyReport')
      .then(() => notify('نُسخ التقرير كاملاً إلى الحافظة'))
      .catch(() => notify('تعذر النسخ — استخدم الحفظ بدلاً منه'))
      .finally(() => setBusy(false));
  };

  const f = report?.findings;

  /* Portalled to the shell: a screen's entrance animation would
     otherwise trap this fixed layer inside the content area. */
  return createPortal(
    <div className="report" role="dialog" aria-label="تقرير النظام">
      <div className="report__panel">
        <header className="report__head">
          <h2 className="report__title">تقرير النظام</h2>
          <button type="button" className="report__close pressable" onClick={onClose}>إغلاق</button>
        </header>

        {phase === 'collecting' && (
          <p className="report__status">يجمع معلومات النظام… قد يستغرق بضع ثوانٍ</p>
        )}

        {phase === 'failed' && (
          <p className="report__status">
            {isAndroid ? 'تعذر جمع التقرير' : 'التقرير يعمل على الشاشة فقط، وليس في نسخة المتصفح'}
          </p>
        )}

        {phase === 'ready' && f && (
          <>
            <dl className="report__facts">
              <div><dt>الشاشة</dt><dd>{f.panel}</dd></div>
              <div><dt>أندرويد</dt><dd>{f.android}</dd></div>
              <div><dt>WebView</dt><dd>{f.webview}</dd></div>
              <div>
                <dt>حساس الحرارة</dt>
                <dd>{f.temperatureSensors.length ? <bdi>{f.temperatureSensors.join('، ')}</bdi> : 'لا يوجد'}</dd>
              </div>
              <div>
                <dt>المحتوى</dt>
                <dd>
                  <span className="n-value">{report?.packages?.count ?? 0}</span> حزمة ·{' '}
                  <span className="n-value">{report?.sensors?.length ?? 0}</span> حساس ·{' '}
                  <span className="n-value">{count(report?.properties)}</span> خاصية ·{' '}
                  <span className="n-value">
                    {count(report?.settings?.system) + count(report?.settings?.global) + count(report?.settings?.secure)}
                  </span> إعداد
                </dd>
              </div>
            </dl>

            <div className="report__lists">
              <section>
                <h3>حزم المصنّع ({f.vendorPackages.length})</h3>
                <ul>{f.vendorPackages.map((p) => <li key={p}>{p}</li>)}</ul>
              </section>
              <section>
                <h3>مؤشرات بيانات السيارة ({f.vehicleHints.length})</h3>
                <ul>{f.vehicleHints.map((h) => <li key={h}>{h}</li>)}</ul>
              </section>
            </div>

            {saved !== null && (
              <p className="report__saved">
                {saved ? <>حُفظ في <bdi>{saved}</bdi></> : 'تعذر حفظ الملف'}
              </p>
            )}
          </>
        )}

        <footer className="report__actions">
          <button type="button" className="report__btn pressable" onClick={collect} disabled={phase === 'collecting'}>
            <Icon name="sync" /> إعادة الجمع
          </button>
          <button type="button" className="report__btn pressable" disabled={phase !== 'ready' || busy}
            onClick={copy}>
            <Icon name="queue" /> نسخ التقرير
          </button>
          <button type="button" className="report__btn pressable" disabled={phase !== 'ready' || busy}
            onClick={() => save(false)}>
            <Icon name="export" /> حفظ في التنزيلات
          </button>
          <button type="button" className="report__btn report__btn--primary pressable"
            disabled={phase !== 'ready' || busy} onClick={() => save(true)}>
            <Icon name="external" /> حفظ ومشاركة
          </button>
        </footer>
      </div>
    </div>,
    document.querySelector('.shell') ?? document.body,
  );
}
