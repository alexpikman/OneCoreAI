import React from 'react';
import { PAGE_CONTAINER_CLASS } from './pageLayout';

interface PageContentProps {
  children?: React.ReactNode;
  scrollRef?: React.Ref<HTMLDivElement>;
  scrollable?: boolean;
  contentClassName?: string;
}

/**
 * The shared content viewport for standard non-chat pages.
 * Its parent must be a bounded flex column (min-h-0).
 * Nested scrolling is explicit and belongs to the page composition.
 */
export const PageContent: React.FC<PageContentProps> = ({
  children,
  scrollRef,
  scrollable = true,
  contentClassName = '',
}) => (
  <section
    ref={scrollRef}
    className={`flex min-h-0 min-w-0 flex-1 flex-col ${scrollable ? 'overflow-y-auto' : 'overflow-hidden'}`}
  >
    <div className={`${PAGE_CONTAINER_CLASS} ${scrollable ? 'shrink-0' : 'flex min-h-0 flex-1 flex-col'}`}>
      <div className={`${scrollable ? '' : 'min-h-0 flex-1'} ${contentClassName}`}>
        {children}
      </div>
    </div>
  </section>
);
