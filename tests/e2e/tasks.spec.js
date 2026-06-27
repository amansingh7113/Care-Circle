const { test, expect } = require('@playwright/test');

test.describe('Task Board Flow', () => {
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
    await page.goto('/tasks');
  });

  test('should render Task Board dashboard and toggle tabs', async ({ page }) => {
    // Verify main header is visible
    const mainHeader = page.getByText('Task Board');
    await expect(mainHeader).toBeVisible();

    // Verify Pending tab active and empty state
    const pendingEmpty = page.getByText('No pending tasks');
    await expect(pendingEmpty).toBeVisible();

    // Click Completed tab
    const completedTab = page.getByText('Completed', { exact: true });
    await completedTab.click();

    // Verify Completed empty state
    const completedEmpty = page.getByText('No completed tasks');
    await expect(completedEmpty).toBeVisible();
  });
});
