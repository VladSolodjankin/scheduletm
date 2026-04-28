import { test, expect } from 'playwright/test';

function creds(prefix) {
  return {
    email: process.env[`${prefix}_EMAIL`] ?? '',
    password: process.env[`${prefix}_PASSWORD`] ?? '',
  };
}

async function login(page, { email, password }) {
  await page.addInitScript(() => {
    window.localStorage.setItem('ui-locale', 'en');
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/settings$/);
}

test.describe('web ui e2e (real clicks)', () => {
  test('owner can create/edit/deactivate user via UI', async ({ page }) => {
    const owner = creds('E2E_OWNER');
    test.skip(!owner.email || !owner.password, 'Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD for UI e2e.');

    await login(page, owner);

    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL(/\/users$/);

    const randomSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `e2e-client-${randomSuffix}@example.com`;

    await page.getByRole('button', { name: 'Add user' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Role').click();
    await page.getByRole('option', { name: 'client' }).click();
    await page.getByLabel('First name').fill('E2E');
    await page.getByLabel('Last name').fill('Client');
    await page.getByRole('button', { name: 'Save' }).click();

    const row = page.locator('tr', { hasText: email });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: 'Edit user' }).click();
    await page.getByLabel('Last name').fill('Client Updated');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('tr', { hasText: 'Client Updated' })).toBeVisible();

    await row.getByRole('button', { name: 'Deactivate user' }).click();
    await expect(row).toBeVisible();
  });

  test('role-aware menu visibility for owner/admin/specialist/client', async ({ browser }) => {
    const scenarios = [
      {
        label: 'owner',
        creds: creds('E2E_OWNER'),
        visible: ['Appointments', 'Specialists', 'Users', 'Notification logs', 'Error logs', 'Settings'],
      },
      {
        label: 'admin',
        creds: creds('E2E_ADMIN'),
        visible: ['Appointments', 'Specialists', 'Users', 'Notification logs', 'Settings'],
        hidden: ['Error logs'],
      },
      {
        label: 'specialist',
        creds: creds('E2E_SPECIALIST'),
        visible: ['Appointments', 'Users', 'Notification logs', 'Settings'],
        hidden: ['Specialists', 'Error logs'],
      },
      {
        label: 'client',
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
