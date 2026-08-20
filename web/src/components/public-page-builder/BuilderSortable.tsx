import { useLayoutEffect, useRef, type ButtonHTMLAttributes, type RefObject } from 'react';
import {
  constants,
  dropHandlers,
  smoothDnD,
  type ContainerOptions,
  type DropResult,
} from 'smooth-dnd';

export const SMOOTH_DND_WRAPPER_CLASS = constants.wrapperClass;
export const BLOCK_DRAG_HANDLE = '.public-page-block-drag-rail';
export const SECTION_DRAG_HANDLE = '.public-page-section-drag-rail';
export const PUBLIC_PAGE_DND_GROUP = 'public-page-items';
export const PUBLIC_PAGE_DND_DRAG_CLASS = 'public-page-dnd-dragging';
const PUBLIC_PAGE_DND_CONTEXT_ATTRIBUTE = 'data-public-page-dnd-context';
const PUBLIC_PAGE_DND_CHROME_SELECTOR = [
  '.public-page-block-actions',
  '.public-page-section-actions',
  BLOCK_DRAG_HANDLE,
  SECTION_DRAG_HANDLE,
].join(',');
const ghostOriginLeft = new WeakMap<HTMLElement, number>();

export type BuilderDragPayload =
  | { type: 'section'; sectionId: string }
  | { type: 'block'; blockId: string; sourceSectionId: string };

export type BuilderDropDestination =
  | { type: 'main'; index: number }
  | { type: 'section'; sectionId: string; index: number };

export type SortableActivator = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>;

type SmoothContainerOptions = Omit<ContainerOptions, 'getChildPayload' | 'onDrop'> & {
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

function syncGhostWithTarget(target: HTMLElement): void {
  const ghost = document.querySelector<HTMLElement>(`.${constants.ghostClass}[data-public-page-sortable]`);
  if (!ghost) {return;}

  const targetBox = contentBox(target);
  const originLeft = ghostOriginLeft.get(ghost) ?? ghost.getBoundingClientRect().left;
  ghostOriginLeft.set(ghost, originLeft);
  const context = target.getAttribute(PUBLIC_PAGE_DND_CONTEXT_ATTRIBUTE);
  if (context) {ghost.setAttribute(PUBLIC_PAGE_DND_CONTEXT_ATTRIBUTE, context);}
  ghost.querySelectorAll(PUBLIC_PAGE_DND_CHROME_SELECTOR).forEach((element) => element.remove());
  ghost.style.marginLeft = `${targetBox.left - originLeft}px`;
  ghost.style.width = `${targetBox.width}px`;
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
    const instance = smoothDnD(element, {
      ...containerOptions,
      getChildPayload: (index) => optionsRef.current.getChildPayload(index),
      onDrop: (result) => {
        if (!disposed) {optionsRef.current.onDrop(result);}
      },
      shouldAcceptDrop: (sourceOptions, payload) => optionsRef.current.shouldAcceptDrop?.(sourceOptions, payload) ?? true,
      onDragStart: (params) => {
        if (params.isSource) {
          queueMicrotask(() => {
            if (!disposed) {syncGhostWithTarget(element);}
          });
        }
        optionsRef.current.onDragStart?.(params);
      },
      onDragEnter: () => {
        syncGhostWithTarget(element);
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
  return type === 'section' || type === 'block';
}
