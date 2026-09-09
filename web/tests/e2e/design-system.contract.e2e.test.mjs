import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

describe('dashboard design system contracts', () => {
  it('keeps palette, typography, spacing, and radii in one token source', async () => {
    const constants = await read('src/shared/theme/constants.ts');
    const theme = await read('src/shared/theme/createAppTheme.ts');

    assert.match(constants, /space: \{ xs: '0\.25rem', s: '0\.5rem', m: '1rem', l: '1\.5rem', xl: '2rem' \}/);
    assert.match(constants, /fontSize: \{ xs: '0\.75rem', s: '0\.875rem', m: '1rem', l: '1\.25rem', xl: '1\.75rem' \}/);
    assert.match(constants, /radius:[\s\S]*xs: '0\.25rem'[\s\S]*s: '0\.5rem'[\s\S]*m: '1rem'[\s\S]*l: '1\.5rem'[\s\S]*xl: '2rem'/);
    assert.match(constants, /PaletteVariantId = 'default'/);
    assert.match(constants, /muiRadiusMultiplier: 14/);
    assert.match(theme, /shape: \{ borderRadius: APP_TOKENS\.publicPageBase\.muiRadiusMultiplier \}/);
    assert.match(theme, /'--app-color-primary': colors\.primary/);
    assert.match(theme, /borderRadius: 'var\(--app-radius-m\)'/);
  });

  it('provides reusable panels, tables, buttons, links, fields, dialogs, and uploads', async () => {
    const appStyles = await read('src/shared/styles/app.css');
    const components = await Promise.all([
      read('src/shared/ui/AppSurface.tsx'),
      read('src/shared/ui/AppDataTable.tsx'),
      read('src/shared/ui/AppButton.tsx'),
      read('src/shared/ui/AppLink.tsx'),
      read('src/shared/ui/AppTextField.tsx'),
      read('src/shared/ui/AppDialog.tsx'),
      read('src/shared/ui/AppImageUpload.tsx'),
    ]);

    for (const className of [
      'app-surface',
      'app-data-table__table',
      'app-button',
      'app-link',
      'app-field',
      'app-dialog',
      'app-image-upload',
    ]) {
      assert.match(appStyles, new RegExp(`\\.${className.replaceAll('__', '__')}`));
      assert.ok(components.some((source) => source.includes(`className=\"${className}`)
        || source.includes(`'${className}'`)), `${className} must be used by a shared component`);
    }

    assert.doesNotMatch(appStyles, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });

  it('keeps Services on token-backed classes without giant pill surfaces', async () => {
    const serviceCard = await read('src/components/services/ServiceCard.tsx');
    const serviceForm = await read('src/components/services/ServiceFormDialog.tsx');
    const serviceStyles = await read('src/components/services/services.css');

    assert.match(serviceCard, /className="service-card"/);
    assert.match(serviceForm, /className="service-form__main"/);
    assert.match(serviceStyles, /\.service-card[\s\S]*border-radius: var\(--app-radius-m\)/);
    assert.match(serviceStyles, /\.service-card__assignment[\s\S]*border-radius: var\(--app-radius-s\)/);
    assert.doesNotMatch(serviceStyles, /border-radius:\s*(?:224px|\d+(?:\.\d+)?rem)/);
    assert.doesNotMatch(serviceStyles, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    assert.doesNotMatch(`${serviceCard}\n${serviceForm}`, /sx=\{\{/);
  });

  it('uses one fixed dashboard palette and leaves authored public-page radii explicit', async () => {
    const header = await read('src/components/layout/Header.tsx');
    const leftMenu = await read('src/components/layout/LeftMenu.tsx');
    const layout = await read('src/components/layout/MainLayout.tsx');
    const blockRenderer = await read('src/components/public-page-blocks/BlockRenderer.tsx');

    assert.doesNotMatch(`${header}\n${leftMenu}`, /PALETTE_VARIANTS|paletteVariantId|onChangePalette/);
    assert.match(layout, /uiPaletteVariantId: DEFAULT_PALETTE_VARIANT_ID/);
    assert.match(blockRenderer, /return borderRadius !== null \? `\$\{borderRadius\}px` : sectionThemeRadius/);
    assert.doesNotMatch(blockRenderer, /shared\/styles\/app\.css|services\.css/);
  });
});
