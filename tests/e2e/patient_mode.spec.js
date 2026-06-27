const { test, expect } = require('@playwright/test');

test.describe('Patient Mode Role Logic', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('userToken', 'mock-jwt-token-for-e2e-testing');
      window.localStorage.setItem('care-circle-storage', JSON.stringify({
        state: {
          userSession: 'mock-jwt-token-for-e2e-testing',
          user: { role: 'Patient', userId: 'mock-id', name: 'Aman Singh', circle_id: 'mock-circle-id' },
          currentCircle: { id: 'mock-circle-id', name: 'Family Circle' }
        },
        version: 0
      }));
    });
  });

  test('should render Patient Mode dashboard screen with simplified interface', async ({ page }) => {
    await page.goto('http://localhost:8081/dashboard');
    
    // Verify emergency SOS button is visible
    await expect(page.getByText('EMERGENCY SOS')).toBeVisible();
    
    // Verify greeting and daily water section
    await expect(page.getByText('Hi, Aman')).toBeVisible();
    await expect(page.getByText('Daily Water')).toBeVisible();
    await expect(page.getByText('Diet')).toBeVisible();
    
    // Verify medicines section title
    await expect(page.getByText('Your Medicines for Today')).toBeVisible();
  });
});
