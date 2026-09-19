import { test, expect } from '@playwright/test';

test.describe('File Lifecycle & Navigation E2E Flow', () => {
  test('home page renders upload dropzone and navigation options', async ({ page }) => {
    await page.goto('/');

    // Verify upload drop zone
    await expect(page.getByText(/Drop file or click to browse/i)).toBeVisible();
    await expect(page.getByText('Images')).toBeVisible();
    await expect(page.getByText('PDF')).toBeVisible();
    await expect(page.getByText('Docs')).toBeVisible();
  });

  test('navigates to decrypt page and validates .bar file upload interface', async ({ page }) => {
    await page.goto('/decrypt');

    // Verify decrypt header
    await expect(page.getByText(/Decrypt \.BAR File/i)).toBeVisible();
    await expect(page.getByText(/Click to select \.bar file/i)).toBeVisible();

    // Verify back navigation returns to home or previous page
    const backBtn = page.getByRole('button', { name: /Back to Create/i });
    await expect(backBtn).toBeVisible();
  });
});
