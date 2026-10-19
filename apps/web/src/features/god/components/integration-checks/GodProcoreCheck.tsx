import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { IntegrationCheckResult, ProcoreCheckSettings } from '@/lib/api/endpoints/god';
import SecretInput from '@/components/common/inputs/SecretInput';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useForgetProcoreCheck, useRunProcoreCheck } from '../../services/god.service';
import GodCheckRunResult from './GodCheckRunResult';

export default function GodProcoreCheck({ settings }: { settings: ProcoreCheckSettings }) {
  const t = useTranslations('god.integrationChecks');
  const run = useRunProcoreCheck();
  const forget = useForgetProcoreCheck();
  const [clientId, setClientId] = useState(settings.clientId);
  const [clientSecret, setClientSecret] = useState('');
  const [companyId, setCompanyId] = useState(settings.companyId);
  const [sandbox, setSandbox] = useState(settings.sandbox);
  const [projectId, setProjectId] = useState('');
  const [remember, setRemember] = useState(false);
  const [result, setResult] = useState<IntegrationCheckResult | null>(null);

  const ready =
    clientId.trim().length > 0 &&
    companyId.trim().length > 0 &&
    (clientSecret.length > 0 || settings.hasClientSecret);

  async function start() {
    try {
      setResult(
        await run.mutateAsync({
          clientId: clientId.trim(),
          companyId: companyId.trim(),
          sandbox,
          remember,
          ...(clientSecret.length > 0 ? { clientSecret } : {}),
          ...(projectId.trim() ? { projectId: projectId.trim() } : {}),
        }),
      );
      setClientSecret('');
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  async function forgetStored() {
    try {
      await forget.mutateAsync();
      setClientSecret('');
      toast.success(t('procore.forgotten'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <SettingsSection
      title={t('procore.title')}
      description={t('procore.hint')}
      action={
        settings.remembered ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void forgetStored()}
            disabled={forget.isPending}
          >
            {t('procore.forget')}
          </Button>
        ) : undefined
      }
    >
      <SettingsCard className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="check-procore-client">{t('procore.clientId')}</Label>
            <Input
              id="check-procore-client"
              dir="ltr"
              autoComplete="off"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="check-procore-secret">{t('procore.clientSecret')}</Label>
            <SecretInput
              id="check-procore-secret"
              value={clientSecret}
              onChange={setClientSecret}
              hasStored={settings.hasClientSecret}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="check-procore-company">{t('procore.companyId')}</Label>
            <Input
              id="check-procore-company"
              dir="ltr"
              autoComplete="off"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="check-procore-project">{t('procore.projectId')}</Label>
            <Input
              id="check-procore-project"
              dir="ltr"
              autoComplete="off"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('procore.projectIdHint')}</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={sandbox} onCheckedChange={setSandbox} />
          {t('procore.sandbox')}
        </label>
        <label className="flex items-start gap-2">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          <span className="space-y-0.5">
            <span className="block text-sm">{t('procore.remember')}</span>
            <span className="block text-xs text-muted-foreground">{t('procore.rememberHint')}</span>
          </span>
        </label>
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void start()}
            disabled={run.isPending || !ready}
          >
            {run.isPending ? t('running') : t('run')}
          </Button>
        </div>
        {result ? <GodCheckRunResult result={result} /> : null}
      </SettingsCard>
    </SettingsSection>
  );
}
