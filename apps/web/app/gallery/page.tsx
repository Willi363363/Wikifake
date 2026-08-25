// The gallery: everything the design system exports, in both modes.
//
// Phase 6's deliverable, and it starts here with the palette. It is rendered
// from `@wikifake/ui`'s own lists rather than written out swatch by swatch — a
// gallery that has to be edited whenever a token is added is a gallery that
// stops being complete on the first token somebody forgets, and `theme.test.ts`
// holds those lists to the stylesheet.
//
// Both modes side by side, on one page. The dark half is the same markup inside
// `.dark`, which is what the theme's `@custom-variant` reads: what is being
// compared has to be the same components, not two descriptions of them.
import { COLOUR_TOKENS, RADIUS_TOKENS, SHADOW_TOKENS } from '@wikifake/ui';
import type { ColourToken, TokenGroup } from '@wikifake/ui';

const GROUPS: readonly { readonly id: TokenGroup; readonly title: string }[] = [
  { id: 'surface', title: 'Surfaces' },
  { id: 'text', title: 'Text' },
  { id: 'accent', title: 'Accents' },
];

function Swatch({ token }: { token: ColourToken }) {
  return (
    <li className="flex items-center gap-3">
      {/* Over a chequered ground, so a translucent token reads as translucent
          rather than as a slightly different flat colour. */}
      <span
        className="size-10 shrink-0 rounded-md border border-line-strong bg-[repeating-conic-gradient(var(--color-bg-grain)_0_25%,transparent_0_50%)] bg-[length:12px_12px]"
        aria-hidden
      >
        <span
          className="block size-full rounded-md"
          style={{ backgroundColor: `var(--color-${token.name})` }}
        />
      </span>
      <span className="min-w-0">
        <code className="block text-sm text-ink">{token.name}</code>
        <span className="block text-xs text-muted">{token.role}</span>
      </span>
    </li>
  );
}

function Palette() {
  return (
    <div className="flex-1 rounded-xl border border-line bg-bg p-6 text-ink">
      <div className="space-y-8">
        {GROUPS.map((group) => (
          <section key={group.id}>
            <h3 className="mb-3 text-xs font-semibold tracking-widest text-muted uppercase">
              {group.title}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {COLOUR_TOKENS.filter((token) => token.group === group.id).map((token) => (
                <Swatch key={token.name} token={token} />
              ))}
            </ul>
          </section>
        ))}

        <section>
          <h3 className="mb-3 text-xs font-semibold tracking-widest text-muted uppercase">
            Elevation
          </h3>
          <ul className="flex flex-wrap gap-4">
            {SHADOW_TOKENS.map((level) => (
              <li
                key={level}
                className="rounded-lg bg-surface px-5 py-4 text-sm text-ink-2"
                style={{ boxShadow: `var(--shadow-${level})` }}
              >
                shadow-{level}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold tracking-widest text-muted uppercase">
            Corners
          </h3>
          <ul className="flex flex-wrap gap-4">
            {RADIUS_TOKENS.map((size) => (
              <li
                key={size}
                className="border border-line-strong bg-surface px-5 py-4 text-sm text-ink-2"
                style={{ borderRadius: `var(--radius-${size})` }}
              >
                rounded-{size}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-ink">Design system</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        The tokens of the current game, transcribed. Light and dark are the same markup:
        the right-hand column is wrapped in <code>.dark</code>.
      </p>

      <h2 className="mt-10 text-lg font-medium text-ink">Palette</h2>
      <div className="mt-4 flex flex-col gap-6 lg:flex-row">
        <Palette />
        <div className="dark flex-1">
          <Palette />
        </div>
      </div>
    </main>
  );
}
