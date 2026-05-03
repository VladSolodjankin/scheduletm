import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

describe('web smoke (auth/settings/specialists/appointments/specialist booking policy contracts)', () => {
  it('router exposes auth/settings/specialists/appointments routes', async () => {
    const router = await read('src/app/router.tsx');

    assert.match(router, /path:\s*'\/login'/);
    assert.match(router, /path:\s*'\/settings\/:tab\?'/);
    assert.match(router, /path:\s*'\/specialists'/);
    assert.match(router, /path:\s*'\/appointments'/);
    assert.match(router, /ProtectedRoute/);
  });

  it('auth flow redirects to settings after login', async () => {
    const authContainer = await read('src/containers/AuthContainer.tsx');

    assert.match(authContainer, /endpoint = isLogin \? '\/api\/auth\/login' : '\/api\/auth\/register'/);
    assert.match(authContainer, /navigate\('\/settings'\)/);
  });

  it('settings/specialists/appointments screens call API endpoints', async () => {
    const settingsContainer = await read('src/containers/SettingsContainer.tsx');
    const specialistsContainer = await read('src/containers/SpecialistsContainer.tsx');
    const appointmentsContainer = await read('src/containers/AppointmentsContainer.tsx');
    const appointmentDialog = await read('src/components/appointments/AppointmentFormDialog.tsx');
    const specialistsTable = await read('src/components/specialists/SpecialistsTable.tsx');
    const settingsCard = await read('src/components/SettingsCard.tsx');
    const settingsCardTypes = await read('src/components/SettingsCard.types.ts');
    const specialistPolicyTab = await read('src/components/settings-tabs/SpecialistPolicyTab.tsx');

    assert.match(settingsContainer, /'\/api\/settings\/user'/);
    assert.match(settingsContainer, /'\/api\/settings\/system'/);

    assert.match(settingsContainer, /'\/api\/settings\/specialist-booking-policy'/);
    assert.match(settingsContainer, /canManageSpecialistBookingPolicy/);
    assert.match(settingsContainer, /saveSpecialistBookingPolicy/);
    assert.match(specialistsContainer, /'\/api\/specialists'/);
    assert.match(specialistsContainer, /baseSessionPrice/);
    assert.match(specialistsContainer, /defaultSessionContinuationMin/);
    assert.match(appointmentsContainer, /'\/api\/appointments'/);
    assert.match(appointmentsContainer, /\/cancel/);
    assert.match(appointmentsContainer, /\/reschedule/);
    assert.match(appointmentsContainer, /\/mark-paid/);
    assert.match(appointmentsContainer, /\/notify/);
    assert.match(appointmentDialog, /appointments\.markPaidAction/);
    assert.match(appointmentDialog, /appointments\.notifyAction/);

    assert.match(settingsCard, /specialistPolicyTab/);
    assert.match(settingsCardTypes, /specialistPolicyTitle:\s*string;/);
    assert.match(specialistPolicyTab, /copy\.specialistPolicyTitle/);
    assert.match(specialistPolicyTab, /copy\.cancelGracePeriodHours/);
    assert.match(specialistPolicyTab, /copy\.refundOnLateCancel/);
    assert.match(specialistPolicyTab, /copy\.autoCancelUnpaidEnabled/);
    assert.match(specialistPolicyTab, /copy\.unpaidAutoCancelAfterHours/);
    assert.match(specialistsTable, /AppIcons\.edit/);
    assert.match(specialistsTable, /AppIcons\.delete/);
  });
});
