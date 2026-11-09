import type { IconName } from '../icons';

/** The three things to set up, shown on the welcome page, the tour and the checklist. */
export const steps = [
  {
    key: 'class',
    icon: 'users',
    title: 'Add your class',
    short: 'Name it and paste in your roster. That’s all it takes.',
    text: 'Name your class and paste in your roster, one student per line. Happy Hallways keeps only first names and the first few letters of last names.',
  },
  {
    key: 'destinations',
    icon: 'map-pin',
    title: 'Set your destinations',
    short: 'Bathroom is ready to go. Add the nurse, the office or anywhere else.',
    text: 'Bathroom is ready to go. Give it a time limit, or add the other places your students go, like the nurse, the office or the library.',
  },
  {
    key: 'kiosk',
    icon: 'kiosk',
    title: 'Start the kiosk',
    short: 'A tablet by the door, or this computer. Students tap their name.',
    text: 'Pair a spare tablet or Chromebook by the door, or use this computer. Students tap their name to take a pass, and again when they’re back, and you see who’s out from your desk.',
  },
] as const satisfies readonly { key: string; icon: IconName; title: string; short: string; text: string }[];

export type StepKey = (typeof steps)[number]['key'];

/** The one thing every teacher must know before the first day. */
export const keepOpen = {
  title: 'Keep your laptop open and awake',
  text: 'Your laptop decides who may leave. The kiosk and students’ own devices ask it every time, directly, with no server in between. Leave Happy Hallways open on your laptop, with the lid open, all day. While it’s closed or asleep, nobody can sign out; students can still sign back in at the kiosk.',
};
