import { Box, ButtonBase, Paper, Stack, Typography } from '@mui/material';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import type { ReactNode } from 'react';
import { toInitials } from '../utils/initials';
import { AppActionsMenu, type AppAction } from './AppActionsMenu';

export function AppList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Paper variant="outlined" elevation={0} className={['app-list', className].filter(Boolean).join(' ')}>
      {children}
    </Paper>
  );
}

type AppListRowProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  media?: ReactNode;
  trailing?: ReactNode;
  actions?: AppAction[];
  actionsLabel?: string;
  actionsDisabled?: boolean;
  muted?: boolean;
  onClick?: () => void;
  /** Accessible name for the clickable row area; defaults to its visible text. */
  mainLabel?: string;
  className?: string;
  testId?: string;
};

export function AppListRow({
  title,
  subtitle,
  badges,
  media,
  trailing,
  actions,
  actionsLabel = '',
  actionsDisabled = false,
  muted = false,
  onClick,
  mainLabel,
  className,
  testId,
}: AppListRowProps) {
  const body = (
    <>
      {media ? <Box className="app-list-row__media">{media}</Box> : null}
      <Stack className="app-list-row__copy">
        <Stack direction="row" className="app-list-row__heading">
          <Typography component="span" className="app-list-row__title">{title}</Typography>
          {badges}
        </Stack>
        {subtitle ? <Box className="app-list-row__subtitle">{subtitle}</Box> : null}
      </Stack>
    </>
  );

  return (
    <Box
      className={['app-list-row', muted ? 'app-list-row--muted' : '', className].filter(Boolean).join(' ')}
      data-testid={testId}
    >
      {onClick ? (
        <ButtonBase className="app-list-row__main" aria-label={mainLabel} onClick={onClick}>{body}</ButtonBase>
      ) : (
        <Box className="app-list-row__main">{body}</Box>
      )}
      {trailing ? <Box className="app-list-row__trailing">{trailing}</Box> : null}
      {actions?.length ? (
        <AppActionsMenu label={actionsLabel} actions={actions} disabled={actionsDisabled} />
      ) : null}
    </Box>
  );
}

export function AppListThumb({ src, alt, icon }: { src?: string | null; alt?: string; icon?: ReactNode }) {
  return src ? (
    <Box component="img" src={src} alt={alt ?? ''} className="app-list-thumb" />
  ) : (
    <Box className="app-list-thumb app-list-thumb--empty" aria-hidden="true">
      {icon ?? <ImageOutlined fontSize="small" />}
    </Box>
  );
}

export function AppAvatar({ name, size = 'm' }: { name: string; size?: 's' | 'm' }) {
  return (
    <Box className={`app-avatar app-avatar--${size}`} aria-hidden="true" title={name}>
      {toInitials(name)}
    </Box>
  );
}

export function AppAvatarStack({ names, max = 4, label }: { names: string[]; max?: number; label?: string }) {
  if (!names.length) {
    return null;
  }
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <Box className="app-avatar-stack" role="img" aria-label={label ?? names.join(', ')} title={names.join(', ')}>
      {shown.map((name, index) => <AppAvatar key={`${name}:${index}`} name={name} size="s" />)}
      {rest > 0 ? <Box className="app-avatar app-avatar--s app-avatar--rest" aria-hidden="true">+{rest}</Box> : null}
    </Box>
  );
}
