/* ============================================================
   TRI-BAR — the system's one signature element.
   Three segments, read as a set. Abstracted from the Mustang's
   three-element rear lamp and its outward sequential sweep; it is
   never drawn as a taillight, only used as a state marker.

     marker      persistent active indicator (navigation rail)
     sequential  indeterminate progress / working
     step        3-stage determinate confirmation
   ============================================================ */

import './TriBar.css';

interface TriBarProps {
  variant?: 'marker' | 'sequential' | 'step';
  orientation?: 'vertical' | 'horizontal';
  /** marker: 0..1 illumination. step: which of the 3 segments are lit. */
  active?: boolean;
  step?: 0 | 1 | 2 | 3;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TriBar({
  variant = 'marker',
  orientation = 'vertical',
  active = true,
  step = 3,
  size = 'md',
  className = '',
}: TriBarProps) {
  return (
    <span
      className={`tribar tribar--${variant} tribar--${orientation} tribar--${size} ${className}`}
      data-active={active}
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="tribar__seg"
          data-lit={variant === 'step' ? i < step : undefined}
          style={{ ['--i' as string]: i }}
        />
      ))}
    </span>
  );
}
