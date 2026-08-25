// The document every page is rendered into.
//
// The first one: until now this application served routes and no pages at all.
// What it carries is deliberately minimal — the screens are phases 7 and 8, and
// a layout that started deciding navigation would be deciding them here.
//
// `lang="fr"` is C6.3, and it is not a placeholder waiting for phase 11: the
// article, the topics and the falsifications are French, so the document is
// French whatever the interface eventually says.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'WikiFake',
  description:
    'Un jeu de détection de désinformation : un article de Wikipédia, des erreurs glissées dedans, et vous.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-bg text-ink">{children}</body>
    </html>
  );
}
