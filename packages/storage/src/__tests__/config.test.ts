import { describe, expect, test } from 'bun:test';
import {
  describeStorage,
  resolveS3Config,
  resolveSharePointConfig,
  resolveStorageConfig,
} from '../config';

const s3Env = {
  S3_ENDPOINT: 'http://minio:9000',
  S3_BUCKET: 'env-bucket',
  S3_ACCESS_KEY_ID: 'env-key',
  S3_SECRET_ACCESS_KEY: 'env-secret',
};

describe('resolveStorageConfig', () => {
  test('uses the environment when nothing is saved', () => {
    expect(resolveStorageConfig({}, s3Env)).toEqual({
      driver: 's3',
      s3: {
        endpoint: 'http://minio:9000',
        bucket: 'env-bucket',
        region: 'us-east-1',
        accessKeyId: 'env-key',
        secretAccessKey: 'env-secret',
        forcePathStyle: true,
      },
    });
  });

  test('a saved field wins over the environment, the others still come from it', () => {
    const config = resolveS3Config({ s3: { bucket: 'db-bucket', forcePathStyle: false } }, s3Env);
    expect(config).toMatchObject({
      bucket: 'db-bucket',
      endpoint: 'http://minio:9000',
      forcePathStyle: false,
    });
  });

  test('S3_FORCE_PATH_STYLE=false turns path style off', () => {
    expect(resolveS3Config({}, { ...s3Env, S3_FORCE_PATH_STYLE: 'false' }).forcePathStyle).toBe(
      false,
    );
  });

  test('the saved driver wins over STORAGE_DRIVER', () => {
    const env = { ...s3Env, STORAGE_DRIVER: 'sharepoint' };
    expect(resolveStorageConfig({ driver: 's3' }, env).driver).toBe('s3');
    expect(() => resolveStorageConfig({}, env)).toThrow('SharePoint storage is not configured');
  });

  test('rejects an unknown STORAGE_DRIVER', () => {
    expect(() => resolveStorageConfig({}, { STORAGE_DRIVER: 'gcs' })).toThrow(
      /Unknown STORAGE_DRIVER/,
    );
  });

  test('names the missing S3 variables', () => {
    expect(() => resolveStorageConfig({}, {})).toThrow('S3 storage is not configured');
  });
});

describe('SharePoint configuration', () => {
  const env = {
    SHAREPOINT_TENANT_ID: 't',
    SHAREPOINT_CLIENT_ID: 'c',
    SHAREPOINT_CLIENT_SECRET: 's',
    SHAREPOINT_DRIVE_ID: 'd',
  };

  test('reads the environment', () => {
    expect(resolveSharePointConfig({}, env)).toMatchObject({ tenantId: 't', driveId: 'd' });
  });

  test('takes the credentials of the instance app when asked', () => {
    const app = { tenantId: 'it', clientId: 'ic', clientSecret: 'is' };
    const config = resolveSharePointConfig({ sharepoint: { useInstanceApp: true } }, env, app);
    expect(config).toMatchObject({
      tenantId: 'it',
      clientId: 'ic',
      clientSecret: 'is',
      driveId: 'd',
    });
  });

  test('fails clearly when the instance app is missing', () => {
    expect(() => resolveSharePointConfig({ sharepoint: { useInstanceApp: true } }, env)).toThrow(
      'instance Microsoft 365 app',
    );
  });
});

describe('describeStorage', () => {
  test('names the source of every value and hides secrets', () => {
    const description = describeStorage({ s3: { bucket: 'db', secretAccessKey: 'x' } }, s3Env);
    expect(description.s3.bucket).toEqual({ value: 'db', source: 'database' });
    expect(description.s3.endpoint).toEqual({ value: 'http://minio:9000', source: 'environment' });
    expect(description.s3.region).toEqual({ value: 'us-east-1', source: 'default' });
    expect(description.s3.secretAccessKey).toEqual({ hasValue: true, source: 'database' });
    expect(JSON.stringify(description)).not.toContain('env-secret');
    expect(description.driver).toEqual({ value: 's3', source: 'default' });
  });
});
