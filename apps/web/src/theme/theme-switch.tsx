'use client';

// The switch — step L.9, beside the language one and for the same reason.
//
// A client component for one thing only: `usePathname`, so the form knows where
// to send the reader back to. Next renders that on the server too, so the value
// is in the first byte of HTML and **nothing here needs JavaScript to work** —
// it is a form, three submit buttons, and a 303.
//
// Three buttons rather than a `<select>`: a select needs a change handler to
// submit, which is the JavaScript this avoids, and three words take less room
// than a control with a label beside it.
//
// The chosen one is `aria-current`, not `disabled`. A disabled control is one a
// keyboard skips, and "which one am I on" is exactly what somebody tabbing
// through wants to hear.
import { cn } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

import { THEMES, type Theme } from './choice.js';

export interface ThemeSwitchProps {
  /** What the cookie says, read on the server by the layout. */
  readonly theme: Theme;
}

export function ThemeSwitch({ theme }: ThemeSwitchProps) {
  const t = useTranslations('theme');
  // `next/navigation`, so the path keeps its locale prefix: the reader goes back
  // to the page they were on rather than to whatever the proxy would have
  // resolved an unprefixed path to.
  const pathname = usePathname();

  return (
    <form
      method="post"
      action="/api/theme"
      aria-label={t('label')}
      className="flex items-center gap-3 text-xs"
    >
      <input type="hidden" name="next" value={pathname} />
      {THEMES.map((candidate) => (
        <button
          key={candidate}
          type="submit"
          name="theme"
          value={candidate}
          aria-current={candidate === theme ? 'true' : undefined}
          className={cn(
            'rounded-sm outline-none',
            'focus-visible:ring-[3px] focus-visible:ring-accent-line focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            candidate === theme
              ? 'font-semibold text-ink'
              : 'text-muted underline-offset-4 hover:underline',
          )}
        >
          {t(`names.${candidate}`)}
        </button>
      ))}
    </form>
  );
}
