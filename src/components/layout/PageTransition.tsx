import type { HTMLAttributes } from 'react';

type PageTransitionMode = 'page' | 'fade';

interface PageTransitionProps extends HTMLAttributes<HTMLDivElement> {
  mode?: PageTransitionMode;
}

/** Shared page wrapper without entry or exit animation. */
export const PageTransition: React.FC<PageTransitionProps> = ({
  mode: _mode = 'page',
  ...props
}) => <div {...props} />;
