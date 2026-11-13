import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomBytes } from 'node:crypto';

/** Matches the limit the editor already enforced on inline uploads. */
export const MAX_IMAGE_BYTES = 3_500_000;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export function isSupportedImage(type: string): boolean {
  return type in EXTENSIONS;
}

/**
 * Reads the container from the bytes rather than the declared type: the browser
 * decides what goes in the multipart part, and nothing stops a client from
 * labelling an HTML file as image/png.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  const at = (offset: number, length: number) =>
    bytes.length >= offset + length ? Array.from(bytes.subarray(offset, offset + length)) : [];
  const matches = (offset: number, expected: number[]) => {
    const actual = at(offset, expected.length);
    return actual.length === expected.length && expected.every((value, index) => actual[index] === value);
  };
  const ascii = (offset: number, length: number) =>
    bytes.length >= offset + length
      ? Buffer.from(bytes.subarray(offset, offset + length)).toString('latin1')
      : '';

  if (matches(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (matches(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (ascii(4, 4) === 'ftyp' && (ascii(8, 4) === 'avif' || ascii(8, 4) === 'avis')) return 'image/avif';
  return null;
}

function config() {
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  // R2 wants an endpoint; plain S3 does not.
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  const region = process.env.S3_REGION?.trim() || (endpoint ? 'auto' : 'us-east-1');
  const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  return { bucket, accessKeyId, secretAccessKey, endpoint, region, publicBase };
}

/** True when every setting an upload needs is present. */
export function storageConfigured(): boolean {
  const { bucket, accessKeyId, secretAccessKey, publicBase } = config();
  return Boolean(bucket && accessKeyId && secretAccessKey && publicBase);
}

let client: S3Client | null = null;

function s3(options: NonNullable<ReturnType<typeof config>>, endpointDefaults: boolean) {
  if (!client) {
    client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      // R2 and most S3-compatible services expect the bucket in the path.
      forcePathStyle: endpointDefaults,
      credentials: {
        accessKeyId: options.accessKeyId!,
        secretAccessKey: options.secretAccessKey!,
      },
    });
  }
  return client;
}

/**
 * Stores one image and returns the URL to keep in the invitation document.
 * The key is scoped by owner so objects can be traced back to an account.
 */
export async function putImage(
  ownerId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const options = config();
  if (!storageConfigured()) throw new Error('Object storage is not configured.');

  const extension = EXTENSIONS[contentType];
  if (!extension) throw new Error(`Unsupported image type ${contentType}.`);

  const key = `invitations/${ownerId}/${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${extension}`;

  await s3(options, Boolean(options.endpoint)).send(
    new PutObjectCommand({
      Bucket: options.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return `${options.publicBase}/${key}`;
}
