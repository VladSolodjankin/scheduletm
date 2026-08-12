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

export type BuilderDragPayload =
  | { type: 'section'; sectionId: string }
  | { type: 'block'; blockId: string; sourceSectionId: string }
  | { type: 'staged'; block: PageBlock };

export type BuilderDropDestination =
  | { type: 'main'; index: number }
  | { type: 'section'; sectionId: string; index: number };

export type SortableActivator = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>;

type SmoothContainerOptions = Omit<ContainerOptions, 'getChildPayload' | 'onDrop'> & {
  getChildPayload: (index: number) => BuilderDragPayload;
  onDrop: (result: DropResult) => void;
};

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
    const instance = smoothDnD(element, {
      ...optionsRef.current,
      getChildPayload: (index) => optionsRef.current.getChildPayload(index),
      onDrop: (result) => requestAnimationFrame(() => {
        if (!disposed) {optionsRef.current.onDrop(result);}
      }),
      shouldAcceptDrop: (sourceOptions, payload) => optionsRef.current.shouldAcceptDrop?.(sourceOptions, payload) ?? true,
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
