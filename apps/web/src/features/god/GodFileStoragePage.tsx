'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { FileStorageSettings } from '@/lib/api/endpoints/god';
import { Button } from '@/components/ui/button';
import GodFileStorageSettings from './components/file-storage/GodFileStorageSettings';
import GodSectionPage from './components/GodSectionPage';
import GodSettingsGate from './components/GodSettingsGate';
import { useGodFileStorageForm } from './hooks/useGodFileStorageForm';
import { useInstanceFileStorageQuery } from './services/god.service';

export default function GodFileStoragePage() {
  const query = useInstanceFileStorageQuery();

  return (
    <GodSettingsGate slug="file-storage" data={query.data}>
      {(settings) => <FileStorageForm settings={settings} />}
    </GodSettingsGate>
  );
}

function FileStorageForm({ settings }: { settings: FileStorageSettings }) {
  const t = useTranslations('god.fileStorage');
  const tCommon = useTranslations('common');
  const form = useGodFileStorageForm(settings);

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
      slug="file-storage"
      actions={
        <Button size="sm" onClick={() => void save()} disabled={!form.dirty || form.saving}>
          {form.saving ? tCommon('saving') : tCommon('save')}
        </Button>
      }
    >
      <GodFileStorageSettings form={form} />
    </GodSectionPage>
  );
}
