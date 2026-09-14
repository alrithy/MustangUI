/* ============================================================
   BOTTOM VEHICLE BAR
   The one strip that never changes screen: read-only drivetrain
   state, climate, media transport, volume. It is a control strip,
   not a second navigation bar — nothing here changes the screen.
   ============================================================ */

import { useDispatch, useSystem, useTrack } from '../state/systemStore';
import type { Gear } from '../state/types';
import { climateTemp } from '../system/format';
import { Icon } from '../system/icons';
import { AlbumArt } from './AlbumArt';
import { IconButton } from './primitives';
import './BottomVehicleBar.css';

const GEARS: Gear[] = ['P', 'R', 'N', 'D'];

export function BottomVehicleBar() {
  const { vehicle, climate, media } = useSystem();
  const dispatch = useDispatch();
  const track = useTrack();

  return (
    <footer className="bvb">
      {/* --- Drivetrain: display only. Never rendered as a control. --- */}
      <div className="bvb__zone bvb__drive">
        {/* Read-only drivetrain readout. `physical` keeps P R N D in
            hardware order; there is no handler and no press state. */}
        <div
          className="bvb__gears physical"
          role="img"
          aria-label={`ناقل الحركة في الوضع ${vehicle.gear}`}
        >
          {GEARS.map((g) => (
            <span key={g} className={`bvb__gear latin${g === vehicle.gear ? ' is-active' : ''}`}>
              {g}
            </span>
          ))}
        </div>
        <div className="bvb__speed">
          <span className="n-value bvb__speedval">{Math.round(vehicle.speedKph)}</span>
          <span className="bvb__unit">كم/س</span>
        </div>
      </div>

      <span className="hairline-v bvb__sep" />

      {/* --- Climate --- */}
      <div className="bvb__zone bvb__climate">
        <div className="bvb__temp physical">
          <IconButton icon="minus" label="خفض حرارة السائق" size="sm"
            onClick={() => dispatch({ type: 'climate-temp', seat: 'driver', delta: -0.5 })} />
          <span className="bvb__tempval">
            <span className="n-value">{climateTemp(climate.driverC)}</span>
            <span className="bvb__unit">°</span>
          </span>
          <IconButton icon="plus" label="رفع حرارة السائق" size="sm"
            onClick={() => dispatch({ type: 'climate-temp', seat: 'driver', delta: 0.5 })} />
        </div>

        <div className="bvb__climate-mid">
          <button
            type="button"
            className="bvb__fan pressable"
            onClick={() => dispatch({ type: 'climate-fan', delta: 1 })}
            aria-label={`سرعة المروحة ${climate.fan} من 7`}
          >
            <Icon name="fan" className="bvb__fanicon" />
            <span className="bvb__fanbars" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} data-on={i < climate.fan} />
              ))}
            </span>
          </button>
          <IconButton icon="ac" label="مكيف الهواء" size="sm" variant="ghost"
            active={climate.ac} onClick={() => dispatch({ type: 'climate-toggle', key: 'ac' })} />
          <IconButton icon="sync" label="مزامنة مناطق التكييف" size="sm" variant="ghost"
            active={climate.sync} onClick={() => dispatch({ type: 'climate-toggle', key: 'sync' })} />
          <IconButton icon="seat-heat" label={`تدفئة المقعد ${climate.seatHeatDriver}`} size="sm"
            variant="ghost" active={climate.seatHeatDriver > 0}
            badge={climate.seatHeatDriver > 0 ? String(climate.seatHeatDriver) : undefined}
            onClick={() => dispatch({ type: 'climate-seat' })} />
        </div>

        <div className="bvb__temp bvb__temp--passenger physical">
          <IconButton icon="minus" label="خفض حرارة الراكب" size="sm"
            onClick={() => dispatch({ type: 'climate-temp', seat: 'passenger', delta: -0.5 })} />
          <span className="bvb__tempval">
            <span className="n-value">{climateTemp(climate.passengerC)}</span>
            <span className="bvb__unit">°</span>
          </span>
          <IconButton icon="plus" label="رفع حرارة الراكب" size="sm"
            onClick={() => dispatch({ type: 'climate-temp', seat: 'passenger', delta: 0.5 })} />
        </div>
      </div>

      <span className="hairline-v bvb__sep" />

      {/* --- Media transport (the persistent mini player) --- */}
      <div className="bvb__zone bvb__media">
        <AlbumArt track={track} size="xs" />
        <div className="bvb__track">
          <span className="bvb__title truncate"><bdi>{track.title}</bdi></span>
          <span className="bvb__artist truncate"><bdi>{track.artist}</bdi></span>
        </div>
        <IconButton
          icon={media.playing ? 'pause' : 'play'}
          label={media.playing ? 'إيقاف مؤقت' : 'تشغيل'}
          size="sm" variant="filled"
          onClick={() => dispatch({ type: 'media-toggle' })}
        />
        <IconButton icon="next" label="المقطع التالي" size="sm"
          onClick={() => dispatch({ type: 'media-step', delta: 1 })} />
      </div>

      <span className="hairline-v bvb__sep" />

      {/* --- Volume --- */}
      <div className="bvb__zone bvb__volume physical">
        <IconButton
          icon={media.muted || media.volume === 0 ? 'mute' : 'volume'}
          label={media.muted ? 'إلغاء الكتم' : 'كتم الصوت'}
          size="sm" active={media.muted}
          onClick={() => dispatch({ type: 'media-mute' })}
        />
        <IconButton icon="minus" label="خفض الصوت" size="sm"
          onClick={() => dispatch({ type: 'media-volume', delta: -1 })} />
        <span className="bvb__vol physical">
          <span className="n-value bvb__volval">{media.muted ? '—' : media.volume}</span>
          <span className="bvb__volbar" aria-hidden="true">
            <span style={{ width: `${(media.muted ? 0 : media.volume / 30) * 100}%` }} />
          </span>
        </span>
        <IconButton icon="plus" label="رفع الصوت" size="sm"
          onClick={() => dispatch({ type: 'media-volume', delta: 1 })} />
      </div>
    </footer>
  );
}
