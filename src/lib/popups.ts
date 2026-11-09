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
  /** A short thank-you, leading the news above its list. */
  thanks?: string;
  /** Smaller changes, in one short line under the list. */
  also?: string;
  /** A closing note at the bottom, by the buttons. An email address in it becomes a link to write to it. */
  note?: string;
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
  {
    id: '2026-11-whats-new',
    title: "What's new in Happy Hallways",
    thanks:
      'Thank you. From all of us at teacher.dev: thank you for every email, comment and idea, and for your patience while we built. Almost everything below came straight from your requests.',
    items: [
      {
        title: 'Keep this computer open during class',
        text: "Your computer now decides who can go, for the kiosk and for students' own devices. Keep Happy Hallways open and awake while you teach. If it closes, passes pause until it's back, though students coming back are still recorded.",
      },
      {
        title: 'Students can take a pass from their own device',
        text: 'Each class gets its own code, shown on the kiosk and on Home. Students join on a Chromebook or phone, type their first name and PIN, and can take a pass, come back or join the line. A kiosk is now optional.',
        link: { label: 'Student devices', href: '/student-link' },
      },
      {
        title: 'Your old Student link now uses class codes',
        text: 'The code changes every class period. If you posted the old link in Google Classroom, students who open it will be asked for the code.',
      },
      {
        title: 'One roster for all your classes',
        text: "A student in two of your classes is now one student, so their passes, PIN and pass allowance follow them. Check the Roster to merge anyone we couldn't match. Paste your class lists again to add full names; only you ever see them.",
        link: { label: 'Roster', href: '/roster' },
      },
      {
        title: 'Attendance, if you want it',
        text: "Turn it on in Pass Options. Students tap in when they arrive, late arrivals are marked tardy, and anyone who never arrives is marked absent. It's your own record, not official attendance.",
        link: { label: 'Pass Options', href: '/pass-options' },
      },
      {
        title: 'Everything that needs you, in one place',
        text: 'Requests and overdue students now sit in the Needs you panel in the corner of every page. From Home you can also add a student to a line, take one out, or clear it.',
      },
      {
        title: 'Choose what students can see',
        text: "Mark a destination like the Nurse as private, and other students see only “Out”. Each class's Settings tab can also hide where students went, who's in line, or names on students' devices.",
        link: { label: 'Destinations', href: '/destinations' },
      },
      {
        title: 'Fix mistakes in History',
        text: 'Cancel an accidental pass and give it back, or add a note to any pass.',
        link: { label: 'History', href: '/history' },
      },
    ],
    also:
      "Kiosk names are in A to Z order and the kiosk stays awake. A sound plays when it's a student's turn, and you can turn on a chime for overdue passes in Pass Options. Drag destinations to reorder them. Each class now has Students, PINs and Settings tabs, and History and Settings are under More in the sidebar. We now say “take a pass” and “come back”.",
    action: { label: 'Go to Home', href: '/' },
    note: "Something not working the way you expect since this update? Email us at support@teacher.dev. We read every message, and we're here to make your days easier.",
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
