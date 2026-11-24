import type { PageSection, SectionDesign, TypographyStyle } from '../types/publicPage';
import { createStableId } from '../utils/createStableId';

const noTypography = (): TypographyStyle => ({
  fontFamily: null, fontSize: null, fontWeight: null, fontStyle: null, color: null,
});

export function createEmptyPageSection(variant: SectionDesign['variant'] = 'off'): PageSection {
  return {
    id: createStableId(),
    name: '',
    visible: true,
    size: 'full',
    blocks: [],
    design: {
      variant,
      backgroundColor: null,
      textColor: null,
      backgroundMediaId: null,
      backgroundOverlay: 0,
      backgroundFit: 'cover',
      backgroundPosition: '50% 50%',
      paddingTop: 0,
      paddingBottom: 0,
      horizontalMargin: false,
      borderRadius: null,
      borderWidth: 0,
      borderColor: null,
      shadow: false,
      width: 'full',
      mobileVisible: true,
      headingStyle: noTypography(),
      textStyle: noTypography(),
      linkStyle: {
        titleStyle: noTypography(), subtitleStyle: noTypography(), backgroundColor: null, backgroundOpacity: null,
        borderWidth: null, borderColor: null, shadow: null, width: null, align: null,
      },
    },
  };
}
