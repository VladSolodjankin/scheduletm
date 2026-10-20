import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

function telegramBotKeys(dictionaries, locale) {
  const start = dictionaries.indexOf('    telegramBot: {', locale === 'en' ? 0 : dictionaries.indexOf('  ru: {'));
  const end = dictionaries.indexOf('    },', start);
  return [...dictionaries.slice(start, end).matchAll(/^      (\w+):/gm)].map((match) => match[1]);
}

describe('web telegram bot settings contracts', () => {
  it('registers a role-restricted route and menu item after public pages', async () => {
    const router = await read('src/app/router.tsx');
    const layout = await read('src/components/layout/MainLayout.tsx');

    assert.match(router, /path: '\/telegram-bot', element: <RoleRoute><TelegramBotPage \/><\/RoleRoute>/);
    assert.match(layout, /\{ to: '\/public-pages'[\s\S]*\{ to: '\/telegram-bot', label: t\('telegramBot\.menu'\)/);
  });

  it('uses the account scoped settings endpoint with bearer auth', async () => {
    const client = await read('src/shared/api/client.ts');

    assert.match(client, /get<T>\('\/api\/settings\/telegram-bot'/);
    assert.match(client, /put<T>\('\/api\/settings\/telegram-bot'/);
    assert.match(client, /telegramBotApi[\s\S]*authHeaders\(accessToken\)/);
  });

  it('keeps the slug rules aligned with the server and limits the welcome message', async () => {
    const container = await read('src/containers/TelegramBotContainer.tsx');
    const schemas = await read('../server/src/config/schemas.ts');

    assert.match(container, /SLUG_PATTERN = \/\^\[a-z0-9_-\]\{3,40\}\$\//);
    assert.match(schemas, /BOT_SLUG_PATTERN = \/\^\[a-z0-9_-\]\{3,40\}\$\//);
    assert.match(container, /WELCOME_MAX_LENGTH = 500/);
    assert.match(schemas, /BOT_WELCOME_MESSAGE_MAX_LENGTH = 500/);
  });

  it('offers QR download and copy as PNG and SVG without extra services', async () => {
    const qr = await read('src/components/telegram-bot/BotQrCode.tsx');

    assert.match(qr, /QRCode\.toDataURL/);
    assert.match(qr, /type: 'svg'/);
    assert.match(qr, /image\/png/);
    assert.match(qr, /navigator\.clipboard\.writeText/);
  });

  it('defines the same telegramBot keys for en and ru', async () => {
    const dictionaries = await read('src/shared/i18n/dictionaries.ts');
    const en = telegramBotKeys(dictionaries, 'en');
    const ru = telegramBotKeys(dictionaries, 'ru');

    assert.ok(en.length > 10);
    assert.deepEqual(ru, en);
  });
});
