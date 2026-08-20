import { describe, expect, it } from 'vitest';
import {
  applyAvatarCoverColor,
  isSameAvatarCoverColor,
  resolveAvatarCoverPalette,
  resolveSelectedAvatarCoverColor,
} from '../../src/components/public-page-builder/avatarCoverPalette';

const theme = {
  colors: { background: '#F4EAD5', surface: '#ffffff', primary: '#c58f55', text: '#21170b' },
};

describe('avatar cover design palette', () => {
  it('keeps design color order and removes duplicate colors case-insensitively', () => {
    expect(resolveAvatarCoverPalette(theme)).toEqual(['#F4EAD5', '#ffffff', '#c58f55', '#21170b']);
    expect(resolveAvatarCoverPalette({ colors: { ...theme.colors, surface: '#f4ead5' } }))
      .toEqual(['#F4EAD5', '#c58f55', '#21170b']);
  });

  it('selects the design primary color by default', () => {
    expect(resolveSelectedAvatarCoverColor(theme, null)).toBe('#c58f55');
    expect(resolveSelectedAvatarCoverColor(theme, '  ')).toBe('#c58f55');
    expect(resolveSelectedAvatarCoverColor(theme, '#123456')).toBe('#123456');
  });

  it('clears a legacy cover image when a design color is selected', () => {
    expect(applyAvatarCoverColor({ coverMediaId: 'legacy-cover', coverColor: '#123456' }, '#c58f55'))
      .toEqual({ coverMediaId: null, coverColor: '#c58f55' });
    expect(isSameAvatarCoverColor('#FFFFFF', '#ffffff')).toBe(true);
  });
});
