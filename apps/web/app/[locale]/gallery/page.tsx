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
import {
  Badge,
  Button,
  COLOUR_TOKENS,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Progress,
  RADIUS_TOKENS,
  Separator,
  SHADOW_TOKENS,
} from '@wikifake/ui';
import type { ColourToken, TokenGroup } from '@wikifake/ui';

import { ContrastAudit } from './contrast.js';
import { MotionGallery } from './motion.js';
import { TokenGallery } from './token.js';

const GROUPS: readonly { readonly id: TokenGroup; readonly title: string }[] = [
  { id: 'surface', title: 'Surfaces' },
  { id: 'text', title: 'Text' },
  { id: 'fill', title: 'Fills — the same in both palettes' },
  { id: 'wash', title: 'Washes — a tint of the ground' },
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

/**
 * Every primitive the package exports, once.
 *
 * Rendered twice by the page — the second inside `.dark` — because "dressed by
 * the theme" is a claim about both palettes, and a component that hard-codes a
 * colour looks perfectly fine until it is put on the other ground.
 */
function Primitives() {
  return (
    <div className="flex-1 space-y-8 rounded-xl border border-line bg-bg p-6 text-ink">
      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-widest text-muted uppercase">
          Button
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" size="lg">
            Large
          </Button>
          <Button size="icon" aria-label="Close">
            ×
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-widest text-muted uppercase">
          Badge
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>neutral</Badge>
          <Badge tone="accent">accent</Badge>
          <Badge tone="bronze">hint · 50</Badge>
          <Badge tone="green">found</Badge>
          <Badge tone="warn">missed</Badge>
          <Badge tone="danger">wrong</Badge>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-widest text-muted uppercase">
          Input and Label
        </h3>
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="gallery-topic">Topic</Label>
          <Input id="gallery-topic" placeholder="Chat" />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-widest text-muted uppercase">
          Progress
        </h3>
        <Progress value={72} max={120} aria-label="Time left" />
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-widest text-muted uppercase">
          Separator
        </h3>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>solo</span>
          <Separator orientation="vertical" />
          <span>multiplayer</span>
        </div>
        <Separator className="mt-3" />
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold tracking-widest text-muted uppercase">
          Dialog
        </h3>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost">Report an error</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Report an error</DialogTitle>
            <DialogDescription>
              Escape closes this, tab stays inside it, and the dismiss has a name.
            </DialogDescription>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="gallery-report">What is wrong</Label>
              <Input id="gallery-report" />
            </div>
            <div className="mt-4 flex justify-end">
              {/* The dismiss a caller writes, as opposed to the one the sheet
                  draws in its corner. */}
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </section>
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

      <h2 className="mt-12 text-lg font-medium text-ink">Contrast</h2>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Measured from what the browser painted, in both palettes. The three pairs below
        3:1 in the light column are the current game&rsquo;s colours, transcribed — see
        step 6.6.
      </p>
      <div className="mt-4 flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <ContrastAudit />
        </div>
        <div className="dark flex-1">
          <ContrastAudit />
        </div>
      </div>

      <h2 className="mt-12 text-lg font-medium text-ink">Paragraph token</h2>
      <div className="mt-4 flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <TokenGallery />
        </div>
        <div className="dark flex-1">
          <TokenGallery />
        </div>
      </div>

      <h2 className="mt-12 text-lg font-medium text-ink">Motion</h2>
      <div className="mt-4">
        <MotionGallery />
      </div>

      <h2 className="mt-12 text-lg font-medium text-ink">Primitives</h2>
      <div className="mt-4 flex flex-col gap-6 lg:flex-row">
        <Primitives />
        <div className="dark flex-1">
          <Primitives />
        </div>
      </div>
    </main>
  );
}
