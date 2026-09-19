import { test, expect } from '@playwright/test';

test.describe('File Lifecycle & Navigation E2E Flow', () => {
  test('landing page renders and navigates to app', async ({ page }) => {
    await page.goto('/');

    // Verify landing page branding and features
    await expect(page.getByText('AES-256 Encryption', { exact: false }).first()).toBeVisible();
    const startSealingBtn = page.getByRole('button', { name: /Start Sealing/i }).first();
    await expect(startSealingBtn).toBeVisible();

    // Navigate to /app via Start Sealing CTA
    await startSealingBtn.click();
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByText(/Drop file or click to browse/i)).toBeVisible();
  });

  test('app page allows toggling between create and decrypt modes', async ({ page }) => {
    await page.goto('/app');

    // Verify upload drop zone in Create mode
    await expect(page.getByText(/Drop file or click to browse/i)).toBeVisible();

    // Click Decrypt toggle in navbar
    const decryptToggle = page.getByRole('button', { name: /Decrypt/i });
    await expect(decryptToggle).toBeVisible();
    await decryptToggle.click();

    // Verify Decrypt mode is active
    await expect(page.getByText(/Decrypt \.BAR File/i)).toBeVisible();
    await expect(page.getByText(/Click to select \.bar file/i)).toBeVisible();

    // Toggle back to Create mode
    const backBtn = page.getByRole('button', { name: /Back to Create|Create/i }).first();
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // Verify back in Create mode
    await expect(page.getByText(/Drop file or click to browse/i)).toBeVisible();
  });
});
