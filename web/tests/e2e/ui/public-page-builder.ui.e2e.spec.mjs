import { expect, test } from '@playwright/test';
import {
  apiRequest,
  authToken,
  loginAsAdmin,
  requireAdminCredentials,
  runId,
} from './helpers/iteration1.mjs';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function savePage(page) {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
}

async function addBlock(page, type) {
  await page.getByRole('button', { name: 'Add block', exact: true }).click();
  await page.getByRole('dialog', { name: 'Add block' }).getByRole('button', { name: type, exact: true }).click();
  return page.getByRole('dialog', { name: 'Configure block' });
}

async function dragByHandle(page, sourceName, targetName, targetPosition) {
  const sourceRoot = page.locator('[data-public-page-sortable="block"]');
  const source = sourceRoot.getByRole('button', { name: `Drag: ${sourceName}`, exact: true });
  const sourceWrapper = source.locator('xpath=ancestor::*[@data-public-page-sortable="block"][1]');
  const target = page.getByRole('group', { name: `Editable block: ${targetName}`, exact: true });
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  const sourceThemeGap = await sourceWrapper.evaluate((element) => getComputedStyle(element).getPropertyValue('--theme-link-offset'));
  expect(sourceThemeGap.trim()).not.toBe('');
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 + 8, { steps: 4 });
  const ghost = page.locator('.smooth-dnd-ghost[data-public-page-sortable="block"]');
  await expect(ghost).toBeAttached();
  await expect(ghost.locator('.public-page-block-actions, .public-page-section-actions, .public-page-block-drag-rail, .public-page-section-drag-rail')).toHaveCount(0);
  expect(await ghost.getAttribute('data-public-page-dnd-context')).toMatch(/^(page|section)$/);
  expect(await ghost.evaluate((element) => element.style.getPropertyValue('--page-background'))).toBe('');
  expect((await ghost.boundingBox())?.width).toBeGreaterThan(0);
  expect(await sourceWrapper.evaluate((element) => getComputedStyle(element).getPropertyValue('--theme-link-offset'))).toBe(sourceThemeGap);

  const assertGhostLane = async (context, width) => {
    const lane = page.locator(`[data-public-page-block-container][data-public-page-dnd-context="${context}"]`).first();
    const laneBox = await lane.boundingBox();
    expect(laneBox).not.toBeNull();
    await page.mouse.move(laneBox.x + laneBox.width / 2, laneBox.y + laneBox.height / 2, { steps: 8 });
    await expect(ghost).toHaveAttribute('data-public-page-dnd-context', context);
    await expect.poll(async () => Math.round((await ghost.boundingBox())?.width ?? 0)).toBe(width);
    expect(await sourceWrapper.evaluate((element) => getComputedStyle(element).getPropertyValue('--theme-link-offset'))).toBe(sourceThemeGap);
  };
  await assertGhostLane('section', 319);
  await assertGhostLane('page', 347);
  const targetY = targetBox.y + targetBox.height * (targetPosition === 'before' ? 0.2 : 0.8);
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetY, { steps: 12 });
  await page.mouse.up();
}

