import { toast } from 'sonner';
import { CircleCheck, CircleX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import SecretInput from '@/components/common/inputs/SecretInput';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { GodMicrosoft365Form } from '../../hooks/useGodMicrosoft365Form';

export default function GodMicrosoft365Settings({ form }: { form: GodMicrosoft365Form }) {
  const t = useTranslations('god.microsoft365');

  async function runTest() {
    try {
      const result = await form.test();
      if (result.ok) toast.success(t('testPassed'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <SettingsSection title={t('app')} description={t('appHint')}>
      <SettingsCard className="space-y-6 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="m365-tenant">{t('tenantId')}</Label>
            <Input
              id="m365-tenant"
              dir="ltr"
              autoComplete="off"
              value={form.tenantId}
              onChange={(e) => form.setTenantId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m365-client">{t('clientId')}</Label>
            <Input
              id="m365-client"
              dir="ltr"
              autoComplete="off"
              value={form.clientId}
              onChange={(e) => form.setClientId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2 sm:max-w-md">
            <Label htmlFor="m365-secret">{t('clientSecret')}</Label>
            <SecretInput
              id="m365-secret"
              value={form.clientSecret}
              onChange={form.setClientSecret}
              hasStored={form.settings.hasClientSecret}
              placeholder={t('clientSecretPlaceholder')}
            />
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {form.complete ? t('testHint') : t('testConfigureFirst')}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void runTest()}
              disabled={!form.complete || form.saving || form.testing}
            >
              {form.testing ? t('testing') : t('test')}
            </Button>
          </div>
          {form.testResult ? (
            <p className="flex items-start gap-2 text-sm" role="status">
              {form.testResult.ok ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0" />
              ) : (
                <CircleX className="mt-0.5 size-4 shrink-0" />
              )}
              <span className="break-words">
                {form.testResult.ok ? t('testPassedWord') : t('testFailedWord')}
                {': '}
                {form.testResult.message}
              </span>
            </p>
          ) : null}
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
