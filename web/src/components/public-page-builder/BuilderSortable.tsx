import { useLayoutEffect, useRef, type ButtonHTMLAttributes, type RefObject } from 'react';
import {
  constants,
  dropHandlers,
  smoothDnD,
  type ContainerOptions,
  type DropResult,
} from 'smooth-dnd';
import type { PageBlock, PageSection } from '../../features/public-page-builder/types/publicPage';

export const SMOOTH_DND_WRAPPER_CLASS = constants.wrapperClass;
export const BLOCK_DRAG_HANDLE = '.public-page-block-drag-rail';
export const SECTION_DRAG_HANDLE = '.public-page-section-drag-rail';
export const PUBLIC_PAGE_DND_GROUP = 'public-page-items';
export const PUBLIC_PAGE_DND_DRAG_CLASS = 'public-page-dnd-dragging';
export const PUBLIC_PAGE_DND_SECTION_INSET = '--public-page-section-block-inset';
const PUBLIC_PAGE_DND_GUTTER = '--public-page-editor-drag-gutter';
const PUBLIC_PAGE_DND_GHOST_ORIGIN_LEFT = 'publicPageDndGhostOriginLeft';

export type BuilderDragPayload =
  | { type: 'section'; sectionId: string }
  | { type: 'block'; blockId: string; sourceSectionId: string }
  | { type: 'staged'; block: PageBlock };

export type BuilderDropDestination =
  | { type: 'main'; index: number }
  | { type: 'section'; sectionId: string; index: number };

export type SortableActivator = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>;

type SmoothContainerOptions = Omit<ContainerOptions, 'getChildPayload' | 'onDrop'> & {
  ghostReferenceRef: RefObject<HTMLElement | null>;
  getChildPayload: (index: number) => BuilderDragPayload;
  onDrop: (result: DropResult) => void;
};

function contentBox(element: HTMLElement): { left: number; width: number } {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const paddingLeft = Number.parseFloat(style.paddingLeft);
  const paddingRight = Number.parseFloat(style.paddingRight);
  return {
    left: rect.left + paddingLeft,
    width: rect.width - paddingLeft - paddingRight,
  };
}

function syncGhostWithTarget(target: HTMLElement, reference: HTMLElement): void {
  const ghost = document.querySelector<HTMLElement>(`.${constants.ghostClass}[data-public-page-sortable]`);
  if (!ghost) {return;}

  const targetBox = contentBox(target);
  const referenceBox = contentBox(reference);
  const originLeftValue = ghost.dataset[PUBLIC_PAGE_DND_GHOST_ORIGIN_LEFT];
  const originLeft = originLeftValue === undefined
    ? ghost.getBoundingClientRect().left
    : Number(originLeftValue);

  ghost.dataset[PUBLIC_PAGE_DND_GHOST_ORIGIN_LEFT] = String(originLeft);
  ghost.style.marginLeft = `${targetBox.left - originLeft}px`;
  ghost.style.width = `${targetBox.width}px`;
  ghost.style.setProperty(PUBLIC_PAGE_DND_SECTION_INSET, `${targetBox.left - referenceBox.left}px`);
  ghost.style.setProperty(
    PUBLIC_PAGE_DND_GUTTER,
    getComputedStyle(reference).getPropertyValue(PUBLIC_PAGE_DND_GUTTER),
  );
}

/** Keeps the imperative smooth-dnd instance isolated from React rendering. */
export function useSmoothDndContainer(
  elementRef: RefObject<HTMLElement | null>,
  options: SmoothContainerOptions,
  enabled = true,
): void {
  const optionsRef = useRef(options);

  useLayoutEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useLayoutEffect(() => {
    if (!enabled) {return;}
    const element = elementRef.current;
    if (!element) {return;}

    smoothDnD.dropHandler = dropHandlers.reactDropHandler().handler;
    smoothDnD.wrapChild = false;
    let disposed = false;
    const containerOptions: Partial<SmoothContainerOptions> = { ...optionsRef.current };
    delete containerOptions.ghostReferenceRef;
    const instance = smoothDnD(element, {
      ...containerOptions,
      getChildPayload: (index) => optionsRef.current.getChildPayload(index),
      onDrop: (result) => {
        if (!disposed) {optionsRef.current.onDrop(result);}
      },
      shouldAcceptDrop: (sourceOptions, payload) => optionsRef.current.shouldAcceptDrop?.(sourceOptions, payload) ?? true,
      onDragEnter: () => {
        const reference = optionsRef.current.ghostReferenceRef.current;
        if (reference) {syncGhostWithTarget(element, reference);}
        optionsRef.current.onDragEnter?.();
      },
      getGhostParent: () => document.body,
    });
    return () => {
      disposed = true;
      instance.dispose();
    };
  }, [elementRef, enabled]);
}

export function isBuilderDragPayload(payload: unknown): payload is BuilderDragPayload {
  if (!payload || typeof payload !== 'object' || !('type' in payload)) {return false;}
  const type = (payload as { type?: unknown }).type;
  return type === 'section' || type === 'block' || type === 'staged';
}

export function standaloneSectionFrom(source: PageSection): PageSection {
  return {
    ...structuredClone(source),
    id: crypto.randomUUID(),
    design: { ...structuredClone(source.design), variant: 'off' },
    blocks: [],
  };
}
