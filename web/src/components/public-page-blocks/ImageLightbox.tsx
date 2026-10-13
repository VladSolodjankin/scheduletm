import Lightbox, { type LightboxProps } from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import { useI18n } from '../../shared/i18n/I18nContext';
import { publicPageText } from '../public-page-builder/uiText';

export type LightboxImage = { src: string; alt: string; width?: number; height?: number };

// The lightbox renders in a portal outside the themed page, so its colors are fixed instead of using page CSS variables.
const rootStyle: NonNullable<LightboxProps['styles']>['root'] = {
  '--yarl__color_backdrop': 'rgba(0, 0, 0, 0.92)',
  '--yarl__color_button': 'rgba(255, 255, 255, 0.85)',
  '--yarl__color_button_active': '#ffffff',
  '--yarl__color_button_disabled': 'rgba(255, 255, 255, 0.3)',
};

export default function ImageLightbox({ images, index, onClose }: {
  images: readonly LightboxImage[];
  index: number;
  onClose: () => void;
}) {
  const { locale } = useI18n();
  return <Lightbox
    open
    close={onClose}
    index={index}
    slides={images.map((image) => ({ ...image }))}
    plugins={[Zoom]}
    carousel={{ finite: true }}
    styles={{ root: rootStyle }}
    labels={{
      Close: publicPageText(locale, 'lightboxClose'),
      'Zoom in': publicPageText(locale, 'lightboxZoomIn'),
      'Zoom out': publicPageText(locale, 'lightboxZoomOut'),
      Previous: publicPageText(locale, 'lightboxPrevious'),
      Next: publicPageText(locale, 'lightboxNext'),
    }}
  />;
}
