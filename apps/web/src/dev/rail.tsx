'use client';

// One rail, drawn four ways.
//
// The entries are the same in all four and so is their styling: what varies is
// only how the grouping is expressed, which is the single question left open.
// Each branch below is one answer to it.
import { RailIcon } from './rail-icon.js';
import { GROUPS, groupOf, type Group, type Item, type Model } from './rail-models.js';

const ENTRY =
  'flex min-h-11 w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors';
const ACTIVE = 'border-3 border-line-strong bg-accent font-bold text-on-fill shadow-sm';
const IDLE =
  'border-3 border-transparent font-medium text-ink-2 hover:border-line-strong hover:bg-bg-grain hover:text-ink';
const HEADING = 'px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-muted uppercase';

export interface RailProps {
  readonly model: Model;
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
}

function Entry({
  item,
  active,
  onSelect,
}: {
  readonly item: Item;
  readonly active: boolean;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={() => {
          onSelect(item.id);
        }}
        className={`${ENTRY} ${active ? ACTIVE : IDLE}`}
      >
        <RailIcon name={item.icon} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {/* The one thing an entry says about its own page: health is a live
            probe, so the rail can carry its answer without opening it. */}
        {item.id === 'health' ? (
          <span className="size-2.5 shrink-0 border-2 border-line-strong bg-green" />
        ) : null}
      </button>
    </li>
  );
}

function Entries({
  group,
  activeId,
  onSelect,
}: {
  readonly group: Group;
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <ul className="flex list-none flex-col gap-1.5 p-0">
      {group.items.map((item) => (
        <Entry
          key={item.id}
          item={item}
          active={item.id === activeId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

/** B — a heading over each run. */
function Headings({ activeId, onSelect }: Omit<RailProps, 'model'>) {
  return (
    <div className="flex flex-col gap-1.5 p-2.5">
      {GROUPS.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          {group.heading === null ? null : (
            <span className={HEADING}>{group.heading}</span>
          )}
          <Entries group={group} activeId={activeId} onSelect={onSelect} />
        </div>
      ))}
    </div>
  );
}

/** B1 — each group is its own bordered block, the way a card is. */
function Boxed({ activeId, onSelect }: Omit<RailProps, 'model'>) {
  return (
    <div className="flex flex-col gap-2.5 p-2.5">
      {GROUPS.map((group) =>
        group.heading === null ? (
          <Entries key={group.id} group={group} activeId={activeId} onSelect={onSelect} />
        ) : (
          <div key={group.id} className="border-3 border-line bg-bg">
            <span className={`${HEADING} block border-b-3 border-line`}>
              {group.heading}
            </span>
            <div className="p-1.5">
              <Entries group={group} activeId={activeId} onSelect={onSelect} />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

/** B2 — a rule between the runs, and not one word of category. */
function Dividers({ activeId, onSelect }: Omit<RailProps, 'model'>) {
  return (
    <div className="flex flex-col p-2.5">
      {GROUPS.map((group, at) => (
        <div
          key={group.id}
          className={
            at === 0
              ? 'pb-2.5'
              : 'border-t-3 border-line py-2.5 last:pb-0 last:border-b-0'
          }
        >
          <Entries group={group} activeId={activeId} onSelect={onSelect} />
        </div>
      ))}
    </div>
  );
}

/** B3 — the groups in one narrow column, their pages in the next. */
function TwoLevel({ activeId, onSelect }: Omit<RailProps, 'model'>) {
  const open = groupOf(activeId);
  return (
    <div className="flex h-full min-h-0">
      <ul
        className="flex list-none flex-col gap-1.5 border-r-3 border-line-strong p-2"
        aria-label="Groups"
      >
        {GROUPS.map((group) => {
          const here = group.id === open.id;
          return (
            <li key={group.id}>
              <button
                type="button"
                aria-current={here ? 'true' : undefined}
                aria-label={group.heading ?? 'Overview'}
                title={group.heading ?? 'Overview'}
                onClick={() => {
                  onSelect((group.items[0] as Item).id);
                }}
                className={`flex size-11 items-center justify-center ${
                  here ? ACTIVE : IDLE
                }`}
              >
                <RailIcon name={group.icon} size={20} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
        <span className={HEADING}>{open.heading ?? 'Overview'}</span>
        <Entries group={open} activeId={activeId} onSelect={onSelect} />
      </div>
    </div>
  );
}

export function Rail({ model, activeId, onSelect }: RailProps) {
  return (
    <nav
      aria-label="Admin sections"
      className="flex h-full flex-col border-r-3 border-line-strong bg-surface"
    >
      <div className="flex flex-col gap-1 border-b-3 border-line-strong px-4 py-4">
        <span className="font-mono text-base font-bold tracking-[0.06em] text-ink">
          WIKIFAKE
        </span>
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
          Administration
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {model.style === 'headings' ? (
          <Headings activeId={activeId} onSelect={onSelect} />
        ) : null}
        {model.style === 'boxed' ? (
          <Boxed activeId={activeId} onSelect={onSelect} />
        ) : null}
        {model.style === 'dividers' ? (
          <Dividers activeId={activeId} onSelect={onSelect} />
        ) : null}
        {model.style === 'two-level' ? (
          <TwoLevel activeId={activeId} onSelect={onSelect} />
        ) : null}
      </div>

      <p className="m-0 border-t-3 border-line-strong px-4 py-3 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        Read only
      </p>
    </nav>
  );
}
