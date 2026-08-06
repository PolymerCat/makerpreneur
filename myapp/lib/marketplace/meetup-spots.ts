export type MeetupSpot = {
  id: string;
  label: string;
  /** Draft text inserted into the composer. Max 200 chars. */
  draft: string;
  /** If true, only focus the input (optionally seed a short prefix). */
  focusOnly?: boolean;
};

export const MEETUP_SPOTS: MeetupSpot[] = [
  {
    id: 'library',
    label: 'Library',
    draft:
      'Meetup suggestion: USM Library (public area). Does this work for you?',
  },
  {
    id: 'dtsp',
    label: 'DTSP',
    draft:
      'Meetup suggestion: DTSP (public area). Does this work for you?',
  },
  {
    id: 'desasiswa',
    label: 'Desasiswa gate',
    draft:
      'Meetup suggestion: Desasiswa gate (public area). Does this work for you?',
  },
  {
    id: 'cafe',
    label: 'Cafe',
    draft:
      'Meetup suggestion: a cafe on campus (public area). Does this work for you?',
  },
  {
    id: 'other',
    label: 'Other…',
    draft: 'Meetup suggestion: ',
    focusOnly: true,
  },
];

export function applyMeetupDraft(current: string, draft: string): string {
  const trimmed = current.trimEnd();
  if (!trimmed) return draft;
  return `${trimmed}\n${draft}`;
}
