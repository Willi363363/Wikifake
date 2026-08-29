// The page footer.
//
// The current one carries a brand mark, `Intelligence System · v2.0.1`, a
// session identifier and a green "Active" dot. Three of those four are fiction:
// the version is hard-coded, the dot is always green, and the session id is
// shown to a player who can do nothing with it. What is served is answerable at
// `/api/health`, which reports the actual commit.
//
// So what is left is what the footer is for: saying what this is.
import { useTranslations } from 'next-intl';

export function RoundFooter() {
  const t = useTranslations('round');

  return (
    <footer className="mt-10 border-t border-line pt-5 pb-8 text-center font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
      {t('footer.tagline')}
    </footer>
  );
}
