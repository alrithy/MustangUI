/* ============================================================
   SETTINGS
   Two panes so nothing nests and nothing scrolls unexpectedly.
   Settings is intentionally the quietest screen in the system.
   ============================================================ */

import { useState } from 'react';
import { Meter, SectionHead, Segmented, TouchButton } from '../components/primitives';
import { act } from '../platform/host';
import { TriBar } from '../components/TriBar';
import { useDispatch, useSystem } from '../state/systemStore';
import type { Appearance, RailSide, ThemeName } from '../state/types';
import { Icon } from '../system/icons';
import './SettingsScreen.css';

type SectionId = 'display' | 'sound' | 'connections' | 'vehicle' | 'system' | 'about';

const SECTIONS: Array<{ id: SectionId; label: string; icon: string }> = [
  { id: 'display', label: 'العرض والسمة', icon: 'brightness' },
  { id: 'sound', label: 'الصوت', icon: 'volume' },
  { id: 'connections', label: 'الاتصالات', icon: 'bluetooth' },
  { id: 'vehicle', label: 'المركبة', icon: 'car' },
  { id: 'system', label: 'النظام', icon: 'sliders' },
  { id: 'about', label: 'حول', icon: 'info' },
];

const THEMES: Array<{ id: ThemeName; name: string; tag: string; desc: string }> = [
  { id: 'stealth', name: 'ستيلث', tag: 'STEALTH', desc: 'أسود عميق وجرافيت مع أحمر متحفّظ' },
  { id: 'gt', name: 'جراند تورينج', tag: 'GRAND TOURING', desc: 'تيتانيوم دافئ ولمسة شامبانيا' },
  { id: 'night', name: 'نايت درايف', tag: 'NIGHT DRIVE', desc: 'جرافيت ليلي مع أزرق ثلجي هادئ' },
];

const APPEARANCE: Array<{ id: Appearance; label: string }> = [
  { id: 'auto', label: 'تلقائي' },
  { id: 'day', label: 'نهاري' },
  { id: 'night', label: 'ليلي' },
];

const RAIL: Array<{ id: RailSide; label: string }> = [
  { id: 'left', label: 'يسار (جهة السائق)' },
  { id: 'right', label: 'يمين' },
];

export function SettingsScreen() {
  const [section, setSection] = useState<SectionId>('display');

  return (
    <div className="screen settings">
      <nav className="settings__nav" aria-label="أقسام الإعدادات">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-current={section === s.id ? 'true' : undefined}
            className={`row settings__navitem pressable${section === s.id ? ' is-active' : ''}`}
            onClick={() => setSection(s.id)}
          >
            <Icon name={s.icon} className="settings__navicon" />
            <span className="truncate">{s.label}</span>
            {section === s.id && (
              <TriBar variant="marker" orientation="horizontal" size="sm" active className="settings__mark" />
            )}
          </button>
        ))}
      </nav>

      <div className="settings__pane scroll-y">
        {section === 'display' && <DisplaySection />}
        {section === 'sound' && <SoundSection />}
        {section === 'connections' && <ConnectionsSection />}
        {section === 'vehicle' && <VehicleSection />}
        {section === 'system' && <SystemSection />}
        {section === 'about' && <AboutSection />}
      </div>
    </div>
  );
}

