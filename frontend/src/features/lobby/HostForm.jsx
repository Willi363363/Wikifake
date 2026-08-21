/** Creation d'une salle. */

import { useState } from 'react';

import { useServerConfig } from '@/state/ServerConfigContext';
import Button from '@/ui/Button';

function HostForm({ busy, onSubmit }) {
  const { maxNameLength } = useServerConfig();
  const [name, setName] = useState('');

  return (
    <form
      className="lobby-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onSubmit(name.trim());
      }}
    >
      <div>
        <label className="field-label" htmlFor="host-name">
          Votre pseudo
        </label>
        <input
          id="host-name"
          className="text-input"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={busy}
          maxLength={maxNameLength}
          autoComplete="nickname"
        />
      </div>
      <Button type="submit" variant="primary" block disabled={busy || !name.trim()}>
        {busy ? 'Création…' : 'Créer la salle'}
      </Button>
    </form>
  );
}

export default HostForm;
