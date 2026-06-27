const { test, expect } = require('@playwright/test');

test.describe('Create Task Screen', () => {
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

  test('should render Create Task form and input fields', async ({ page }) => {
    await page.goto('http://localhost:8081/create-task');
    
    // Verify main header
    await expect(page.getByText('Create New Task')).toBeVisible();
    
    // Fill out form fields
    const titleInput = page.getByPlaceholder('e.g. Pick up medicines');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Give evening medication');

    const descInput = page.getByPlaceholder('Additional details...');
    await expect(descInput).toBeVisible();
    await descInput.fill('Make sure to give after dinner');

    const catInput = page.getByPlaceholder('e.g. Medical, Groceries');
    await expect(catInput).toBeVisible();
    await catInput.fill('Medical');

    const dueDateInput = page.getByPlaceholder('e.g. Today, 5 PM');
    await expect(dueDateInput).toBeVisible();
    await dueDateInput.fill('Tonight 8 PM');
    
    // Verify post button is present
    await expect(page.getByText('Post Task')).toBeVisible();
  });
});
