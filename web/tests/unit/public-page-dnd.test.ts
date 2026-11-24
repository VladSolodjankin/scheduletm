import { describe, expect, it } from 'vitest';
import { resolveDrop, type BuilderLayout } from '../../src/components/public-page-builder/BuilderDnd';

const layout: BuilderLayout = [
  { sectionId: 's1', blockIds: ['a'] },
  { sectionId: 's2', blockIds: ['b', 'c', 'd'] },
  { sectionId: 's3', blockIds: [] },
];

describe('public page drag and drop resolution', () => {
  it('moves a section to the final index after removal', () => {
    expect(resolveDrop({ type: 'section', sectionId: 's1' }, { type: 'section', sectionId: 's2' }, 'after', layout))
      .toEqual({ type: 'main', index: 1 });
    expect(resolveDrop({ type: 'section', sectionId: 's3' }, { type: 'section', sectionId: 's1' }, 'before', layout))
      .toEqual({ type: 'main', index: 0 });
  });

  it('ignores dropping an item on itself', () => {
    expect(resolveDrop({ type: 'section', sectionId: 's2' }, { type: 'block', sectionId: 's2', blockId: 'b' }, 'before', layout)).toBeNull();
    expect(resolveDrop({ type: 'block', blockId: 'b', sourceSectionId: 's2' }, { type: 'block', sectionId: 's2', blockId: 'b' }, 'after', layout)).toBeNull();
  });

  it('reorders a block inside its section with the index after removal', () => {
    expect(resolveDrop({ type: 'block', blockId: 'b', sourceSectionId: 's2' }, { type: 'block', sectionId: 's2', blockId: 'd' }, 'after', layout))
      .toEqual({ type: 'section', sectionId: 's2', index: 2 });
    expect(resolveDrop({ type: 'block', blockId: 'd', sourceSectionId: 's2' }, { type: 'block', sectionId: 's2', blockId: 'b' }, 'before', layout))
      .toEqual({ type: 'section', sectionId: 's2', index: 0 });
  });

  it('inserts a block next to a block of another section', () => {
    expect(resolveDrop({ type: 'block', blockId: 'a', sourceSectionId: 's1' }, { type: 'block', sectionId: 's2', blockId: 'c' }, 'before', layout))
      .toEqual({ type: 'section', sectionId: 's2', index: 1 });
    expect(resolveDrop({ type: 'block', blockId: 'a', sourceSectionId: 's1' }, { type: 'block', sectionId: 's2', blockId: 'd' }, 'after', layout))
      .toEqual({ type: 'section', sectionId: 's2', index: 3 });
  });

  it('drops a block on a section gap between sections and into an empty section', () => {
    expect(resolveDrop({ type: 'block', blockId: 'a', sourceSectionId: 's1' }, { type: 'section', sectionId: 's2' }, 'after', layout))
      .toEqual({ type: 'main', index: 2 });
    expect(resolveDrop({ type: 'block', blockId: 'a', sourceSectionId: 's1' }, { type: 'section', sectionId: 's3' }, 'before', layout))
      .toEqual({ type: 'section', sectionId: 's3', index: 0 });
  });
});
