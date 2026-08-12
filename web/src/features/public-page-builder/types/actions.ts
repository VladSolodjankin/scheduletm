import type {
  BlockDesign,
  MediaReference,
  PageBlock,
  PageProfile,
  PageSection,
  PageSeo,
  PageTheme,
  PublicPageDocument,
} from './publicPage';
import type { EditorSaveStatus } from './editor';

export type EditorAction =
  | { type: 'document/replace'; document: PublicPageDocument }
  | { type: 'profile/update'; changes: Partial<PageProfile> }
  | { type: 'seo/update'; changes: Partial<PageSeo> }
  | { type: 'slug/update'; slug: string }
  | { type: 'theme/update'; theme: PageTheme }
  | { type: 'media/add'; media: MediaReference }
  | { type: 'media/remove'; mediaId: string }
  | { type: 'section/add'; section: PageSection; index?: number }
  | { type: 'section/update'; sectionId: string; changes: Partial<Omit<PageSection, 'id' | 'blocks'>> }
  | { type: 'section/remove'; sectionId: string }
  | { type: 'section/reorder'; sectionId: string; toIndex: number }
  | { type: 'section/toggle'; sectionId: string }
  | { type: 'block/add'; sectionId: string; block: PageBlock; index?: number }
  | { type: 'block/create-with-section'; section: PageSection; afterSectionId?: string | null }
  | { type: 'block/update'; sectionId: string; blockId: string; changes: Partial<Omit<PageBlock, 'id'>> }
  | { type: 'block/design'; sectionId: string; blockId: string; changes: Partial<BlockDesign> }
  | { type: 'block/remove'; sectionId: string; blockId: string }
  | { type: 'block/move-or-detach'; fromSectionId: string; toSectionId?: string; block: PageBlock; index?: number; newSection?: PageSection; sectionChanges?: Partial<Omit<PageSection, 'id' | 'blocks'>> }
  | { type: 'block/reorder'; sectionId: string; blockId: string; toIndex: number }
  | { type: 'layout/drop'; item: { type: 'section'; sectionId: string } | { type: 'block'; blockId: string } | { type: 'staged'; block: PageBlock }; to: { type: 'section'; sectionId: string; index: number } | { type: 'main'; index: number }; standaloneSection?: PageSection }
  | { type: 'block/toggle'; sectionId: string; blockId: string }
  | { type: 'selection/set'; sectionId: string | null; blockId?: string | null }
  | { type: 'selection/clear' }
  | { type: 'history/undo' }
  | { type: 'history/redo' }
  | { type: 'save/status'; status: EditorSaveStatus; error?: string | null }
  | { type: 'save/succeeded'; document: PublicPageDocument }
  | { type: 'publish/errors'; errors: string[] }
  | { type: 'publish/succeeded'; document: PublicPageDocument };
