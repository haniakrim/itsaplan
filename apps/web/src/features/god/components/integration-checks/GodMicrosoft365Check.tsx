import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { IntegrationCheckResult } from '@/lib/api/endpoints/god';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRunMicrosoft365Check } from '../../services/god.service';
import GodCheckRunResult from './GodCheckRunResult';

export default function GodMicrosoft365Check() {
  const t = useTranslations('god.integrationChecks');
  const run = useRunMicrosoft365Check();
  const [user, setUser] = useState('');
  const [write, setWrite] = useState(false);
  const [result, setResult] = useState<IntegrationCheckResult | null>(null);

  async function start() {
    try {
      setResult(await run.mutateAsync({ user: user.trim(), write }));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <SettingsSection title={t('microsoft365.title')} description={t('microsoft365.hint')}>
      <SettingsCard className="space-y-4 p-4">
        <div className="space-y-1.5 sm:max-w-md">
          <Label htmlFor="check-m365-user">{t('microsoft365.user')}</Label>
          <Input
            id="check-m365-user"
            dir="ltr"
            type="email"
            autoComplete="off"
            placeholder="agent@company.com"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
        </div>
        <label className="flex items-start gap-2">
          <Checkbox checked={write} onCheckedChange={(v) => setWrite(v === true)} />
          <span className="space-y-0.5">
            <span className="block text-sm">{t('microsoft365.write')}</span>
            <span className="block text-xs text-muted-foreground">
              {t('microsoft365.writeHint')}
            </span>
          </span>
        </label>
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void start()}
            disabled={run.isPending || user.trim().length === 0}
          >
            {run.isPending ? t('running') : t('run')}
          </Button>
        </div>
        {result ? <GodCheckRunResult result={result} /> : null}
      </SettingsCard>
    </SettingsSection>
  );
}
