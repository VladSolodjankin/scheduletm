import { Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
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
        borderRight: 1,
        borderColor: 'divider',
        p: 1.5,
        display: { xs: 'none', md: 'block' }
      }}
    >
      <List>
        {items.map((item) => {
          const Icon = AppIcons[item.icon];
          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              sx={{
                borderRadius: 2,
                marginBottom: 1,
                '&.active': {
                  bgcolor: 'action.selected'
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
