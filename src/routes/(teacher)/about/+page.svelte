<script lang="ts">
  import SettingsTabs from '#lib/SettingsTabs.svelte';
  import { siteUrl } from '#lib/guides.ts';
  import { supportEmail, supportMailto } from '#lib/support.ts';

  const title = 'About Happy Hallways · A free hall pass from teacher.dev';
  const description =
    'Happy Hallways is a free digital hall pass from teacher.dev, a community building free classroom tools. No paywalls, no ads, no tracking.';
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href="{siteUrl}/about" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content="{siteUrl}/about" />
  <meta property="og:image" content="{siteUrl}/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="page site-prose">
  <SettingsTabs />
  <header>
    <p class="eyebrow">About</p>
    <h1>About Happy Hallways</h1>
    <p class="muted">
      A free hall pass for teachers. Students sign themselves out at a kiosk by the door, and you see who's out and
      how much class each student misses.
    </p>
  </header>

  <section class="card">
    <div class="card-heading">
      <img src="/edtechathon-logo.svg" alt="" width="40" height="40" />
      <h2>From teacher.dev</h2>
    </div>
    <p>
      Happy Hallways is a project from
      <a href="https://teacher.dev" target="_blank" rel="noopener noreferrer">teacher.dev</a>, a community of builders
      making free tools for classrooms. It was shaped by the teachers who asked us for it. Learn more about who we are
      and what else we're building at
      <a href="https://teacher.dev" target="_blank" rel="noopener noreferrer">teacher.dev</a>.
    </p>
    <figure>
      <img src="/edtechathon-2026.jpg" alt="Participants of the 2026 EdTech-a-thon" />
      <figcaption>EdTech-a-thon 2026</figcaption>
    </figure>
  </section>

  <section class="card">
    <h2>Our promise</h2>
    <ul>
      <li><strong>Zero paywalls.</strong></li>
      <li><strong>Zero ads.</strong></li>
      <li><strong>Zero tracking of personal data.</strong></li>
    </ul>
  </section>

  <section class="card">
    <h2>Feedback &amp; ideas</h2>
    <p>
      We'd love to hear from you. Tell us what's working, what's not, or pitch us an idea for a tool you wish existed.
      We're here to help.
    </p>
    <div><a class="btn btn-primary" href={supportMailto('Happy Hallways feedback')}>Email {supportEmail}</a></div>
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

  .card p,
  .card li {
    font-size: 15px;
    line-height: 1.6;
  }

  .card a:not(.btn) {
    font-weight: 700;
    text-underline-offset: 4px;
  }

  .card-heading {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  ul {
    margin: 0;
    padding-left: 20px;
  }

  figure {
    margin: 0;
  }

  figure img {
    display: block;
    width: 100%;
    border-radius: var(--radius);
  }

  figcaption {
    margin-top: 6px;
    color: var(--muted);
    font-size: 13px;
    text-align: center;
  }
</style>
