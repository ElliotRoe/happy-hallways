<script lang="ts">
  import { onMount } from 'svelte';
  import { account } from '#lib/account.svelte.ts';
  import { siteUrl } from '#lib/guides.ts';
  import Icon from '#lib/Icon.svelte';
  import { onboarding } from '#lib/onboarding.svelte.ts';
  import SiteFooter from '#lib/SiteFooter.svelte';
  import StepArt from '#lib/welcome/StepArt.svelte';
  import { keepOpen, steps } from '#lib/welcome/steps.ts';
  import WelcomeHeader from '#lib/welcome/WelcomeHeader.svelte';

  /**
   * Someone with work here is offered the way back to it. This page is built
   * in advance for search engines, so it waits until it is running in this
   * browser before looking.
   */
  let running = $state(false);
  onMount(() => (running = true));
  const returning = $derived(running && (onboarding.welcomed || account.classes.length > 0));

  const title = 'Happy Hallways · A free digital hall pass for classrooms';
  const description =
    'A free digital hall pass for teachers. Students take a pass at a kiosk by the door, and you see who’s out and how much class each student misses.';
  const url = `${siteUrl}/welcome`;
  const image = `${siteUrl}/og-image.png`;

  // What search engines read about the app. "<" is escaped so the text can't end the script tag early.
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Happy Hallways',
    url,
    description,
    image,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern web browser',
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
    audience: { '@type': 'EducationalAudience', educationalRole: 'teacher' },
  }).replaceAll('<', '\\u003c');
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={url} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Happy Hallways" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={url} />
  <meta property="og:image" content={image} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  {@html `<script type="application/ld+json">${structuredData}</script>`}
</svelte:head>

<div class="landing">
  <WelcomeHeader>
    <a href="#how-it-works">How it works</a>
    <a href="/guides">Guides</a>
    <a href="/about">About</a>
    {#if returning}<a href="/">Open the app</a>{/if}
    <a class="cta small" href="/welcome/tour">Get started <Icon name="arrow-right" size={15} /></a>
  </WelcomeHeader>

  <main>
    <section class="hero">
      <div class="copy">
        <p class="welcome-eyebrow">The hall pass, without the paper</p>
        <h1>Know who’s out of your room, at a glance.</h1>
        <p class="lede">
          Students sign themselves out and back in at a kiosk by the door. You see who’s out, where they went, and how
          much class each student misses, without stopping your lesson.
        </p>
        <a class="cta" href="/welcome/tour">Get started <Icon name="arrow-right" size={18} /></a>
        <p class="fineprint">
          <strong>Free forever.</strong> Runs in your browser. Nothing to install, no account to make.
        </p>
      </div>
      <StepArt step="kiosk" />
    </section>

    <section class="band" id="how-it-works" aria-labelledby="how-heading">
      <div class="section">
        <p class="welcome-eyebrow">Ready before the bell</p>
        <h2 id="how-heading">Three steps and you’re set.</h2>
        <ol class="steps">
          {#each steps as step, i (step.key)}
            <li>
              <span class="mark"><span class="num">{i + 1}</span><Icon name={step.icon} size={20} /></span>
              <h3>{step.title}</h3>
              <p>{step.short}</p>
            </li>
          {/each}
        </ol>
        <div class="keep-open">
          <span class="tile"><Icon name="laptop" size={22} /><Icon name="kiosk" size={22} /></span>
          <div>
            <h3>{keepOpen.title}</h3>
            <p>{keepOpen.text}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="local-heading">
      <div class="local">
        <span class="tile"><Icon name="shield-check" size={28} /></span>
        <div>
          <p class="welcome-eyebrow">Private by default</p>
          <h2 id="local-heading">Everything stays in your classroom.</h2>
          <p>
            Your classes and passes are saved in your own browser, never uploaded anywhere. There’s no account, no
            tracking and no ads, and for each student we keep only a first name and a few letters of the last.
          </p>
        </div>
        <a class="cta secondary" href="/welcome/tour">Get started <Icon name="arrow-right" size={18} /></a>
      </div>
    </section>
  </main>

  <SiteFooter />
</div>

<style>
  .landing {
    min-height: 100vh;
    background:
      radial-gradient(circle at 88% 6%, rgb(251 191 36 / 18%), transparent 26rem),
      linear-gradient(180deg, #fffdf8 0%, var(--bg) 70%);
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: clamp(32px, 6vw, 72px);
    width: min(1120px, calc(100% - 32px));
    margin: 0 auto;
    padding: 40px 0 72px;
  }

  .hero :global(.art) {
    justify-self: end;
  }

  .copy {
    max-width: 540px;
  }

  h1 {
    margin: 0 0 20px;
    font-size: clamp(38px, 5.2vw, 62px);
    line-height: 1.02;
    letter-spacing: -0.04em;
  }

  .lede {
    max-width: 510px;
    margin: 0 0 30px;
    color: var(--muted);
    font-size: clamp(17px, 1.7vw, 20px);
    line-height: 1.55;
  }

  .fineprint {
    margin-top: 14px;
    color: var(--faint);
    font-size: 13.5px;
  }

  .fineprint strong {
    color: var(--accent);
    font-weight: 800;
  }

  .band {
    background: var(--surface);
    border-block: 1px solid var(--border);
  }

  .section {
    width: min(1120px, calc(100% - 32px));
    margin: 0 auto;
    padding: 68px 0;
  }

  .section h2 {
    margin-bottom: 30px;
    font-size: clamp(28px, 3.2vw, 38px);
    letter-spacing: -0.03em;
  }

  .steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .steps li,
  .keep-open {
    padding: 24px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: #fff;
  }

  .mark {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    color: var(--accent);
  }

  .num {
    display: inline-grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--accent-wash);
    font-weight: 800;
  }

  .steps h3,
  .keep-open h3 {
    margin-bottom: 8px;
    font-size: 17px;
  }

  .steps p,
  .keep-open p {
    color: var(--muted);
    line-height: 1.6;
  }

  .keep-open {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-top: 18px;
    border-color: #ecd3ac;
    background: #fff8ea;
  }

  .tile {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 58px;
    height: 58px;
    padding: 0 12px;
    border-radius: 16px;
    background: #fff;
    color: var(--accent);
  }

  .keep-open .tile {
    color: #a8620f;
  }

  .local {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 24px;
    padding: 34px 38px;
    border: 1px solid #c7dccd;
    border-radius: 24px;
    background: linear-gradient(135deg, var(--accent-wash), #fbfaf2);
  }

  .local h2 {
    margin-bottom: 8px;
  }

  .local p:last-child {
    max-width: 640px;
    color: var(--muted);
    line-height: 1.6;
  }

  @media (max-width: 860px) {
    .hero {
      grid-template-columns: 1fr;
      padding-top: 16px;
    }

    .hero :global(.art) {
      justify-self: center;
    }

    .steps {
      grid-template-columns: 1fr;
    }

    .local {
      grid-template-columns: 1fr;
      padding: 28px 24px;
    }

    .keep-open {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
