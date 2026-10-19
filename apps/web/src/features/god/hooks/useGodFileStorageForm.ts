'use client';

import { useState } from 'react';
import type {
  FileStorageSettings,
  FileStorageTestResult,
  StorageDriverName,
} from '@/lib/api/endpoints/god';
import {
  buildFileStoragePatch,
  EMPTY_DRAFT,
  isDraftDirty,
  type FieldDraft,
  type FileStorageDraft,
} from '../utils/fileStoragePatch';
import { useTestInstanceFileStorage, useUpdateInstanceFileStorage } from '../services/god.service';

export interface GodFileStorageForm {
  settings: FileStorageSettings;
  draft: FileStorageDraft;
  driver: StorageDriverName;
  setDriver: (value: StorageDriverName | null) => void;
  setS3: (key: string, value: FieldDraft) => void;
  setSharePoint: (key: string, value: FieldDraft) => void;
  useInstanceApp: boolean;
  dirty: boolean;
  saving: boolean;
  testing: boolean;
  testResult: FileStorageTestResult | null;
  save: () => Promise<void>;
  test: () => Promise<FileStorageTestResult>;
}

export function useGodFileStorageForm(settings: FileStorageSettings): GodFileStorageForm {
  const update = useUpdateInstanceFileStorage();
  const testStorage = useTestInstanceFileStorage();
  const [draft, setDraft] = useState<FileStorageDraft>(EMPTY_DRAFT);
  const [testResult, setTestResult] = useState<FileStorageTestResult | null>(null);

  const driver = draft.driver ?? settings.driver.value;
  const useInstanceApp =
    typeof draft.sharepoint.useInstanceApp === 'boolean'
      ? draft.sharepoint.useInstanceApp
      : settings.sharepoint.useInstanceApp;

  function setDriver(value: StorageDriverName | null) {
    setDraft((d) => ({ ...d, driver: value }));
  }

  function setS3(key: string, value: FieldDraft) {
    setDraft((d) => ({ ...d, s3: { ...d.s3, [key]: value } }));
  }

  function setSharePoint(key: string, value: FieldDraft) {
    setDraft((d) => ({ ...d, sharepoint: { ...d.sharepoint, [key]: value } }));
  }

  async function save() {
    await update.mutateAsync(buildFileStoragePatch(draft));
  }

  async function test() {
    const result = await testStorage.mutateAsync(buildFileStoragePatch(draft));
    setTestResult(result);
    return result;
  }

  return {
    settings,
    draft,
    driver,
    setDriver,
    setS3,
    setSharePoint,
    useInstanceApp,
    dirty: isDraftDirty(draft),
    saving: update.isPending,
    testing: testStorage.isPending,
    testResult,
    save,
    test,
  };
}
