import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

function countKey(source, key) {
  return (source.match(new RegExp(`^[ ]+${key}:`, 'gm')) ?? []).length;
}

describe('microsoft calendar and apple calendar feed contracts', () => {
  it('types the additive user settings flags and API responses', async () => {
    const types = await read('src/shared/types/api.ts');

    assert.match(types, /microsoftConnected: boolean;/);
    assert.match(types, /appleCalendarFeedEnabled: boolean;/);
    assert.match(types, /provider: 'microsoft';\s*authorizeUrl: string;/);
    assert.match(types, /provider: 'apple_feed';\s*feedUrl: string;\s*webcalUrl: string;/);
  });

  it('starts, disconnects and handles the Microsoft OAuth return with per-reason messages', async () => {
    const container = await read('src/containers/SettingsContainer.tsx');

    assert.match(container, /'\/api\/integrations\/microsoft\/oauth\/start'/);
    assert.match(container, /'\/api\/integrations\/microsoft\/disconnect'/);
    assert.match(container, /searchParams\.get\('microsoft_oauth'\)/);
    assert.match(container, /nextParams\.delete\('microsoft_oauth'\)/);
    for (const reason of ['invalid_state', 'microsoft_oauth_not_configured', 'token_exchange_failed', 'calendar_write_required', 'access_denied', 'admin_consent_required', 'provider_error']) {
      assert.match(container, new RegExp(`case '${reason}'`));
    }
  });

  it('creates and revokes the Apple feed and keeps the full URL only in memory', async () => {
    const container = await read('src/containers/SettingsContainer.tsx');
    const tab = await read('src/components/settings-tabs/IntegrationsSettingsTab.tsx');

    assert.match(container, /apiClient\.post<AppleCalendarFeedCreateResponse>\(\s*'\/api\/integrations\/apple\/feed'/);
    assert.match(container, /apiClient\.delete<AppleCalendarFeedRevokeResponse>\(\s*'\/api\/integrations\/apple\/feed'/);
    assert.match(container, /code === 'specialist_required'/);
    assert.doesNotMatch(container, /(localStorage|sessionStorage)/);
    assert.match(tab, /href=\{appleFeedLink\?\.webcalUrl\}/);
    assert.match(tab, /AppConfirmDialog/);
  });

  it('defines every new locale key once in en and once in ru', async () => {
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');
    const keys = [
      'connectingMicrosoft', 'disconnectingMicrosoft', 'connectMicrosoftHelpTitle', 'microsoftCalendarCaption',
      'microsoftConnectedSuccessfully', 'microsoftNotConfigured', 'microsoftInvalidRequest',
      'microsoftTokenExchangeFailed', 'microsoftCalendarWriteRequired', 'microsoftAccessDenied',
      'microsoftAdminConsentRequired', 'microsoftProviderError',
      'appleCalendarLinkWarning', 'appleCalendarRegenerateDescription', 'appleCalendarSpecialistRequired',
      'createAppleCalendarFeed', 'revokeAppleCalendarFeed', 'externalBusyBadgeMicrosoft',
    ];

    for (const key of keys) {
      assert.equal(countKey(dictionaries, key), 2, `${key} must be defined once in en and once in ru`);
    }
  });
});
