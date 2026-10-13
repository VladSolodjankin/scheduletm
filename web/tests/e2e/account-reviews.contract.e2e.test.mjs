import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

describe('web account reviews contracts', () => {
  it('registers a role-restricted route and menu item next to public pages', async () => {
    const router = await read('src/app/router.tsx');
    const layout = await read('src/components/layout/MainLayout.tsx');

    assert.match(router, /path: '\/account-reviews', element: <RoleRoute><AccountReviewsPage \/><\/RoleRoute>/);
    assert.match(router, /function RoleRoute[\s\S]*WebUserRole\.ProductAdmin \|\| user\?\.role === WebUserRole\.Owner[\s\S]*Navigate to="\/appointments"/);
    assert.match(layout, /\{ to: '\/public-pages'[\s\S]*\{ to: '\/account-reviews', label: t\('common\.accountReviews'\)/);
  });

  it('uses the fixed account reviews API paths with bearer auth', async () => {
    const client = await read('src/shared/api/client.ts');

    assert.match(client, /get<T>\('\/api\/account-reviews'/);
    assert.match(client, /post<T>\('\/api\/account-reviews'/);
    assert.match(client, /patch<T>\(`\/api\/account-reviews\/\$\{reviewId\}`/);
    assert.match(client, /delete\(`\/api\/account-reviews\/\$\{reviewId\}`/);
    assert.match(client, /accountReviewsApi[\s\S]*authHeaders\(accessToken\)/);
  });

  it('manages screenshots through the shared media API with cleanup after changes', async () => {
    const container = await read('src/containers/AccountReviewsContainer.tsx');
    const form = await read('src/components/account-reviews/ReviewFormDialog.tsx');

    assert.match(container, /imageMediaApi\.upload/);
    assert.match(container, /previousMediaId !== payload\.screenshotMediaId/);
    assert.match(container, /cleanupManagedImage\(review\.screenshot\.mediaId\)/);
    assert.match(container, /review_limit_reached: 'accountReviews\.errors\.limitReached'/);
    assert.match(container, /status: review\.status === 'published' \? 'hidden' : 'published'/);
    assert.match(form, /fullScreen=\{fullScreen\}/);
    assert.match(form, /MAX_NAME_LENGTH = 80/);
    assert.match(form, /MAX_TEXT_LENGTH = 1500/);
    assert.match(form, /const altInvalid = Boolean\(screenshotMediaId\) && !screenshotAlt\.trim\(\)/);
  });

  it('fetches public reviews only for pages with a visible reviews block and hides the block when empty', async () => {
    const view = await read('src/pages/PublicPageViewPage.tsx');
    const renderer = await read('src/components/public-page-blocks/PublicPageRenderer.tsx');
    const block = await read('src/components/public-page-blocks/ReviewsBlock.tsx');

    assert.match(view, /block\.visible && block\.type === 'reviews'/);
    assert.match(view, /\/reviews`/);
    assert.match(view, /<PublicPageRenderer document=\{page\} services=\{services\} reviews=\{reviews\} \/>/);
    assert.match(renderer, /block\.type === 'reviews'\) \{return Boolean\(reviews && reviews\.reviews\.length > 0\)/);
    assert.match(block, /if \(editor\) \{[\s\S]*href="\/account-reviews"/);
    assert.match(block, /prefers-reduced-motion|useReducedMotion/);
    assert.match(block, /role="img"/);
  });

  it('keeps the lightbox lazy, localized and out of the builder preview', async () => {
    const lightbox = await read('src/components/public-page-blocks/ImageLightbox.tsx');
    const credentials = await read('src/components/public-page-blocks/CredentialsBlock.tsx');

    assert.match(lightbox, /plugins=\{\[Zoom\]\}/);
    assert.match(lightbox, /yet-another-react-lightbox\/styles\.css/);
    assert.match(lightbox, /lightboxZoomIn/);
    assert.match(credentials, /lazy\(\(\) => import\('\.\/ImageLightbox'\)\)/);
    assert.match(credentials, /!editor && openIndex !== null/);
  });
});
