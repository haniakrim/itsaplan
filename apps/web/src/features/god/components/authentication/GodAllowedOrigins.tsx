import { useState } from 'react';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AllowedOrigins } from '@/lib/api/endpoints/god';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { firstInvalidOrigin, parseOrigins } from '../../utils/origins';
import { useAllowedOriginsQuery, useUpdateAllowedOrigins } from '../../services/god.service';

export default function GodAllowedOrigins() {
  const query = useAllowedOriginsQuery();
  if (!query.data) return <ListSkeleton rows={2} rowClassName="h-12" />;
  return <AllowedOriginsForm key={JSON.stringify(query.data)} data={query.data} />;
}

function AllowedOriginsForm({ data }: { data: AllowedOrigins }) {
  const t = useTranslations('god.allowedOrigins');
  const tCommon = useTranslations('common');
  const update = useUpdateAllowedOrigins();
  const [text, setText] = useState(data.origins.join('\n'));

  const origins = parseOrigins(text);
  const invalid = firstInvalidOrigin(origins);
  const dirty = origins.join('\n') !== data.origins.join('\n');

  async function save() {
    try {
      await update.mutateAsync(origins);
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <SettingsSection
      title={t('title')}
      description={t('hint')}
      action={
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={!dirty || invalid !== null || update.isPending}
        >
          {update.isPending ? tCommon('saving') : tCommon('save')}
        </Button>
      }
    >
      <SettingsCard className="space-y-4 p-4">
        <ul className="space-y-1.5">
          {data.envOrigins.map((origin, index) => (
            <li key={origin} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-mono text-xs" dir="ltr">
                {origin}
              </span>
              <span className="flex items-center gap-1.5">
                {index === 0 ? <Badge variant="outline">{t('canonical')}</Badge> : null}
                <Badge variant="secondary" className="gap-1">
                  <Lock className="size-3" />
                  {t('fromEnvironment')}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5">
          <label htmlFor="allowed-origins" className="text-sm font-medium">
            {t('extra')}
          </label>
          <Textarea
            id="allowed-origins"
            rows={4}
            dir="ltr"
            spellCheck={false}
            className="font-mono text-xs"
            placeholder={'https://app.example.com\nhttp://*.orca.localhost:60418'}
            value={text}
            aria-invalid={invalid !== null}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('extraHint')}</p>
          {invalid !== null ? (
            <p className="text-xs text-destructive">{t('invalid', { entry: invalid })}</p>
          ) : null}
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
