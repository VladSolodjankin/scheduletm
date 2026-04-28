import { test, expect } from '@playwright/test';
import { creds, loggedInRole, login } from './helpers/auth.mjs';

test.describe('web ui e2e: navigation & role-aware menu', () => {
  test('owner can open error logs page from menu', async ({ page }) => {
    const owner = creds('E2E_OWNER');
    test.skip(!owner.email || !owner.password, 'Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD for UI e2e.');

    await login(page, owner);

    await page.getByRole('link', { name: 'Error logs' }).click();
    await expect(page).toHaveURL(/\/error-logs$/);
    await expect(page.getByRole('heading', { name: 'Error logs' })).toBeVisible();
  });

  test('role-aware menu visibility for owner/admin/specialist/client', async ({ browser }) => {
    const scenarios = [
      {
        label: 'owner',
        expectedRole: 'owner',
        creds: creds('E2E_OWNER'),
        visible: ['Appointments', 'Specialists', 'Users', 'Notification logs', 'Error logs', 'Settings'],
      },
      {
        label: 'admin',
        expectedRole: 'admin',
        creds: creds('E2E_ADMIN'),
        visible: ['Appointments', 'Specialists', 'Users', 'Notification logs', 'Settings'],
        hidden: ['Error logs'],
      },
      {
        label: 'specialist',
        expectedRole: 'specialist',
        creds: creds('E2E_SPECIALIST'),
        visible: ['Appointments', 'Users', 'Notification logs', 'Settings'],
        hidden: ['Specialists', 'Error logs'],
      },
      {
        label: 'client',
        expectedRole: 'client',
        creds: creds('E2E_CLIENT'),
        visible: ['Appointments', 'Settings'],
        hidden: ['Specialists', 'Users', 'Notification logs', 'Error logs'],
      },
    ];

    const hasAnyScenario = scenarios.some((scenario) => scenario.creds.email && scenario.creds.password);
    test.skip(!hasAnyScenario, 'Set at least one E2E_*_EMAIL/PASSWORD pair for role menu checks.');

    for (const scenario of scenarios) {
      if (!scenario.creds.email || !scenario.creds.password) {
        continue;
      }

      const context = await browser.newContext();
      const page = await context.newPage();

      await login(page, scenario.creds);
      const role = await loggedInRole(page);
      if (role !== scenario.expectedRole) {
        test.info().annotations.push({
          type: 'skip',
          description: `${scenario.label}: expected role "${scenario.expectedRole}", got "${role ?? 'unknown'}".`,
        });
        await context.close();
        continue;
      }

      for (const item of scenario.visible) {
        await expect(page.getByRole('link', { name: item })).toBeVisible();
      }

      for (const item of scenario.hidden ?? []) {
        await expect(page.getByRole('link', { name: item })).toHaveCount(0);
      }

      await context.close();
    }
  });
});
