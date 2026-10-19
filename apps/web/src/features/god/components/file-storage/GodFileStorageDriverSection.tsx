import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { StorageDriverName } from '@/lib/api/endpoints/god';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import type { GodFileStorageForm } from '../../hooks/useGodFileStorageForm';
import SourcedField from './SourcedField';

const DRIVERS: StorageDriverName[] = ['s3', 'sharepoint'];

export default function GodFileStorageDriverSection({ form }: { form: GodFileStorageForm }) {
  const t = useTranslations('god.fileStorage');
  const { settings } = form;
  const draft = form.draft.driver;
  const changed = form.driver !== settings.driver.value;

  return (
    <SettingsSection title={t('driver')} description={t('driverHint')}>
      <SettingsCard className="space-y-4 p-4">
        <div className="sm:max-w-sm">
          <SourcedField
            id="storage-driver"
            label={t('driver')}
            source={settings.driver.source}
            draft={draft}
            envDisplay={t(`driverOptions.${settings.driver.value}`)}
            overrideSeed={settings.driver.value}
            onChange={(value) => {
              if (value === null || typeof value === 'string') {
                form.setDriver(value as StorageDriverName | null);
              }
            }}
          >
            <Select
              value={form.driver}
              onValueChange={(value) => form.setDriver(value as StorageDriverName)}
            >
              <SelectTrigger id="storage-driver" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DRIVERS.map((driver) => (
                  <SelectItem key={driver} value={driver}>
                    {t(`driverOptions.${driver}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SourcedField>
        </div>

        <Alert className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <TriangleAlert />
          <AlertTitle>{t('warningTitle')}</AlertTitle>
          <AlertDescription className="space-y-2 text-current">
            <p>{t('warningBody')}</p>
            <p>{t('copyHint')}</p>
            <code className="block rounded bg-background/60 px-2 py-1 text-xs" dir="ltr">
              bun --env-file=.env scripts/storage-copy-s3-to-sharepoint.ts [--dry-run]
            </code>
            {changed ? <p className="font-medium">{t('warningPending')}</p> : null}
          </AlertDescription>
        </Alert>
      </SettingsCard>
    </SettingsSection>
  );
}
