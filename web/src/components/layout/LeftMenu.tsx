import { Box, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Stack, Typography } from '@mui/material';
import { NavLink } from 'react-router-dom';
import { APP_SIZING, rem } from '../../shared/theme/constants';
import { AppIcons } from '../../shared/ui/AppIcons';

type MenuItem = {
  to: string;
  label: string;
  icon: keyof typeof AppIcons;
};

type LeftMenuProps = {
  items: MenuItem[];
  headingLabel: string;
  mobile?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
};

export function LeftMenu({ items, headingLabel, mobile = false, onClose, onNavigate }: LeftMenuProps) {
  const CloseIcon = AppIcons.close;

  return (
    <Box
      component="aside"
      sx={{
        width: mobile ? '100%' : rem(APP_SIZING.leftMenuWidth),
        flexShrink: 0,
        borderRight: mobile ? 0 : 1,
        borderColor: 'divider',
        px: 1.5,
        py: 2,
        display: mobile ? 'block' : { xs: 'none', md: 'block' },
        overflowY: 'auto',
        height: '100%',
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 1.5 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
          {headingLabel}
        </Typography>
        {mobile ? (
          <IconButton onClick={onClose} aria-label="Close navigation menu" size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Stack>
      <List sx={{ mt: 1 }}>
        {items.map((item) => {
          const Icon = AppIcons[item.icon];
          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              onClick={onNavigate}
              sx={{
                borderRadius: 3,
                marginBottom: 1,
                minHeight: rem(46),
                '&.active': {
                  bgcolor: 'action.selected',
                  color: 'primary.main',
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main'
                  }
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: rem(36) }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
