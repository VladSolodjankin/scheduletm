import { expect, test } from '@playwright/test';

const AUTH_TOKEN_KEY = 'meetli_access_token';
const AUTH_USER_KEY = 'meetli_auth_user';

const SPECIALISTS = [
  { id: 11, name: 'Specialist One', isActive: true },
  { id: 12, name: 'Specialist Two', isActive: true },
];

function initialService() {
  return {
    id: 101,
    name: 'Deep Tissue Massage',
    description: 'Focused recovery session.',
    basePrice: 2500,
    baseDurationMinutes: 75,
    firstSessionFree: false,
    imageMediaId: 'old-media-101',
    imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    isActive: true,
    assignments: [
      {
        specialistId: 11,
        specialistName: 'Specialist One',
        isActive: true,
        priceOverride: null,
        durationOverrideMinutes: null,
      },
      {
        specialistId: 12,
        specialistName: 'Specialist Two',
        isActive: true,
        priceOverride: 3200,
        durationOverrideMinutes: 90,
      },
    ],
  };
}

function archivedService() {
  return {
    id: 303,
    name: 'Archived Service',
    description: 'Managed image is available only through authenticated preview.',
    basePrice: 1800,
    baseDurationMinutes: 45,
    firstSessionFree: false,
    imageMediaId: 'archived-media-303',
    imageUrl: null,
    isActive: false,
    assignments: [],
  };
}

function assignmentRow(dialog, specialistName) {
  return dialog.locator('.service-assignments__row').filter({ hasText: specialistName });
}

function serviceRow(page, serviceName) {
  return page.locator('.service-row').filter({
    has: page.locator('.app-list-row__title').getByText(serviceName, { exact: true }),
  });
}

async function openServiceMenuItem(page, serviceName, itemName) {
  await serviceRow(page, serviceName).getByRole('button', { name: 'More actions', exact: true }).click();
  await page.getByRole('menuitem', { name: itemName, exact: true }).click();
}

