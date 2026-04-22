import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

describe('web smoke (auth/settings/appointments contracts)', () => {
  it('router exposes auth/settings/appointments routes', async () => {
    const router = await read('src/app/router.tsx');

    assert.match(router, /path:\s*'\/login'/);
    assert.match(router, /path:\s*'\/settings'/);
    assert.match(router, /path:\s*'\/appointments'/);
    assert.match(router, /ProtectedRoute/);
  });

  it('auth flow redirects to settings after login', async () => {
    const authContainer = await read('src/containers/AuthContainer.tsx');

    assert.match(authContainer, /endpoint = isLogin \? '\/api\/auth\/login' : '\/api\/auth\/register'/);
    assert.match(authContainer, /navigate\('\/settings'\)/);
  });

  it('settings and appointments screens call API endpoints', async () => {
    const settingsContainer = await read('src/containers/SettingsContainer.tsx');
    const appointmentsContainer = await read('src/containers/AppointmentsContainer.tsx');

    assert.match(settingsContainer, /'\/api\/settings\/user'/);
    assert.match(settingsContainer, /'\/api\/settings\/system'/);
    assert.match(appointmentsContainer, /'\/api\/appointments'/);
    assert.match(appointmentsContainer, /\/cancel/);
    assert.match(appointmentsContainer, /\/reschedule/);
  });
});