/* ---------- Sections ------------------------------------------------- */
function DisplaySection() {
  const { settings } = useSystem();
  const dispatch = useDispatch();

  return (
    <>
      <section className="settings__group">
      <SectionHead title="السمة" tag="THEME" />
      <div className="settings__themes">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            data-scale="true"
            className={`settings__theme pressable${settings.theme === t.id ? ' is-active' : ''}`}
            onClick={() => dispatch({ type: 'set-theme', theme: t.id })}
            aria-pressed={settings.theme === t.id}
          >
            <span className={`settings__swatch settings__swatch--${t.id}`} aria-hidden="true">
              <i /><i /><i />
            </span>
            <span className="settings__themetext">
              <span className="settings__themename">{t.name}</span>
              <span className="latin settings__themetag">{t.tag}</span>
              <span className="settings__themedesc">{t.desc}</span>
            </span>
            {settings.theme === t.id && <Icon name="check" className="settings__check" />}
          </button>
        ))}
      </div>
      </section>

      <section className="settings__group">
      <SectionHead title="المظهر" tag="APPEARANCE" />
      <Row label="وضع النهار والليل" hint="التلقائي يتبع مستشعر الإضاءة الخارجية">
        <Segmented<Appearance>
          options={APPEARANCE}
          value={settings.appearance}
          onChange={(a) => dispatch({ type: 'set-appearance', appearance: a })}
          ariaLabel="المظهر"
        />
      </Row>
      <Row label="موضع شريط التنقل" hint="يُفضّل وضعه في الجهة الأقرب للسائق">
        <Segmented<RailSide>
          options={RAIL}
          value={settings.railSide}
          onChange={(side) => dispatch({ type: 'set-rail-side', side })}
          ariaLabel="موضع شريط التنقل"
        />
      </Row>
      <Row label="تقليل الحركة" hint="يوقف الانتقالات غير الضرورية">
        <Toggle
          on={settings.reduceMotion}
          onChange={(v) => dispatch({ type: 'set-setting', key: 'reduceMotion', value: v })}
          label="تقليل الحركة"
        />
      </Row>
      </section>

      <section className="settings__group">
      <SectionHead title="بدء التشغيل" tag="STARTUP" />
      <Row label="تسلسل بدء التشغيل" hint="يظهر عند تشغيل المركبة">
        <Toggle
          on={settings.startupOn}
          onChange={(v) => dispatch({ type: 'set-setting', key: 'startupOn', value: v })}
          label="تسلسل بدء التشغيل"
        />
      </Row>
      <Row label="رسالة الترحيب">
        <Toggle
          on={settings.greetingOn}
          onChange={(v) => dispatch({ type: 'set-setting', key: 'greetingOn', value: v })}
          label="رسالة الترحيب"
        />
      </Row>
      <Row label="نغمة بدء التشغيل" hint="تُنفَّذ في نظام أندرويد الأصلي — النموذج صامت">
        <Toggle
          on={settings.startupChime}
          onChange={(v) => dispatch({ type: 'set-setting', key: 'startupChime', value: v })}
          label="نغمة بدء التشغيل"
        />
      </Row>
      <Row label="نص الترحيب" hint="يُنطق صوتياً في النظام النهائي">
        <input
          type="text"
          className="settings__input"
          value={settings.greetingText}
          maxLength={40}
          aria-label="نص الترحيب"
          disabled={!settings.greetingOn}
          onChange={(e) => dispatch({ type: 'set-greeting-text', value: e.target.value })}
        />
      </Row>
      <button
        type="button"
        className="settings__replay pressable"
        onClick={() => window.location.reload()}
      >
        <Icon name="sync" />
        معاينة تسلسل بدء التشغيل
      </button>
      </section>
    </>
  );
}

function SoundSection() {
  const { media, settings } = useSystem();
  const dispatch = useDispatch();
  return (
    <>
      <section className="settings__group">
      <SectionHead title="مستويات الصوت" tag="LEVELS" />
      <Level label="الوسائط" value={media.volume} max={30}
        onChange={(v) => dispatch({ type: 'media-set-volume', value: v })} />
      <Level label="نغمات النظام" value={settings.chimeVolume} max={7}
        onChange={(v) => dispatch({ type: 'set-chime', value: v })} />
      </section>

      <section className="settings__group">
      <SectionHead title="التنبيهات" tag="ALERTS" />
      <Row label="تنبيهات السائق" hint="تنبيهات ضغط الإطارات ومستوى الوقود">
        <Toggle
          on={settings.driverAlerts}
          onChange={(v) => dispatch({ type: 'set-setting', key: 'driverAlerts', value: v })}
          label="تنبيهات السائق"
        />
      </Row>
      </section>
    </>
  );
}

/* The three Android surfaces this launcher deliberately does not
   reimplement. Pairing, notification access and device settings belong
   to the platform; the HMI only needs to be able to reach them. */
function HostLinks({ ids }: { ids: Array<'bluetooth' | 'mediaAccess' | 'settings' | 'homeSettings'> }) {
  const LABEL = {
    bluetooth: 'إعدادات البلوتوث',
    mediaAccess: 'الوصول للوسائط',
    settings: 'إعدادات أندرويد',
    homeSettings: 'الشاشة الرئيسية الافتراضية',
  } as const;
  const ICON = {
    bluetooth: 'bluetooth', mediaAccess: 'music', settings: 'settings', homeSettings: 'sliders',
  } as const;
  return (
    <div className="settings__hostlinks">
      {ids.map((id) => (
        <TouchButton key={id} variant="secondary" size="lg" icon={ICON[id]}
          onClick={() => act('launch', { app: id })}>
          {LABEL[id]}
        </TouchButton>
      ))}
    </div>
  );
}

function ConnectionsSection() {
  const { sources } = useSystem();
  if (sources.system !== 'demo') {
    return (
      <section className="settings__group">
        <SectionHead title="الاتصالات" tag="ANDROID" />
        <p className="settings__note">
          الإقران وحالة الأجهزة يديرهما نظام أندرويد. هذه الشاشة لا تقرأ قائمة
          الأجهزة المقترنة ولا حالة المكالمات.
        </p>
        <HostLinks ids={['bluetooth', 'mediaAccess']} />
      </section>
    );
  }
  return (
    <>
      <section className="settings__group">
        <SectionHead title="الأجهزة المقترنة" tag="PAIRED" />
        <ul className="settings__devices">
          <DeviceRow name="هاتف عبدالله" detail="متصل · الوسائط والهاتف" on />
          <DeviceRow name="سماعة الرأس" detail="غير متصل" />
        </ul>
      </section>
      <section className="settings__group">
        <SectionHead title="الشبكة" tag="NETWORK" />
        <ul className="settings__devices">
          <DeviceRow name="بيانات المركبة" detail="LTE · قوة ممتازة" on />
          <DeviceRow name="نقطة اتصال Wi-Fi" detail="متوقفة" />
        </ul>
      </section>
    </>
  );
}

