import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

describe('google calendar integration contracts', () => {
  it('has no calendar-write settings fields or start payload types', async () => {
    const types = await read('src/shared/types/api.ts');

    assert.doesNotMatch(types, /googleCalendarWrite|GoogleOAuthStartPayload|GoogleCalendarWriteUpdatePayload/);
    assert.doesNotMatch(types, /organizerEmail|creatorEmail/);
  });

  it('connects with a plain start and has no toggle, grant flow or scope_write handling', async () => {
    const container = await read('src/containers/SettingsContainer.tsx');

    assert.match(container, /'\/api\/integrations\/google\/oauth\/start'/);
    assert.match(container, /status === 503/);
    assert.doesNotMatch(container, /googleCalendarWrite(?!Required)|google_write_scope_missing|scope_write|grantGoogleCalendarAccess|startGoogleOauth/);
  });

  it('removes the switch and grant button from the integrations tab and card', async () => {
    const tab = await read('src/components/settings-tabs/IntegrationsSettingsTab.tsx');
    const card = await read('src/components/SettingsCard.tsx');

    assert.doesNotMatch(tab, /Switch|FormControlLabel|googleCalendarWrite|onGrantGoogleCalendarAccess|onToggleGoogleCalendarWrite/);
    assert.doesNotMatch(card, /GoogleGrantingAccess|GoogleWriteSaving|onGrantGoogleCalendarAccess|onToggleGoogleCalendarWrite/);
    assert.match(tab, /copy\.googleCalendarCaption/);
    assert.match(tab, /disabled=\{userSettings\.googleConnected \|\| isGoogleDisconnecting/);
  });

  it('keeps the caption and callback error keys once in en and once in ru, without removed keys', async () => {
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');

    for (const key of ['googleCalendarCaption', 'googleCalendarWriteRequired', 'googleNotConfigured']) {
      const definitions = dictionaries.match(new RegExp(`^[ ]+${key}:`, 'gm')) ?? [];
      assert.equal(definitions.length, 2, `${key} must be defined once in en and once in ru`);
    }

    assert.doesNotMatch(dictionaries, /googleCalendarWrite(?!Required)|googleWriteScopeMissing|saveGoogleCalendarWrite/);
  });

  it('shows the calendar_write_required error and cleans callback params', async () => {
    const container = await read('src/containers/SettingsContainer.tsx');

    assert.match(container, /oauthReason === 'calendar_write_required'[\s\S]*settings\.errors\.googleCalendarWriteRequired/);
    assert.match(container, /nextParams\.delete\('google_oauth'\)/);
    assert.match(container, /nextParams\.delete\('reason'\)/);
  });

  it('renders optional busy slot titles with the localized generic label as fallback', async () => {
    const types = await read('src/shared/types/api.ts');
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');
    const calendar = await read('src/components/appointments/AppointmentsCalendar.tsx');

    assert.match(types, /source: 'google';\s*title\?: string;/);
    assert.equal((dictionaries.match(/^[ ]+externalBusyBadge:/gm) ?? []).length, 2);
    assert.match(calendar, /label=\{slot\.title \?\? t\('appointments\.externalBusyBadge'\)\}/);
    assert.doesNotMatch(calendar, /Busy \(Google\)/);
  });

  it('lands on the Integrations tab after a provider OAuth redirect', async () => {
    const container = await read('src/containers/SettingsContainer.tsx');

    assert.match(container, /const isOauthReturn = Boolean\(googleOauthStatus \|\| zoomOauthStatus \|\| yandexOauthStatus \|\| stripeOauthStatus\);/);
    assert.match(container, /: 'integrations';/);
    assert.match(container, /if \(!tab && isOauthReturn\) \{[\s\S]*pathname: `\/settings\/\$\{oauthReturnTab\}`/);
  });
});
