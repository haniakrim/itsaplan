'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { InstanceMicrosoft365Settings } from '@/lib/api/endpoints/god';
import { Button } from '@/components/ui/button';
import GodMicrosoft365Reuse from './components/microsoft365/GodMicrosoft365Reuse';
import GodMicrosoft365Settings from './components/microsoft365/GodMicrosoft365Settings';
import GodSectionPage from './components/GodSectionPage';
import GodSettingsGate from './components/GodSettingsGate';
import { useGodMicrosoft365Form } from './hooks/useGodMicrosoft365Form';
import { useInstanceMicrosoft365Query } from './services/god.service';

export default function GodMicrosoft365Page() {
  const query = useInstanceMicrosoft365Query();

  return (
    <GodSettingsGate slug="microsoft365" data={query.data}>
      {(settings) => <Microsoft365Form settings={settings} />}
    </GodSettingsGate>
  );
}

function Microsoft365Form({ settings }: { settings: InstanceMicrosoft365Settings }) {
  const t = useTranslations('god.microsoft365');
  const tCommon = useTranslations('common');
  const form = useGodMicrosoft365Form(settings);

  async function save() {
    try {
      await form.save();
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage
      slug="microsoft365"
      actions={
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={!form.dirty || !form.complete || form.saving}
        >
          {form.saving ? tCommon('saving') : tCommon('save')}
        </Button>
      }
    >
      <div className="space-y-8">
        <GodMicrosoft365Settings form={form} />
        <GodMicrosoft365Reuse />
      </div>
    </GodSectionPage>
  );
}
