import { afterEach, describe, expect, it, vi } from 'vitest';
import { clip, shareDescription, sharePalette, shareTitle, siteUrl } from '@/lib/share';
import { formatWhen } from '@/lib/dates';
import type { Card, EventDetails, Invitation } from '@/lib/types';

const event = (over: Partial<EventDetails> = {}): EventDetails => ({
  title: '',
  host: '',
  startsAt: '',
  endsAt: '',
  location: '',
  address: '',
  description: '',
  dressCode: '',
  ...over,
});

const card = (over: Partial<Card> = {}): Card => ({
  background: '#f7f2e7',
  ink: '#2b2a26',
  accent: '#9a7b4f',
  motif: null,
  border: 'none',
  borderColor: '',
  photo: null,
  photoOpacity: 0,
  layers: [],
  ...over,
});

const invitation = (over: Partial<Invitation> = {}): Invitation => ({
  id: 'inv_1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  designSlug: 'gilded-arch',
  title: 'A test invitation',
  subject: '',
  card: card(),
  envelope: {} as Invitation['envelope'],
  backdrop: {} as Invitation['backdrop'],
  event: event(),
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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('clip', () => {
  it('collapses whitespace and leaves short text alone', () => {
    expect(clip('  A  late-summer\nsupper  ', 40)).toBe('A late-summer supper');
  });

  it('clips on a word boundary', () => {
    expect(clip('alpha beta gamma delta', 12)).toBe('alpha beta…');
  });

  it('trims the space it cuts at', () => {
    expect(clip('one two three four', 8)).toBe('one two…');
  });

  it('clips mid-word rather than losing the sentence', () => {
    expect(clip('supercalifragilistic expialidocious', 10)).toBe('supercalif…');
  });
});

describe('shareTitle', () => {
  it('uses the event title the guest sees', () => {
    const inv = invitation({ title: 'Dashboard name', event: event({ title: 'A Late-Summer Supper' }) });
    expect(shareTitle(inv)).toBe('A Late-Summer Supper');
  });

  it('falls back to the card title, then to a generic line', () => {
    expect(shareTitle(invitation({ title: '  Garden party ' }))).toBe('Garden party');
    expect(shareTitle(invitation({ title: '   ' }))).toBe('You are invited');
  });

  it('clips a very long title without cutting a word in half', () => {
    const long =
      'The Annual Late-Summer Supper, Barn Dance and Long Table Dinner for the Whole Village and Every Friend';
    const title = shareTitle(invitation({ event: event({ title: long }) }));
    expect(title.length).toBeLessThanOrEqual(91);
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toMatch(/ …$/);
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
  });
});

describe('shareDescription', () => {
  it('reads host, when and where, then the host’s own words', () => {
    const startsAt = '2026-09-11T23:00:00.000Z';
    const inv = invitation({
      event: event({
        host: 'Amelia & Jonah',
        startsAt,
        location: 'The Old Fig House',
        description: 'Bring a dish and something to drink.',
      }),
    });
    expect(shareDescription(inv)).toBe(
      `Hosted by Amelia & Jonah · ${formatWhen(startsAt)} · The Old Fig House — Bring a dish and something to drink.`,
    );
  });

  it('leaves out missing pieces without stray separators', () => {
    const startsAt = '2026-09-11T23:00:00.000Z';
    const inv = invitation({ event: event({ startsAt, location: 'The Old Fig House' }) });
    expect(shareDescription(inv)).toBe(`${formatWhen(startsAt)} · The Old Fig House`);

    const bare = invitation({ event: event({ host: 'Amelia' }) });
    expect(shareDescription(bare)).toBe('Hosted by Amelia');
  });

  it('has a line for a card with no details at all', () => {
    expect(shareDescription(invitation())).toBe(
      'Open the invitation to see the details and reply.',
    );
  });

  it('clips the blurb and never includes the guest list', () => {
    const inv = invitation({
      event: event({
        host: 'Amelia',
        description: 'word '.repeat(80),
      }),
      guests: [
        {
          id: 'guest_1',
          name: 'Grace Hopper',
          email: 'grace@example.com',
          tag: '',
          status: 'yes',
          plusOnes: 0,
          adults: 0,
          children: 0,
          answers: {},
          message: 'Cannot wait',
          respondedAt: null,
        },
      ],
    });
    const description = shareDescription(inv);
    expect(description).toContain('word word');
    expect(description.endsWith('…')).toBe(true);
    expect(description).not.toContain('Grace Hopper');
    expect(description).not.toContain('grace@example.com');
    expect(description.length).toBeLessThanOrEqual('Hosted by Amelia — '.length + 141);
  });
});

describe('sharePalette', () => {
  it('keeps the card’s own colours', () => {
    const inv = invitation({ card: card({ background: '#8E1B2C', ink: '#FFF8EE', accent: '#D9A441' }) });
    expect(sharePalette(inv)).toEqual({
      background: '#8E1B2C',
      ink: '#FFF8EE',
      accent: '#D9A441',
    });
  });

  it('takes the page background when the card has none', () => {
    const inv = invitation({
      card: card({ background: '' }),
      page: { background: '#0f172a' } as Invitation['page'],
    });
    expect(sharePalette(inv).background).toBe('#0f172a');
  });

  it('falls back to neutral paper and ink for blank or invalid values', () => {
    const inv = invitation({
      card: card({ background: 'transparent', ink: 'rgb(0,0,0)', accent: '#12345' }),
      page: { background: '' } as Invitation['page'],
    });
    expect(sharePalette(inv)).toEqual({
      background: '#f7f2e7',
      ink: '#2b2a26',
      accent: '#9a7b4f',
    });
  });
});

describe('siteUrl', () => {
  it('is undefined with no APP_URL set', () => {
    vi.stubEnv('APP_URL', '');
    expect(siteUrl()).toBeUndefined();
  });

  it('is undefined when APP_URL is not a URL', () => {
    vi.stubEnv('APP_URL', 'gatherly.example.com');
    expect(siteUrl()).toBeUndefined();
  });

  it('resolves the configured origin, trimming the value', () => {
    vi.stubEnv('APP_URL', ' https://gatherly.example.com ');
    expect(siteUrl()?.origin).toBe('https://gatherly.example.com');
  });
});
