import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { IntegrationCheckResult } from '@/lib/api/endpoints/god';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
import { useRunSharePointCheck } from '../../services/god.service';
import GodCheckRunResult from './GodCheckRunResult';

export default function GodSharePointCheck() {
  const t = useTranslations('god.integrationChecks');
  const run = useRunSharePointCheck();
  const [result, setResult] = useState<IntegrationCheckResult | null>(null);

  async function start() {
    try {
      setResult(await run.mutateAsync());
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <SettingsSection title={t('sharepoint.title')} description={t('sharepoint.hint')}>
      <SettingsCard className="space-y-4 p-4">
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void start()}
            disabled={run.isPending}
          >
            {run.isPending ? t('running') : t('run')}
          </Button>
        </div>
        {result ? <GodCheckRunResult result={result} /> : null}
      </SettingsCard>
    </SettingsSection>
  );
}
