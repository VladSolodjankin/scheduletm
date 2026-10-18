import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

describe('google calendar write opt-in contracts', () => {
  it('types the additive settings fields and drops event details from busy slots', async () => {
    const types = await read('src/shared/types/api.ts');

    assert.match(types, /googleCalendarWriteEnabled: boolean;[\s\S]*googleCalendarWriteGranted: boolean;/);
    assert.match(types, /GoogleOAuthStartPayload = \{\s*access\?: 'write';/);
    assert.doesNotMatch(types, /organizerEmail|creatorEmail/);
  });

  it('requests the write scope only via the explicit grant flow and toggles via PUT settings', async () => {
    const container = await read('src/containers/SettingsContainer.tsx');

    assert.match(container, /'\/api\/integrations\/google\/oauth\/start'/);
    assert.match(container, /startGoogleOauth\('write', setIsGoogleGrantingAccess\)/);
    assert.match(container, /startGoogleOauth\(undefined, setIsGoogleConnecting\)/);
    assert.match(container, /googleCalendarWriteEnabled: enabled/);
    assert.match(container, /status === 503/);
    assert.match(container, /status === 409[\s\S]*google_write_scope_missing/);
  });

  it('handles the scope_write callback values and cleans the URL', async () => {
    const container = await read('src/containers/SettingsContainer.tsx');

    assert.match(container, /searchParams\.get\('scope_write'\)/);
    assert.match(container, /googleScopeWrite === 'granted'/);
    assert.match(container, /googleScopeWrite === 'missing'/);
    assert.match(container, /nextParams\.delete\('scope_write'\)/);
  });

  it('never sends the write flags from the generic user settings form save', async () => {
    const container = await read('src/containers/SettingsContainer.tsx');

    assert.match(container, /delete payload\.googleCalendarWriteEnabled;/);
    assert.match(container, /delete payload\.googleCalendarWriteGranted;/);
  });

  it('gates the switch on connection and granted scope, with a grant button as reconnect path', async () => {
    const tab = await read('src/components/settings-tabs/IntegrationsSettingsTab.tsx');

    assert.match(tab, /canToggleGoogleWrite = userSettings\.googleConnected && userSettings\.googleCalendarWriteGranted/);
    assert.match(tab, /disabled=\{!canToggleGoogleWrite \|\| isGoogleWriteSaving/);
    assert.match(tab, /onClick=\{onGrantGoogleCalendarAccess\}/);
    assert.match(tab, /disabled=\{userSettings\.googleConnected \|\| isGoogleDisconnecting/);
  });

  it('keeps ru and en dictionaries in sync for the new keys', async () => {
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');
    const keys = [
      'googleCalendarWriteLabel',
      'googleCalendarWriteHelper',
      'googleCalendarWriteConnectFirst',
      'googleCalendarWriteGrantHint',
      'googleCalendarWriteGrantAccess',
      'googleCalendarWriteGrantingAccess',
      'googleCalendarWriteEnabledSuccess',
      'googleCalendarWriteDisabledSuccess',
      'googleCalendarWriteGrantedSuccessfully',
      'googleCalendarWriteMissing',
      'googleNotConfigured',
      'googleWriteScopeMissing',
      'saveGoogleCalendarWrite',
    ];

    for (const key of keys) {
      const definitions = dictionaries.match(new RegExp(`^[ ]+${key}:`, 'gm')) ?? [];
      assert.equal(definitions.length, 2, `${key} must be defined once in en and once in ru`);
    }
  });

  it('localizes the external busy badge and documents write-setting limits in helper text', async () => {
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');
    const calendar = await read('src/components/appointments/AppointmentsCalendar.tsx');

    assert.equal((dictionaries.match(/^[ ]+externalBusyBadge:/gm) ?? []).length, 2);
    assert.match(dictionaries, /'appointments\.externalBusyBadge'/);
    assert.match(calendar, /t\('appointments\.externalBusyBadge'\)/);
    assert.doesNotMatch(calendar, /Busy \(Google\)/);

    const helpers = dictionaries.match(/^[ ]+googleCalendarWriteHelper: '.*',$/gm) ?? [];
    assert.equal(helpers.length, 2);
    assert.match(helpers[0], /does not remove events already created/);
    assert.match(helpers[0], /created or changed after/);
    assert.match(helpers[1], /не удаляет события, уже созданные/);
    assert.match(helpers[1], /созданные или изменённые после/);
  });
});
