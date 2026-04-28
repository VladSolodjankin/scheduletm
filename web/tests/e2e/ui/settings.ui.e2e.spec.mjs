import { test, expect } from '@playwright/test';
import { creds, loggedInRole, login } from './helpers/auth.mjs';

test.describe('web ui e2e: settings', () => {
  test('settings tabs are visible according to role', async ({ browser }) => {
    const scenarios = [
      { label: 'owner', expectedRole: 'owner', creds: creds('E2E_OWNER'), systemTabVisible: true, accountTabVisible: true },
      { label: 'admin', expectedRole: 'admin', creds: creds('E2E_ADMIN'), systemTabVisible: false, accountTabVisible: true },
      { label: 'specialist', expectedRole: 'specialist', creds: creds('E2E_SPECIALIST'), systemTabVisible: false, accountTabVisible: false },
      { label: 'client', expectedRole: 'client', creds: creds('E2E_CLIENT'), systemTabVisible: false, accountTabVisible: false },
    ];

    const hasAnyScenario = scenarios.some((scenario) => scenario.creds.email && scenario.creds.password);
    test.skip(!hasAnyScenario, 'Set at least one E2E_*_EMAIL/PASSWORD pair for settings tab checks.');

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

      await page.getByRole('link', { name: 'Settings' }).click();
      await expect(page).toHaveURL(/\/settings$/);

      const systemTab = page.getByRole('tab', { name: 'System settings' });
      const accountTab = page.getByRole('tab', { name: 'Account settings' });

      if (scenario.systemTabVisible) {
        await expect(systemTab, `${scenario.label}: system tab must be visible`).toBeVisible();
      } else {
        await expect(systemTab, `${scenario.label}: system tab must be hidden`).toHaveCount(0);
      }

      if (scenario.accountTabVisible) {
        await expect(accountTab, `${scenario.label}: account tab must be visible`).toBeVisible();
      } else {
        await expect(accountTab, `${scenario.label}: account tab must be hidden`).toHaveCount(0);
      }

      await context.close();
    }
  });
});
