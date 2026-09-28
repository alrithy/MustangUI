/* ============================================================
   APP TILE
   One launchable app: the real icon from the unit when the host
   sends one, a tinted monogram when it does not. The whole tile is
   the hit region. A long press is the only way into editing, so a
   quick tap while driving can never rearrange anything.
   ============================================================ */

import { useRef, type ReactNode } from 'react';
import type { CatalogApp } from '../state/types';
import './AppTile.css';

const LONG_PRESS_MS = 600;

/** Tap and long-press on one element; a long press swallows the tap. */
export function useLongPress(onTap: () => void, onLong?: () => void) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: () => {
      fired.current = false;
      if (!onLong) return;
      clear();
      timer.current = window.setTimeout(() => { fired.current = true; onLong(); }, LONG_PRESS_MS);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    onClick: () => {
      if (fired.current) { fired.current = false; return; }
      onTap();
    },
  };
}

export function AppIcon({ app, className = '' }: { app: CatalogApp; className?: string }) {
  if (app.icon) {
    return <img className={`appicon ${className}`} src={app.icon} alt="" draggable={false} />;
  }
  return (
    <span className={`appicon appicon--mono ${className}`} style={{ background: app.tint ?? 'var(--surface-elevated)' }}>
      {initial(app.label)}
    </span>
  );
}

interface AppTileProps {
  app: CatalogApp;
  variant: 'home' | 'grid';
  onOpen: () => void;
  onLongPress?: () => void;
  /** Small corner badge, e.g. the pinned dot or an edit control. */
  badge?: ReactNode;
  selected?: boolean;
  editing?: boolean;
}

export function AppTile({ app, variant, onOpen, onLongPress, badge, selected, editing }: AppTileProps) {
  const press = useLongPress(onOpen, onLongPress);
  return (
    <button
      type="button"
      className={`apptile apptile--${variant} pressable${selected ? ' is-selected' : ''}${editing ? ' is-editing' : ''}`}
      aria-label={app.label}
      {...press}
    >
      <span className="apptile__glow" style={{ background: app.tint ?? 'transparent' }} aria-hidden="true" />
      <AppIcon app={app} className="apptile__icon" />
      <span className="apptile__label truncate"><bdi>{app.label}</bdi></span>
      {badge}
    </button>
  );
}

/* First letter of the name, skipping the Arabic article so الساعة
   reads س rather than ا. */
function initial(label: string): string {
  const word = label.trim().replace(/^ال(?=.{2,})/, '');
  return Array.from(word)[0]?.toUpperCase() ?? '؟';
}
