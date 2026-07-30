import { Add, ContentCopy, Delete, Visibility, VisibilityOff } from '@mui/icons-material';
import { Button, Divider, IconButton, Stack, Typography } from '@mui/material';
import type { EditorSelection } from '../../features/public-page-builder/types/editor';
import type { PublicPageDocument } from '../../features/public-page-builder/types/publicPage';
import type { Locale } from '../../shared/i18n/dictionaries';
import { SortableList } from './SortableList';
import { publicPageText } from './uiText';

export function BlockTree(props: {
  locale: Locale;
  document: PublicPageDocument;
  selection: EditorSelection;
  onSelect: (sectionId: string, blockId?: string) => void;
  onAddSection: () => void;
  onMoveSection: (id: string, index: number) => void;
  onMoveBlock: (sectionId: string, id: string, index: number) => void;
  onToggleSection: (id: string) => void;
  onToggleBlock: (sectionId: string, id: string) => void;
  onDuplicateSection: (id: string) => void;
  onDuplicateBlock: (sectionId: string, id: string) => void;
  onRemoveSection: (id: string) => void;
  onRemoveBlock: (sectionId: string, id: string) => void;
}) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="h6">{publicPageText(props.locale, 'sections')}</Typography>
      <SortableList
        items={props.document.sections.map((section) => ({ id: section.id, label: section.name }))}
        selectedId={props.selection.blockId ? null : props.selection.sectionId}
        onSelect={(id) => props.onSelect(id)}
        onMove={props.onMoveSection}
        actions={(item) => {
          const section = props.document.sections.find((candidate) => candidate.id === item.id);
          return (
            <>
              <IconButton size="small" onClick={() => props.onToggleSection(item.id)}>
                {section?.visible ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
              </IconButton>
              <IconButton size="small" onClick={() => props.onDuplicateSection(item.id)}><ContentCopy fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => props.onRemoveSection(item.id)}><Delete fontSize="small" /></IconButton>
            </>
          );
        }}
      />
      {props.document.sections.map((section) => (
        <Stack key={section.id} spacing={0.5} sx={{ pl: 1 }}>
          <Typography variant="caption">{section.name}</Typography>
          <SortableList
            items={section.blocks.map((block) => ({ id: block.id, label: block.name, secondary: block.type }))}
            selectedId={props.selection.blockId}
            onSelect={(id) => props.onSelect(section.id, id)}
            onMove={(id, index) => props.onMoveBlock(section.id, id, index)}
            actions={(item) => {
              const block = section.blocks.find((candidate) => candidate.id === item.id);
              return (
                <>
                  <IconButton size="small" onClick={() => props.onToggleBlock(section.id, item.id)}>
                    {block?.visible ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={() => props.onDuplicateBlock(section.id, item.id)}><ContentCopy fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => props.onRemoveBlock(section.id, item.id)}><Delete fontSize="small" /></IconButton>
                </>
              );
            }}
          />
          <Divider />
        </Stack>
      ))}
      <Button startIcon={<Add />} onClick={props.onAddSection}>{publicPageText(props.locale, 'addSection')}</Button>
    </Stack>
  );
}
