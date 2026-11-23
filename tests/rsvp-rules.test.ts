import { describe, expect, it } from 'vitest';
import {
  clampCount,
  clearParty,
  fitsCapacity,
  guestForReply,
  partySize,
  rsvpClosedReason,
  seatsTaken,
} from '@/lib/rsvp-rules';
import type { Guest, Invitation } from '@/lib/types';

const guest = (over: Partial<Guest> = {}): Guest => ({
  id: 'guest_1',
  name: 'Ada Lovelace',
  email: '',
  tag: '',
  status: 'invited',
  plusOnes: 0,
  adults: 0,
  children: 0,
  answers: {},
  message: '',
  respondedAt: null,
  ...over,
});

const invitation = (over: Partial<Invitation> = {}): Invitation => ({
  id: 'inv_1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  designSlug: 'gilded-arch',
  title: 'A test invitation',
  subject: '',
  card: { layers: [] } as unknown as Invitation['card'],
  envelope: {} as Invitation['envelope'],
  backdrop: {} as Invitation['backdrop'],
  event: {} as Invitation['event'],
  page: {} as Invitation['page'],
  blocks: [],
  guests: [],
  settings: {
    collectRsvp: true,
    showGuestList: false,
    allowPlusOnes: true,
    maxPlusOnes: 3,
    capacity: null,
    deadline: null,
    headcount: false,
    questions: [],
  },
  ...over,
});

describe('§4.2 reply identity', () => {
  it('prefers the row a signed personal link names', () => {
    const signed = guest({ id: 'guest_signed', name: 'Grace Hopper' });
    const byEmail = guest({ id: 'guest_email', email: 'ada@example.com' });
    const found = guestForReply([byEmail, signed], {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      signedId: 'guest_signed',
    });
    expect(found?.id).toBe('guest_signed');
  });

  it('matches one row by email, ignoring case', () => {
    const row = guest({ id: 'guest_email', email: 'Ada@Example.com' });
    const found = guestForReply([row, guest({ id: 'other' })], {
      name: 'Someone Else',
      email: 'ada@example.com',
      signedId: null,
    });
    expect(found?.id).toBe('guest_email');
  });

  it('matches nobody when an address appears twice', () => {
    const first = guest({ id: 'a', email: 'shared@example.com' });
    const second = guest({ id: 'b', email: 'shared@example.com' });
    expect(
      guestForReply([first, second], { name: 'Ada', email: 'shared@example.com', signedId: null }),
    ).toBeUndefined();
  });

  it('fills a host-started row that has only a name', () => {
    const row = guest({ id: 'blank', name: 'Ada Lovelace', email: '' });
    expect(guestForReply([row], { name: '  ada lovelace ', email: '', signedId: null })?.id).toBe(
      'blank',
    );
  });

  it('never claims a row that already carries an email', () => {
    const row = guest({ id: 'known', name: 'Ada Lovelace', email: 'ada@example.com' });
    expect(guestForReply([row], { name: 'Ada Lovelace', email: '', signedId: null })).toBeUndefined();
  });

  it('never claims a row that has already replied', () => {
    const row = guest({
      id: 'answered',
      name: 'Ada Lovelace',
      email: '',
      status: 'yes',
      respondedAt: '2026-02-01T10:00:00.000Z',
    });
    expect(guestForReply([row], { name: 'Ada Lovelace', email: '', signedId: null })).toBeUndefined();
  });
});

describe('§4.5 party size', () => {
  it('counts the names given when a headcount is used', () => {
    expect(partySize(guest({ status: 'yes', adults: 2, children: 1 }))).toBe(3);
  });

  it('counts the guest plus unnamed plus-ones', () => {
    expect(partySize(guest({ status: 'yes', plusOnes: 2 }))).toBe(3);
  });

  it('always counts the guest themselves', () => {
    expect(partySize(guest({ status: 'yes' }))).toBe(1);
  });

  it('counts nobody who is not attending', () => {
    expect(partySize(guest({ status: 'no', adults: 2 }))).toBe(0);
    expect(partySize(guest({ status: 'maybe', plusOnes: 2 }))).toBe(0);
    expect(partySize(guest({ status: 'invited' }))).toBe(0);
  });

  it('clamps numeric input to the allowed range', () => {
    expect(clampCount('2', 0, 20)).toBe(2);
    expect(clampCount(2.6, 0, 20)).toBe(3);
    expect(clampCount('nonsense', 1, 20)).toBe(1);
    expect(clampCount(-4, 0, 20)).toBe(0);
    expect(clampCount(99, 0, 20)).toBe(20);
  });
});

describe('§4.6 declining clears the party', () => {
  it('resets plus-ones and both headcounts but keeps the status', () => {
    const row = guest({ status: 'no', plusOnes: 2, adults: 3, children: 1 });
    clearParty(row);
    expect(row).toMatchObject({ status: 'no', plusOnes: 0, adults: 0, children: 0 });
  });
});

describe('§4.3 capacity', () => {
  it('sums attending parties, skipping the replying row and its plus-ones', () => {
    const guests = [
      guest({ id: 'host', status: 'yes', adults: 2 }),
      guest({ id: 'solo', status: 'yes' }),
      guest({ id: 'declined', status: 'no', plusOnes: 2 }),
      guest({ id: 'companion', status: 'yes', companionOf: 'host' }),
    ];
    expect(seatsTaken(guests, 'solo')).toBe(3);
  });

  it('skips the plus-ones the replying guest brought', () => {
    const guests = [
      guest({ id: 'host', status: 'yes', adults: 2 }),
      guest({ id: 'solo', status: 'yes', plusOnes: 2 }),
      guest({ id: 'plus-one', status: 'yes', companionOf: 'solo' }),
    ];
    expect(seatsTaken(guests, 'solo')).toBe(2);
  });

  it('has no limit when no capacity is set', () => {
    const inv = invitation({ guests: [guest({ id: 'a', status: 'yes', adults: 10 })] });
    expect(fitsCapacity(inv, 'a', 50)).toBe(true);
  });

  it('accepts a party that exactly fills the room', () => {
    const inv = invitation({
      guests: [guest({ id: 'a', status: 'yes', adults: 3 })],
      settings: { ...invitation().settings, capacity: 5 },
    });
    expect(fitsCapacity(inv, 'b', 2)).toBe(true);
  });

  it('rejects a party that would go over', () => {
    const inv = invitation({
      guests: [guest({ id: 'a', status: 'yes', adults: 3 })],
      settings: { ...invitation().settings, capacity: 5 },
    });
    expect(fitsCapacity(inv, 'b', 3)).toBe(false);
  });
});

describe('§4.4 replies closed', () => {
  const now = new Date('2026-06-01T12:00:00.000Z').getTime();

  it('is open with no deadline and RSVPs enabled', () => {
    expect(rsvpClosedReason(invitation(), now)).toBeNull();
  });

  it('is disabled when the host turned replies off', () => {
    const inv = invitation({ settings: { ...invitation().settings, collectRsvp: false } });
    expect(rsvpClosedReason(inv, now)).toBe('disabled');
  });

  it('is closed after the deadline', () => {
    const inv = invitation({
      settings: { ...invitation().settings, deadline: '2026-05-31T23:59:00.000Z' },
    });
    expect(rsvpClosedReason(inv, now)).toBe('deadline');
  });

  it('stays open before the deadline', () => {
    const inv = invitation({
      settings: { ...invitation().settings, deadline: '2026-06-02T23:59:00.000Z' },
    });
    expect(rsvpClosedReason(inv, now)).toBeNull();
  });
});
