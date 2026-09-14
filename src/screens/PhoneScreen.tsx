/* ============================================================
   PHONE
   Two-column lists so rows stay 72dp on a 1920 panel instead of
   stretching to a full-width smartphone list. An active call takes
   the whole screen — during a call there is nothing else to do here.
   ============================================================ */

import { useState } from 'react';
import { Avatar, IconButton, Segmented, Surface, TouchButton } from '../components/primitives';
import { act } from '../platform/host';
import { CALL_LOG, CONTACTS } from '../state/demoData';
import { contactById, useDispatch, useSystem } from '../state/systemStore';
import { relativeTime, timecode } from '../system/format';
import { Icon } from '../system/icons';
import './PhoneScreen.css';

type Tab = 'recent' | 'contacts' | 'keypad';

const TABS = [
  { id: 'recent' as const, label: 'الأخيرة' },
  { id: 'contacts' as const, label: 'جهات الاتصال' },
  { id: 'keypad' as const, label: 'لوحة الأرقام' },
];

const DIRECTION_ICON = { in: 'phone-in', out: 'phone-out', missed: 'phone-missed' } as const;

export function PhoneScreen() {
  const { phone, sources } = useSystem();
  const demo = sources.phone === 'demo';
  /* Without a phone source there is nothing in the lists, so the one
     tab that still works opens first. */
  const [tab, setTab] = useState<Tab>(demo ? 'recent' : 'keypad');

  if (phone.status === 'active' || phone.status === 'incoming') return <ActiveCall />;

  return (
    <div className="screen phone">
      <header className="phone__head">
        <Segmented<Tab> options={TABS} value={tab} onChange={setTab} size="lg" ariaLabel="أقسام الهاتف" />
        <span className="phone__device t-meta">
          <Icon name="bluetooth" className="phone__deviceicon" />
          {demo ? 'هاتف عبدالله' : 'الجهاز المقترن غير معروف'}
        </span>
      </header>

      <div className="phone__body">
        {tab === 'keypad' ? <Keypad /> : demo ? <PeopleList tab={tab} /> : <NoPhoneSource tab={tab} />}
        <QuickDial />
      </div>
    </div>
  );
}

/* The head unit has no read access to the paired phone's log or address
   book in V1. An empty list would imply there were no calls. */
function NoPhoneSource({ tab }: { tab: Tab }) {
  return (
    <div className="phone__list phone__nosource">
      <p className="t-meta phone__nosourcetext">
        {tab === 'recent'
          ? 'سجل المكالمات غير متاح من هذا المصدر.'
          : 'جهات الاتصال غير متاحة من هذا المصدر.'}
      </p>
      <p className="t-meta phone__nosourcetext muted">
        استخدم لوحة الأرقام للاتصال عبر تطبيق الهاتف في النظام.
      </p>
    </div>
  );
}

/* Four favourites, always on screen, at 88dp. Placing them outside the
   tabs means the most common call never costs a navigation step. */
function QuickDial() {
  const dispatch = useDispatch();
  const { sources } = useSystem();
  const favorites = sources.phone === 'demo'
    ? CONTACTS.filter((c) => c.favorite).slice(0, 4)
    : [];

  return (
    <aside className="quickdial">
      <span className="t-label quickdial__head">اتصال سريع</span>
      <div className="quickdial__grid">
        {favorites.map((c) => (
          <button
            key={c.id}
            type="button"
            data-scale="true"
            className="quickdial__item pressable"
            onClick={() => dispatch({ type: 'call-dial', contactId: c.id })}
          >
            <Avatar name={c.name} seed={c.id} size="md" />
            <span className="quickdial__name truncate">{c.name}</span>
            {c.relation && <span className="quickdial__rel truncate">{c.relation}</span>}
          </button>
        ))}
      </div>
    </aside>
  );
}

