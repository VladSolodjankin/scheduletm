// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { EditorNavigationGuard } from '../../src/components/public-page-builder/EditorNavigationGuard';
import { publishIssueText } from '../../src/components/public-page-builder/publishIssueText';
import { resolvePublicPageOrigin } from '../../src/features/public-page-builder/config/publicPageUrl';

let root: Root | undefined;
afterEach(async () => {
  await act(async () => root?.unmount());
  document.body.replaceChildren();
});

async function setup(save: () => Promise<unknown>, dirty = true) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const router = createMemoryRouter([
    { path: '/edit', element: createElement(EditorNavigationGuard, { locale: 'en', dirty, busy: false, save }) },
    { path: '/public-pages', element: createElement('div', null, 'Pages') },
  ], { initialEntries: ['/edit'] });
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(createElement(RouterProvider, { router })));
  await act(async () => { await router.navigate('/public-pages'); });
  return router;
}

async function click(label: string) {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

it('blocks dirty navigation and lets the user stay or explicitly discard', async () => {
  const save = vi.fn(async () => ({}));
  const router = await setup(save);
  expect(router.state.location.pathname).toBe('/edit');
  await click('Stay');
  expect(router.state.location.pathname).toBe('/edit');
  await act(async () => { await router.navigate('/public-pages'); });
  await click('Discard and leave');
  expect(router.state.location.pathname).toBe('/public-pages');
  expect(save).not.toHaveBeenCalled();
});

it('waits for a successful save before leaving and keeps failed or stale saves open', async () => {
  const save = vi.fn<() => Promise<unknown>>().mockResolvedValueOnce(null).mockResolvedValueOnce({ revision: 2 });
  const router = await setup(save);
  await click('Save and leave');
  expect(router.state.location.pathname).toBe('/edit');
  expect(document.body.textContent).toContain('Could not save');
  await click('Save and leave');
  expect(router.state.location.pathname).toBe('/public-pages');
});

it('does not navigate when the user cancels during an in-flight save', async () => {
  let complete!: (value: unknown) => void;
  const save = () => new Promise((resolve) => { complete = resolve; });
  const router = await setup(save);
  await click('Save and leave');
  await click('Stay');
  await act(async () => complete({ revision: 2 }));
  expect(router.state.location.pathname).toBe('/edit');
});

it('does not block a clean document', async () => {
  const router = await setup(async () => ({}), false);
  expect(router.state.location.pathname).toBe('/public-pages');
});

it('uses loopback origin only when no explicit public origin is configured', () => {
  expect(resolvePublicPageOrigin(undefined, 'http://localhost:5173')).toBe('http://localhost:5173');
  expect(resolvePublicPageOrigin('', 'http://127.0.0.1:5173')).toBe('http://127.0.0.1:5173');
  expect(resolvePublicPageOrigin('', 'https://cabinet.example.com')).toBe('https://meetli.cc');
  expect(resolvePublicPageOrigin('https://pages.example.com', 'http://localhost:5173')).toBe('https://pages.example.com');
});

it('renders actionable localized SEO validation instead of technical paths', () => {
  const issue = { code: 'missing_seo_description', path: 'seo.description' } as const;
  expect(publishIssueText('en', issue)).toBe('Enter a page description in Page settings.');
  expect(publishIssueText('ru', issue)).toContain('описание страницы');
});