test.describe('public-page builder browser flow', () => {
  test.beforeAll(() => {
    requireAdminCredentials();
  });

  test('persists social presets, specialized forms, and block media lifecycle', async ({ page }) => {
    await loginAsAdmin(page);
    const marker = runId('builder').toLowerCase();
    const socialUrl = `https://instagram.com/${marker}`;
    const faqQuestion = `Question ${marker}`;
    const faqAnswer = `Answer ${marker}`;
    const serviceTitle = `Service ${marker}`;
    const serviceDescription = `Description ${marker}`;
    const servicePrice = '125';
    const imageAlt = `Background ${marker}`;
    let pageId = '';
    let uploadedMediaId = '';
    let primaryError;

    try {
      const createResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST'
        && new URL(response.url()).pathname === '/api/public-pages',
      );
      await page.goto('/public-pages');
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      const createDialog = page.getByRole('dialog', { name: 'Create page' });
      await createDialog.getByLabel('Template').selectOption('beauty');
      await createDialog.getByRole('button', { name: 'Create', exact: true }).click();
      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBeTruthy();
      pageId = (await createResponse.json()).id;
      await expect(page).toHaveURL(new RegExp(`/public-pages/${pageId}/edit$`));

      const mainDropContainer = page.locator('[data-public-page-main-container]');
      await expect(mainDropContainer).toHaveAttribute('data-public-page-dnd-context', 'page');
      await expect(mainDropContainer).toHaveCSS('flex-grow', '0');
      await expect(mainDropContainer).toHaveCSS('align-content', 'start');
      expect((await mainDropContainer.boundingBox())?.width).toBeCloseTo(347, 0);
      const paddedSection = page.locator('[data-public-page-section-drag-target]').filter({
        has: page.locator('[data-public-page-block-container]'),
      }).first();
      const paddedSectionId = await paddedSection.getAttribute('data-public-page-section-drag-target');
      expect(paddedSectionId).not.toBeNull();
      const sectionBox = await paddedSection.boundingBox();
      const sectionDropBox = await page.locator(`[data-public-page-block-container="${paddedSectionId}"]`).boundingBox();
      expect(sectionBox).not.toBeNull();
      expect(sectionDropBox).not.toBeNull();
      expect(Math.abs(sectionDropBox.y - sectionBox.y)).toBeLessThan(4);
      expect(Math.abs((sectionDropBox.y + sectionDropBox.height) - (sectionBox.y + sectionBox.height))).toBeLessThan(4);

      const socialDialog = await addBlock(page, 'Instagram');
      await socialDialog.getByLabel('URL').fill(socialUrl);
      await socialDialog.getByRole('button', { name: 'Save', exact: true }).click();

      await page.getByRole('button', { name: 'Add block', exact: true }).click();
      const addDialog = page.getByRole('dialog', { name: 'Add block' });
      await expect(addDialog.getByRole('group', { name: 'Social networks' }).getByRole('button', { name: 'Instagram' })).toBeDisabled();
      await addDialog.getByRole('button', { name: 'Cancel', exact: true }).click();

      const faqDialog = await addBlock(page, 'FAQ');
      await expect(faqDialog.getByLabel('Title')).toHaveCount(2);
      await expect(faqDialog.getByLabel('Description')).toBeVisible();
      await faqDialog.getByLabel('Title').nth(1).fill(faqQuestion);
      await faqDialog.getByLabel('Description').fill(faqAnswer);
      await faqDialog.getByRole('button', { name: 'Save', exact: true }).click();

      const serviceDialog = await addBlock(page, 'Services');
      await expect(serviceDialog.getByLabel('Title')).toHaveCount(2);
      await expect(serviceDialog.getByLabel('Description')).toBeVisible();
      await expect(serviceDialog.getByLabel('Price')).toBeVisible();
      await serviceDialog.getByLabel('Title').nth(1).fill(serviceTitle);
      await serviceDialog.getByLabel('Description').fill(serviceDescription);
      await serviceDialog.getByLabel('Price').fill(servicePrice);
      await serviceDialog.getByRole('button', { name: 'Save', exact: true }).click();

      await dragByHandle(page, 'FAQ', 'Welcome', 'after');
      await dragByHandle(page, 'Instagram', 'FAQ', 'after');
      await dragByHandle(page, 'Services', 'Welcome', 'after');
      await expect.poll(async () => {
        const socialSectionId = await page.getByRole('group', { name: 'Editable block: Instagram' })
          .getAttribute('data-editor-section-id');
        const faqSectionId = await page.getByRole('group', { name: 'Editable block: FAQ' })
          .getAttribute('data-editor-section-id');
        return socialSectionId && socialSectionId === faqSectionId ? socialSectionId : null;
      }).not.toBeNull();

      await dragByHandle(page, 'Instagram', 'FAQ', 'before');

      await savePage(page);
      await page.reload();

      const reorderedResponse = await apiRequest(page, 'GET', `/api/public-pages/${encodeURIComponent(pageId)}`);
      const reordered = await reorderedResponse.json();
      const reorderedSection = reordered.draft.sections.find((section) =>
        section.blocks.some((block) => block.type === 'social-button')
        && section.blocks.some((block) => block.type === 'faq'));
      expect(reorderedSection).toBeTruthy();
      const reorderedTypes = reorderedSection.blocks.map((block) => block.type);
      expect(reorderedTypes.indexOf('social-button')).toBeLessThan(reorderedTypes.indexOf('faq'));

      await expect(page.getByRole('group', { name: 'Editable block: Instagram' })).toBeVisible();
      await expect(page.getByRole('link', { name: /Instagram/ })).toHaveAttribute('href', socialUrl);
      await expect(page.getByText(faqQuestion, { exact: true })).toBeVisible();
      await expect(page.getByText(faqAnswer, { exact: true })).toBeVisible();
      await expect(page.getByText(serviceTitle, { exact: true })).toBeVisible();
      await expect(page.getByText(serviceDescription, { exact: true })).toBeVisible();
      await expect(page.getByText(servicePrice, { exact: true })).toBeVisible();

      await page.getByRole('group', { name: 'Editable block: Instagram' }).click();
      const editDialog = page.getByRole('dialog', { name: 'Instagram' });
      await editDialog.getByLabel('Label').fill(`Instagram ${marker}`);
      const uploadResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST'
        && new URL(response.url()).pathname === '/api/public-pages/media',
      );
      await editDialog.locator('input[type="file"]').setInputFiles({
        name: 'tiny.png',
        mimeType: 'image/png',
        buffer: TINY_PNG,
      });
      const uploadResponse = await uploadResponsePromise;
      expect(uploadResponse.ok()).toBeTruthy();
      const uploadedMedia = await uploadResponse.json();
      uploadedMediaId = uploadedMedia.id;
      await expect(editDialog.getByRole('img')).toBeVisible();
      await editDialog.getByLabel('Image description').fill(imageAlt);
      await editDialog.getByLabel('Image description').blur();
      await editDialog.getByRole('button', { name: 'Save', exact: true }).click();
      await savePage(page);

      let recordResponse = await apiRequest(page, 'GET', `/api/public-pages/${encodeURIComponent(pageId)}`);
      let record = await recordResponse.json();
      let socialBlock = record.draft.sections.flatMap((section) => section.blocks)
        .find((block) => block.type === 'social-button');
      expect(socialBlock.content).toMatchObject({ platform: 'instagram', label: `Instagram ${marker}`, url: socialUrl });
      expect(record.draft.media).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: uploadedMedia.id, alt: imageAlt, mimeType: 'image/png' }),
      ]));
      expect(socialBlock.design.backgroundMediaId).toBe(uploadedMedia.id);

      await page.reload();
      await page.getByRole('group', { name: 'Editable block: Instagram' }).click();
      await expect(page.getByRole('dialog', { name: 'Instagram' }).getByRole('img', { name: imageAlt })).toBeVisible();

      const deleteResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'DELETE'
        && new URL(response.url()).pathname === `/api/public-pages/media/${uploadedMedia.id}`,
      );
      await page.getByRole('dialog', { name: 'Instagram' }).getByRole('button', { name: 'Delete', exact: true }).click();
      await page.getByRole('dialog', { name: 'Instagram' }).getByRole('button', { name: 'Save', exact: true }).click();
      await savePage(page);
      const deleteResponse = await deleteResponsePromise;
      expect(deleteResponse.ok()).toBeTruthy();

      recordResponse = await apiRequest(page, 'GET', `/api/public-pages/${encodeURIComponent(pageId)}`);
      record = await recordResponse.json();
      socialBlock = record.draft.sections.flatMap((section) => section.blocks)
        .find((block) => block.type === 'social-button');
      expect(record.draft.media.some((media) => media.id === uploadedMedia.id)).toBeFalsy();
      expect(socialBlock.design.backgroundMediaId).toBeNull();
      uploadedMediaId = '';
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      let pageCleanupError;
      let mediaCleanupError;
      try {
        if (pageId) {
          const current = await apiRequest(page, 'GET', `/api/public-pages/${encodeURIComponent(pageId)}`);
          const record = await current.json();
          const archived = record.status === 'archived'
            ? record
            : await (await apiRequest(
              page,
              'POST',
              `/api/public-pages/${encodeURIComponent(pageId)}/archive`,
              { expectedRevision: record.revision },
            )).json();
          await apiRequest(
            page,
            'DELETE',
            `/api/public-pages/${encodeURIComponent(pageId)}`,
            { expectedRevision: archived.revision },
          );
        }
      } catch (error) {
        pageCleanupError = error;
      }

      if (uploadedMediaId) {
        try {
          const token = await authToken(page);
          const response = await page.request.delete(
            new URL(`/api/public-pages/media/${encodeURIComponent(uploadedMediaId)}`, process.env.E2E_API_URL).toString(),
            { headers: { Authorization: `Bearer ${token}` }, failOnStatusCode: false },
          );
          if (!response.ok() && response.status() !== 404) {
            mediaCleanupError = new Error(`Media cleanup failed (${response.status()}).`);
          }
        } catch (error) {
          mediaCleanupError = error;
        }
      }

      if (!primaryError && pageCleanupError) {
        throw pageCleanupError;
      }
      if (!primaryError && mediaCleanupError) {
        throw mediaCleanupError;
      }
    }
  });
});
