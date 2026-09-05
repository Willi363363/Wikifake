'use client';

// A client component, every one of them.
//
// Radix reads the DOM — focus, keyboard, portals — and Next needs to be told
// before it tries to render one on the server. Marked on all of them rather
// than only the ones that need it today: a primitive that grows a handler and
// forgets the directive fails at build time in the application, a long way from
// here.

// The modal, and the reason this step is not decoration.
//
// The current game has several: the item target picker, the flag report, the
// settings sheet. All of them are a fixed `<div>` over an overlay `<div>`.
// Nothing traps focus, so tab walks out of the modal and into the page behind
// it; Escape does nothing; the overlay is a click target with no role; and a
// screen reader is told nothing has happened at all.
//
// Radix answers all four, and none of them are things worth writing again.
import {
  Close,
  Content,
  Description,
  Overlay,
  Portal,
  Root,
  Title,
  Trigger,
} from '@radix-ui/react-dialog';
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '../cn.js';

export const Dialog = Root;
export const DialogTrigger = Trigger;
export const DialogClose = Close;

export type DialogContentProps = ComponentPropsWithoutRef<typeof Content>;

/**
 * The sheet, with its overlay and its dismiss.
 *
 * `Title` is not optional and is not decoration: Radix warns without one because
 * a dialog nobody can name is a dialog a screen reader announces as an empty
 * region. A caller that wants no visible title hides it rather than omitting it.
 */
export function DialogContent({ className, children, ...props }: DialogContentProps) {
  return (
    <Portal>
      <Overlay
        className={cn(
          // Opaque enough to separate, with no blur: the direction has no haze,
          // and a blurred scrim is the most expensive way to draw one.
          'fixed inset-0 z-50 bg-ink/70',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
        )}
      />
      <Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md',
          '-translate-x-1/2 -translate-y-1/2',
          'rounded-none border-3 border-line-strong bg-surface p-6 shadow-lg',
          'outline-none focus-visible:ring-[3px] focus-visible:ring-accent-line',
          className,
        )}
        {...props}
      >
        {children}
        <Close
          aria-label="Close"
          className={cn(
            'absolute top-4 right-4 rounded-none p-1 text-muted transition-colors',
            'motion-reduce:transition-none hover:bg-bg-grain hover:text-ink',
            'outline-none focus-visible:ring-[3px] focus-visible:ring-accent-line',
          )}
        >
          {/* Drawn rather than imported: one glyph is not worth an icon
              dependency, and `aria-label` above is what names the control. */}
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden focusable="false">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </Close>
      </Content>
    </Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Title>) {
  return <Title className={cn('text-base font-medium text-ink', className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Description>) {
  return <Description className={cn('mt-1 text-sm text-muted', className)} {...props} />;
}
