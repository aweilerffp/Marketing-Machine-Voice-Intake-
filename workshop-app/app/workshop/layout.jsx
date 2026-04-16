'use client';

import { WorkshopSessionProvider } from '../../hooks/useWorkshopSession';
import ProgressBar from '../../components/ProgressBar';

export default function WorkshopLayout({ children }) {
  return (
    <WorkshopSessionProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <ProgressBar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </WorkshopSessionProvider>
  );
}
