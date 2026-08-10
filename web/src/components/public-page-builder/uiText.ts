import { dictionaries, type Locale, type TranslationKey } from '../../shared/i18n/dictionaries';

const keys = {
  pages: 'publicPageBuilder.pages', create: 'publicPageBuilder.create', empty: 'publicPageBuilder.empty',
  loading: 'publicPageBuilder.loading', retry: 'publicPageBuilder.retry', edit: 'publicPageBuilder.edit',
  duplicate: 'publicPageBuilder.duplicate', archive: 'publicPageBuilder.archive', draft: 'publicPageBuilder.draft',
  published: 'publicPageBuilder.published', archived: 'publicPageBuilder.archived', save: 'publicPageBuilder.save',
  saving: 'publicPageBuilder.saving', saved: 'publicPageBuilder.saved', saveError: 'publicPageBuilder.saveError',
  publish: 'publicPageBuilder.publish', undo: 'publicPageBuilder.undo', redo: 'publicPageBuilder.redo',
  preview: 'publicPageBuilder.preview', open: 'publicPageBuilder.open', copyLink: 'publicPageBuilder.copyLink',
  linkCopied: 'publicPageBuilder.linkCopied', sections: 'publicPageBuilder.sections', blocks: 'publicPageBuilder.blocks',
  addSection: 'publicPageBuilder.addSection', addBlock: 'publicPageBuilder.addBlock', inspector: 'publicPageBuilder.inspector',
  page: 'publicPageBuilder.page', section: 'publicPageBuilder.section', block: 'publicPageBuilder.block',
  title: 'publicPageBuilder.title', description: 'publicPageBuilder.description', slug: 'publicPageBuilder.slug',
  visible: 'publicPageBuilder.visible', remove: 'publicPageBuilder.remove', moveUp: 'publicPageBuilder.moveUp',
  moveDown: 'publicPageBuilder.moveDown', name: 'publicPageBuilder.name', theme: 'publicPageBuilder.theme',
  background: 'publicPageBuilder.background', textColor: 'publicPageBuilder.textColor',
  deviceMobile: 'publicPageBuilder.deviceMobile', deviceTablet: 'publicPageBuilder.deviceTablet',
  deviceDesktop: 'publicPageBuilder.deviceDesktop',
  noSelection: 'publicPageBuilder.noSelection', invalidSlug: 'publicPageBuilder.invalidSlug',
  validation: 'publicPageBuilder.validation', notFound: 'publicPageBuilder.notFound',
  unavailable: 'publicPageBuilder.unavailable',
  template: 'publicPageBuilder.template', revisionConflict: 'publicPageBuilder.revisionConflict',
  reloadLatest: 'publicPageBuilder.reloadLatest',
  addItem: 'publicPageBuilder.addItem',
  deleteConfirm: 'publicPageBuilder.deleteConfirm',
  uploadImage: 'publicPageBuilder.uploadImage', replaceImage: 'publicPageBuilder.replaceImage',
  imageAlt: 'publicPageBuilder.imageAlt', invalidImageType: 'publicPageBuilder.invalidImageType',
  imageTooLarge: 'publicPageBuilder.imageTooLarge', imageUploadError: 'publicPageBuilder.imageUploadError',
  displayName: 'publicPageBuilder.displayName', profileDescription: 'publicPageBuilder.profileDescription',
  logo: 'publicPageBuilder.logo', avatar: 'publicPageBuilder.avatar', blockBackground: 'publicPageBuilder.blockBackground',
  pageBackground: 'publicPageBuilder.pageBackground', overlay: 'publicPageBuilder.overlay', imageFit: 'publicPageBuilder.imageFit',
  focalPoint: 'publicPageBuilder.focalPoint', font: 'publicPageBuilder.font', pageColor: 'publicPageBuilder.pageColor',
  backgroundPreset: 'publicPageBuilder.backgroundPreset',
} as const satisfies Record<string, TranslationKey>;

export type PublicPageUiKey = keyof typeof keys;

export function publicPageText(locale: Locale, key: PublicPageUiKey): string {
  const dictionaryKey = keys[key].slice('publicPageBuilder.'.length) as keyof typeof dictionaries.en.publicPageBuilder;
  return dictionaries[locale].publicPageBuilder[dictionaryKey];
}