async function installMockSessionAndApi(page) {
  const state = {
    services: [initialService(), archivedService()],
    createPayloads: [],
    updatePayloads: [],
    assignmentPayloads: [],
    deleteRequests: 0,
    mediaDeleteAttempts: 0,
    mediaPreviewRequests: [],
    unexpectedApiRequests: [],
  };

  await page.addInitScript(({ tokenKey, userKey }) => {
    window.localStorage.setItem('ui-locale', 'en');
    window.localStorage.setItem(tokenKey, 'mock-admin-token');
    window.localStorage.setItem(userKey, JSON.stringify({
      id: 'mock-admin',
      email: 'admin@example.test',
      role: 'owner',
      fullName: 'Mock Admin',
    }));
  }, { tokenKey: AUTH_TOKEN_KEY, userKey: AUTH_USER_KEY });

  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const request = route.request();
    const method = request.method();
    const pathname = new URL(request.url()).pathname;
    const json = (status, body) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (pathname === '/api/settings/user') {
      await json(200, {});
      return;
    }

    if (method === 'GET' && pathname === '/api/services') {
      await json(200, { services: state.services, specialists: SPECIALISTS });
      return;
    }

    const previewMatch = pathname.match(/^\/api\/public-pages\/media\/([^/]+)\/preview$/);
    if (method === 'GET' && previewMatch) {
      const mediaId = decodeURIComponent(previewMatch[1]);
      state.mediaPreviewRequests.push({
        mediaId,
        authorization: request.headers().authorization,
      });
      if (mediaId === 'archived-media-303') {
        await json(404, { code: 'not_found', message: 'Preview is not available.' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/services') {
      const payload = request.postDataJSON();
      state.createPayloads.push(payload);
      const created = {
        id: 202,
        ...payload,
        imageUrl: null,
        assignments: SPECIALISTS
          .filter(({ id }) => payload.specialistIds.includes(id))
          .map(({ id, name }) => ({
            specialistId: id,
            specialistName: name,
            isActive: true,
            priceOverride: null,
            durationOverrideMinutes: null,
          })),
      };
      delete created.specialistIds;
      state.services.push(created);
      await json(201, created);
      return;
    }

    const assignmentMatch = pathname.match(/^\/api\/services\/(\d+)\/specialists\/(\d+)$/);
    if (method === 'PATCH' && assignmentMatch) {
      const serviceId = Number(assignmentMatch[1]);
      const specialistId = Number(assignmentMatch[2]);
      const payload = request.postDataJSON();
      state.assignmentPayloads.push({ serviceId, specialistId, payload });
      const service = state.services.find(({ id }) => id === serviceId);
      const assignment = service.assignments.find((item) => item.specialistId === specialistId);
      Object.assign(assignment, payload);
      await json(200, assignment);
      return;
    }

    const serviceMatch = pathname.match(/^\/api\/services\/(\d+)$/);
    if (method === 'PATCH' && serviceMatch) {
      const serviceId = Number(serviceMatch[1]);
      const payload = request.postDataJSON();
      state.updatePayloads.push({ serviceId, payload });
      const service = state.services.find(({ id }) => id === serviceId);
      Object.assign(service, payload);
      if (Array.isArray(payload.specialistIds)) {
        service.assignments = SPECIALISTS
          .filter(({ id }) => payload.specialistIds.includes(id))
          .map(({ id, name }) => {
            const previous = service.assignments.find((item) => item.specialistId === id);
            return previous ?? {
              specialistId: id,
              specialistName: name,
              isActive: true,
              priceOverride: null,
              durationOverrideMinutes: null,
            };
          });
      }
      delete service.specialistIds;
      await json(200, service);
      return;
    }

    const impactMatch = pathname.match(/^\/api\/services\/(\d+)\/delete-impact$/);
    if (method === 'GET' && impactMatch) {
      await json(200, {
        canDelete: false,
        impact: { appointments: 2, appointmentGroups: 1, publicPages: 3 },
      });
      return;
    }

    if (method === 'DELETE' && pathname === '/api/public-pages/media/old-media-101') {
      state.mediaDeleteAttempts += 1;
      if (state.mediaDeleteAttempts === 1) {
        await json(503, { code: 'temporary_failure', message: 'Temporary media storage failure.' });
      } else {
        await json(404, { code: 'not_found', message: 'Media is already absent.' });
      }
      return;
    }

    if (method === 'DELETE' && serviceMatch) {
      state.deleteRequests += 1;
      await route.fulfill({ status: 204 });
      return;
    }

    state.unexpectedApiRequests.push(`${method} ${pathname}`);
    await json(200, {});
  });

  return state;
}

test('services CRUD form and specialist defaults use one consistent mock-backed flow', async ({ page }) => {
  const state = await installMockSessionAndApi(page);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/services');

  await expect.poll(() => pageErrors).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Services', exact: true })).toBeVisible();
  await expect(serviceRow(page, 'Deep Tissue Massage')).toBeVisible();
  await expect(serviceRow(page, 'Deep Tissue Massage').getByText('1 with custom pricing', { exact: true })).toBeVisible();
  await expect(serviceRow(page, 'Deep Tissue Massage').getByRole('img', { name: 'Specialist One, Specialist Two' })).toBeVisible();
  await expect(page.locator('.app-filter-bar')).toHaveCSS('border-radius', '8px');
  await expect(page.locator('.services-list__rows')).toHaveCSS('border-radius', '16px');
  await expect(page.locator('.services-list__rows .MuiCard-root')).toHaveCount(0);
  await expect(page.locator('.app-list-thumb').first()).toHaveCSS('border-radius', '8px');
  await expect.poll(() => page.locator(':root').evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      primary: styles.getPropertyValue('--app-color-primary').trim(),
      radiusS: styles.getPropertyValue('--app-radius-s').trim(),
      radiusM: styles.getPropertyValue('--app-radius-m').trim(),
    };
  })).toEqual({ primary: '#2563eb', radiusS: '0.5rem', radiusM: '1rem' });
  await expect.poll(() => state.mediaPreviewRequests.length).toBe(2);
  expect(state.mediaPreviewRequests).toEqual(expect.arrayContaining([
    { mediaId: 'old-media-101', authorization: 'Bearer mock-admin-token' },
    { mediaId: 'archived-media-303', authorization: 'Bearer mock-admin-token' },
  ]));

  await page.getByRole('combobox', { name: /Status/ }).click();
  await page.getByRole('option', { name: 'Archived services', exact: true }).click();
  const archivedCard = serviceRow(page, 'Archived Service');
  await expect(archivedCard).toBeVisible();
  await expect(archivedCard.locator('img')).toHaveCount(0);
  await page.getByRole('combobox', { name: /Status/ }).click();
  await page.getByRole('option', { name: 'Active services', exact: true }).click();

  await serviceRow(page, 'Deep Tissue Massage').locator('.app-list-row__main').click();
  let dialog = page.getByRole('dialog', { name: 'Edit service' });
  const inheritedAssignment = assignmentRow(dialog, 'Specialist One');
  await expect(inheritedAssignment.locator('input[type="number"]')).toHaveCount(0);
  await expect(inheritedAssignment.getByText('RUB 2,500 · 1 hr 15 min', { exact: true })).toBeVisible();
  await expect(inheritedAssignment.getByRole('button', { name: 'Set custom price', exact: true })).toBeVisible();

  const customAssignment = assignmentRow(dialog, 'Specialist Two');
  await expect(customAssignment.getByText('Custom', { exact: true })).toBeVisible();
  await expect(customAssignment.getByText('RUB 3,200 · 1 hr 30 min', { exact: true })).toBeVisible();
  await customAssignment.getByRole('button', { name: 'Use service defaults: Specialist Two', exact: true }).click();
  await expect(customAssignment.getByText('Custom', { exact: true })).toHaveCount(0);

  await inheritedAssignment.getByRole('button', { name: 'Set custom price', exact: true }).click();
  await expect(inheritedAssignment.getByLabel('Price')).toHaveValue('');
  await expect(inheritedAssignment.getByText('Service default', { exact: true })).toHaveCount(2);
  await inheritedAssignment.getByLabel('Price').fill('2700');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => state.assignmentPayloads).toEqual([
    { serviceId: 101, specialistId: 11, payload: { isActive: true, priceOverride: 2700, durationOverrideMinutes: null } },
    { serviceId: 101, specialistId: 12, payload: { isActive: true, priceOverride: null, durationOverrideMinutes: null } },
  ]);
  await expect.poll(() => state.updatePayloads).toHaveLength(1);
  state.updatePayloads.length = 0;

  await page.getByRole('button', { name: 'Add service', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Add service' });
  await expect(dialog.getByLabel('Name')).toBeVisible();
  await expect(dialog.getByLabel('Description')).toBeVisible();
  await expect(dialog.getByLabel('Price')).toHaveValue('0');
  await expect(dialog.getByLabel('Duration, minutes')).toHaveValue('60');
  await expect(dialog.getByText('Specialists', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Specialists inherit the service price and duration', { exact: false })).toBeVisible();
  await expect(dialog.getByLabel('Specialist One')).toBeVisible();
  await expect(dialog.getByLabel('Specialist Two')).toBeVisible();
  await expect(dialog.locator('input[type="file"]')).toHaveAttribute(
    'accept',
    'image/jpeg,image/png,image/webp',
  );
  await expect(dialog.locator('input[type="url"]')).toHaveCount(0);
  await expect(dialog.getByLabel(/image url/i)).toHaveCount(0);

  const desktopNameBox = await dialog.getByLabel('Name').boundingBox();
  const desktopPriceBox = await dialog.getByLabel('Price').boundingBox();
  expect(desktopNameBox).not.toBeNull();
  expect(desktopPriceBox).not.toBeNull();
  expect(desktopNameBox.width).toBeGreaterThan(desktopPriceBox.width * 1.35);
  expect(desktopNameBox.x).toBeLessThan(desktopPriceBox.x);

  await page.setViewportSize({ width: 600, height: 900 });
  const mobileNameBox = await dialog.getByLabel('Name').boundingBox();
  const mobilePriceBox = await dialog.getByLabel('Price').boundingBox();
  expect(mobileNameBox).not.toBeNull();
  expect(mobilePriceBox).not.toBeNull();
  expect(Math.abs(mobileNameBox.x - mobilePriceBox.x)).toBeLessThan(2);
  expect(Math.abs(mobileNameBox.width - mobilePriceBox.width)).toBeLessThan(2);
  expect(mobileNameBox.y).toBeLessThan(mobilePriceBox.y);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await dialog.getByLabel('Name').fill('New UX Service');
  await dialog.getByLabel('Description').fill('Created from the consistent service form.');
  await dialog.getByLabel('Price').fill('4100');
  await dialog.getByLabel('Duration, minutes').fill('50');
  await dialog.getByLabel('First session free').check();
  await dialog.getByLabel('Specialist One').check();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => state.createPayloads).toEqual([{
    name: 'New UX Service',
    description: 'Created from the consistent service form.',
    basePrice: 4100,
    baseDurationMinutes: 50,
    firstSessionFree: true,
    imageMediaId: null,
    isActive: true,
    specialistIds: [11],
  }]);
  await expect(serviceRow(page, 'New UX Service')).toBeVisible();

  await openServiceMenuItem(page, 'Deep Tissue Massage', 'Edit');
  dialog = page.getByRole('dialog', { name: 'Edit service' });
  await expect(dialog.getByLabel('Name')).toHaveValue('Deep Tissue Massage');
  await expect(dialog.getByLabel('Description')).toHaveValue('Focused recovery session.');
  await expect(dialog.getByLabel('Price')).toHaveValue('2500');
  await expect(dialog.getByLabel('Duration, minutes')).toHaveValue('75');
  await expect(dialog.getByLabel('Specialist One')).toBeChecked();
  await expect(dialog.getByLabel('Specialist Two')).toBeChecked();

  await dialog.getByLabel('Name').fill('Deep Tissue Massage Plus');
  await dialog.getByLabel('Description').fill('Updated recovery session.');
  await dialog.getByLabel('Price').fill('2800');
  await dialog.getByLabel('Duration, minutes').fill('80');
  await dialog.getByLabel('Specialist Two').uncheck();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => state.updatePayloads).toHaveLength(1);
  expect(state.updatePayloads[0]).toEqual({
    serviceId: 101,
    payload: {
      name: 'Deep Tissue Massage Plus',
      description: 'Updated recovery session.',
      basePrice: 2800,
      baseDurationMinutes: 80,
      firstSessionFree: false,
      isActive: true,
      specialistIds: [11],
    },
  });
  expect(state.updatePayloads[0].payload).not.toHaveProperty('imageUrl');
  expect(state.updatePayloads[0].payload).not.toHaveProperty('imageMediaId');

  await openServiceMenuItem(page, 'Deep Tissue Massage Plus', 'Edit');
  dialog = page.getByRole('dialog', { name: 'Edit service' });
  await dialog.getByRole('button', { name: 'Remove image', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => state.mediaDeleteAttempts).toBe(1);
  await expect(page.getByText(
    'The service change was saved, but an old image could not be removed automatically.',
    { exact: true },
  )).toBeVisible();
  await page.getByRole('button', { name: 'Retry cleanup', exact: true }).click();
  await expect.poll(() => state.mediaDeleteAttempts).toBe(2);
  await expect(page.getByText(
    'The service change was saved, but an old image could not be removed automatically.',
    { exact: true },
  )).toHaveCount(0);
  expect(state.updatePayloads[1]).toEqual({
    serviceId: 101,
    payload: {
      name: 'Deep Tissue Massage Plus',
      description: 'Updated recovery session.',
      basePrice: 2800,
      baseDurationMinutes: 80,
      firstSessionFree: false,
      imageMediaId: null,
      isActive: true,
      specialistIds: [11],
    },
  });

  await openServiceMenuItem(page, 'Deep Tissue Massage Plus', 'Delete permanently');
  const deleteDialog = page.getByRole('dialog', { name: 'Delete service permanently?' });
  await expect(deleteDialog.getByText('Appointments: 2', { exact: true })).toBeVisible();
  await expect(deleteDialog.getByText('Recurring appointment groups: 1', { exact: true })).toBeVisible();
  await expect(deleteDialog.getByText('Public Pages: 3', { exact: true })).toBeVisible();
  await expect(deleteDialog.getByText('Archive this service instead.', { exact: false })).toBeVisible();
  await expect(deleteDialog.getByRole('button', { name: 'Delete permanently', exact: true })).toBeDisabled();
  expect(state.deleteRequests).toBe(0);
  expect(state.unexpectedApiRequests).toEqual([]);
});
