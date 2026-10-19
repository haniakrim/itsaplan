'use client';

import { useState } from 'react';
import type {
  InstanceMicrosoft365Settings,
  InstanceMicrosoft365TestResult,
} from '@/lib/api/endpoints/god';
import {
  useTestInstanceMicrosoft365,
  useUpdateInstanceMicrosoft365,
} from '../services/god.service';

export interface GodMicrosoft365Form {
  settings: InstanceMicrosoft365Settings;
  tenantId: string;
  setTenantId: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  clientSecret: string;
  setClientSecret: (v: string) => void;
  dirty: boolean;
  complete: boolean;
  saving: boolean;
  testing: boolean;
  testResult: InstanceMicrosoft365TestResult | null;
  save: () => Promise<void>;
  test: () => Promise<InstanceMicrosoft365TestResult>;
}

export function useGodMicrosoft365Form(
  settings: InstanceMicrosoft365Settings,
): GodMicrosoft365Form {
  const update = useUpdateInstanceMicrosoft365();
  const testApp = useTestInstanceMicrosoft365();
  const [tenantId, setTenantId] = useState(settings.tenantId);
  const [clientId, setClientId] = useState(settings.clientId);
  const [clientSecret, setClientSecret] = useState('');
  const [testResult, setTestResult] = useState<InstanceMicrosoft365TestResult | null>(null);

  const dirty =
    tenantId !== settings.tenantId || clientId !== settings.clientId || clientSecret.length > 0;
  const complete =
    tenantId.trim().length > 0 &&
    clientId.trim().length > 0 &&
    (clientSecret.length > 0 || settings.hasClientSecret);

  function draft() {
    return {
      tenantId: tenantId.trim(),
      clientId: clientId.trim(),
      ...(clientSecret.length > 0 ? { clientSecret } : {}),
    };
  }

  async function save() {
    await update.mutateAsync(draft());
    setClientSecret('');
  }

  async function test() {
    const result = await testApp.mutateAsync(draft());
    setTestResult(result);
    return result;
  }

  return {
    settings,
    tenantId,
    setTenantId,
    clientId,
    setClientId,
    clientSecret,
    setClientSecret,
    dirty,
    complete,
    saving: update.isPending,
    testing: testApp.isPending,
    testResult,
    save,
    test,
  };
}
