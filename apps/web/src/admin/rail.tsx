'use client';

// The rail — step K.1.
//
// Each group is its own bordered block, which is the shape the owner chose out
// of four: the direction already draws a container with a 3px border, so a
// group can be one instead of a label above nothing.
//
// **Narrow is CSS, not state.** Below `lg` the rail is a drawer and the
// stylesheet says so, because a panel that needs JavaScript to be readable is
// unreadable exactly when JavaScript is what broke.
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Link, usePathname } from '../i18n/navigation.js';
import { SectionGlyph } from './section-icon.js';
import { GROUPS, type Group, type Section } from './sections.js';

const ENTRY =
  'flex min-h-11 w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors';
// L.7 repainted these and moved none of them. The idle entry carried a
// transparent 3px border so that hovering did not reflow the rail by three
// pixels; with no border on either state there is nothing to reserve room for.
const ACTIVE = 'rounded-lg bg-accent font-bold text-on-fill';
const IDLE = 'rounded-lg font-medium text-ink-2 hover:bg-bg-grain hover:text-ink';
const HEADING = 'px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-muted uppercase';

function Entries({
  group,
  here,
  onFollow,
}: {
  readonly group: Group;
  readonly here: string;
  readonly onFollow: () => void;
}) {
  const t = useTranslations('admin');
  return (
    <ul className="flex list-none flex-col gap-1.5 p-0">
      {group.sections.map((section: Section) => {
        const active = section.route === here;
        return (
          <li key={section.route}>
            <Link
              href={section.route}
              aria-current={active ? 'page' : undefined}
              onClick={onFollow}
              className={`${ENTRY} ${active ? ACTIVE : IDLE}`}
            >
              <SectionGlyph name={section.icon} />
              <span className="min-w-0 flex-1 truncate">{t(section.key)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Nav({
  here,
  onFollow,
}: {
  readonly here: string;
  readonly onFollow: () => void;
}) {
  const t = useTranslations('admin');
  return (
    <nav
      aria-label={t('nav.label')}
      className="flex h-full flex-col border-r border-line-strong bg-surface"
    >
      <div className="flex flex-col gap-1 border-b border-line-strong px-4 py-4">
        <span className="font-mono text-base font-bold tracking-[0.06em] text-ink">
          WIKIFAKE
        </span>
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
          {t('title')}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
        {GROUPS.map((group) =>
          group.key === null ? (
            <Entries key="top" group={group} here={here} onFollow={onFollow} />
          ) : (
            <div key={group.key} className="rounded-lg border border-line bg-bg">
              <span className={`${HEADING} block border-b border-line`}>
                {t(group.key)}
              </span>
              <div className="p-1.5">
                <Entries group={group} here={here} onFollow={onFollow} />
              </div>
            </div>
          ),
        )}
      </div>

      <p className="m-0 border-t border-line-strong px-4 py-3 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        {t('nav.readOnly')}
      </p>
    </nav>
  );
}

/** The rail beside the page, on a screen wide enough to hold both. */
export function Rail() {
  const here = usePathname();
  return (
    <div className="hidden shrink-0 lg:block lg:w-62">
      <Nav
        here={here}
        onFollow={() => {
          // Nothing to close: the rail is always open at this width.
        }}
      />
    </div>
  );
}

/** The same rail, as a drawer, on a screen that has room for one thing. */
export function RailDrawer() {
  const t = useTranslations('admin');
  const here = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-on-fill lg:hidden"
      >
        <SectionGlyph name="grid" size={18} />
        <span className="sr-only">{t('nav.label')}</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button
            type="button"
            aria-label={t('nav.close')}
            onClick={() => {
              setOpen(false);
            }}
            className="absolute inset-0 border-0 bg-ink/60"
          />
          <div className="relative w-72 max-w-[85%]">
            <Nav
              here={here}
              onFollow={() => {
                setOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
