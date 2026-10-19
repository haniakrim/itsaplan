import type { SourcedValue } from '@/lib/api/endpoints/god';
import type { FieldDraft } from '../../utils/fileStoragePatch';
import { Input } from '@/components/ui/input';
import SourcedField from './SourcedField';

export default function SourcedTextField({
  id,
  label,
  hint,
  placeholder,
  field,
  draft,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  placeholder?: string;
  field: SourcedValue<string>;
  draft: FieldDraft;
  onChange: (value: FieldDraft) => void;
}) {
  const value =
    typeof draft === 'string' ? draft : field.source === 'environment' ? '' : field.value;
  return (
    <SourcedField
      id={id}
      label={label}
      hint={hint}
      source={field.source}
      draft={draft}
      envDisplay={field.value}
      overrideSeed={field.value}
      onChange={onChange}
    >
      <Input
        id={id}
        dir="ltr"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </SourcedField>
  );
}
