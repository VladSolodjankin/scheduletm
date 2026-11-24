import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Collision,
  type CollisionDetection,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type BuilderDragPayload =
  | { type: 'section'; sectionId: string }
  | { type: 'block'; blockId: string; sourceSectionId: string };

export type BuilderDropDestination =
  | { type: 'main'; index: number }
  | { type: 'section'; sectionId: string; index: number };

export type SortableActivator = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>;

/** The page structure the drop targets are resolved against: sections in order with their block ids. */
export type BuilderLayout = ReadonlyArray<{ sectionId: string; blockIds: readonly string[] }>;

export type BuilderDropTarget =
  | { type: 'section'; sectionId: string }
  | { type: 'block'; sectionId: string; blockId: string };

export type DropSide = 'before' | 'after';
export type DropAxis = 'x' | 'y';
export type DropIndicator = { targetKey: string; side: DropSide; axis: DropAxis };

export const targetKey = (target: BuilderDropTarget): string => (
  target.type === 'section' ? `section:${target.sectionId}` : `block:${target.blockId}`
);

function insertionIndex(ids: readonly string[], excluded: string, targetId: string, side: DropSide): number {
  const remaining = ids.filter((id) => id !== excluded);
  const position = remaining.indexOf(targetId);
  return position < 0 ? remaining.length : position + (side === 'after' ? 1 : 0);
}

/**
 * Turns "dragged item dropped before/after target" into the reducer destination.
 * Section drops and same-section block drops use the final index after removal; a block
 * dropped between sections uses the boundary index of the current section list.
 */
export function resolveDrop(
  payload: BuilderDragPayload,
  target: BuilderDropTarget,
  side: DropSide,
  layout: BuilderLayout,
): BuilderDropDestination | null {
  const sectionIds = layout.map(({ sectionId }) => sectionId);
  if (payload.type === 'section') {
    if (target.sectionId === payload.sectionId) {return null;}
    return { type: 'main', index: insertionIndex(sectionIds, payload.sectionId, target.sectionId, side) };
  }
  if (target.type === 'block') {
    if (target.blockId === payload.blockId) {return null;}
    const blockIds = layout.find(({ sectionId }) => sectionId === target.sectionId)?.blockIds ?? [];
    return { type: 'section', sectionId: target.sectionId, index: insertionIndex(blockIds, payload.blockId, target.blockId, side) };
  }
  const section = layout.find(({ sectionId }) => sectionId === target.sectionId);
  if (!section) {return null;}
  if (section.blockIds.length === 0) {return { type: 'section', sectionId: section.sectionId, index: 0 };}
  return { type: 'main', index: sectionIds.indexOf(section.sectionId) + (side === 'after' ? 1 : 0) };
}

type DragData = { payload: BuilderDragPayload; label: string };
type DropData = { target: BuilderDropTarget };

const IndicatorContext = createContext<DropIndicator | null>(null);

/** Marks where the dragged item will land: a bar on the leading or trailing edge of the target. */
export function useDropIndicator(target: BuilderDropTarget): DropIndicator | null {
  const indicator = useContext(IndicatorContext);
  return indicator?.targetKey === targetKey(target) ? indicator : null;
}

export function useBuilderDraggable(payload: BuilderDragPayload, label: string) {
  const id = payload.type === 'section' ? `drag-section:${payload.sectionId}` : `drag-block:${payload.blockId}`;
  const data: DragData = { payload, label };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  const activator = useMemo(() => ({ ...attributes, ...listeners }) as SortableActivator, [attributes, listeners]);
  return { setNodeRef, activator, isDragging };
}

export function useBuilderDroppable(target: BuilderDropTarget) {
  const data: DropData = { target };
  return useDroppable({ id: targetKey(target), data }).setNodeRef;
}

const dropTargetOf = (collision: Collision): BuilderDropTarget | undefined => (
  (collision.data?.droppableContainer.data.current as DropData | undefined)?.target
);

/** Blocks are preferred under the pointer; section gaps and empty sections are the fallback. */
const collisionDetection: CollisionDetection = (args) => {
  const payload = (args.active.data.current as DragData | undefined)?.payload;
  const wantsBlock = payload?.type === 'block';
  const containers = args.droppableContainers.filter((container) => {
    const target = (container.data.current as DropData | undefined)?.target;
    return target !== undefined && (wantsBlock || target.type === 'section');
  });
  const scoped = { ...args, droppableContainers: containers };
  const hits = pointerWithin(scoped);
  const byKind = (kind: BuilderDropTarget['type']) => hits.filter((hit) => dropTargetOf(hit)?.type === kind);
  const blockHits = wantsBlock ? byKind('block') : [];
  if (blockHits.length > 0) {return blockHits.slice(0, 1);}
  if (hits.length > 0) {return hits.slice(-1);}
  return closestCenter(scoped).slice(0, 1);
};

