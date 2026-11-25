import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import { Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { useState, type ReactNode } from 'react';

export type AppAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  href?: string;
  onClick?: () => void;
};

type AppActionsMenuProps = {
  label: string;
  actions: AppAction[];
  disabled?: boolean;
};

export function AppActionsMenu({ label, actions, disabled = false }: AppActionsMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const visible = actions.filter((action) => !action.hidden);
  const regular = visible.filter((action) => !action.danger);
  const danger = visible.filter((action) => action.danger);

  if (!visible.length) {
    return null;
  }

  const close = () => setAnchor(null);
  const renderItem = (action: AppAction) => (
    <MenuItem
      key={action.key}
      disabled={action.disabled}
      className={action.danger ? 'app-actions-menu__item app-actions-menu__item--danger' : 'app-actions-menu__item'}
      {...(action.href ? { component: 'a', href: action.href, target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={() => {
        close();
        action.onClick?.();
      }}
    >
      {action.icon ? <ListItemIcon className="app-actions-menu__icon">{action.icon}</ListItemIcon> : null}
      <ListItemText>{action.label}</ListItemText>
    </MenuItem>
  );

  return (
    <>
      <IconButton
        size="small"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : undefined}
        disabled={disabled}
        className="app-actions-menu__trigger"
        onClick={(event) => {
          event.stopPropagation();
          setAnchor(event.currentTarget);
        }}
      >
        <MoreVertRounded fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { className: 'app-actions-menu' } }}
      >
        {regular.map(renderItem)}
        {regular.length && danger.length ? <Divider /> : null}
        {danger.map(renderItem)}
      </Menu>
    </>
  );
}
