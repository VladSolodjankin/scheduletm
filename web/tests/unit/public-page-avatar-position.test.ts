import { describe, expect, it } from 'vitest';
import {
  formatAvatarPosition,
  moveAvatarPosition,
  normalizeAvatarPosition,
  parseAvatarPosition,
} from '../../src/features/public-page-builder/model/avatarPosition';

describe('profile avatar position', () => {
  it('parses only bounded two-axis percentage positions', () => {
    expect(parseAvatarPosition('17% 63%')).toEqual([17, 63]);
    for (const value of ['17.5% 63%', '050% 50%', '17%,63%', '17 63', '-1% 50%', '101% 50%', '50% 50% extra', null]) {
      expect(parseAvatarPosition(value)).toBeNull();
    }
  });

  it('normalizes missing or malformed input to the center and formats integer percentages', () => {
    expect(normalizeAvatarPosition(undefined)).toBe('50% 50%');
    expect(normalizeAvatarPosition('12.3% 56.8%')).toBe('50% 50%');
    expect(formatAvatarPosition([12.34, 56.78])).toBe('12% 57%');
    expect(formatAvatarPosition([0, 100])).toBe('0% 100%');
  });

  it('moves and clamps only the axis that overflows a square crop', () => {
    expect(moveAvatarPosition([50, 50], -50, 30, 200, 400, 200)).toEqual([75, 50]);
    expect(moveAvatarPosition([50, 50], 30, -50, 200, 200, 400)).toEqual([50, 75]);
    expect(moveAvatarPosition([5, 50], 100, 0, 200, 400, 200)).toEqual([0, 50]);
    expect(moveAvatarPosition([50, 50], -100, 0, 200, 100, 100)).toEqual([50, 50]);
  });
});
