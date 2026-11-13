import { deleteImage, objectKey } from './storage';
import { isImageReferenced } from './store';

type WithImages = {
  card?: { photo?: string | null; portrait?: string | null } | null;
  backdrop?: { image?: string | null } | null;
};

/** The three spots an invitation keeps an uploaded image. */
export function imageUrls(invitation: WithImages | null): string[] {
  const candidates = [
    invitation?.card?.photo,
    invitation?.card?.portrait,
    invitation?.backdrop?.image,
  ];
  return candidates.filter((url): url is string => typeof url === 'string' && url.length > 0);
}

/**
 * Deletes the objects behind these URLs, skipping any an invitation still
 * references. Best effort: a failed cleanup is logged rather than thrown, since
 * losing an orphaned image beats failing the save that exposed it.
 */
export async function discardImages(urls: string[]): Promise<void> {
  for (const url of new Set(urls)) {
    if (!objectKey(url)) continue;
    try {
      if (await isImageReferenced(url)) continue;
      await deleteImage(url);
    } catch (error) {
      console.error(`could not delete stored image ${url}`, error);
    }
  }
}
