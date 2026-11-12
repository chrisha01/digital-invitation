export type TextLayer = {
  id: string;
  name: string;
  text: string;
  font: string;

  /** font size in cqw (percent of card width) */
  size: number;
  color: string;
  weight: number;
  italic: boolean;
  uppercase: boolean;
  /** letter spacing in em */
  tracking: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  /** left edge in % of card width */
  x: number;
  /** top edge in % of card height */
  y: number;
  width: number;
  visible: boolean;
};

/** Animated artwork that drifts across the card. */
export type DriftId = 'leaves' | 'petals' | 'confetti' | 'sparkle' | 'motes';

/** Silhouette of the frame around a card portrait. */
export type PortraitShape = 'circle' | 'arch' | 'oval' | 'soft';

export type Card = {
  background: string;
  ink: string;
  accent: string;
  motif: string | null;
  border: 'none' | 'rule' | 'double' | 'frame';
  borderColor: string;
  photo: string | null;
  photoOpacity: number;
  /** A portrait framed in a shape, set above the host names. */
  portrait?: string | null;
  portraitShape?: PortraitShape;
  /** frame width in cqw (percent of card width) */
  portraitSize?: number;
  /** centre of the frame in % of the card; missing = centred above the host names */
  portraitX?: number;
  portraitY?: number;
  /** `null` = deliberately still; missing = follow the design's motion */
  drift?: DriftId | null;
  layers: TextLayer[];
};

export type LinerPattern = 'none' | 'solid' | 'stripe' | 'dots' | 'scallop' | 'bloom';

/** Silhouette of the closing flap. */
export type FlapShape = 'pointed' | 'rounded' | 'flat';

/** Surface of the paper stock. */
export type PaperTexture = 'smooth' | 'laid' | 'grain';

/** What holds the flap shut. */
export type SealStyle = 'none' | 'monogram' | 'rosette';

/** How the envelope opens when a guest taps it. */
export type EnvelopeAnimation = 'classic' | 'quick' | 'slow' | 'wide';

export type Envelope = {
  enabled: boolean;
  color: string;
  flap: FlapShape;
  texture: PaperTexture;
  seal: SealStyle;
  sealColor: string;
  linerPattern: LinerPattern;
  linerColor: string;
  linerColor2: string;
  stamp: string;
  stampColor: string;
  font: string;
  openAnimation: EnvelopeAnimation;
  returnAddress: string;
};

export type BackdropPattern = 'plain' | 'paper' | 'linen' | 'gradient' | 'confetti' | 'sunburst' | 'upload';

export type Backdrop = {
  pattern: BackdropPattern;
  color1: string;
  color2: string;
  image: string | null;
};

export type Question = {
  id: string;
  label: string;
  type: 'text' | 'choice';
  options: string[];
  required: boolean;
};

export type EventSettings = {
  collectRsvp: boolean;
  showGuestList: boolean;
  allowPlusOnes: boolean;
  maxPlusOnes: number;
  capacity: number | null;
  deadline: string | null;
  headcount: boolean;
  /** ask guests for a mobile number when they reply; missing = on */
  textUpdates?: boolean;
  questions: Question[];
};

export type PageStyle = {
  background: string;
  text: string;
  accent: string;
  fontBody: string;
  fontHeading: string;
};

export type Block = {
  id: string;
  type: 'note' | 'schedule' | 'link';
  title: string;
  body: string;
  url: string;
};

export type EventDetails = {
  title: string;
  host: string;
  startsAt: string;
  endsAt: string;
  location: string;
  address: string;
  description: string;
  dressCode: string;
};

/** Silhouette of a table on the seating plan. */
export type SeatShape = 'round' | 'long' | 'square';

export type SeatTable = {
  id: string;
  name: string;
  shape: SeatShape;
  /** seats at this table, whatever the party sizes put in them */
  seats: number;
  /** centre of the table in % of the plan floor */
  x: number;
  y: number;
  /** one entry per chair, around the table in order; null is a free chair */
  chairs: (string | null)[];
  /** degrees clockwise; chairs turn with the table */
  rotation?: number;
  /** chairs kept free for late plus-ones (drawn dashed, not seatable) */
  spare?: number;
};

/** Silhouette of a venue feature drawn on the floor. */
export type VenueShape = 'rect' | 'round' | 'soft';

