const { test, expect } = require('@playwright/test');

test.describe('Dashboard View Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER CONSOLE (${msg.type()}):`, msg.text()));
    page.on('pageerror', error => console.log('BROWSER ERROR:', error.message, error.stack));
    // Inject mock userToken into localStorage to bypass AuthNavigator and access AppNavigator
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
    await page.goto('/dashboard');
  });

  test('should render main dashboard hero sections and emergency SOS banner', async ({ page }) => {
    // Verify Emergency SOS section is visible
    const sosBanner = page.getByText('🚨 EMERGENCY SOS');
    await expect(sosBanner).toBeVisible();

    const sosSubtitle = page.getByText('Hold for 3 seconds to alert Care Circle');
    await expect(sosSubtitle).toBeVisible();

    // Verify Tasks Completed progress ring label is visible
    const progressLabel = page.getByText('TASKS COMPLETED');
    await expect(progressLabel).toBeVisible();
  });
});
