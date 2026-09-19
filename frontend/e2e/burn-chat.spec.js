import { test, expect } from '@playwright/test';

test.describe('Burn Chat End-to-End Flow', () => {
  test('renders burn chat landing page and creation form', async ({ page }) => {
    await page.goto('/burn-chat');

    // Verify title and heading
    await expect(page.getByText('End-to-End Encrypted', { exact: false })).toBeVisible();
    await expect(page.getByText('Auto-Destructs', { exact: false })).toBeVisible();
    await expect(page.getByText('Create a Burn Chat', { exact: false })).toBeVisible();

    // Verify duration selector buttons exist (e.g. 5m, 15m, 1h, 24h)
    await expect(page.getByRole('button', { name: /15m/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Burn Chat/i })).toBeVisible();
  });

  test('multi-browser context: creator and participant interaction', async ({ browser }) => {
    // Context 1: Creator
    const creatorContext = await browser.newContext();
    const creatorPage = await creatorContext.newPage();

    await creatorPage.goto('/chat');
    await expect(creatorPage.getByRole('button', { name: /Create Burn Chat/i })).toBeVisible();

    // Context 2: Participant (isolated session)
    const participantContext = await browser.newContext();
    const participantPage = await participantContext.newPage();

    await participantPage.goto('/chat');
    await expect(participantPage.getByRole('button', { name: /Create Burn Chat/i })).toBeVisible();

    await creatorContext.close();
    await participantContext.close();
  });
});