/** Anything that is not seating: a stage, a bar, a dance floor, a door. */
export type VenueItem = {
  id: string;
  label: string;
  shape: VenueShape;
  /** size in % of the floor */
  w: number;
  h: number;
  /** centre in % of the floor */
  x: number;
  y: number;
  rotation: number;
};

export type SeatingPlan = {
  tables: SeatTable[];
  items?: VenueItem[];
  /** party size each seated guest held when they were placed, for drift detection */
  snapshot?: Record<string, number>;
  /** the hosts have signed off; guests see their table only once true */
  finalized?: boolean;
  updatedAt?: string;
};

export type RsvpStatus = 'invited' | 'yes' | 'no' | 'maybe';

/** Which consented guests a text blast goes to. */
export type TextAudience = 'attending' | 'pending' | 'all';

export type TextBlast = {
  id: string;
  body: string;
  audience: TextAudience;
  sentAt: string;
  /** consented guests the message was aimed at */
  recipients: number;
  delivered: number;
  failed: number;
  status: 'sent' | 'partial' | 'failed' | 'not-configured';
  detail?: string;
};

export type EmailBlast = {
  id: string;
  subject: string;
  body: string;
  audience: TextAudience;
  sentAt: string;
  /** guests with an address the message was aimed at */
  recipients: number;
  delivered: number;
  failed: number;
  status: 'sent' | 'partial' | 'failed' | 'not-configured';
  detail?: string;
};

export type Guest = {
  id: string;
  name: string;
  email: string;
  /** party the guest belongs to, e.g. "The Alvarez family" */
  household?: string;
  /** anything the kitchen should know */
  dietary?: string;
  /** step-free access, seating, quiet room, … */
  accessibility?: string;
  /** mobile number given for event updates */
  phone?: string;
  /** explicit permission to receive text messages */
  smsConsent?: boolean;
  tag: string;
  status: RsvpStatus;
  plusOnes: number;
  adults: number;
  children: number;
  answers: Record<string, string>;
  message: string;
  respondedAt: string | null;
  /** set on a plus-one row: the guest whose invitation brought them */
  companionOf?: string | null;
  /** when the door team scanned them in */
  checkedInAt?: string | null;
  /** who on the door team scanned them in */
  checkedInBy?: string;
};

/** Who a reminder asks for a reply. */
export type ReminderAudience = 'pending' | 'maybe' | 'all';

/** A nudge to guests who have not replied yet. */
export type Reminder = {
  id: string;
  sendAt: string;
  audience: ReminderAudience;
  channel: 'email' | 'text';
  createdAt: string;
  status: 'scheduled' | 'sent' | 'partial' | 'failed' | 'not-configured';
  /** claim token: only the request that set this may send the reminder */
  sendingId?: string;
  /** when the claim was taken, so a crashed send can be retried later */
  claimedAt?: string;
  sentAt?: string;
  recipients?: number;
  delivered?: number;
  failed?: number;
  detail?: string;
};

export type Invitation = {
  id: string;
  /** account that owns it; missing on invitations made before accounts existed */
  ownerId?: string;
  /** co-host emails that can see replies and seat guests */
  collaborators?: string[];
  createdAt: string;
  updatedAt: string;
  designSlug: string;
  /** internal title used in the dashboard */
  title: string;
  /** subject line shown in inboxes / on the envelope when a guest has no name */
  subject: string;
  card: Card;
  envelope: Envelope;
  backdrop: Backdrop;
  event: EventDetails;
  settings: EventSettings;
  page: PageStyle;
  blocks: Block[];
  guests: Guest[];
  /** missing on invitations saved before seating was drawn */
  seating?: SeatingPlan;
  /** text updates already sent, newest last */
  texts?: TextBlast[];
  emails?: EmailBlast[];
  /** scheduled RSVP nudges */
  reminders?: Reminder[];
};

export type InvitationSummary = {
  id: string;
  title: string;
  designSlug: string;
  updatedAt: string;
  startsAt: string;
  location: string;
  guestCount: number;
  yesCount: number;
  maybeCount: number;
  checkedIn: number;
  /** heads expected, counting parties and plus-ones */
  headcount: number;
  preview: string;
};

export type RsvpPayload = {
  name: string;
  email: string;
  phone?: string;
  smsConsent?: boolean;
  attending: 'yes' | 'no' | 'maybe';
  plusOnes: number;
  adults: number;
  children: number;
  answers: Record<string, string>;
  message: string;
  guestId?: string;
};
