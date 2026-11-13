import { deleteImage, imageUrls, isStoredImageUrl } from './storage';
import { isImageReferenced } from './store';

export { imageUrls };

/**
 * Best-effort cleanup for objects no longer used by an invitation.
 *
 * Sequential rather than parallel so a large delete cannot stampede the bucket,
 * and every failure is logged rather than thrown: losing one orphaned image is
 * better than failing the save or delete that the person actually asked for.
 */
export async function discardImages(urls: string[]): Promise<void> {
  const unique = [...new Set(urls)].filter(isStoredImageUrl);

  for (const url of unique) {
    try {
      // Duplicating an invitation copies its URLs, so an object may still be
      // in use elsewhere.
      if (await isImageReferenced(url)) continue;
      await deleteImage(url);
    } catch (error) {
      console.error(`could not delete stored image ${url}`, error);
    }
  }
}

/** URLs an update removed, i.e. the objects that are now candidates for cleanup. */
export function replacedImages(before: string[], after: string[]): string[] {
  const kept = new Set(after);
  return before.filter((url) => !kept.has(url));
}
