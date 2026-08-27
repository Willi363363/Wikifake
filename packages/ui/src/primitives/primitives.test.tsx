// What the primitives are for.
//
// Not "does it render" — that proves nothing anybody cares about. Every
// assertion below is one of the four things the current interface gets wrong:
// a control that cannot be reached by tab, a control that does nothing on the
// keyboard, a field with no name, and a modal that lets focus walk out of it
// into the page behind.
//
// So the tests drive the components the way a player without a mouse would, and
// read the accessibility tree rather than the class names. A test asserting
// `class="rounded-full"` would pass on a `<span>`.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Badge } from './badge.js';
import { Button } from './button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './dialog.js';
import { Input } from './input.js';
import { Label } from './label.js';
import { Progress } from './progress.js';
import { Separator } from './separator.js';

afterEach(cleanup);

describe('6.2 — the primitives', () => {
  describe('Button', () => {
    it('is a button, which is what makes the rest true', () => {
      render(<Button>Start</Button>);
      expect(screen.getByRole('button', { name: 'Start' }).tagName).toBe('BUTTON');
    });

    // The legacy `<span onClick>` does none of these three.
    it('is reachable by tab', async () => {
      const user = userEvent.setup();
      render(<Button>Start</Button>);

      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('button'));
    });

    it.each(['{Enter}', ' '])('is activated by %s', async (key) => {
      const user = userEvent.setup();
      const pressed = vi.fn();
      render(<Button onClick={pressed}>Start</Button>);

      await user.tab();
      await user.keyboard(key);
      expect(pressed).toHaveBeenCalledTimes(1);
    });

    it('shows a focus ring rather than removing the outline', () => {
      render(<Button>Start</Button>);
      const classes = screen.getByRole('button').className;
      // `outline-none` with nothing in its place is the single most common way a
      // design system becomes unusable by keyboard.
      expect(classes).toContain('outline-none');
      expect(classes).toContain('focus-visible:ring-2');
    });

    it('does not submit the form it happens to be inside', () => {
      render(
        <form>
          <Button>Start</Button>
        </form>,
      );
      expect(screen.getByRole('button')).toHaveProperty('type', 'button');
    });

    it('says so, and stops responding, when disabled', async () => {
      const user = userEvent.setup();
      const pressed = vi.fn();
      render(
        <Button disabled onClick={pressed}>
          Start
        </Button>,
      );

      await user.click(screen.getByRole('button'));
      expect(pressed).not.toHaveBeenCalled();
      expect(screen.getByRole('button')).toHaveProperty('disabled', true);
    });

    it.each(['default', 'primary', 'ghost', 'danger'] as const)(
      'dresses the %s variant from the theme',
      (variant) => {
        render(<Button variant={variant}>Start</Button>);
        // Theme tokens, not raw colours: a hex here is a colour outside the
        // palette and outside dark mode.
        expect(screen.getByRole('button').className).not.toMatch(/#[0-9a-f]{3,6}/i);
      },
    );
  });

  describe('Input and Label', () => {
    // The current interface has no labels at all: a placeholder stands in for
    // one, and it disappears the moment anything is typed.
    it('names the field it points at', () => {
      render(
        <>
          <Label htmlFor="topic">Topic</Label>
          <Input id="topic" />
        </>,
      );
      expect(screen.getByLabelText('Topic')).toBe(screen.getByRole('textbox'));
    });

    it('focuses the field when its label is clicked', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Label htmlFor="topic">Topic</Label>
          <Input id="topic" />
        </>,
      );

      await user.click(screen.getByText('Topic'));
      expect(document.activeElement).toBe(screen.getByRole('textbox'));
    });

    it('takes what is typed into it', async () => {
      const user = userEvent.setup();
      render(<Input aria-label="Topic" />);

      await user.type(screen.getByRole('textbox'), 'Chat');
      expect(screen.getByRole('textbox')).toHaveProperty('value', 'Chat');
    });
  });

  describe('Progress', () => {
    // Two nested divs tell a sighted player that time is running out and tell
    // nobody else anything.
    it('announces where it is', () => {
      render(<Progress value={40} max={120} aria-label="Time left" />);
      const bar = screen.getByRole('progressbar', { name: 'Time left' });
      expect(bar.getAttribute('aria-valuenow')).toBe('40');
      expect(bar.getAttribute('aria-valuemax')).toBe('120');
    });

    it('clamps a value outside its range instead of overflowing', () => {
      render(<Progress value={500} max={120} aria-label="Time left" />);
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('120');
    });
  });

  describe('Separator', () => {
    it('is decorative unless it is told otherwise', () => {
      const { rerender } = render(<Separator />);
      expect(screen.queryByRole('separator')).toBeNull();

      rerender(<Separator decorative={false} />);
      expect(screen.getByRole('separator')).not.toBeNull();
    });
  });

  describe('Badge', () => {
    it.each(['neutral', 'accent', 'bronze', 'green', 'warn', 'danger'] as const)(
      'dresses the %s tone from the theme',
      (tone) => {
        render(<Badge tone={tone}>hint</Badge>);
        expect(screen.getByText('hint').className).not.toMatch(/#[0-9a-f]{3,6}/i);
      },
    );
  });

  describe('Dialog', () => {
    const open = async (): Promise<ReturnType<typeof userEvent.setup>> => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Report</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Report an error</DialogTitle>
            <DialogDescription>Tell us what is wrong.</DialogDescription>
            <Input aria-label="What is wrong" />
          </DialogContent>
        </Dialog>,
      );
      await user.click(screen.getByRole('button', { name: 'Report' }));
      await screen.findByRole('dialog');
      return user;
    };

    it('is announced as a dialog, with a name', async () => {
      await open();
      expect(screen.getByRole('dialog', { name: 'Report an error' })).not.toBeNull();
    });

    // The four things the current modals get wrong. This is the first.
    it('closes on Escape', async () => {
      const user = await open();
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });

    it('keeps focus inside it', async () => {
      const user = await open();
      const dialog = screen.getByRole('dialog');

      // All the way round the sheet and past its end: focus must come back to
      // the sheet rather than land on the page behind it.
      for (let step = 0; step < 6; step += 1) {
        await user.tab();
        expect(dialog.contains(document.activeElement)).toBe(true);
      }
    });

    it('gives its dismiss a name, since it is drawn rather than written', async () => {
      await open();
      expect(screen.getByRole('button', { name: 'Close' })).not.toBeNull();
    });

    it('closes when its dismiss is pressed by keyboard', async () => {
      const user = await open();
      screen.getByRole('button', { name: 'Close' }).focus();
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });
  });
});
