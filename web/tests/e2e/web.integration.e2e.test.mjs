import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

describe('web integration contracts: appointments lifecycle + users CRUD + RBAC', () => {
  it('covers appointments create/edit/cancel/reschedule API contracts', async () => {
    const appointmentsContainer = await read('src/containers/AppointmentsContainer.tsx');

    assert.match(appointmentsContainer, /await apiClient\.post\('\/api\/appointments'/);
    assert.match(appointmentsContainer, /await apiClient\.patch\(`\/api\/appointments\/\$\{editingItem\.id\}`/);
    assert.match(appointmentsContainer, /await apiClient\.post\(`\/api\/appointments\/\$\{editingItem\.id\}\/cancel`/);
    assert.match(appointmentsContainer, /await apiClient\.post\(`\/api\/appointments\/\$\{appointmentId\}\/reschedule`/);
  });

  it('covers late-cancel grace period and refund/no-refund UX contracts', async () => {
    const appointmentsContainer = await read('src/containers/AppointmentsContainer.tsx');

    assert.match(appointmentsContainer, /policy\.cancelGracePeriodHours/);
    assert.match(appointmentsContainer, /policy\.refundOnLateCancel/);
    assert.match(appointmentsContainer, /return isLateCancel && !policy\.refundOnLateCancel \? 'no_refund' : 'refund'/);
    assert.match(appointmentsContainer, /\? t\('appointments\.cancelConfirmNoRefund'\)/);
    assert.match(appointmentsContainer, /: t\('appointments\.cancelConfirmRefund'\)/);
    assert.match(appointmentsContainer, /\? t\('appointments\.cancelPolicyNoRefund'\)/);
    assert.match(appointmentsContainer, /: t\('appointments\.cancelPolicyRefund'\)/);
  });

  it('covers users create/edit/delete contracts', async () => {
    const usersContainer = await read('src/containers/UsersContainer.tsx');

    assert.match(usersContainer, /await apiClient\.post<ManagedUserItem>\('\/api\/users', payload/);
    assert.match(usersContainer, /await apiClient\.patch<ManagedUserItem>\(`\/api\/users\/\$\{editingUser\.id\}`, payload/);
    assert.match(usersContainer, /await apiClient\.delete<ManagedUserItem>\(`\/api\/users\/\$\{item\.id\}`/);
  });

  it('covers owner/admin/specialist/client RBAC gates in web UI containers', async () => {
    const roles = await read('src/shared/types/roles.ts');
    const mainLayout = await read('src/components/layout/MainLayout.tsx');
    const usersContainer = await read('src/containers/UsersContainer.tsx');
    const specialistsContainer = await read('src/containers/SpecialistsContainer.tsx');
    const appointmentsContainer = await read('src/containers/AppointmentsContainer.tsx');

    assert.match(roles, /Owner = 'owner'/);
    assert.match(roles, /Admin = 'admin'/);
    assert.match(roles, /Specialist = 'specialist'/);
    assert.match(roles, /Client = 'client'/);

    assert.match(mainLayout, /user\?\.role === WebUserRole\.Owner \|\| user\?\.role === WebUserRole\.Admin/);
    assert.match(mainLayout, /user\?\.role === WebUserRole\.Owner \|\| user\?\.role === WebUserRole\.Admin \|\| user\?\.role === WebUserRole\.Specialist/);
    assert.match(mainLayout, /user\?\.role === WebUserRole\.Owner[\s\S]*?\{ to: '\/error-logs'/);

    assert.match(usersContainer, /const canManageUsers = user\?\.role === 'owner' \|\| user\?\.role === 'admin' \|\| user\?\.role === 'specialist'/);
    assert.match(specialistsContainer, /const canManageSpecialists = user\?\.role === 'owner' \|\| user\?\.role === 'admin'/);
    assert.match(appointmentsContainer, /const canManageAll = user\?\.role === WebUserRole\.Owner \|\| user\?\.role === WebUserRole\.Admin/);
  });
});
