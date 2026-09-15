import { describe, expect, it } from 'vitest';
import { archiveRestoreConflict, createEditorState, editorReducer } from '../../src/features/public-page-builder/model/editorReducer';
import { normalizeDocument } from '../../src/features/public-page-builder/model/normalizeDocument';
import { validateDocument } from '../../src/features/public-page-builder/model/validateDocument';
import { documentReferencesMedia } from '../../src/features/public-page-builder/model/media';
import { validateForPublish } from '../../src/features/public-page-builder/model/publishValidation';
import { isBlockScheduledVisible, localScheduleTimeToUtc, nextScheduleVisibilityChange, utcScheduleTimeToLocal } from '../../src/features/public-page-builder/model/schedule';
import { applyPublicPagePalette, PUBLIC_PAGE_THEMES, resetPublicPageDesignGroup } from '../../src/features/public-page-builder/config/themes';
import { PUBLIC_PAGE_TEMPLATES } from '../../src/features/public-page-builder/templates';
import { resolvePublicPageThemeVariables } from '../../src/components/public-page-blocks/publicPageThemeVariables';

describe('public page schedules', () => {
  it('converts local inputs and rejects ambiguous or nonexistent DST times', () => {
    expect(localScheduleTimeToUtc('2026-09-10T12:15', 'Europe/Samara')).toEqual({ value: '2026-09-10T08:15:00.000Z', error: null });
    expect(utcScheduleTimeToLocal('2026-09-10T08:15:00Z', 'Europe/Samara')).toBe('2026-09-10T12:15');
    expect(localScheduleTimeToUtc('2026-03-08T02:30', 'America/New_York').error).toBe('nonexistent_time');
    expect(localScheduleTimeToUtc('2026-11-01T01:30', 'America/New_York').error).toBe('ambiguous_time');
    expect(localScheduleTimeToUtc('2026-02-30T12:00', 'UTC').error).toBe('invalid_time');
  });
  it('uses inclusive start, exclusive end and ISO weekday in the page zone', () => {
    const schedule = { period: { startAt: '2026-09-10T20:00:00Z', endAt: '2026-09-11T20:00:00Z' }, weekdays: [5] };
    const start = Date.parse(schedule.period.startAt);
    expect(isBlockScheduledVisible(schedule, 'Europe/Samara', start - 1)).toBe(false);
    expect(isBlockScheduledVisible(schedule, 'Europe/Samara', start)).toBe(true);
    expect(isBlockScheduledVisible(schedule, 'UTC', start)).toBe(false);
    expect(isBlockScheduledVisible(schedule, 'Europe/Samara', Date.parse(schedule.period.endAt))).toBe(false);
  });
  it('finds exact local midnight through a DST transition and earlier period boundaries', () => {
    const document = normalizeDocument({ timezone: 'America/New_York', sections: [{ blocks: [{ type: 'divider', content: { height: 16 }, schedule: { period: null, weekdays: [7] } }] }] });
    const now = Date.parse('2026-03-08T05:00:00Z');
    expect(nextScheduleVisibilityChange(document, now)).toBe(Date.parse('2026-03-09T04:00:00Z'));
    document.sections[0].blocks[0].schedule.period = { startAt: '2026-03-08T06:00:00Z', endAt: '2026-03-08T08:00:00Z' };
    expect(nextScheduleVisibilityChange(document, now)).toBe(Date.parse('2026-03-08T06:00:00Z'));
  });
});

describe('public page archive', () => {
  const source = () => normalizeDocument({ sections: [{ id: 'source', blocks: [{ id: 'block', type: 'image', visible: false, content: { mediaId: 'photo' }, schedule: { period: null, weekdays: [1] } }] }] });
  it('archives atomically, protects media and restores unchanged to main when source was pruned', () => {
    const document = source();
    const state = createEditorState(document);
    const archived = editorReducer(state, { type: 'block/archive', sectionId: 'source', blockId: 'block' });
    expect(archived.document.sections).toEqual([]);
    expect(documentReferencesMedia(archived.document, 'photo')).toBe(true);
    expect(editorReducer(archived, { type: 'history/undo' }).document).toEqual(document);
    const restored = editorReducer(archived, { type: 'block/restore', blockId: 'block' });
    expect(restored.document.archivedBlocks).toEqual([]);
    expect(restored.document.sections[0].design.variant).toBe('off');
    expect(restored.document.sections[0].blocks[0]).toEqual(document.sections[0].blocks[0]);
    expect(editorReducer(restored, { type: 'history/undo' }).document).toEqual(archived.document);
  });
  it('restores at the end of existing section and keeps active social conflicts archived', () => {
    const document = source();
    document.sections[0].blocks.push({ ...structuredClone(document.sections[0].blocks[0]), id: 'other' });
    let state = editorReducer(createEditorState(document), { type: 'block/archive', sectionId: 'source', blockId: 'block' });
    const restored = editorReducer(state, { type: 'block/restore', blockId: 'block' });
    expect(restored.document.sections[0].blocks.map((block) => block.id)).toEqual(['other', 'block']);
    state = createEditorState(normalizeDocument({ sections: [{ blocks: [{ id: 'active', type: 'social-button', content: { platform: 'telegram' } }] }], archivedBlocks: [{ sourceSectionId: 'removed', block: { id: 'archived', type: 'social-button', content: { platform: 'telegram' } } }] }));
    expect(archiveRestoreConflict(state.document, 'archived')).toBe('social-platform');
    expect(editorReducer(state, { type: 'block/restore', blockId: 'archived' })).toBe(state);
  });
});

