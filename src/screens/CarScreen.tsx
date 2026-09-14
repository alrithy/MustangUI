/* ============================================================
   VEHICLE
   Linear data only — bars, numbers, one schematic. No circular
   gauges: the cluster owns those, and a duplicate tachometer on
   the centre screen is decoration.

   Every value on this screen is simulated. Drivetrain state is
   presented as a readout and is never interactive.
   ============================================================ */

import { VehicleDiagram } from '../components/VehicleDiagram';
import { Meter, SectionHead, Segmented, Surface, ValueBlock } from '../components/primitives';
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
      <header className="car__head">
        <div className="car__mode">
          <span className="t-label">وضع القيادة</span>
          <Segmented<DriveMode>
            options={DRIVE_MODES}
            value={vehicle.driveMode}
            onChange={(mode) => dispatch({ type: 'set-drive-mode', mode })}
            size="lg"
            ariaLabel="وضع القيادة"
          />
        </div>
        <p className="car__disclaimer t-caption">
          <Icon name="info" className="car__discicon" />
          القيم معروضة لأغراض العرض التوضيحي
        </p>
      </header>

      <div className="car__grid">
        {/* --- Tyres --- */}
        <Surface tone="base" radius="md" pad="md" className="car__card car__card--tires">
          <SectionHead title="ضغط الإطارات" tag="PSI" />
          <div className="car__tires">
            {(['fl', 'fr'] as const).map((p) => <TireCell key={p} pos={p} />)}
            <div className="car__diagram">
              <VehicleDiagram warn={lowTires} />
            </div>
            {(['rl', 'rr'] as const).map((p) => <TireCell key={p} pos={p} />)}
          </div>
        </Surface>

        {/* --- Energy --- */}
        <Surface tone="base" radius="md" pad="md" className="car__card">
          <SectionHead title="الوقود والمدى" />
          <div className="car__stack">
            <div className="car__fuel">
              <ValueBlock label="المدى المتوقع" value={vehicle.rangeKm} unit="كم" size="lg" />
              <ValueBlock label="مستوى الوقود" value={Math.round(vehicle.fuelPct)} unit="٪" size="lg"
                tone={vehicle.fuelPct < 15 ? 'warning' : 'default'} />
            </div>
            <Meter ratio={vehicle.fuelPct / 100} height="lg" ticks={4}
              tone={vehicle.fuelPct < 15 ? 'warning' : 'neutral'} />
            <div className="car__scale">
              <span className="latin">F</span>
              <span className="latin">1/2</span>
              <span className="latin">E</span>
            </div>
          </div>
        </Surface>

        {/* --- Powertrain --- */}
        <Surface tone="base" radius="md" pad="md" className="car__card">
          <SectionHead title="مجموعة نقل الحركة" />
          <div className="car__metrics">
            <ValueBlock label="حرارة المبرد" value={`${Math.round(vehicle.coolantC)}°`} latinLabel="C"
              tone={vehicle.coolantC > 110 ? 'warning' : 'default'} />
            <ValueBlock label="حرارة الزيت" value={`${Math.round(vehicle.oilC)}°`} latinLabel="C" />
            <ValueBlock label="جهد البطارية" value={vehicle.voltage.toFixed(1)} unit="فولت" latinLabel="12V"
              tone={vehicle.voltage < 12.4 ? 'warning' : 'default'} />
            <ValueBlock label="دورات المحرك" value={vehicle.rpm.toLocaleString('en-US')} latinLabel="RPM" />
          </div>
        </Surface>

        {/* --- Trip --- */}
        <Surface tone="base" radius="md" pad="md" className="car__card">
          <SectionHead title="عداد الرحلة" tag="TRIP A" />
          <div className="car__metrics">
            <ValueBlock label="المسافة" value={vehicle.trip.distanceKm.toFixed(1)} unit="كم" />
            <ValueBlock label="متوسط الاستهلاك" value={vehicle.trip.avgKmL.toFixed(1)} unit="كم/ل" />
            <ValueBlock label="المدة" value={Math.round(vehicle.trip.durationMin)} unit="د" />
            <ValueBlock label="متوسط السرعة" value={vehicle.trip.avgSpeed} unit="كم/س" />
          </div>
        </Surface>

      </div>

      <footer className="car__identity">
        <InfoCell k="الطراز" v="Mustang GT Fastback · 5.0L V8" latin />
        <span className="hairline-v car__idsep" />
        <InfoCell k="العداد الكلي" v={`${Math.round(vehicle.odometerKm).toLocaleString('en-US')} كم`} />
        <span className="hairline-v car__idsep" />
        <InfoCell k="الصيانة القادمة" v="بعد 2,680 كم" />
        <span className="hairline-v car__idsep" />
        <InfoCell k="حالة الأنظمة" v="سليمة" ok />
      </footer>
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
        <span className="car__tireunit latin">psi</span>
      </span>
      <span className="car__tiretemp">{Math.round(tire.tempC)}°</span>
    </div>
  );
}

function InfoCell({ k, v, latin = false, ok = false }: { k: string; v: string; latin?: boolean; ok?: boolean }) {
  return (
    <div className="car__idcell">
      <span className="t-label">{k}</span>
      <span className={`car__idvalue${latin ? ' car__infolatin' : ''}${ok ? ' is-ok' : ''}`}>
        <bdi>{v}</bdi>
      </span>
    </div>
  );
}
