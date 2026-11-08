<script lang="ts">
  import GuideHead from '#lib/GuideHead.svelte';
  import GuideStep from '#lib/GuideStep.svelte';
  import SectionLink from '#lib/SectionLink.svelte';
  import { guideNamed } from '#lib/guides.ts';

  const guide = guideNamed('separate-bathroom-lines');
  const pictures = `/guides/${guide.slug}`;

  // The screenshots come from scripts/guides/separate-bathroom-lines.spec.ts.
  const steps = [
    {
      name: 'Add a destination for the first bathroom',
      text: 'In Happy Hallways, click Destinations in the sidebar, then click Add destination.',
      tip: 'New accounts start with Bathroom 1 and Bathroom 2, already one at a time with a line each: just click each card and rename it. Already have a bathroom destination? Use it as one of the two, as in the next step.',
      image: `${pictures}/1-add-destination.png`,
      alt: 'The Destinations page, with the Add destination button circled',
    },
    {
      name: 'Name it and give it a limit',
      text: 'Give the bathroom a name students will recognize, like Left Hall Bathroom. Under Students here at once, choose 1 at a time (or however many students it holds). Pick a color and an icon, then click Save.',
      image: `${pictures}/2-first-bathroom.png`,
      alt: 'The New destination window, with the Name set to Left Hall Bathroom and Students here at once set to 1 at a time, both circled',
    },
    {
      name: 'Add the second bathroom the same way',
      text: 'Click Add destination again and set up the other bathroom, like Right Hall Bathroom, with its own limit. A different color helps students tell the two apart at a glance.',
      image: `${pictures}/3-second-bathroom.png`,
      alt: 'The New destination window, with the Name set to Right Hall Bathroom and Students here at once set to 1 at a time, both circled',
    },
    {
      name: 'Check that both bathrooms have a limit',
      text: 'Both cards should show a limit, like “1 at a time”. A destination with no limit never fills up, so it never has a line.',
      image: `${pictures}/4-both-bathrooms.png`,
      alt: 'The Destinations page showing Left Hall Bathroom and Right Hall Bathroom, each 1 at a time, both circled',
    },
    {
      name: 'Turn on lines',
      text: 'Click Pass Options in the sidebar and turn on Let students line up. Now, when a bathroom is full, students can join that bathroom’s line instead of being turned away.',
      image: `${pictures}/5-turn-on-lines.png`,
      alt: 'The Pass Options page, with the Let students line up switch turned on and circled',
    },
  ];
</script>

<GuideHead {guide} image={steps[3].image} {steps} />

<article class="guide">
  <header class="guide-header">
    <p class="eyebrow"><a href="/guides">Guides</a></p>
    <h1>{guide.title}</h1>
    <p class="lede">
      In Happy Hallways, every destination with a limit has its own line. Make each bathroom its own destination, and a
      student waiting for one never holds up a student headed to another.
    </p>
    <p class="lede">
      Name them however your school divides its bathrooms: Left Hall and Right Hall, First Floor Girls’, First Floor
      Private, and so on. You can set up as many as you need.
    </p>
    <p class="muted small">Takes about 2 minutes · Updated {new Date(guide.updated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</p>
  </header>

  {#each steps as step, index (step.name)}
    <GuideStep number={index + 1} title={step.name} image={step.image} alt={step.alt} tip={step.tip}>
      <p>{step.text}</p>
    </GuideStep>
  {/each}

  <section class="guide-section" id="what-students-see">
    <h2>What students see at the kiosk<SectionLink id="what-students-see" /></h2>
    <p>
      Each bathroom shows up as its own choice. When one is full, the kiosk marks it <strong>Full</strong>, and a
      student who taps it can join its line. The other bathroom stays open.
    </p>
    <figure>
      <img
        src="{pictures}/6-kiosk-one-full.png"
        alt="The kiosk asking where Mia is going: Left Hall Bathroom is marked Full and Right Hall Bathroom is open, both circled"
        width="1280"
        height="800"
        loading="lazy"
      />
    </figure>
    <p>
      Here, Ava is at the Left Hall Bathroom and Mia is first in its line, while Liam went straight to the Right Hall
      Bathroom without waiting. When Ava comes back, Mia’s name turns green: it’s Mia’s turn.
    </p>
    <figure>
      <img
        src="{pictures}/7-kiosk-line.png"
        alt="The kiosk showing the Left Hall Bathroom line with Mia first, while Ava is out at the Left Hall Bathroom and Liam at the Right Hall Bathroom"
        width="1280"
        height="800"
        loading="lazy"
      />
    </figure>
  </section>

  <section class="guide-section" id="if-it-isnt-working">
    <h2>If it isn’t working<SectionLink id="if-it-isnt-working" /></h2>
    <dl>
      <dt>There’s no “Students here at once” when I edit a destination.</dt>
      <dd>
        You have one limit for the whole class. On the Pass Options page, under <strong>How limits work</strong>, choose
        <strong>Each destination has its own limit</strong>. The limits you set before come back as they were.
      </dd>
      <dt>Students waiting for one bathroom hold up the other.</dt>
      <dd>
        Check that Pass Options says <strong>Each destination has its own limit</strong>: with one limit for the whole
        class, everyone shares one line. If it does, the kiosk may still be running an older version of Happy
        Hallways. Reload the kiosk page (or close it and open it again). It also updates itself after a minute with
        nobody touching it.
      </dd>
      <dt>Students are told to wait, but can’t join a line.</dt>
      <dd>Lines are off. Turn on <strong>Let students line up</strong> on the Pass Options page (step 5).</dd>
      <dt>Nobody ever has to wait for a bathroom.</dt>
      <dd>
        That bathroom has no limit. Open it on the Destinations page and choose a number under
        <strong>Students here at once</strong>.
      </dd>
      <dt>A student went to a full bathroom without waiting in line.</dt>
      <dd>
        They may be marked <strong>Can always go</strong> on the Students page, for a medical need or an IEP or 504
        plan. Their trip doesn’t take anyone’s spot, and it’s marked in History.
      </dd>
      <dt>Can two students use the same bathroom at once?</dt>
      <dd>Yes. Choose <strong>2 at a time</strong> (or more) under Students here at once.</dd>
    </dl>
    <p>
      The same steps work for any other destinations you want to keep apart, such as an all-gender restroom or the water
      fountain.
    </p>
  </section>
</article>

