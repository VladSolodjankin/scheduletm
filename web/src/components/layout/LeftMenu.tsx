import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { NavLink } from 'react-router-dom';
import { APP_SIZING } from '../../shared/theme/constants';
import { AppIcons } from '../../shared/ui/AppIcons';

type MenuItem = {
  to: string;
  label: string;
  icon: keyof typeof AppIcons;
};

type LeftMenuProps = {
  items: MenuItem[];
};

export function LeftMenu({ items }: LeftMenuProps) {
  return (
    <Box
      component="aside"
      sx={{
        width: APP_SIZING.leftMenuWidth,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        px: 1.5,
        py: 2,
        display: { xs: 'none', md: 'block' },
        overflowY: 'auto'
      }}
    >
      <Typography variant="overline" color="text.secondary" sx={{ px: 1.5, letterSpacing: '0.08em' }}>
        Workspace
      </Typography>
      <List sx={{ mt: 1 }}>
        {items.map((item) => {
          const Icon = AppIcons[item.icon];
          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              sx={{
                borderRadius: 3,
                marginBottom: 1,
                minHeight: 46,
                '&.active': {
                  bgcolor: 'action.selected',
                  color: 'primary.main',
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main'
                  }
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
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
