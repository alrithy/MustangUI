/* ============================================================
   PRIMITIVES
   The small vocabulary every screen is assembled from. Nothing
   here hardcodes a colour, a size or a duration.
   ============================================================ */

import type { CSSProperties, ReactNode } from 'react';
import { hashIndex, monogram } from '../system/format';
import { Icon } from '../system/icons';
import './primitives.css';

/* ---------- Surface ----------------------------------------------
   Layered by tone, not by outline. `chamfer` is reserved for
   hero-level surfaces — one cut corner, never more. */
interface SurfaceProps {
  children?: ReactNode;
  tone?: 'base' | 'elevated' | 'sunken' | 'bare';
  radius?: 'sm' | 'md' | 'lg' | 'none';
  pad?: 'none' | 'sm' | 'md' | 'lg';
  chamfer?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Surface({
  children, tone = 'base', radius = 'md', pad = 'md', chamfer = false,
  className = '', style,
}: SurfaceProps) {
  return (
    <div
      className={`surface surface--${tone} surface--r-${radius} surface--p-${pad}${chamfer ? ' surface--chamfer' : ''} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

/* ---------- Section header ---------------------------------------
   Arabic title with an optional Latin technical tag. No captions
   under headings — the heading is the caption. */
export function SectionHead({
  title, tag, action,
}: { title: string; tag?: string; action?: ReactNode }) {
  return (
    <div className="section-head">
      <h2 className="t-title-sm section-head__title">{title}</h2>
      {tag && <span className="latin section-head__tag">{tag}</span>}
      <span className="section-head__rule hairline" />
      {action}
    </div>
  );
}

/* ---------- TouchButton -------------------------------------------
   Sizes map to the automotive touch tokens; nothing smaller than
   56dp is offered. */
interface TouchButtonProps {
  children?: ReactNode;
  icon?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accept';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  block?: boolean;
  /** Present only on toggles. Undefined means "not a toggle". */
  active?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function TouchButton({
  children, icon, onClick, variant = 'secondary', size = 'md',
  block = false, active, disabled = false, ariaLabel, className = '',
}: TouchButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      data-scale="true"
      className={`tbtn tbtn--${variant} tbtn--${size}${block ? ' tbtn--block' : ''}${active ? ' is-active' : ''} pressable ${className}`}
    >
      {icon && <Icon name={icon} className="tbtn__icon" />}
      {children && <span className="tbtn__label">{children}</span>}
    </button>
  );
}

/* ---------- IconButton -------------------------------------------- */
interface IconButtonProps {
  icon: string;
  label: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'ghost' | 'filled' | 'accent' | 'danger' | 'accept';
  /** Present only on toggles. Undefined means "not a toggle". */
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  /** Opt in to the accent for an active state that genuinely means it. */
  tone?: 'neutral' | 'accent';
  className?: string;
}

export function IconButton({
  icon, label, onClick, size = 'md', variant = 'ghost',
  active, disabled = false, badge, tone = 'neutral', className = '',
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      data-scale="true"
      className={`ibtn ibtn--${size} ibtn--${variant} ibtn--tone-${tone}${active ? ' is-active' : ''} pressable ${className}`}
    >
      <Icon name={icon} className="ibtn__icon" />
      {badge && <span className="ibtn__badge latin">{badge}</span>}
    </button>
  );
}

/* ---------- Segmented control -------------------------------------
   Used for drive modes, phone tabs, appearance. Selection is shown
   by surface + text weight, never a saturated pill. */
export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  tag?: string;
  icon?: string;
}

export function Segmented<T extends string>({
  options, value, onChange, size = 'md', block = false, ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
  size?: 'md' | 'lg';
  block?: boolean;
  ariaLabel: string;
}) {
  return (
    <div
      className={`segmented segmented--${size}${block ? ' segmented--block' : ''}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            className={`segmented__item pressable${selected ? ' is-selected' : ''}`}
          >
            {o.icon && <Icon name={o.icon} className="segmented__icon" />}
            <span className="segmented__label">{o.label}</span>
            {o.tag && <span className="latin segmented__tag">{o.tag}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Value block -------------------------------------------
   The single way a number is presented anywhere in the system:
   label above, tabular value, unit trailing at reduced weight. */
export function ValueBlock({
  label, value, unit, tone = 'default', size = 'md', latinLabel,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: 'default' | 'accent' | 'warning' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  latinLabel?: string;
}) {
  return (
    <div className={`vblock vblock--${size} vblock--${tone}`}>
      <div className="vblock__label t-label">
        {label}
        {latinLabel && <span className="vblock__latin latin">{latinLabel}</span>}
      </div>
      <div className="vblock__value">
        <span className="n-value vblock__num">{value}</span>
        {unit && <span className="vblock__unit">{unit}</span>}
      </div>
    </div>
  );
}

/* ---------- Meter --------------------------------------------------
   Linear only. No circular gauges: a bar is read faster and does
   not import racing-cluster styling into the HMI. */
export function Meter({
  ratio, tone = 'accent', height = 'md', ticks = 0,
}: {
  ratio: number;
  tone?: 'accent' | 'neutral' | 'warning' | 'danger' | 'success';
  height?: 'sm' | 'md' | 'lg';
  ticks?: number;
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className={`meter meter--${height} meter--${tone}`} role="presentation">
      <div className="meter__fill" style={{ width: `${pct}%` }} />
      {ticks > 0 && (
        <div className="meter__ticks">
          {Array.from({ length: ticks - 1 }, (_, i) => (
            <span key={i} style={{ insetInlineStart: `${((i + 1) / ticks) * 100}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Avatar -------------------------------------------------- */
const AVATAR_TONES = 5;
export function Avatar({ name, seed, size = 'md' }: { name: string; seed: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={`avatar avatar--${size}`}
      data-tone={hashIndex(seed, AVATAR_TONES)}
      aria-hidden="true"
    >
      {monogram(name)}
    </span>
  );
}