describe('advanced theme persistence', () => {
  it('renders custom page typography through an inherited section and keeps font CSS in rem', () => {
    const document = PUBLIC_PAGE_TEMPLATES[0].createDocument('styles');
    const theme = document.theme;
    theme.styleDefaults.headingStyle.color = '#ff0066';
    theme.styleDefaults.linkStyle.titleStyle.color = '#12ab34';
    theme.styleDefaults.linkStyle.titleStyle.fontSize = 18;
    const section = normalizeDocument({ sections: [{}] }).sections[0];
    const variables = resolvePublicPageThemeVariables(theme, section);
    expect(variables['--theme-heading-color']).toBe('#ff0066');
    expect(variables['--theme-link-title-color']).toBe('#12ab34');
    expect(variables['--theme-link-title-fontsize']).toBe('1.125rem');
    section.design.linkStyle.titleStyle.color = '#456789';
    expect(resolvePublicPageThemeVariables(theme, section)['--theme-link-title-color']).toBe('#456789');
  });
  it('keeps typography, spacing and button customization on palette switch; resets only requested group', () => {
    const theme = structuredClone(PUBLIC_PAGE_THEMES[0]);
    theme.roundingStyle = 'square';
    theme.styleDefaults.textStyle.fontSize = 19;
    theme.styleDefaults.linkStyle.backgroundOpacity = 0.7;
    theme.styleDefaults.linkStyle.borderWidth = 3;
    theme.styleDefaults.linkStyle.titleStyle.color = '#ff0044';
    theme.tokens.layout.linkGap = 13;
    const switched = applyPublicPagePalette(theme, PUBLIC_PAGE_THEMES[2]);
    expect(switched.styleDefaults.textStyle.fontSize).toBe(19);
    expect(switched.styleDefaults.linkStyle.backgroundOpacity).toBe(0.7);
    expect(switched.styleDefaults.linkStyle.titleStyle.color).toBe('#ff0044');
    expect(switched.tokens.layout.linkGap).toBe(13);
    const reset = resetPublicPageDesignGroup(switched, 'buttons');
    expect(reset.styleDefaults.textStyle).toEqual(switched.styleDefaults.textStyle);
    expect(reset.styleDefaults.linkStyle.borderWidth).toBe(0);
    expect(reset.colors).toEqual(switched.colors);
    expect(reset.roundingStyle).toBe('square');
    switched.colors.primary = '#ffab12';
    switched.colors.surface = '#ab23ff';
    const resetSections = resetPublicPageDesignGroup(switched, 'sections');
    expect(resetSections.colors.primary).toBe(PUBLIC_PAGE_THEMES[2].colors.primary);
    expect(resetSections.colors.surface).toBe(PUBLIC_PAGE_THEMES[2].colors.surface);
    expect(resetSections.styleDefaults.linkStyle.titleStyle.color).toBe('#ff0044');
  });
  it('validates all new templates and rejects legacy, duplicate archive IDs and invalid schedules', () => {
    for (const template of PUBLIC_PAGE_TEMPLATES) {expect(validateDocument(template.createDocument('page')).errors).toEqual([]);}
    const document = PUBLIC_PAGE_TEMPLATES.find((template) => template.id === 'specialist')!.createDocument('page');
    const button = document.sections[1].blocks[0];
    document.archivedBlocks = [{ block: structuredClone(button), sourceSectionId: 'removed' }];
    expect(validateDocument(document).errors.some((error) => error.code === 'duplicate_id')).toBe(true);
    document.archivedBlocks = [];
    button.schedule = { period: null, weekdays: [] };
    expect(validateDocument(document).valid).toBe(false);
    button.schedule = { period: { startAt: '2026-02-30T00:00:00Z', endAt: '2026-03-10T00:00:00Z' }, weekdays: null };
    expect(validateDocument(document).valid).toBe(false);
    button.schedule = { period: null, weekdays: null };
    button.content.radius = 12;
    expect(validateDocument(document).valid).toBe(false);
  });
  it('does not block publication on archive-only alt but still validates shared and orphan media', () => {
    const document = normalizeDocument({ archivedBlocks: [{ sourceSectionId: 'old', block: { type: 'image', content: { mediaId: 'image' } } }], media: [{ id: 'image', url: 'https://example.com/image.png', alt: '', mimeType: 'image/png', width: 100, height: 100 }] });
    expect(validateForPublish(document).issues.some((issue) => issue.code === 'missing_alt')).toBe(false);
    document.seo.imageMediaId = 'image';
    expect(validateForPublish(document).issues.some((issue) => issue.code === 'missing_alt')).toBe(true);
    document.seo.imageMediaId = null;
    document.archivedBlocks = [];
    expect(validateForPublish(document).issues.some((issue) => issue.code === 'missing_alt')).toBe(true);
  });
});
