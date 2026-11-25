import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

describe('web service catalog contracts', () => {
  it('registers the protected service route and role-aware navigation', async () => {
    const router = await read('src/app/router.tsx');
    const layout = await read('src/components/layout/MainLayout.tsx');

    assert.match(router, /path: '\/services'/);
    assert.match(router, /WebUserRole\.ProductAdmin[\s\S]*WebUserRole\.Specialist/);
    assert.match(layout, /\{ to: '\/services', label: t\('common\.services'\)/);
  });

  it('uses the fixed service and assignment API paths', async () => {
    const client = await read('src/shared/api/client.ts');
    const serviceRow = await read('src/components/services/ServiceListRow.tsx');

    assert.match(client, /get<T>\('\/api\/services'/);
    assert.match(client, /post<T>\('\/api\/services'/);
    assert.match(client, /`\/api\/services\/\$\{serviceId\}`/);
    assert.match(client, /`\/api\/services\/\$\{serviceId\}\/specialists\/\$\{specialistId\}`/);
    assert.match(client, /`\/api\/services\/\$\{serviceId\}\/delete-impact`/);
    assert.match(client, /delete\(`\/api\/services\/\$\{serviceId\}`/);
    assert.match(client, /`\/api\/public-pages\/media\/\$\{encodeURIComponent\(mediaId\)\}\/preview`/);
    assert.match(client, /responseType: 'blob'/);
    assert.match(serviceRow, /assignment\.canEdit === true/);
  });

  it('resolves catalog images from authenticated managed-media previews', async () => {
    const container = await read('src/containers/ServicesContainer.tsx');
    const images = await read('src/shared/api/useManagedImages.ts');

    assert.match(container, /useManagedImages<ServiceImageMedia>/);
    assert.match(container, /previewUrl \? \{ \.\.\.service, imageUrl: previewUrl \} : service/);
    assert.match(images, /imageMediaApi\.getPreview\(accessToken, mediaId\)/);
    assert.match(images, /URL\.createObjectURL\(response\.data\)/);
    assert.match(images, /URL\.revokeObjectURL\(url\)/);
  });

  it('preserves only active, available assignments during metadata edits', async () => {
    const serviceForm = await read('src/components/services/ServiceFormDialog.tsx');

    assert.match(serviceForm, /new Set\(specialists\.map\(\(item\) => item\.id\)\)/);
    assert.match(serviceForm, /\.filter\(\(item\) => item\.isActive && availableSpecialistIds\.has\(item\.specialistId\)\)/);
    assert.match(serviceForm, /specialistIds,/);
  });

  it('opens the existing service dialog from public-page links without adding another CRUD layer', async () => {
    const container = await read('src/containers/ServicesContainer.tsx');
    const editor = await read('src/components/public-page-builder/ServicesBlockEditor.tsx');

    assert.match(container, /useSearchParams\(\)/);
    assert.match(container, /searchParams\.get\('create'\) === '1'/);
    assert.match(container, /searchParams\.get\('edit'\)/);
    assert.match(container, /next\.delete\('create'\)[\s\S]*next\.delete\('edit'\)/);
    assert.match(editor, /href="\/services\?create=1"/);
    assert.match(editor, /href=\{`\/services\?edit=\$\{id\}`\}/);
    assert.doesNotMatch(editor, /servicesApi\.create|servicesApi\.update/);
  });

  it('uses the shared production form layout and managed image upload', async () => {
    const serviceForm = await read('src/components/services/ServiceFormDialog.tsx');
    const sharedUpload = await read('src/shared/ui/AppImageUpload.tsx');
    const publicPageUpload = await read('src/components/public-page-builder/ImageUploadControl.tsx');

    assert.match(serviceForm, /<AppDialog[\s\S]*maxWidth="md"/);
    assert.match(serviceForm, /<FormContainer>/);
    const serviceStyles = await read('src/components/services/services.css');
    assert.match(serviceForm, /className="service-form__main"/);
    assert.match(serviceStyles, /\.service-form__main[\s\S]*grid-template-columns: minmax\(0, 5fr\) minmax\(0, 3fr\)/);
    assert.match(serviceForm, /<AppSectionHeader[\s\S]*title=\{t\('services\.specialistsTitle'\)\}/);
    assert.doesNotMatch(serviceForm, /<AppSurface/);
    assert.match(serviceForm, /imageMediaId,/);
    assert.doesNotMatch(serviceForm, /type="url"|imageUrl:/);
    assert.match(sharedUpload, /image\/jpeg,image\/png,image\/webp/);
    assert.match(sharedUpload, /5 \* 1024 \* 1024/);
    assert.match(sharedUpload, /onBusyChange\?\.\(true\)[\s\S]*finally[\s\S]*onBusyChange\?\.\(false\)/);
    assert.doesNotMatch(sharedUpload, /public-page-builder|ApiPublicPageRepository|MediaReference/);
    assert.match(publicPageUpload, /<AppImageUpload<MediaReference>/);
    assert.match(serviceForm, /onBusyChange=\{setIsUploadingImage\}/);
    assert.match(serviceForm, /onClose=\{isSaving \|\| isImageBusy \? undefined/);
    assert.match(serviceForm, /\.\.\.\(!service \|\| imageChanged \? \{ imageMediaId \} : \{\}\)/);
  });

  it('shows inherited specialist defaults and safe archive/delete flows', async () => {
    const container = await read('src/containers/ServicesContainer.tsx');
    const assignmentsEditor = await read('src/components/services/ServiceAssignmentsEditor.tsx');
    const serviceForm = await read('src/components/services/ServiceFormDialog.tsx');

    assert.match(assignmentsEditor, /price === null \? basePrice : price/);
    assert.match(assignmentsEditor, /duration === null \? baseDurationMinutes : duration/);
    assert.match(assignmentsEditor, /priceOverride: parseOptional\(draft\.priceText\)/);
    assert.match(assignmentsEditor, /durationOverrideMinutes: parseOptional\(draft\.durationText\)/);
    assert.match(serviceForm, /getChangedAssignmentDrafts\(assignmentDrafts, \{ includeAvailability: false \}\)/);
    assert.match(container, /<AppFilterBar/);
    assert.match(container, /getDeleteImpact<ServiceDeleteImpact>/);
    assert.match(container, /disabled=\{isDeleteImpactLoading \|\| !deleteImpact\?\.canDelete\}/);
    assert.match(container, /maxWidth="xs"/);
    assert.match(container, /payload\.imageMediaId !== undefined[\s\S]*payload\.imageMediaId !== previousImageMediaId/);
    assert.match(container, /changedManagedImage && previousImageMediaId[\s\S]*cleanupImage\(previousImageMediaId\)/);
    assert.match(container, /servicesApi\.delete\(accessToken, service\.id\)[\s\S]*cleanupImage\(service\.imageMediaId\)/);
    assert.match(container, /<AppImageCleanupNotice[\s\S]*services\.imageCleanupWarning[\s\S]*services\.retryImageCleanup[\s\S]*images\.retryCleanup/);
    const images = await read('src/shared/api/useManagedImages.ts');
    assert.match(images, /isAxiosError\(caught\) && caught\.response\?\.status === 404/);
    assert.match(images, /current\.filter\(\(id\) => id !== mediaId\)/);
    assert.doesNotMatch(container, /\{mediaId\}|String\(mediaId\)/);
  });
});
