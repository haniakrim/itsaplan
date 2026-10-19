import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { StorageDriver } from './driver';
import type { S3Config } from './config';

// S3-compatible object store (RustFS in the Compose stacks). forcePathStyle is
// required for RustFS (and most self-hosted S3 gateways) because they do not serve
// virtual-host-style buckets; hosted stores that only serve virtual-host-style
// buckets turn it off. region is sent but ignored by RustFS; a value is still
// required by the SDK.

export function createS3Driver(config: S3Config): StorageDriver {
  const bucket = config.bucket;
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: config.forcePathStyle,
  });

  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },
    async get(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!res.Body) throw new Error(`Object '${key}' has no body`);
      return {
        body: (res.Body as { transformToWebStream: () => ReadableStream }).transformToWebStream(),
        contentType: res.ContentType || 'application/octet-stream',
        contentLength: res.ContentLength,
      };
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
