import type { BlockContent } from '../types/publicPage';

export const SOCIAL_PLATFORMS = [
  'facebook-messenger', 'vk', 'whatsapp', 'viber', 'telegram', 'facebook', 'threads', 'instagram', 'tiktok',
] as const;

export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];

export function validateSocialPlatforms(content: BlockContent): string[] {
  return typeof content.platform === 'string' && SOCIAL_PLATFORMS.includes(content.platform as SocialPlatform)
    ? [] : ['platform is invalid'];
}
