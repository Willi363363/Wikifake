// A refusal, in the reader's language — step 11.9.
//
// **The server authors codes; the client authors sentences.** Phase 11 moved
// every string a player can see into the catalogue and could not finish the
// job: `apps/realtime` and `@wikifake/protocol` write their own English —
// "That room does not exist." — and a French player read it in English under a
// French interface. `06-structural-debt.md` recorded it as a decision rather
// than a defect, because the fix is not a catalogue entry in `apps/web`: it is
// that a package which authors a player-visible sentence must emit a code.
//
// It already does. `errorMessage` carries both, and the protocol's own comment
// says `code` is what the client branches on and `message` what it *may* show.
// So this step stops showing the message: the code is translated here, the
// message stays in logs and tests where a developer reads it.
//
// The unknown branch is the reason this is a function rather than a lookup. A
// client one version behind meets a code its catalogue has never heard of, and
// the choice is between a raw identifier on screen and a sentence that says
// what happened without pretending to know why.
import { useTranslations } from 'next-intl';

import { ERROR_CODES, type ErrorCode } from '@wikifake/protocol';

const known = (code: string): code is ErrorCode =>
  (ERROR_CODES as readonly string[]).includes(code);

/** Translates a refusal code, or null when there is nothing to say. */
export function useRefusal(): (code: string | null | undefined) => string | null {
  const t = useTranslations('errors.refusals');

  return (code) => {
    if (code === null || code === undefined || code === '') return null;
    return known(code) ? t(code) : t('unknown');
  };
}
