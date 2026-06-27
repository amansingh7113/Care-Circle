const { test, expect } = require('@playwright/test');

test.describe('Doctor Visits Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER CONSOLE (${msg.type()}):`, msg.text()));
    page.on('pageerror', error => console.log('BROWSER ERROR:', error.message, error.stack));
    await page.addInitScript(() => {
      window.localStorage.setItem('userToken', 'mock-jwt-token-for-e2e-testing');
      window.localStorage.setItem('care-circle-storage', JSON.stringify({
        state: {
          userSession: 'mock-jwt-token-for-e2e-testing',
          user: { role: 'Caregiver', userId: 'mock-id', circle_id: 'mock-circle-id' },
          currentCircle: { id: 'mock-circle-id', name: 'Family Circle' }
        },
        version: 0
      }));
    });
    await page.goto('/doctor');
  });

  test('should render Doctor Visits screen and open Add Visit modal', async ({ page }) => {
    // Verify main header is visible
    const mainHeader = page.getByText('Doctor Visits');
    await expect(mainHeader).toBeVisible();

    // Verify empty state is visible
    const emptyState = page.getByText('No visit logs found.');
    await expect(emptyState).toBeVisible();

    // Click Add button (+)
    const addBtn = page.getByText('+', { exact: true });
    await addBtn.click();

    // Verify modal title is visible
    const modalTitle = page.getByText('Add Visit Log');
    await expect(modalTitle).toBeVisible();

    // Verify Doctor Name input is visible
    const doctorInput = page.getByPlaceholder('Doctor Name');
    await expect(doctorInput).toBeVisible();
  });
});