function PeopleList({ tab }: { tab: Tab }) {
  const dispatch = useDispatch();

  const rows = tab === 'recent'
    ? CALL_LOG.map((c) => ({ key: c.id, contact: contactById(c.contactId)!, record: c }))
    : CONTACTS.map((c) => ({ key: c.id, contact: c, record: undefined }));

  return (
    <ul className="phone__list scroll-y">
      {rows.map(({ key, contact, record }) => (
        <li key={key}>
          <button
            type="button"
            className="row phone__row pressable"
            onClick={() => dispatch({ type: 'call-dial', contactId: contact.id })}
          >
            <Avatar name={contact.name} seed={contact.id} size="md" />
            <span className="phone__rowtext">
              <span className="phone__rowname truncate">{contact.name}</span>
              <span className="phone__rowsub truncate">
                {record ? (
                  <>
                    <Icon
                      name={DIRECTION_ICON[record.direction]}
                      className={`phone__diricon${record.direction === 'missed' ? ' is-missed' : ''}`}
                    />
                    {relativeTime(record.agoMin)}
                    {record.durationSec > 0 && (
                      <span className="n-value phone__rowdur">{timecode(record.durationSec)}</span>
                    )}
                  </>
                ) : (
                  contact.relation ?? 'جهة اتصال'
                )}
              </span>
            </span>
            <span className="phone__rowmeta ltr-num">{contact.phone}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const KEYS = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
];

function Keypad() {
  const [value, setValue] = useState('');
  const dispatch = useDispatch();
  const { sources } = useSystem();
  const demo = sources.phone === 'demo';
  const match = demo
    ? CONTACTS.find((c) => c.phone.replace(/\s/g, '').endsWith(value))
    : undefined;

  /* The HMI does not place the call itself: it hands the number to the
     system dialer, which owns telephony and the Bluetooth HFP link. */
  const dial = () => {
    if (!demo) { act('dial', { number: value }); return; }
    dispatch({ type: 'call-dial', contactId: match?.id ?? CONTACTS[0].id });
  };

  return (
    <div className="phone__keypadwrap">
      <Surface tone="base" radius="lg" pad="md" className="phone__keypad">
        <div className="phone__display">
          {value
            ? <span className="n-value phone__number">{value}</span>
            : <span className="phone__placeholder">أدخل رقماً</span>}
          {value.length > 2 && match && <span className="phone__match truncate">{match.name}</span>}
        </div>
        {/* A dialpad is a physical keypad layout: 1 stays top-left in RTL. */}
        <div className="phone__keys physical">
          {KEYS.map(([k, sub]) => (
            <button key={k} type="button" className="phone__key pressable" data-scale="true"
              onClick={() => setValue((v) => (v.length < 15 ? v + k : v))}>
              <span className="n-value phone__keynum">{k}</span>
              {sub && <span className="latin phone__keysub">{sub}</span>}
            </button>
          ))}
        </div>
        <div className="phone__keyactions">
          <TouchButton
            variant="accept" size="lg" icon="phone" block disabled={value.length < 3}
            onClick={dial}
          >
            اتصال
          </TouchButton>
          <IconButton icon="close" label="مسح آخر رقم" size="lg" variant="filled" disabled={!value}
            onClick={() => setValue((v) => v.slice(0, -1))} />
        </div>
      </Surface>
    </div>
  );
}

function ActiveCall() {
  const { phone, nav } = useSystem();
  const dispatch = useDispatch();
  const contact = contactById(phone.contactId);
  if (!contact) return null;
  const incoming = phone.status === 'incoming';

  return (
    <div className="screen phone phone--call">
      <div className="phone__callbody">
        <Avatar name={contact.name} seed={contact.id} size="lg" />
        <span className="t-label phone__callstate">
          {incoming ? 'مكالمة واردة' : 'مكالمة جارية'}
        </span>
        <h1 className="phone__callname truncate">{contact.name}</h1>
        <span className="phone__callnum ltr-num">{contact.phone}</span>
        {!incoming && <span className="n-value phone__calltime">{timecode(phone.durationSec)}</span>}
      </div>

      {incoming ? (
        <div className="phone__callactions">
          <TouchButton variant="accept" size="xl" icon="phone"
            onClick={() => dispatch({ type: 'call-accept' })}>رد</TouchButton>
          <TouchButton variant="danger" size="xl" icon="phone-end"
            onClick={() => dispatch({ type: 'call-decline' })}>رفض</TouchButton>
        </div>
      ) : (
        <div className="phone__callactions">
          <IconButton icon={phone.muted ? 'mic-off' : 'mic'} label="كتم الميكروفون" size="xl"
            variant="filled" active={phone.muted} onClick={() => dispatch({ type: 'call-mute' })} />
          <IconButton icon="dialpad" label="لوحة الأرقام" size="xl" variant="filled" />
          <IconButton icon="speaker" label="مكبر الصوت" size="xl" variant="filled"
            active={phone.speaker} onClick={() => dispatch({ type: 'call-speaker' })} />
          <TouchButton variant="danger" size="xl" icon="phone-end"
            onClick={() => dispatch({ type: 'call-end' })}>إنهاء</TouchButton>
        </div>
      )}

      {/* Guidance is never dropped for a call. */}
      {nav.active && (
        <button type="button" className="phone__navstrip pressable"
          onClick={() => dispatch({ type: 'navigate', screen: 'nav' })}>
          <Icon name="nav" className="phone__navicon" />
          <span className="truncate">التوجيه مستمر إلى {nav.destination?.name}</span>
          <span className="n-value phone__navkm">{nav.remainingKm.toFixed(1)}</span>
          <span className="phone__navunit">كم</span>
        </button>
      )}
    </div>
  );
}
