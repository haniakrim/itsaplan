import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import type { GodFileStorageForm } from '../../hooks/useGodFileStorageForm';
import SourcedSecretField from './SourcedSecretField';
import SourcedSwitchField from './SourcedSwitchField';
import SourcedTextField from './SourcedTextField';

export default function GodFileStorageS3Section({ form }: { form: GodFileStorageForm }) {
  const t = useTranslations('god.fileStorage');
  const { s3 } = form.settings;
  const draft = form.draft.s3;

  return (
    <SettingsSection
      title={t('s3Title')}
      description={form.driver === 's3' ? t('s3Hint') : t('inactiveHint')}
    >
      <SettingsCard className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <SourcedTextField
            id="s3-endpoint"
            label={t('endpoint')}
            hint={t('endpointHint')}
            placeholder="https://s3.example.com"
            field={s3.endpoint}
            draft={draft.endpoint}
            onChange={(v) => form.setS3('endpoint', v)}
          />
        </div>
        <SourcedTextField
          id="s3-bucket"
          label={t('bucket')}
          field={s3.bucket}
          draft={draft.bucket}
          onChange={(v) => form.setS3('bucket', v)}
        />
        <SourcedTextField
          id="s3-region"
          label={t('region')}
          placeholder="us-east-1"
          field={s3.region}
          draft={draft.region}
          onChange={(v) => form.setS3('region', v)}
        />
        <SourcedTextField
          id="s3-access-key"
          label={t('accessKeyId')}
          field={s3.accessKeyId}
          draft={draft.accessKeyId}
          onChange={(v) => form.setS3('accessKeyId', v)}
        />
        <SourcedSecretField
          id="s3-secret-key"
          label={t('secretAccessKey')}
          field={s3.secretAccessKey}
          draft={draft.secretAccessKey}
          onChange={(v) => form.setS3('secretAccessKey', v)}
        />
        <SourcedSwitchField
          id="s3-path-style"
          label={t('forcePathStyle')}
          hint={t('forcePathStyleHint')}
          field={s3.forcePathStyle}
          draft={draft.forcePathStyle}
          onChange={(v) => form.setS3('forcePathStyle', v)}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
