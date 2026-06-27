const { test, expect } = require('@playwright/test');

test.describe('Expenses Flow', () => {
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
    await page.goto('/expenses');
  });

  test('should render Expenses screen and open Edit Budget modal', async ({ page }) => {
    // Verify main header is visible
    const mainHeader = page.getByText('Expenses', { exact: true });
    await expect(mainHeader).toBeVisible();

    // Click Edit Budget button
    const editBudgetBtn = page.getByText('Edit Budget');
    await editBudgetBtn.click();

    // Verify modal title is visible
    const modalTitle = page.getByText('Edit Monthly Budget');
    await expect(modalTitle).toBeVisible();

    // Verify budget input is visible
    const budgetInput = page.getByPlaceholder('Enter monthly limit (e.g. 5000)');
    await expect(budgetInput).toBeVisible();
  });
});
