import { useTranslations } from 'next-intl';
import type { SourcedSecret } from '@/lib/api/endpoints/god';
import type { FieldDraft } from '../../utils/fileStoragePatch';
import SecretInput from '@/components/common/inputs/SecretInput';
import SourcedField from './SourcedField';

export default function SourcedSecretField({
  id,
  label,
  field,
  draft,
  onChange,
}: {
  id: string;
  label: string;
  field: SourcedSecret;
  draft: FieldDraft;
  onChange: (value: FieldDraft) => void;
}) {
  const t = useTranslations('god.fileStorage');
  return (
    <SourcedField
      id={id}
      label={label}
      source={field.source}
      draft={draft}
      envDisplay={t('secretSet')}
      overrideSeed=""
      onChange={onChange}
    >
      <SecretInput
        id={id}
        value={typeof draft === 'string' ? draft : ''}
        onChange={onChange}
        hasStored={field.hasValue && field.source === 'database'}
        placeholder={t('secretPlaceholder')}
      />
    </SourcedField>
  );
}
