/**
 * Popups: what Happy Hallways tells a teacher once, on the laptop only, never
 * on the kiosk. Each is shown until the teacher closes it, and the Account
 * remembers which ones they have closed.
 * - News is "What's changed": a big window, shown once on whatever page the
 *   teacher opens, to teachers who were using Happy Hallways before the change.
 * Add new news at the end of `news`.
 */

export type PopupArt = 'destination-limits' | 'check-destinations' | 'schedule' | 'no-pass-rules' | 'home' | 'requests';

export type News = {
  id: string;
  /** Heads this news when it's shown along with older news the teacher hasn't seen. */
  title: string;
  /**
   * Each change. One with a drawing gets a big row beside it; one without is a
   * short row in a compact list, with a link to where to find it.
   */
  items: { title: string; text: string; art?: PopupArt; link?: { label: string; href: string } }[];
  /** Smaller changes, in one short line under the list. */
  also?: string;
  /** Where the teacher should go to act on the news, when it all happens in one place. */
  action?: { label: string; href: string };
};

export const news: News[] = [
  {
    id: '2026-10-destination-limits',
    title: 'Destinations',
    items: [
      {
        title: 'Each destination has its own limit',
        text: 'The Restroom can stay one at a time while the Nurse and the Counselor have no limit. Only destinations with a limit get a line, so nobody waits behind a trip to the Nurse.',
        art: 'destination-limits',
      },
      {
        title: 'Check your destinations',
        text: 'We copied your old limit onto each of your destinations. Set the ones like the Nurse to “No limit”.',
        art: 'check-destinations',
      },
    ],
    action: { label: 'Review destinations', href: '/destinations' },
  },
  {
    id: '2026-10-schedule',
    title: 'Your schedule',
    items: [
      {
        title: 'The kiosk can follow your schedule',
        text: 'Enter your periods once in the Schedule tab, and the kiosk switches to each class by itself as the period starts. Rotating days? Make a schedule for each (A Day, B Day…) and pick the right one on Home in the morning.',
        art: 'schedule',
      },
      {
        title: 'No-pass times live in your schedule',
        text: 'Block the first or last few minutes of a period, or draw a no-pass time right on the calendar. They work while the kiosk is following your schedule. Off schedule, stop passes by hand from Home.',
        art: 'no-pass-rules',
      },
    ],
    action: { label: 'Set up your schedule', href: '/schedule' },
  },
  {
    id: '2026-10-home',
    title: 'Home, and students asking you',
    items: [
      {
        title: 'Everything for the day is on Home',
        text: 'Who’s out, who’s waiting, and which class and schedule the kiosk is on, all on one page you can leave open all day. The box at the top of the sidebar always brings you back. Classes are just your rosters now, and every pass is in History.',
        art: 'home',
      },
      {
        title: 'Students ask, you say yes or no',
        text: 'When something stops a student (they’re out of passes, it’s a no-pass time, or their destination is full), they can tap “Ask my teacher” at the kiosk. Their request shows up on Home. Approve it and their pass starts right away. You can still let them go at the kiosk with your PIN.',
        art: 'requests',
      },
    ],
    action: { label: 'Go to Home', href: '/' },
  },
  {
    id: '2026-10-13-class-limit-pins-student-link',
    title: 'Limits, PINs and the Student link',
    items: [
      {
        title: 'One limit for the whole class',
        text: 'Under “How limits work”, choose one limit for the whole class or a limit for each destination. Set the Nurse, or anywhere else, not to count.',
        link: { label: 'Pass Options', href: '/pass-options' },
      },
      {
        title: 'Can always go',
        text: 'For students with medical, IEP or 504 needs: nothing at the kiosk holds them back, and every trip is still recorded. Edit a student in their class to turn it on. “Exempt” is now “Exempt from the Pass Allowance only”.',
      },
      {
        title: 'Student PINs',
        text: 'Turn on Student PINs on the Roster, so nobody takes a pass as someone else. Print PIN cards from each class’s PINs button.',
      },
      {
        title: 'Student link',
        text: 'Students can watch who’s out and the line from their own Chromebook. Open the new Student link tab and paste the link into Google Classroom.',
        link: { label: 'Student link', href: '/student-link' },
      },
    ],
    also: 'Drag your classes in the sidebar to put them in order. Long destination lists now scroll on the kiosk, and the icon picker always fits and finds everyday words like “restroom” and “nurse”.',
  },
];

export function newsIds() {
  return news.map((each) => each.id);
}

/**
 * Older versions remembered only the newest news a teacher had seen, so
 * everything up to it counts as seen.
 */
export function seenBefore(newestSeen: string | undefined, at: string): Record<string, string> {
  const upTo = news.findIndex((each) => each.id === newestSeen);
  return Object.fromEntries(news.slice(0, upTo + 1).map((each) => [each.id, at]));
}

export function unseenNews(seen: Record<string, string>) {
  return news.filter((each) => !seen[each.id]);
}

/** Any popup by id, for `?popup=` and the Help menu. */
export function popupNamed(id: string) {
  return news.find((each) => each.id === id);
}
