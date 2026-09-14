/* ============================================================
   VEHICLE
   One hero and a field of structured telemetry — not a grid of equal
   cards. The hero is the car itself: a top-down schematic with each
   tyre reading anchored to its own wheel, and drive mode at its base.
   Everything else is flat data on the background, grouped by hairline,
   because a table of numbers should look like a table of numbers.

   No circular gauges: the cluster owns those, and a second tachometer
   on the centre screen is decoration.

   Every value here is simulated. Drivetrain state is a readout and is
   never interactive.
   ============================================================ */

import { VehicleDiagram } from '../components/VehicleDiagram';
import { Meter, Segmented, Surface, ValueBlock } from '../components/primitives';
import { useDispatch, useSystem } from '../state/systemStore';
import type { DriveMode } from '../state/types';
import { Icon } from '../system/icons';
import './CarScreen.css';

const DRIVE_MODES = [
  { id: 'normal' as const, label: 'عادي' },
  { id: 'sport' as const, label: 'رياضي' },
  { id: 'track' as const, label: 'حلبة' },
  { id: 'wet' as const, label: 'طرق مبتلة' },
];

const TIRE_LABEL: Record<string, string> = {
  fl: 'أمامي أيسر', fr: 'أمامي أيمن', rl: 'خلفي أيسر', rr: 'خلفي أيمن',
};
const LOW_PSI = 33;

export function CarScreen() {
  const { vehicle } = useSystem();
  const dispatch = useDispatch();
  const lowTires = vehicle.tires.filter((t) => t.psi < LOW_PSI).map((t) => t.position);

  return (
    <div className="screen car">
      {/* ---- Hero: the vehicle ---- */}
      <Surface tone="base" radius="lg" pad="none" className="car__hero">
        <header className="car__herohead">
          <h1 className="car__herotitle">Mustang GT Fastback</h1>
          <span className="t-label">ضغط الإطارات · PSI</span>
        </header>

        <div className="car__tires">
          <TireCell pos="fl" />
          <TireCell pos="fr" />
          <div className="car__diagram"><VehicleDiagram warn={lowTires} /></div>
          <TireCell pos="rl" />
          <TireCell pos="rr" />
        </div>

        <footer className="car__mode">
          <span className="t-label">وضع القيادة</span>
          <Segmented<DriveMode>
            options={DRIVE_MODES}
            value={vehicle.driveMode}
            onChange={(mode) => dispatch({ type: 'set-drive-mode', mode })}
            size="lg" block
            ariaLabel="وضع القيادة"
          />
        </footer>
      </Surface>

      {/* ---- Telemetry: flat, grouped by rule, no card chrome ---- */}
      <div className="car__data">
        <section className="car__group car__group--energy">
          <h2 className="car__grouptitle">الوقود والمدى</h2>
          <div className="car__energy">
            <ValueBlock label="المدى المتوقع" value={vehicle.rangeKm} unit="كم" size="lg" />
            <ValueBlock label="مستوى الوقود" value={Math.round(vehicle.fuelPct)} unit="٪" size="lg"
              tone={vehicle.fuelPct < 15 ? 'warning' : 'default'} />
          </div>
          <Meter ratio={vehicle.fuelPct / 100} height="lg" ticks={4}
            tone={vehicle.fuelPct < 15 ? 'warning' : 'neutral'} />
          <div className="car__scale">
            <span className="latin">F</span><span className="latin">1/2</span><span className="latin">E</span>
          </div>
        </section>

        <span className="hairline-v car__rule" />

        <section className="car__group">
          <h2 className="car__grouptitle">مجموعة نقل الحركة</h2>
          <div className="car__metrics">
            <ValueBlock label="حرارة المبرد" value={`${Math.round(vehicle.coolantC)}°`} latinLabel="C"
              tone={vehicle.coolantC > 110 ? 'warning' : 'default'} />
            <ValueBlock label="حرارة الزيت" value={`${Math.round(vehicle.oilC)}°`} latinLabel="C" />
            <ValueBlock label="جهد البطارية" value={vehicle.voltage.toFixed(1)} unit="فولت" latinLabel="12V"
              tone={vehicle.voltage < 12.4 ? 'warning' : 'default'} />
            <ValueBlock label="دورات المحرك" value={vehicle.rpm.toLocaleString('en-US')} latinLabel="RPM" />
          </div>
        </section>

        <span className="hairline-v car__rule" />

        <section className="car__group">
          <h2 className="car__grouptitle">عداد الرحلة <span className="latin car__tag">TRIP A</span></h2>
          <div className="car__metrics">
            <ValueBlock label="المسافة" value={vehicle.trip.distanceKm.toFixed(1)} unit="كم" />
            <ValueBlock label="متوسط الاستهلاك" value={vehicle.trip.avgKmL.toFixed(1)} unit="كم/ل" />
            <ValueBlock label="المدة" value={Math.round(vehicle.trip.durationMin)} unit="د" />
            <ValueBlock label="متوسط السرعة" value={vehicle.trip.avgSpeed} unit="كم/س" />
          </div>
        </section>

        <footer className="car__identity">
          <InfoCell k="العداد الكلي" v={`${Math.round(vehicle.odometerKm).toLocaleString('en-US')} كم`} />
          <span className="hairline-v car__idsep" />
          <InfoCell k="الصيانة القادمة" v="بعد 2,680 كم" />
          <span className="hairline-v car__idsep" />
          <InfoCell k="حالة الأنظمة" v="سليمة" ok />
          <p className="car__disclaimer t-caption">
            <Icon name="info" className="car__discicon" />
            القيم معروضة لأغراض العرض التوضيحي
          </p>
        </footer>
      </div>
    </div>
  );
}

function TireCell({ pos }: { pos: 'fl' | 'fr' | 'rl' | 'rr' }) {
  const { vehicle } = useSystem();
  const tire = vehicle.tires.find((t) => t.position === pos)!;
  const low = tire.psi < LOW_PSI;
  return (
    <div className={`car__tire car__tire--${pos}`}>
      <span className="t-label">{TIRE_LABEL[pos]}</span>
      <span className={`car__tireval${low ? ' is-warn' : ''}`}>
        <span className="n-value">{tire.psi.toFixed(1)}</span>
      </span>
      <span className="car__tiretemp">{Math.round(tire.tempC)}°</span>
    </div>
  );
}

function InfoCell({ k, v, ok = false }: { k: string; v: string; ok?: boolean }) {
  return (
    <div className="car__idcell">
      <span className="t-label">{k}</span>
      <span className={`car__idvalue${ok ? ' is-ok' : ''}`}><bdi>{v}</bdi></span>
    </div>
  );
}
