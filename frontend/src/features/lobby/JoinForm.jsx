/** Rejoindre une salle existante. */

import { useState } from 'react';

import { useServerConfig } from '@/state/ServerConfigContext';
import Button from '@/ui/Button';

function JoinForm({ busy, onSubmit }) {
  const { maxNameLength } = useServerConfig();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const ready = code.trim().length >= 4 && name.trim().length > 0;

  return (
    <form
      className="lobby-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onSubmit(code.trim().toUpperCase(), name.trim());
      }}
    >
      <div>
        <label className="field-label" htmlFor="join-code">
          Code de la salle
        </label>
        <input
          id="join-code"
          className="text-input room-code"
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          disabled={busy}
          maxLength={6}
          autoComplete="off"
          spellCheck="false"
        />
      </div>
      <div>
        <label className="field-label" htmlFor="join-name">
          Votre pseudo
        </label>
        <input
          id="join-name"
          className="text-input"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={busy}
          maxLength={maxNameLength}
          autoComplete="nickname"
        />
      </div>
      <Button type="submit" variant="primary" block disabled={busy || !ready}>
        {busy ? 'Connexion…' : 'Rejoindre'}
      </Button>
    </form>
  );
}

export default JoinForm;
