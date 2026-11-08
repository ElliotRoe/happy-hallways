<script lang="ts">
  import { siteUrl } from '#lib/guides.ts';
  import { supportEmail, supportMailto } from '#lib/support.ts';

  const title = 'Privacy · Happy Hallways digital hall pass';
  const description =
    "Happy Hallways keeps your classes and passes in your own browser. No accounts, no cookies, no ads, and no student data on our servers, ever.";
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href="{siteUrl}/privacy" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content="{siteUrl}/privacy" />
  <meta property="og:image" content="{siteUrl}/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="page site-prose">
  <header>
    <p class="eyebrow">Privacy</p>
    <h1>Privacy</h1>
    <p class="muted">What we collect, what we don't, and why.</p>
  </header>

  <section class="card">
    <h2>Your class stays on your computer</h2>
    <p>
      Happy Hallways has no accounts and no sign-in. Your classes, students and passes are stored by your browser on your own
      computer and are never uploaded to us or to anyone else. A backup is a file you download yourself.
    </p>
    <p>
      Your students' full names are kept on your computer, so you can tell them apart and see the same student across your
      classes. Screens students can see, the kiosk and the student link, only ever show a first name and the first few
      letters of the last name. Your backup file holds full names, so keep it somewhere only you can open.
    </p>
    <p>
      If you turn on PINs for a class, each student also has a short PIN to type at the kiosk, or to set up their own
      device on the student link. Happy Hallways makes these up, or you can choose them. Never use real student ID
      numbers.
    </p>
  </section>

  <section class="card">
    <h2>The kiosk by your door</h2>
    <p>
      A paired kiosk talks directly to your computer over an encrypted connection. To find each other, the two devices
      are introduced by a small matchmaking server run by teacher.dev. It sees only a random address for each device,
      stores nothing, and never receives your class or pass data.
    </p>
    <p>
      Some school networks block devices from talking directly. Then the encrypted data is passed along by a relay run
      by <a href="https://developers.cloudflare.com/realtime/turn/" target="_blank" rel="noopener noreferrer">Cloudflare</a>,
      which can't read it.
      Google's public connection service helps each device learn its own network address; it sees no class data.
    </p>
    <p>
      Your computer decides who may leave; the kiosk asks it every time. The kiosk keeps a copy of your students' short
      names (and their PINs, if you use them), and, if it loses touch with your computer, the times students signed back
      in until it can hand them over. It never shows anyone's PIN on screen.
    </p>
  </section>

  <section class="card">
    <h2>The student link</h2>
    <p>
      If you open the student link, students who have it can see, on their own device, what the kiosk shows the whole
      room: who is out and where they went, who is waiting in line, and whether passes are open, using the same short
      names. Their device connects straight to your computer, the same way the kiosk does.
    </p>
    <p>
      A student can set up their own device by choosing their name and typing their PIN once. Their device then keeps
      only a random code that means nothing anywhere else, and can sign them out and back in, line up or ask you, during
      their class. Your computer checks everything it does. You can stop any device acting as a student at any time.
    </p>
    <p>
      Anyone with the link can see it while it's open, including the short names of the class, so share it only with your
      class. You can close it at any time, or get a new link so the old one stops working. It never shows how long anyone
      else has been out, any PIN, any full name, or anything you've set for a student.
    </p>
  </section>

  <!-- Draft (docs/adr/0016): must be reviewed by someone qualified in student-privacy law before the
       Student link's device setup ships to teachers. Keep this note until then. -->
  <section class="card" aria-labelledby="ferpa-title">
    <h2 id="ferpa-title">FERPA and COPPA</h2>
    <p class="draft-note">Draft: this section is waiting for review by a student-privacy specialist.</p>
    <p>
      <strong>No student data on our servers, ever.</strong> Every record Happy Hallways keeps lives only in your browser,
      on a computer your school controls. We never receive, store or have access to your students' information, so we
      don't hold education records under FERPA. Your school decides whether to use Happy Hallways under its own FERPA
      policies, as it would for any tool its teachers run.
    </p>
    <p>
      We collect no personal information from children. Students' devices talk only to their teacher's computer; nothing
      a student does reaches a server we run, so COPPA's rules on collecting children's information online don't come into
      play for us. Our matchmaking server sees only random device addresses, and the relay carries encrypted data it
      can't read.
    </p>
  </section>

  <section class="card">
    <h2>No tracking</h2>
    <p>
      Happy Hallways doesn't use cookies or ads, and we don't share, sell or otherwise transfer any visitor data. To see
      how many people visit, we use
      <a href="https://www.cloudflare.com/web-analytics/" target="_blank" rel="noopener noreferrer"
        >Cloudflare Web Analytics</a
      >, which counts page views without cookies or anything that identifies you, and never sees your class or pass data.
      The fonts load from Google Fonts, which sees a request from your browser like any website would.
    </p>
    <p>
      Questions or concerns? Email <a href={supportMailto('Happy Hallways privacy')}>{supportEmail}</a>.
    </p>
  </section>
</div>

<style>
  .site-prose {
    max-width: 760px;
  }

  .site-prose header {
    display: grid;
    gap: 6px;
  }

  .card p {
    font-size: 15px;
    line-height: 1.6;
  }

  .draft-note {
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--warn-wash);
    color: var(--warn);
    font-weight: 700;
  }

  .card a {
    font-weight: 700;
    text-underline-offset: 4px;
  }
</style>
