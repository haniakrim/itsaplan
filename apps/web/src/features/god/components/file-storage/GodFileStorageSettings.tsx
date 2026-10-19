import type { GodFileStorageForm } from '../../hooks/useGodFileStorageForm';
import GodFileStorageDriverSection from './GodFileStorageDriverSection';
import GodFileStorageS3Section from './GodFileStorageS3Section';
import GodFileStorageSharePointSection from './GodFileStorageSharePointSection';
import GodFileStorageTest from './GodFileStorageTest';

export default function GodFileStorageSettings({ form }: { form: GodFileStorageForm }) {
  return (
    <div className="space-y-8">
      <GodFileStorageDriverSection form={form} />
      <GodFileStorageS3Section form={form} />
      <GodFileStorageSharePointSection form={form} />
      <GodFileStorageTest form={form} />
    </div>
  );
}
