import type { SourcedValue } from '@/lib/api/endpoints/god';
import type { FieldDraft } from '../../utils/fileStoragePatch';
import { Switch } from '@/components/ui/switch';
import SourcedField from './SourcedField';

export default function SourcedSwitchField({
  id,
  label,
  hint,
  field,
  draft,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  field: SourcedValue<boolean>;
  draft: FieldDraft;
  onChange: (value: FieldDraft) => void;
}) {
  const checked = typeof draft === 'boolean' ? draft : field.value;
  return (
    <SourcedField
      id={id}
      label={label}
      hint={hint}
      source={field.source}
      draft={draft}
      envDisplay={String(field.value)}
      overrideSeed={field.value}
      onChange={onChange}
    >
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </SourcedField>
  );
}
