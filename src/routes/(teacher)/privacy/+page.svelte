<script lang="ts">
  import SettingsTabs from '#lib/SettingsTabs.svelte';
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
  <SettingsTabs />
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
      classes. Screens students can see, the kiosk and their own devices, only ever show a first name and the first few
      letters of the last name. Your backup file holds full names, so keep it somewhere only you can open.
    </p>
    <p>
      If you take attendance, Happy Hallways also keeps when each student arrived, and whether they were tardy or
      absent, on your computer only. It's your own log for your class, not your school's official attendance, which stays
      in your school's own system.
    </p>
    <p>
      If you turn on PINs for a class, each student also has a short PIN to type at the kiosk, or to set up their own
      device for passes. Happy Hallways makes these up, or you can choose them. Never use real student ID
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
    <h2>Students' own devices</h2>
    <p>
      If you turn on student devices, students who have the class code can see, on their own device, whether passes are open and how
      many students are out or waiting at each place. Never who: students' names stay on the kiosk, in your room. Their
      device connects straight to your computer, the same way the kiosk does.
    </p>
    <p>
      A student can set up their own device by typing their first name and PIN once. Their device then keeps
      only a random code that means nothing anywhere else, shows them only their own status, and can sign them out and
      back in, line up or ask you, during their class. Your computer checks everything it does. You can stop any device
      acting as a student at any time.
    </p>
    <p>
      Each class has its own code, shown on your kiosk and your screen, and it works only while that class is on.
      You can turn student devices off at any time, or give a class a new code straight away.
      A device that hasn't been set up with a first name and PIN is never sent anyone's name, only how many are out and
      waiting. A set-up device also gets who's out and who's in line, unless you turn that off for the class. No device
      is ever sent how long anyone else has been out, any PIN, or anything you've set for a
      student.
    </p>
  </section>

  <section class="card" aria-labelledby="where-title">
    <h2 id="where-title">Where your students' information is</h2>
    <p>
      <strong>Only on your computer.</strong> Your classes, students, passes and history live in your browser on your own
      computer. None of it is ever sent to a server we run, and we can't see it.
    </p>
    <p>
      Students' devices talk only to your computer. A student's device keeps one random code that means nothing anywhere
      else. Our matchmaking server sees only random device addresses, and the relay carries encrypted data it can't read.
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

  .card a {
    font-weight: 700;
    text-underline-offset: 4px;
  }
</style>
