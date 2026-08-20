import {
  AccountCircleOutlined,
  ArrowBack,
  ChatBubbleOutlined,
  Close,
  CollectionsOutlined,
  ContactPageOutlined,
  DesignServicesOutlined,
  HorizontalRuleOutlined,
  ImageOutlined,
  LinkOutlined,
  MapOutlined,
  QuizOutlined,
  ShareOutlined,
  SmartButtonOutlined,
  TextFieldsOutlined,
} from '@mui/icons-material';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { SocialPlatformIcon, socialPlatformStyles } from '../public-page-blocks/blocks';
import { createBlock, getBlockDefinitions } from '../../features/public-page-builder/model/blockRegistry';
import type { SocialPlatform } from '../../features/public-page-builder/model/socialPlatforms';
import type { MediaReference, PageBlock, PageTheme } from '../../features/public-page-builder/types/publicPage';
import type { ApiPublicPageRepository } from '../../features/public-page-builder/repository/ApiPublicPageRepository';
import type { Locale } from '../../shared/i18n/dictionaries';
import { BlockEditorDialog, type BlockEditorSave } from './BlockEditorDialog';
import { publicPageText } from './uiText';

const blockLabelKeys = {
  avatar: 'blockTypeAvatar', button: 'blockTypeButton', links: 'blockTypeLinks', text: 'blockTypeText', image: 'blockTypeImage',
  gallery: 'blockTypeGallery', services: 'blockTypeServices', contacts: 'blockTypeContacts', map: 'blockTypeMap', divider: 'blockTypeDivider', faq: 'blockTypeFaq',
} as const;
const categories = {
  messagingApps: ['facebook-messenger', 'vk', 'whatsapp', 'viber', 'telegram'],
  socialNetworks: ['vk', 'facebook', 'threads', 'instagram', 'tiktok', 'telegram'],
} as const satisfies Record<string, readonly SocialPlatform[]>;
type Category = keyof typeof categories;
const categoryIcons = { messagingApps: ChatBubbleOutlined, socialNetworks: ShareOutlined } as const;
const blockIcons = {
  avatar: AccountCircleOutlined,
  button: SmartButtonOutlined,
  links: LinkOutlined,
  text: TextFieldsOutlined,
  image: ImageOutlined,
  gallery: CollectionsOutlined,
  services: DesignServicesOutlined,
  contacts: ContactPageOutlined,
  map: MapOutlined,
  divider: HorizontalRuleOutlined,
  faq: QuizOutlined,
} as const;
const platformKeys: Record<SocialPlatform, Parameters<typeof publicPageText>[1]> = {
  'facebook-messenger': 'platformFacebookMessenger', vk: 'platformVk', whatsapp: 'platformWhatsapp', viber: 'platformViber',
  telegram: 'platformTelegram', facebook: 'platformFacebook', threads: 'platformThreads', instagram: 'platformInstagram', tiktok: 'platformTiktok',
};

export function AddBlockDialog({ open, locale, usedPlatforms, theme, repository, media, previewUrls, onClose, onConfirm }: {
  open: boolean;
  locale: Locale;
  usedPlatforms: ReadonlySet<SocialPlatform>;
  theme: PageTheme;
  repository: ApiPublicPageRepository;
  media: readonly MediaReference[];
  previewUrls: ReadonlyMap<string, string>;
  onClose: () => void;
  onConfirm: (result: BlockEditorSave) => void;
}) {
  const [category, setCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<PageBlock | null>(null);
  const close = () => { setCategory(null); setQuery(''); setDraft(null); onClose(); };
  const selectPlatform = (platform: SocialPlatform) => {
    if (usedPlatforms.has(platform)) {return;}
    const label = publicPageText(locale, platformKeys[platform]);
    const block = createBlock('social-button');
    if (block) {setDraft({ ...block, name: label, content: { platform, label, url: 'https://' } });}
  };
  const tileSx = { p: 2.5, minHeight: 112, cursor: 'pointer', border: 0, textAlign: 'center', bgcolor: 'background.paper',
    '&:hover, &:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } } as const;
  const title = category ? publicPageText(locale, category) : publicPageText(locale, 'addBlock');
  return <>
    <Dialog open={open && !draft} onClose={close} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {category ? <IconButton aria-label={publicPageText(locale, 'back')} onClick={() => { setCategory(null); setQuery(''); }}><ArrowBack /></IconButton> : null}
        <Typography component="span" variant="h6" sx={{ flex: 1 }}>{title}</Typography>
        <IconButton aria-label={publicPageText(locale, 'close')} onClick={close}><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {!category ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
          {(Object.keys(categories) as Category[]).map((item) => {
            const Icon = categoryIcons[item];
            return <Paper key={item} component="button" type="button" onClick={() => setCategory(item)} sx={tileSx}>
              <Icon aria-hidden="true" sx={{ fontSize: 44, color: 'text.secondary' }} />
              <Typography sx={{ mt: 0.75, fontWeight: 700 }}>{publicPageText(locale, item)}</Typography>
            </Paper>;
          })}
          {getBlockDefinitions().filter(({ type }) => type !== 'hero' && type !== 'social-button').map((definition) => {
            const labelKey = blockLabelKeys[definition.type as keyof typeof blockLabelKeys];
            const Icon = blockIcons[definition.type as keyof typeof blockIcons];
            return <Paper key={definition.type} component="button" type="button" onClick={() => setDraft(createBlock(definition.type))} sx={tileSx}>
              {Icon ? <Icon aria-hidden="true" sx={{ fontSize: 44, color: 'text.secondary' }} /> : null}
              <Typography sx={{ mt: 0.75, fontWeight: 700 }}>{labelKey ? publicPageText(locale, labelKey) : definition.name}</Typography>
            </Paper>;
          })}
        </Box> : <Box sx={{ display: 'grid', gap: 2 }}>
          <TextField fullWidth autoFocus label={publicPageText(locale, 'searchPlatforms')} value={query} onChange={(event) => setQuery(event.target.value)} />
          <Box role="group" aria-label={title} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
            {categories[category].filter((platform) => publicPageText(locale, platformKeys[platform]).toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale))).map((platform) => {
              const disabled = usedPlatforms.has(platform); const style = socialPlatformStyles[platform];
              return <Paper key={platform} component="button" type="button" disabled={disabled} aria-label={publicPageText(locale, platformKeys[platform])}
                onClick={() => selectPlatform(platform)} sx={{ p: 2, minHeight: 96, border: 0, borderRadius: 3, cursor: disabled ? 'default' : 'pointer',
                  background: style.background, color: style.color, opacity: disabled ? .38 : 1, '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}>
                <SocialPlatformIcon platform={platform} sx={{ fontSize: 32, color: style.iconColor }} />
                <Typography sx={{ mt: .5, fontWeight: 700 }}>{publicPageText(locale, platformKeys[platform])}</Typography>
              </Paper>;
            })}
          </Box>
        </Box>}
      </DialogContent>
      <DialogActions>{category ? <Button startIcon={<ArrowBack />} onClick={() => { setCategory(null); setQuery(''); }}>{publicPageText(locale, 'back')}</Button> : null}</DialogActions>
    </Dialog>
    <BlockEditorDialog open={Boolean(draft)} block={draft} locale={locale} title={publicPageText(locale, 'configureBlock')}
      theme={theme} repository={repository} media={media} previewUrls={previewUrls}
      onClose={() => setDraft(null)} onSave={(result) => { onConfirm(result); close(); }} />
  </>;
}
