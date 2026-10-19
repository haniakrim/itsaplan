import Link from 'next/link';
import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Switch } from '@/components/ui/switch';
import type { GodFileStorageForm } from '../../hooks/useGodFileStorageForm';
import SourcedSecretField from './SourcedSecretField';
import SourcedTextField from './SourcedTextField';

export default function GodFileStorageSharePointSection({ form }: { form: GodFileStorageForm }) {
  const t = useTranslations('god.fileStorage');
  const { sharepoint, instanceAppConfigured } = form.settings;
  const draft = form.draft.sharepoint;

  return (
    <SettingsSection
      title={t('sharepointTitle')}
      description={form.driver === 'sharepoint' ? t('sharepointHint') : t('inactiveHint')}
    >
      <SettingsCard className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <label htmlFor="sp-instance-app" className="text-sm font-medium">
              {t('useInstanceApp')}
            </label>
            <p className="text-xs text-muted-foreground">{t('useInstanceAppHint')}</p>
            {form.useInstanceApp && !instanceAppConfigured ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t('instanceAppMissing')}{' '}
                <Link href="/god/microsoft365" className="underline">
                  {t('openMicrosoft365')}
                </Link>
              </p>
            ) : null}
          </div>
          <Switch
            id="sp-instance-app"
            checked={form.useInstanceApp}
            onCheckedChange={(v) => form.setSharePoint('useInstanceApp', v)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {form.useInstanceApp ? null : (
            <>
              <SourcedTextField
                id="sp-tenant"
                label={t('tenantId')}
                field={sharepoint.tenantId}
                draft={draft.tenantId}
                onChange={(v) => form.setSharePoint('tenantId', v)}
              />
              <SourcedTextField
                id="sp-client"
                label={t('clientId')}
                field={sharepoint.clientId}
                draft={draft.clientId}
                onChange={(v) => form.setSharePoint('clientId', v)}
              />
              <SourcedSecretField
                id="sp-secret"
                label={t('clientSecret')}
                field={sharepoint.clientSecret}
                draft={draft.clientSecret}
                onChange={(v) => form.setSharePoint('clientSecret', v)}
              />
            </>
          )}
          <SourcedTextField
            id="sp-site"
            label={t('siteId')}
            hint={t('siteHint')}
            field={sharepoint.siteId}
            draft={draft.siteId}
            onChange={(v) => form.setSharePoint('siteId', v)}
          />
          <SourcedTextField
            id="sp-drive"
            label={t('driveId')}
            field={sharepoint.driveId}
            draft={draft.driveId}
            onChange={(v) => form.setSharePoint('driveId', v)}
          />
          <SourcedTextField
            id="sp-root"
            label={t('rootFolder')}
            placeholder="itsaplan"
            field={sharepoint.rootFolder}
            draft={draft.rootFolder}
            onChange={(v) => form.setSharePoint('rootFolder', v)}
          />
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
