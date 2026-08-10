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
    assert.match(serviceCard, /assignment\.canEdit/);
  });

  it('preserves only active, available assignments during metadata edits', async () => {
    const serviceForm = await read('src/components/services/ServiceFormDialog.tsx');

    assert.match(serviceForm, /new Set\(specialists\.map\(\(item\) => item\.id\)\)/);
    assert.match(serviceForm, /\.filter\(\(item\) => item\.isActive && availableSpecialistIds\.has\(item\.specialistId\)\)/);
    assert.match(serviceForm, /specialistIds,/);
  });
});
