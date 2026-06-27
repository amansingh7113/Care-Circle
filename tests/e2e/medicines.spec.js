const { test, expect } = require('@playwright/test');

test.describe('Medicine Tracker Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER CONSOLE (${msg.type()}):`, msg.text()));
    page.on('pageerror', error => console.log('BROWSER ERROR:', error.message, error.stack));
    await page.addInitScript(() => {
      window.localStorage.setItem('userToken', 'mock-jwt-token-for-e2e-testing');
      window.localStorage.setItem('care-circle-storage', JSON.stringify({
        state: {
          userSession: 'mock-jwt-token-for-e2e-testing',
          user: { role: 'Caregiver', userId: 'mock-id' }
        },
        version: 0
      }));
    });
    await page.goto('/medicines');
  });

  test('should render Medicine Tracker dashboard and empty state', async ({ page }) => {
    // Verify main header is visible
    const mainHeader = page.getByText('MEDICINE TRACKER');
    await expect(mainHeader).toBeVisible();

    // Verify empty state or medicine list is visible
    const emptyState = page.getByText('No Medicines Today');
    await expect(emptyState).toBeVisible();

    const emptySubtitle = page.getByText('You have no scheduled medicines for today.');
    await expect(emptySubtitle).toBeVisible();
  });
});
