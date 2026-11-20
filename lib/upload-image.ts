/**
 * Uploads an image and returns the URL to store in the invitation.
 *
 * Servers without object storage answer 503; in that case the file is inlined as
 * a data URL exactly as before, so the editor keeps working during the move and
 * on a developer's machine where no bucket is configured.
 *
 * Either way the picture is shrunk first: the URL ends up inside the invitation
 * document, which is written on every save and shipped in the guest page's HTML.
 * A 5 MB camera photo inlined at full size turns one invitation into a 6 MB
 * page, so anything large is re-encoded to a sane size before it leaves the tab.
 */

/** Long edge kept for a stored photo; plenty for a card, envelope or backdrop. */
const MAX_EDGE = 1800;
/** Files under this are sent untouched: resizing cannot make them much smaller. */
const SHRINK_ABOVE_BYTES = 450_000;
const JPEG_QUALITY = 0.82;

/** The size an image should be drawn at to fit inside `max` on its long edge. */
export function fittedSize(
  width: number,
  height: number,
  max = MAX_EDGE,
): { width: number; height: number } {
  if (!width || !height) return { width: 1, height: 1 };
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Re-encodes one large file smaller. Falls back to the original whenever the
 * browser cannot decode it or the result would not actually be smaller, so a
 * photo the browser does not understand still uploads as it always did.
 */
async function shrink(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  // Animated GIFs would lose their frames to a canvas, and canvas cannot encode them back.
  if (file.type === 'image/gif') return file;
  if (file.size <= SHRINK_ABOVE_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const size = fittedSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, size.width, size.height);

    // Keep transparency where the source had it; everything else becomes a JPEG.
    const png = file.type === 'image/png';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, png ? 'image/png' : 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = png ? file.name : `${file.name.replace(/\.[^./\\]+$/, '') || 'photo'}.jpg`;
    return new File([blob], name, { type: blob.type });
  } finally {
    bitmap.close();
  }
}

export async function uploadImage(file: File): Promise<string> {
  const prepared = await shrink(file);
  const body = new FormData();
  body.append('file', prepared);

  const response = await fetch('/api/uploads', { method: 'POST', body });

  if (response.status === 503) return inline(prepared);
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? 'That image could not be uploaded.');
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) throw new Error('That image could not be uploaded.');
  return data.url;
}

function inline(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.readAsDataURL(file);
  });
}
