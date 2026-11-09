<script lang="ts">
  import GuideHead from '#lib/GuideHead.svelte';
  import GuideStep from '#lib/GuideStep.svelte';
  import SectionLink from '#lib/SectionLink.svelte';
  import { guideNamed } from '#lib/guides.ts';

  const guide = guideNamed('schedule-no-pass-times');
  const pictures = `/guides/${guide.slug}`;

  // The screenshots come from scripts/guides/schedule-no-pass-times.spec.ts.
  const steps = [
    {
      name: 'Start a new schedule',
      text: 'In Happy Hallways, click Schedule in the sidebar, then click to create a schedule (or New schedule, if you already have one).',
      tip: 'Make your classes first (Classes, then New class), so you can put them in the schedule.',
      image: `${pictures}/1-new-schedule.png`,
      alt: 'The Schedule page with no schedules yet, and the box to create one circled',
    },
    {
      name: 'Name it',
      text: 'Give the schedule a name, like Regular Day.',
      tip: 'Rotating days, or an early-release day? Make a schedule for each one, and pick the right one when you come in. Duplicate copies a schedule so you only change what’s different.',
      image: `${pictures}/2-name-schedule.png`,
      alt: 'The new schedule, with its name, Regular Day, circled',
    },
    {
      name: 'Add a period for each class',
      text: 'Click Add a period. Choose the class, then when it starts and ends. Do this for each class you teach. You can also drag across the calendar to draw a period.',
      image: `${pictures}/3-add-periods.png`,
      alt: 'The list of periods: Period 1 from 8:00 to 8:50 AM and Period 2 from 8:55 to 9:45 AM, circled, with the Add a period button circled',
    },
    {
      name: 'Choose the no-pass minutes',
      text: 'Under each period, set how many minutes at its start and end nobody can leave. For example: no passes in the first 10 minutes and the last 5. The calendar shows those minutes striped.',
      image: `${pictures}/4-first-and-last-minutes.png`,
      alt: 'Each period set to no passes for the first 10 and last 5 minutes, circled, with striped bands at the start and end of each period on the calendar',
    },
    {
      name: 'Add a set time, if you need one (optional)',
      text: 'For a time nobody can leave whatever class is on, like an assembly or testing, click A set time under No-pass times and enter when it starts and ends.',
      image: `${pictures}/5-set-time.png`,
      alt: 'The No-pass times section, circled, with no passes from 9:15 to 9:30 AM',
    },
    {
      name: 'Use it on Home',
      text: 'Click the box at the top of the sidebar to go to Home, and pick your schedule from the menu at the right, under the date. From now on, the kiosk changes to each class as its period starts, and follows the no-pass times by itself.',
      tip: 'An early-release day? Pick that day’s schedule on Home in the morning, then switch back the next day.',
      image: `${pictures}/6-use-schedule.png`,
      alt: 'Home, with the status box at the top of the sidebar and the schedule menu, set to Regular Day, both circled',
    },
  ];
</script>

<GuideHead {guide} image={steps[3].image} {steps} />

<article class="guide">
  <header class="guide-header">
    <p class="eyebrow"><a href="/guides">Guides</a></p>
    <h1>{guide.title}</h1>
    <p class="lede">
      Enter your bell schedule once, and the kiosk does the rest: it switches to each class as its period starts, and
      stops students from leaving during the minutes you choose, like the first and last minutes of class.
    </p>
    <p class="muted small">Takes about 5 minutes · Updated {new Date(guide.updated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</p>
  </header>

  {#each steps as step, index (step.name)}
    <GuideStep number={index + 1} title={step.name} image={step.image} alt={step.alt} tip={step.tip}>
      <p>{step.text}</p>
    </GuideStep>
  {/each}

  <section class="guide-section" id="what-students-see">
    <h2>What students see at the kiosk<SectionLink id="what-students-see" /></h2>
    <p>
      During a no-pass time, the kiosk says <strong>No passes right now</strong> and when passes open. A student who
      taps their name anyway can join the line, and goes first when passes open. (Turn on
      <strong>Let students line up</strong> on the Pass Options page for this. Without it, they’re asked to wait.)
    </p>
    <figure>
      <img
        src="{pictures}/7-kiosk-no-passes.png"
        alt="The kiosk during a no-pass time: Passes open at 8:10 AM. Join the line to go as soon as they do. The Join the line button is circled."
        width="1280"
        height="800"
        loading="lazy"
      />
    </figure>
    <p>
      If a student really needs to go, they can tap <strong>Ask my teacher</strong>, and you approve or deny the request
      on Home. Or tap <strong>Teacher: let them go</strong> and enter your PIN right at the kiosk. Either way, their pass is marked
      so your records stay complete. (When the kiosk is this computer, or it’s offline, only the PIN works.)
    </p>
    <p>
      A student you’ve marked <strong>Can always go</strong> (for a medical need, or an IEP or 504 plan) is never held
      back by a no-pass time. They leave as usual, and their pass is marked in History.
    </p>
    <figure>
      <img
        src="{pictures}/8-kiosk-line.png"
        alt="The kiosk showing No passes right now, passes open at 8:10 AM, with Ava first in the Bathroom line"
        width="1280"
        height="800"
        loading="lazy"
      />
    </figure>
  </section>

  <section class="guide-section" id="if-it-isnt-working">
    <h2>If it isn’t working<SectionLink id="if-it-isnt-working" /></h2>
    <dl>
      <dt>The kiosk isn’t changing classes or following the no-pass times.</dt>
      <dd>
        The kiosk follows the schedule only while it’s in use. If someone switched classes by hand, it stopped
        following it, and the box at the top of the sidebar says <strong>Off schedule</strong>. Go to Home and click
        <strong>Back to Regular Day</strong> (or whatever your schedule is called).
      </dd>
      <dt>The kiosk says “No class right now.”</dt>
      <dd>That’s normal between periods. It shows which class is next and when it starts.</dd>
      <dt>Students are told to wait, but can’t join a line.</dt>
      <dd>Lines are off. Turn on <strong>Let students line up</strong> on the Pass Options page.</dd>
      <dt>I just need to stop passes for a few minutes, without a schedule.</dt>
      <dd>
        On Home, click <strong>No passes now</strong>. Click <strong>Open passes</strong> when you’re ready.
      </dd>
    </dl>
  </section>
</article>
