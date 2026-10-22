import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

function sectionKeys(dictionarySource, locale, section) {
  const localeStart = dictionarySource.indexOf(`\n  ${locale}: {`);
  const sectionStart = dictionarySource.indexOf(`\n    ${section}: {`, localeStart);
  const sectionEnd = dictionarySource.indexOf('\n    },', sectionStart);
  const body = dictionarySource.slice(sectionStart, sectionEnd);
  return [...body.matchAll(/^\s{6}(\w+):/gm)].map((match) => match[1]).sort();
}

describe('web payment setup contracts', () => {
  it('adds the owner-only payments tab right after integrations', async () => {
    const card = await read('src/components/SettingsCard.tsx');
    const container = await read('src/containers/SettingsContainer.tsx');

    assert.match(
      card,
      /key: 'integrations'[\s\S]*?canManageAccountSettings \? \[\{ key: 'payments', label: copy\.paymentsTab \}\][\s\S]*?key: 'password'/,
    );
    assert.match(container, /'integrations',\s*\.\.\.\(canManageAccountSettings \? \['payments'\] : \[\]\),\s*'password'/);
    assert.match(container, /searchParams\.get\('stripe_oauth'\)/);
    assert.match(container, /nextParams\.delete\('stripe_oauth'\)/);
  });

  it('keeps payments locale keys in sync between en and ru', async () => {
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');

    for (const section of ['payments', 'payPage']) {
      const en = sectionKeys(dictionaries, 'en', section);
      const ru = sectionKeys(dictionaries, 'ru', section);
      assert.ok(en.length > 10, `${section} en keys exist`);
      assert.deepEqual(ru, en, `${section} keys match in en and ru`);
    }
    assert.match(dictionaries, /payments: 'Payment setup'/);
    assert.match(dictionaries, /payments: 'Настройка оплаты'/);
    assert.match(dictionaries, /'settings\.tabs\.payments'/);
  });

  it('uses the fixed payment API paths', async () => {
    const client = await read('src/shared/api/client.ts');

    for (const path of [
      "'/api/settings/payments'",
      "'/api/settings/payments/manual'",
      '`/api/settings/payments/providers/${provider}`',
      '`/api/settings/payments/providers/${provider}/disconnect`',
      "'/api/settings/payments/active-provider'",
      "'/api/integrations/stripe/oauth/start'",
      "'/api/settings/payments/test-reminder'",
      '`/api/public/payments/${encodeURIComponent(token)}`',
      '`/api/public/payments/${encodeURIComponent(token)}/checkout`',
    ]) {
      assert.ok(client.includes(path), `client calls ${path}`);
    }
  });

  it('reuses shared components and extracts the integration panel', async () => {
    const tab = await read('src/components/settings-tabs/PaymentsSettingsTab.tsx');
    const integrations = await read('src/components/settings-tabs/IntegrationsSettingsTab.tsx');

    assert.match(tab, /AppIntegrationPanel/);
    assert.match(tab, /AppCopyableField/);
    assert.match(tab, /AppRhfSecretKeyField/);
    assert.match(tab, /FormControlLabel/);
    assert.match(tab, /<Switch/);
    assert.match(integrations, /AppIntegrationPanel/);
    assert.doesNotMatch(integrations, /function IntegrationPanel/);
  });

  it('registers the public pay route outside authentication and renders manual links safely', async () => {
    const router = await read('src/app/router.tsx');
    const page = await read('src/pages/PublicPaymentPage.tsx');

    assert.match(router, /path: '\/pay\/:token'/);
    assert.doesNotMatch(router, /path: '\/pay\/:token'[^}]*ProtectedRoute/);
    assert.match(page, /rel="noopener noreferrer"/);
    assert.match(page, /window\.location\.assign\(response\.data\.redirectUrl\)/);
  });

  it('offers mark-unpaid next to mark-paid for appointments', async () => {
    const container = await read('src/containers/AppointmentsContainer.tsx');
    const dialog = await read('src/components/appointments/AppointmentFormDialog.tsx');

    assert.match(container, /\/api\/appointments\/\$\{editingItem\.id\}\/mark-unpaid/);
    assert.match(dialog, /appointments\.markUnpaidAction/);
    assert.match(dialog, /editingItem\.price > 0/);
  });
});
