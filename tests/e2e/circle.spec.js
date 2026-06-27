const { test, expect } = require('@playwright/test');

test.describe('Circle Management Flow', () => {
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
    await page.goto('/join');
  });

  test('should display Circle Selection screen and toggle between Join and Create modes', async ({ page }) => {
    // Wait for the main card title to appear
    const joinTitle = page.getByText('JOIN YOUR CARE CIRCLE');
    await expect(joinTitle).toBeVisible();

    // Verify invite code input is visible
    const inviteInput = page.getByPlaceholder('Enter Invite Code');
    await expect(inviteInput).toBeVisible();

    // Switch to Create Circle mode
    const switchButton = page.getByText('Create a new Care Circle');
    await switchButton.click();

    // Verify UI updates to Create mode
    const createTitle = page.getByText('CREATE A CARE CIRCLE');
    await expect(createTitle).toBeVisible();

    const nameInput = page.getByPlaceholder('New Circle Name');
    await expect(nameInput).toBeVisible();

    // Switch back to Join mode
    const switchBack = page.getByText('Join an existing Circle');
    await switchBack.click();
    await expect(page.getByText('JOIN YOUR CARE CIRCLE')).toBeVisible();
  });

  test('should handle validation on empty submit', async ({ page }) => {
    // Click Join Circle without entering code
    await page.getByText('Join Circle', { exact: true }).click();

    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Please enter a invite code');
      dialog.accept();
    });
  });
});
