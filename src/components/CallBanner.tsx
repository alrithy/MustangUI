/* ============================================================
   CALL BANNER
   An incoming call raises priority without taking the screen: it
   docks to the bottom of the content area so route guidance above
   it stays readable. Answer / decline are 88dp and separated, so
   neither can be hit by accident.
   ============================================================ */

import { contactById, useDispatch, useSystem } from '../state/systemStore';
import { timecode } from '../system/format';
import { Avatar, IconButton, TouchButton } from './primitives';
import './CallBanner.css';

export function CallBanner() {
  const { phone } = useSystem();
  const dispatch = useDispatch();
  const contact = contactById(phone.contactId);

  if (phone.status === 'idle' || !contact) return null;
  const incoming = phone.status === 'incoming';

  return (
    <section
      className="callbanner"
      data-state={phone.status}
      role="alertdialog"
      aria-label={incoming ? 'مكالمة واردة' : 'مكالمة جارية'}
    >
      <Avatar name={contact.name} seed={contact.id} size="md" />
      <div className="callbanner__who">
        <span className="callbanner__label t-label">
          {incoming ? 'مكالمة واردة' : 'مكالمة جارية'}
        </span>
        <span className="callbanner__name truncate">{contact.name}</span>
        <span className="callbanner__meta" dir="ltr">
          {incoming ? contact.phone : timecode(phone.durationSec)}
        </span>
      </div>

      {incoming ? (
        <div className="callbanner__actions">
          <TouchButton
            variant="accept" size="xl" icon="phone"
            onClick={() => dispatch({ type: 'call-accept' })}
          >
            رد
          </TouchButton>
          <TouchButton
            variant="danger" size="xl" icon="phone-end"
            onClick={() => dispatch({ type: 'call-decline' })}
          >
            رفض
          </TouchButton>
        </div>
      ) : (
        <div className="callbanner__actions">
          <IconButton
            icon={phone.muted ? 'mic-off' : 'mic'}
            label={phone.muted ? 'إلغاء كتم الميكروفون' : 'كتم الميكروفون'}
            size="lg" variant="filled" active={phone.muted}
            onClick={() => dispatch({ type: 'call-mute' })}
          />
          <TouchButton
            variant="danger" size="xl" icon="phone-end"
            onClick={() => dispatch({ type: 'call-end' })}
          >
            إنهاء
          </TouchButton>
        </div>
      )}
    </section>
  );
}
