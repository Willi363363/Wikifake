/** Lancement d'une partie solo : sujet + duree. */

import { useState } from 'react';

import { useServerConfig } from '@/state/ServerConfigContext';
import Button from '@/ui/Button';
import RangeField from '@/ui/RangeField';

function SoloForm({ busy, onSubmit }) {
  const { duration } = useServerConfig();
  const [category, setCategory] = useState('');
  const [durationS, setDurationS] = useState(duration.default);

  return (
    <form
      className="lobby-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (category.trim()) onSubmit(category.trim(), durationS);
      }}
    >
      <div>
        <label className="field-label" htmlFor="solo-category">
          Sujet ou catégorie
        </label>
        <input
          id="solo-category"
          className="text-input"
          type="text"
          placeholder="ex. Paris, volcans, Renaissance…"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          disabled={busy}
          maxLength={120}
          autoComplete="off"
        />
      </div>

      <RangeField
        label="Limite de temps"
        value={durationS}
        min={duration.min}
        max={duration.max}
        disabled={busy}
        onChange={setDurationS}
      />

      <Button type="submit" variant="primary" block disabled={busy || !category.trim()}>
        {busy ? 'Génération en cours…' : 'Lancer en solo'}
      </Button>
    </form>
  );
}

export default SoloForm;
