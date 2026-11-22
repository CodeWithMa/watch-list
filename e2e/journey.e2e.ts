import { expect, test } from '@playwright/test';

// The one browser test. Component and service behaviour is covered by the
// Vitest specs; this proves what they cannot: the production bundle boots under
// its Content-Security-Policy, real clicks reach the controls, and the
// collection persists in the browser's own IndexedDB.
test('add a series, watch an episode, and delete the series', async ({ page }) => {
  const title = 'Browser Journey Series';
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
  });

  const nav = page.getByRole('navigation');
  const card = page.getByRole('link', { name: title });

  await page.goto('/');
  await nav.getByRole('link', { name: 'Items' }).click();
  await expect(page.getByText('No items found')).toBeVisible();

  await page.getByRole('link', { name: 'Add Item' }).click();
  await page.getByLabel('Title *').fill(title);
  await page.getByRole('button', { name: 'Add Season' }).click();
  await page.getByLabel('Episodes', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Add Item' }).click();

  await expect(page).toHaveURL(/\/items$/);
  await expect(card.first()).toBeVisible();

  await page.reload();
  await expect(card.first()).toBeVisible();

  await card.first().click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('button', { name: 'Mark Watched' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'S1E1' })).toBeVisible();

  await nav.getByRole('link', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'Watch History' })).toBeVisible();
  await expect(page.getByText('S1E1')).toBeVisible();
  await page.getByRole('link', { name: title }).click();

  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Delete?' }).click();

  await expect(page).toHaveURL(/\/items$/);
  await expect(page.getByText('No items found')).toBeVisible();
  await nav.getByRole('link', { name: 'History' }).click();
  // History outlives its item by design.
  await expect(page.getByText(`${title} (deleted)`)).toBeVisible();

  expect(problems).toEqual([]);
});
