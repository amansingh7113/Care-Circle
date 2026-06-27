const { test, expect } = require('@playwright/test');

test.describe('Vitals, Sleep, Steps and Notifications Screens', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('userToken', 'mock-jwt-token-for-e2e-testing');
      window.localStorage.setItem('care-circle-storage', JSON.stringify({
        state: {
          userSession: 'mock-jwt-token-for-e2e-testing',
          user: { role: 'Caregiver', userId: 'mock-id', name: 'Caregiver One', circle_id: 'mock-circle-id' },
          currentCircle: { id: 'mock-circle-id', name: 'Family Circle' }
        },
        version: 0
      }));
    });
  });

  test('should render Blood Pressure History screen and open Log modal', async ({ page }) => {
    await page.goto('http://localhost:8081/bp-history');
    await expect(page.getByText('Blood Pressure History', { exact: true })).toBeVisible();
    await expect(page.getByText('No records yet')).toBeVisible();

    // Click add button to open modal
    await page.getByTestId('add-bp-button').click();
    await expect(page.getByText('Log Blood Pressure', { exact: true })).toBeVisible();
    await expect(page.getByText('Systolic (SYS)')).toBeVisible();
    await expect(page.getByText('Diastolic (DIA)')).toBeVisible();
  });

  test('should render Sleep History screen and empty state', async ({ page }) => {
    await page.goto('http://localhost:8081/sleep-details');
    await expect(page.getByText('Sleep History', { exact: true })).toBeVisible();
    await expect(page.getByText('No sleep data')).toBeVisible();
  });

  test('should render Step History screen and period toggles', async ({ page }) => {
    await page.goto('http://localhost:8081/step-history');
    await expect(page.getByText('Step History', { exact: true })).toBeVisible();
    await expect(page.getByText('7 Days', { exact: true })).toBeVisible();
    await expect(page.getByText('30 Days', { exact: true })).toBeVisible();
    await expect(page.getByText('No step data')).toBeVisible();
  });

  test('should render Notifications screen and empty state', async ({ page }) => {
    await page.goto('http://localhost:8081/notifications');
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible();
    await expect(page.getByText('No Notifications', { exact: true })).toBeVisible();
  });
});
