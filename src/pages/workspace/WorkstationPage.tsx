import React from 'react';
import { useOneCoreStore } from '../../store/useOneCoreStore';
import { CenterAgentPane } from '../../components/workstation/CenterAgentPane';
import { RightInspectorPane } from '../../components/workstation/RightInspectorPane';

export const WorkstationPage: React.FC = () => {
  const { chatVisibility } = useOneCoreStore();

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 overflow-hidden">
      <CenterAgentPane />
      {chatVisibility.showRightInspector && <RightInspectorPane />}
    </div>
  );
};
