import { useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { SettingSource } from '@/lib/api/endpoints/god';
import type { FieldDraft } from '../../utils/fileStoragePatch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function SourcedField({
  id,
  label,
  hint,
  source,
  draft,
  envDisplay,
  overrideSeed,
  onChange,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  source: SettingSource;
  draft: FieldDraft;
  envDisplay: string;
  overrideSeed: string | boolean;
  onChange: (value: FieldDraft) => void;
  children: ReactNode;
}) {
  const t = useTranslations('god.fileStorage');
  const [overriding, setOverriding] = useState(false);
  const usesEnvironment =
    draft === null || (source === 'environment' && draft === undefined && !overriding);

  function override() {
    setOverriding(true);
    onChange(overrideSeed);
  }

  function useEnvironment() {
    setOverriding(false);
    onChange(null);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {usesEnvironment ? (
          <Badge variant="secondary" className="gap-1">
            <Lock className="size-3" />
            {t('setByEnvironment')}
          </Badge>
        ) : null}
      </div>
      {usesEnvironment ? (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="min-w-0 truncate font-mono text-xs" dir="ltr">
            {draft === null ? t('willUseEnvironment') : envDisplay}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={override}>
            {t('override')}
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {children}
          {source !== 'default' ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={useEnvironment}
            >
              {t('useEnvironment')}
            </Button>
          ) : null}
        </div>
      )}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
