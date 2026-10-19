'use client';

import GodMicrosoft365Check from './components/integration-checks/GodMicrosoft365Check';
import GodProcoreCheck from './components/integration-checks/GodProcoreCheck';
import GodSharePointCheck from './components/integration-checks/GodSharePointCheck';
import GodSectionPage from './components/GodSectionPage';
import GodSettingsGate from './components/GodSettingsGate';
import { useProcoreCheckSettingsQuery } from './services/god.service';

export default function GodIntegrationChecksPage() {
  const query = useProcoreCheckSettingsQuery();

  return (
    <GodSettingsGate slug="integration-checks" data={query.data}>
      {(procore) => (
        <GodSectionPage slug="integration-checks">
          <div className="space-y-8">
            <GodProcoreCheck settings={procore} />
            <GodSharePointCheck />
            <GodMicrosoft365Check />
          </div>
        </GodSectionPage>
      )}
    </GodSettingsGate>
  );
}
