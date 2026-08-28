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
    assert.match(router, /WebUserRole\.ProductOwner[\s\S]*WebUserRole\.Specialist/);
    assert.match(layout, /\{ to: '\/services', label: t\('common\.services'\)/);
  });

  it('uses the fixed service and assignment API paths', async () => {
    const client = await read('src/shared/api/client.ts');
    const serviceCard = await read('src/components/services/ServiceCard.tsx');

    assert.match(client, /get<T>\('\/api\/services'/);
    assert.match(client, /post<T>\('\/api\/services'/);
    assert.match(client, /`\/api\/services\/\$\{serviceId\}`/);
    assert.match(client, /`\/api\/services\/\$\{serviceId\}\/specialists\/\$\{specialistId\}`/);
    assert.match(client, /`\/api\/services\/\$\{serviceId\}\/delete-impact`/);
    assert.match(client, /delete\(`\/api\/services\/\$\{serviceId\}`/);
    assert.match(client, /`\/api\/public-pages\/media\/\$\{encodeURIComponent\(mediaId\)\}\/preview`/);
    assert.match(client, /responseType: 'blob'/);
    assert.match(serviceCard, /assignment\.canEdit/);
  });

  it('resolves catalog images from authenticated managed-media previews', async () => {
    const container = await read('src/containers/ServicesContainer.tsx');

    assert.match(container, /imageMediaApi\.getPreview\(accessToken, mediaId\)/);
    assert.match(container, /URL\.createObjectURL\(response\.data\)/);
    assert.match(container, /previewUrl \? \{ \.\.\.service, imageUrl: previewUrl \} : service/);
    assert.match(container, /URL\.revokeObjectURL\(url\)/);
    assert.match(container, /archived services show the empty image state/);
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
    assert.match(serviceForm, /<AppSurface[\s\S]*title=\{labels\.specialistsTitle\}/);
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
    const serviceCard = await read('src/components/services/ServiceCard.tsx');

    assert.match(serviceCard, /assignment\.priceOverride \?\? service\.basePrice/);
    assert.match(serviceCard, /assignment\.durationOverrideMinutes \?\? service\.baseDurationMinutes/);
    assert.match(serviceCard, /priceOverride: priceInherited \? null : parsedPrice/);
    assert.match(serviceCard, /durationOverrideMinutes: durationInherited \? null : parsedDuration/);
    assert.match(container, /<AppFilterBar/);
    assert.match(container, /getDeleteImpact<ServiceDeleteImpact>/);
    assert.match(container, /disabled=\{isDeleteImpactLoading \|\| !deleteImpact\?\.canDelete\}/);
    assert.match(container, /maxWidth="xs"/);
    assert.match(container, /payload\.imageMediaId !== undefined[\s\S]*payload\.imageMediaId !== previousImageMediaId/);
    assert.match(container, /changedManagedImage && previousImageMediaId[\s\S]*cleanupManagedImage\(previousImageMediaId\)/);
    assert.match(container, /servicesApi\.delete\(accessToken, service\.id\)[\s\S]*cleanupManagedImage\(service\.imageMediaId\)/);
    assert.match(container, /failedCleanupMediaIds[\s\S]*retryFailedMediaCleanup/);
    assert.match(container, /failedCleanupMediaIds\.length[\s\S]*services\.imageCleanupWarning[\s\S]*services\.retryImageCleanup/);
    assert.match(container, /isAxiosError\(caught\)[\s\S]*response\?\.status === 404[\s\S]*filter\(\(id\) => id !== mediaId\)/);
    assert.doesNotMatch(container, /\{mediaId\}|String\(mediaId\)/);
  });
});
