const { test, expect } = require('@playwright/test');

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER CONSOLE (${msg.type()}):`, msg.text()));
    page.on('pageerror', error => console.log('BROWSER ERROR:', error.message, error.stack));
    await page.goto('/');
  });

  test('should display language selection modal and select English', async ({ page }) => {
    // Check if language modal appears
    const langModalTitle = page.getByText('Choose Language / भाषा चुनें');
    await expect(langModalTitle).toBeVisible();

    // Select English
    const englishOption = page.getByText('English', { exact: true });
    await englishOption.click();

    // Verify modal is dismissed and Welcome text is visible
    await expect(page.getByText('Welcome to CareCircle')).toBeVisible();
  });

  test('should switch between Phone and Email auth modes', async ({ page }) => {
    // Dismiss language modal if present
    if (await page.getByText('Choose Language / भाषा चुनें').isVisible()) {
      await page.getByText('English', { exact: true }).click();
    }

    // Default mode is Phone
    await expect(page.getByPlaceholder('Phone Number (e.g., +919876543210)')).toBeVisible();

    // Switch to Email mode
    await page.getByText('Continue with Email').click();
    await expect(page.getByPlaceholder('Email Address')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();

    // Switch back to Phone mode
    await page.getByText('Continue with Phone').click();
    await expect(page.getByPlaceholder('Phone Number (e.g., +919876543210)')).toBeVisible();
  });

  test('should show validation error on empty phone submit', async ({ page }) => {
    if (await page.getByText('Choose Language / भाषा चुनें').isVisible()) {
      await page.getByText('English', { exact: true }).click();
    }

    // Click Send Verification Code without entering phone
    await page.getByText('Send Verification Code').click();

    // Expect browser alert or visual error (React Native Alert on web uses window.alert/confirm or custom DOM)
    // Playwright auto-dismisses dialogs by default, so we can attach a dialog handler to verify
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Please enter a valid phone number');
      dialog.accept();
    });
  });
});
