/**
 * Uploads an image and returns the URL to store in the invitation.
 *
 * Servers without object storage answer 503; in that case the file is inlined as
 * a data URL exactly as before, so the editor keeps working during the move and
 * on a developer's machine where no bucket is configured.
 */
export async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);

  const response = await fetch('/api/uploads', { method: 'POST', body });

  if (response.status === 503) return inline(file);
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