function pointerSide(rect: { left: number; top: number; width: number; height: number }, x: number, y: number) {
  const dx = (x - (rect.left + rect.width / 2)) / rect.width;
  const dy = (y - (rect.top + rect.height / 2)) / rect.height;
  const axis: DropAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  const side: DropSide = (axis === 'x' ? dx : dy) > 0 ? 'after' : 'before';
  return { axis, side };
}

/** Editor chrome and identifiers that must not be copied into the drag preview. */
const PREVIEW_CHROME = '.public-page-block-actions, .public-page-section-actions, .public-page-block-drag-rail, .public-page-section-drag-rail, .public-page-section-resize-handle, .public-page-drop-indicator';
const PREVIEW_ATTRIBUTES = ['data-editor-block-id', 'data-editor-section-id', 'data-block-id', 'data-section-id', 'data-public-page-sortable', 'data-public-page-section-drag-target', 'id', 'tabindex'];

/** The dragged block or section itself, as it looks on the page, so the person sees what they move. */
function DragPreview({ source, width }: { source: HTMLElement; width: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) {return;}
    const clone = source.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(PREVIEW_CHROME).forEach((element) => element.remove());
    [clone, ...clone.querySelectorAll<HTMLElement>('*')].forEach((element) => PREVIEW_ATTRIBUTES.forEach((name) => element.removeAttribute(name)));
    clone.style.opacity = '1';
    clone.style.margin = '0';
    clone.style.gridColumn = 'auto';
    host.replaceChildren(clone);
  }, [source]);
  return <div ref={hostRef} className="public-page-dnd-overlay" style={{ width }} />;
}

type BuilderDndProps = {
  layout: BuilderLayout;
  onDrop: (payload: BuilderDragPayload, destination: BuilderDropDestination) => void;
  children: ReactNode;
};

export function BuilderDndProvider({ layout, onDrop, children }: BuilderDndProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [indicator, setIndicator] = useState<DropIndicator | null>(null);
  const [dragged, setDragged] = useState<{ source: HTMLElement; width: number } | null>(null);
  const resolved = useRef<{ payload: BuilderDragPayload; destination: BuilderDropDestination } | null>(null);

  const reset = useCallback(() => {
    resolved.current = null;
    setIndicator(null);
    setDragged(null);
  }, []);

  const onDragStart = ({ active }: DragStartEvent) => {
    const payload = (active.data.current as DragData | undefined)?.payload;
    const source = payload ? document.querySelector<HTMLElement>(payload.type === 'block'
      ? `[data-block-id="${CSS.escape(payload.blockId)}"]` : `[data-section-id="${CSS.escape(payload.sectionId)}"]`) : null;
    setDragged(source ? { source, width: active.rect.current.initial?.width ?? source.getBoundingClientRect().width } : null);
  };

  const onDragMove = ({ active, over, activatorEvent, delta }: DragMoveEvent) => {
    const payload = (active.data.current as DragData | undefined)?.payload;
    const target = (over?.data.current as DropData | undefined)?.target;
    if (!payload || !over || !target || !(activatorEvent instanceof PointerEvent)) {
      resolved.current = null;
      setIndicator(null);
      return;
    }
    const { axis, side } = pointerSide(over.rect, activatorEvent.clientX + delta.x, activatorEvent.clientY + delta.y);
    const destination = resolveDrop(payload, target, side, layout);
    resolved.current = destination ? { payload, destination } : null;
    const next = destination ? { targetKey: targetKey(target), side, axis } : null;
    // The pointer moves much more often than the landing spot changes: only re-render for a different spot.
    setIndicator((current) => (current?.targetKey === next?.targetKey && current?.side === next?.side && current?.axis === next?.axis ? current : next));
  };

  const onDragEnd = () => {
    const drop = resolved.current;
    reset();
    if (drop) {onDrop(drop.payload, drop.destination);}
  };

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection}
      onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={reset}>
      <IndicatorContext.Provider value={indicator}>{children}</IndicatorContext.Provider>
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {dragged ? <DragPreview source={dragged.source} width={dragged.width} /> : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
