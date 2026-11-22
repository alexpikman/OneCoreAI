import React from 'react';

/**
 * Canonical outer layout for standard non-chat pages.
 * Owns the bounded vertical workspace and keeps page geometry consistent.
 */
interface PageLayoutProps extends React.PropsWithChildren {
  className?: string;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children, className = '' }) => (
  <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${className}`}>
    {children}
  </div>
);
