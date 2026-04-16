'use client';

import { WorkshopSessionProvider } from '../../hooks/useWorkshopSession';
import ProgressBar from '../../components/ProgressBar';

export default function WorkshopLayout({ children }) {
  return (
    <WorkshopSessionProvider>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <ProgressBar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </WorkshopSessionProvider>
  );
}
