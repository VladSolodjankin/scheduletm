import { ArrowDownward, ArrowUpward } from '@mui/icons-material';
import { IconButton, List, ListItem, ListItemButton, ListItemText } from '@mui/material';
import type { ReactNode } from 'react';
import { useI18n } from '../../shared/i18n/I18nContext';
import { publicPageText } from './uiText';

export type SortableItem = { id: string; label: string; secondary?: string };

export function SortableList({
  items,
  selectedId,
  onSelect,
  onMove,
  actions,
}: {
  items: SortableItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, index: number) => void;
  actions?: (item: SortableItem) => ReactNode;
}) {
  const { locale } = useI18n();
  return (
    <List dense disablePadding>
      {items.map((item, index) => (
        <ListItem
          key={item.id}
          disablePadding
          secondaryAction={
            <>
              <IconButton size="small" aria-label={`${publicPageText(locale, 'moveUp')}: ${item.label}`} disabled={index === 0} onClick={() => onMove(item.id, index - 1)}>
                <ArrowUpward fontSize="small" />
              </IconButton>
              <IconButton size="small" aria-label={`${publicPageText(locale, 'moveDown')}: ${item.label}`} disabled={index === items.length - 1} onClick={() => onMove(item.id, index + 1)}>
                <ArrowDownward fontSize="small" />
              </IconButton>
              {actions?.(item)}
            </>
          }
        >
          <ListItemButton selected={selectedId === item.id} onClick={() => onSelect(item.id)}>
            <ListItemText primary={item.label} secondary={item.secondary} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}
