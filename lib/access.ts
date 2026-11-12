import type { Invitation } from './types';
import type { SessionUser } from './auth';

/** Co-hosts are stored as lowercased emails so a pending invite still works. */
export function isCollaborator(invitation: Invitation, email: string | undefined): boolean {
  if (!email) return false;
  return (invitation.collaborators ?? []).some((entry) => entry.toLowerCase() === email.toLowerCase());
}

export function isOwner(invitation: Invitation, user: SessionUser | null): boolean {
  return Boolean(user && invitation.ownerId === user.id);
}

/** Owners and co-hosts can see replies, seat guests and send texts. */
export function canManage(invitation: Invitation, user: SessionUser | null): boolean {
  if (!user) return false;
  return isOwner(invitation, user) || isCollaborator(invitation, user.email);
}
