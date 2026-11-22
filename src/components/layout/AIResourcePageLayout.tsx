import React from 'react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { AI_RESOURCE_STYLES, getPageUiTokens } from '../../utils/uiStyle';
import { PageLayout } from './StandardPageLayout';

export const AIResourcePageLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const uiStyle = useOneCoreStore((state) => state.uiStyle);
  const tokens = getPageUiTokens(uiStyle);
  return <PageLayout className={`${tokens.pageSurface} ${AI_RESOURCE_STYLES.page}`}>{children}</PageLayout>;
};
