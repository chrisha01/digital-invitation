import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomBytes } from 'node:crypto';

/** Matches the limit the editor enforces before it even sends the file. */
export const MAX_IMAGE_BYTES = 3_500_000;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

/**
 * Reads the container from the bytes rather than the declared type: the browser
 * decides what goes in the multipart part, and nothing stops a client from
 * labelling an HTML file as image/png.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  const head = (offset: number, length: number) =>
    bytes.length >= offset + length
      ? Buffer.from(bytes.subarray(offset, offset + length)).toString('latin1')
      : '';
  const startsWith = (expected: number[]) => expected.every((value, index) => bytes[index] === value);

  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (head(0, 4) === 'GIF8') return 'image/gif';
  if (head(0, 4) === 'RIFF' && head(8, 4) === 'WEBP') return 'image/webp';
  if (head(4, 4) === 'ftyp' && (head(8, 4) === 'avif' || head(8, 4) === 'avis')) return 'image/avif';
  return null;
}

type Settings = {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  region: string;
  publicBase: string;
};

/** Everything an upload needs, or null when the server has no bucket. */
function settings(): Settings | null {
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  if (!bucket || !accessKeyId || !secretAccessKey || !publicBase) return null;

  // R2 needs an endpoint and region=auto; plain S3 needs neither.
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint,
    region: process.env.S3_REGION?.trim() || (endpoint ? 'auto' : 'us-east-1'),
    publicBase,
  };
}

export function storageConfigured(): boolean {
  return settings() !== null;
}

let cached: { client: S3Client; settings: Settings } | null = null;

function storage() {
  if (!cached) {
    const current = settings();
    if (!current) throw new Error('Object storage is not configured.');
    cached = {
      settings: current,
      client: new S3Client({
        region: current.region,
        endpoint: current.endpoint,
        forcePathStyle: Boolean(current.endpoint),
        credentials: {
          accessKeyId: current.accessKeyId,
          secretAccessKey: current.secretAccessKey,
        },
      }),
    };
  }
  return cached;
}

/** Key behind a URL this app stored; null for data URLs and foreign links. */
export function objectKey(url: string): string | null {
  const current = settings();
  if (!current || !url.startsWith(`${current.publicBase}/`)) return null;
  const key = url.slice(current.publicBase.length + 1).split('?')[0];
  return key ? decodeURIComponent(key) : null;
}

/** Stores one image and returns the URL to keep in the invitation document. */
export async function putImage(
  ownerId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const extension = EXTENSIONS[contentType];
  if (!extension) throw new Error(`Unsupported image type ${contentType}.`);

  const { client, settings: current } = storage();
  const key = `invitations/${ownerId}/${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${extension}`;

  await client.send(
    new PutObjectCommand({
      Bucket: current.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return `${current.publicBase}/${key}`;
}

/** Deletes one stored object; anything that is not ours is ignored. */
export async function deleteImage(url: string): Promise<void> {
  const key = objectKey(url);
  if (!key) return;

  const { client, settings: current } = storage();
  await client.send(new DeleteObjectCommand({ Bucket: current.bucket, Key: key }));
}
