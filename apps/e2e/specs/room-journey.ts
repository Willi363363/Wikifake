// The gestures a room journey is made of.
//
// Shared by the two-player run of 9.5 and the four-player one of 8.9, because
// two copies of "open a room, join it, vote, draw" is two places that stop
// agreeing about what the screens are called.
import { expect, type BrowserContext, type Page } from '@playwright/test';

/** A player with their own context, on the entry screen. */
export async function arrive(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto('/play');
  return page;
}

/**
 * Opens a room, and hands back its code.
 *
 * From the URL rather than from the heading: the entry screen has an `<h1>` too,
 * and reading it before the navigation lands reads "WikiFake".
 */
export async function host(page: Page, nickname: string): Promise<string> {
  await page.getByRole('tab', { name: 'Host' }).click();
  await page.getByLabel('Nickname').fill(nickname);
  await page.getByRole('button', { name: 'Open a room' }).click();

  await page.waitForURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 20_000 });
  const code = page.url().split('/').pop() ?? '';
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  return code;
}

export async function join(page: Page, code: string, nickname: string): Promise<void> {
  await page.getByRole('tab', { name: 'Join' }).click();
  await page.getByLabel('Room code').fill(code);
  await page.getByLabel('Nickname').fill(nickname);
  await page.getByRole('button', { name: 'Join' }).click();
  await page.waitForURL(new RegExp(`/room/${code}$`), { timeout: 20_000 });
}

/** Every screen agrees on how many are here. The roster is the server's. */
export async function everyoneSees(pages: readonly Page[], count: number): Promise<void> {
  for (const page of pages) {
    await expect(page.getByText(`Players (${String(count)})`)).toBeVisible({
      timeout: 30_000,
    });
  }
}

/**
 * From the lobby into a round: start, vote, draw.
 *
 * Starting opens the topic vote — the round's subject is the room's decision,
 * not the host's — and the host draws rather than waiting the timer out, because
 * this journey is meant to be short and who may draw is the interesting part.
 */
export async function playARound(hostPage: Page, others: readonly Page[]): Promise<void> {
  const everyone = [hostPage, ...others];

  await hostPage.getByRole('button', { name: /^Start/ }).click();
  for (const page of everyone) {
    await expect(page.getByRole('heading', { name: 'Pick a topic' })).toBeVisible({
      timeout: 30_000,
    });
  }

  // One ballot is enough for the host to be offered the draw, and it is the one
  // that proves a guest's vote reaches the room.
  const voter = others[0] ?? hostPage;
  await voter.getByLabel('Your topic').fill('Chat');
  await voter.getByRole('button', { name: 'Propose it' }).click();
  await expect(voter.getByText('your ballot is in')).toBeVisible({ timeout: 20_000 });

  // C1.7 — only the host may draw, and the guests are not offered the control.
  for (const page of others) {
    await expect(page.getByRole('button', { name: 'Draw now' })).toHaveCount(0);
  }
  await hostPage.getByRole('button', { name: 'Draw now' }).click();

  for (const page of everyone) {
    await expect(page.getByRole('article')).toBeVisible({ timeout: 60_000 });
  }
}