function VehicleSection() {
  const { settings, sources } = useSystem();
  const dispatch = useDispatch();
  return (
    <>
      <section className="settings__group">
      <SectionHead title="إعدادات القيادة" tag="DRIVING" />
      <Row label="محاكاة الإضاءة الخارجية" hint="للاختبار على المنضدة فقط">
        <Segmented
          options={[{ id: 'day', label: 'نهار' }, { id: 'night', label: 'ليل' }]}
          value={settings.ambientDaylight ? 'day' : 'night'}
          onChange={(v) => dispatch({ type: 'set-ambient', daylight: v === 'day' })}
          ariaLabel="مستشعر الإضاءة"
        />
      </Row>
      <p className="settings__note">
        {sources.vehicle === 'demo'
          ? 'بيانات المركبة في هذا النموذج تجريبية. لا يتم التحكم في ناقل الحركة أو أي وظيفة متعلقة بالسلامة من خلال هذه الشاشة.'
          : 'لا يوجد مصدر معتمد لبيانات المركبة على هذه الوحدة بعد، لذلك تظهر القراءات فارغة. لا يتم التحكم في ناقل الحركة أو أي وظيفة متعلقة بالسلامة من خلال هذه الشاشة.'}
      </p>
      </section>
    </>
  );
}

function SystemSection() {
  const { sources } = useSystem();
  return (
    <>
      {sources.system !== 'demo' && (
        <section className="settings__group">
          <SectionHead title="النظام المضيف" tag="ANDROID" />
          <p className="settings__note">
            التخزين ومعلومات الجهاز تُقرأ من إعدادات أندرويد. اختيار الشاشة
            الرئيسية الافتراضية يبقى بيدك، ويمكن الرجوع للانشر الأصلي في أي وقت.
          </p>
          <HostLinks ids={['settings', 'homeSettings']} />
        </section>
      )}
      <section className="settings__group">
        <SectionHead title="اللغة والمنطقة" tag="LOCALE" />
        <ul className="settings__devices">
          <DeviceRow name="لغة الواجهة" detail="العربية" on />
          <DeviceRow name="الوحدات" detail="متري · كم · مئوية" on />
          <DeviceRow name="المنطقة الزمنية" detail="الرياض · GMT+3" on />
        </ul>
      </section>
      {/* The prototype's storage figure is illustrative. On a real unit
          the number would be wrong, so the meter is not shown at all
          rather than shown with invented values. */}
      {sources.system === 'demo' && (
        <section className="settings__group">
        <SectionHead title="التخزين" tag="STORAGE" />
        <div className="settings__storage">
          <Meter ratio={0.42} height="lg" tone="neutral" />
          <div className="settings__storagemeta">
            <span className="t-meta">27.1 غب مستخدمة</span>
            <span className="t-meta muted">من 64 غب</span>
          </div>
        </div>
        </section>
      )}
    </>
  );
}

function AboutSection() {
  return (
    <>
      <section className="settings__group">
      <SectionHead title="حول النظام" tag="ABOUT" />
      <ul className="settings__devices">
        <DeviceRow name="إصدار النظام" detail="1.0.0 (bench)" on />
        <DeviceRow name="خرائط" detail="الرياض · بيانات عرض" />
        <DeviceRow name="آخر تحديث" detail="غير متوفر في هذا النموذج" />
      </ul>
      <p className="settings__note">
        نموذج واجهة تفاعلي. جميع البيانات المعروضة — الملاحة والوسائط والاتصالات
        وقياسات المركبة — بيانات تجريبية ولا تعكس حالة مركبة حقيقية.
      </p>
      </section>
    </>
  );
}

/* ---------- Section building blocks ------------------------------------ */
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="settings__row">
      <span className="settings__rowtext">
        <span className="settings__rowlabel">{label}</span>
        {hint && <span className="settings__rowhint">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle${on ? ' is-on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="toggle__knob" />
    </button>
  );
}

function Level({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="settings__level">
      <span className="settings__rowlabel">{label}</span>
      <div className="settings__levelbar">
        {Array.from({ length: max }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${label} ${i + 1}`}
            className={`settings__levelseg${i < value ? ' is-on' : ''}`}
            onClick={() => onChange(i + 1)}
          />
        ))}
      </div>
      <span className="n-value settings__levelval">{value}</span>
    </div>
  );
}

function DeviceRow({ name, detail, on = false }: { name: string; detail: string; on?: boolean }) {
  return (
    <li className="settings__device">
      <span className="settings__devicetext">
        <span className="settings__devicename">{name}</span>
        <span className="settings__devicedetail">{detail}</span>
      </span>
      <span className={`settings__devicedot${on ? ' is-on' : ''}`} aria-hidden="true" />
    </li>
  );
}
