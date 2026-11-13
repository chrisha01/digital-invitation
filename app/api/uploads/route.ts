import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { rateGate } from '@/lib/rate-limit';
import {
  MAX_IMAGE_BYTES,
  isSupportedImage,
  putImage,
  sniffImageType,
  storageConfigured,
} from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** One image per request; enough for an editor session, cheap to abuse. */
const UPLOADS_PER_HOUR = 60;

export async function POST(request: Request) {
  const gate = await rateGate(request, 'upload', UPLOADS_PER_HOUR, 60 * 60 * 1000);
  if (!gate.ok) return gate.response;

  const user = await currentUser();
  if (!user) {
    return gate.applyCookie(NextResponse.json({ error: 'Sign in first.' }, { status: 401 }));
  }

  if (!storageConfigured()) {
    return gate.applyCookie(
      NextResponse.json(
        { error: 'Object storage is not configured on this server.' },
        { status: 503 },
      ),
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return gate.applyCookie(NextResponse.json({ error: 'Attach an image.' }, { status: 400 }));
  }
  if (file.size === 0) {
    return gate.applyCookie(NextResponse.json({ error: 'That file is empty.' }, { status: 400 }));
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return gate.applyCookie(
      NextResponse.json(
        { error: `Please choose an image under ${Math.floor(MAX_IMAGE_BYTES / 100_000) / 10} MB.` },
        { status: 413 },
      ),
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType || !isSupportedImage(contentType)) {
    return gate.applyCookie(
      NextResponse.json({ error: 'Use a JPEG, PNG, WebP, GIF or AVIF image.' }, { status: 400 }),
    );
  }

  try {
    const url = await putImage(user.id, bytes, contentType);
    return gate.applyCookie(NextResponse.json({ url }));
  } catch (error) {
    console.error('upload failed', error);
    return gate.applyCookie(
      NextResponse.json({ error: 'Could not store that image. Try again.' }, { status: 502 }),
    );
  }
}
