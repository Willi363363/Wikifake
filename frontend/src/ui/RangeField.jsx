/** Curseur avec libelle et bornes. Remplace le <style> injecte a la volee. */

import { formatDuration } from '@/lib/format';

function RangeField({ label, value, min, max, step = 30, disabled, onChange, format = formatDuration }) {
  return (
    <div>
      <label className="field-label" htmlFor={`range-${label}`}>
        {label} : {format(value)}
      </label>
      <input
        id={`range-${label}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="range-scale">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

export default RangeField;
