<script lang="ts">
  import { account, resetPassAllowance, setAttendance, setOverdueChime, setPassAllowance, setPassOptions } from '#lib/account.svelte.ts';
  import { defaultAttendance } from '#lib/attendance.ts';
  import { shortDate } from '#lib/passes.ts';
  import RequestCard from '#lib/RequestCard.svelte';

  const allowance = $derived(account.passAllowance);
  const classLimitChoices = Array.from({ length: 10 }, (_, index) => index + 1);
  const attendance = $derived(account.attendanceRules);

  /** A minutes box: a whole number, at least `least`; anything else puts the saved value back. */
  function setMinutes(key: 'graceMinutes' | 'absentAfterMinutes', event: Event) {
    const rules = account.attendanceRules;
    if (!rules) return;
    const input = event.currentTarget as HTMLInputElement;
    const value = Number(input.value);
    const least = key === 'absentAfterMinutes' ? 1 : 0;
    if (input.value === '' || !Number.isFinite(value) || value < least) {
      input.value = String(rules[key]);
      return;
    }
    setAttendance({ ...rules, [key]: Math.round(value) });
  }
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Pass Options</p>
      <h1>How passes work</h1>
      <p class="muted">These apply to every class. Changes reach the kiosk straight away.</p>
    </div>
  </header>

  <section class="card">
    <fieldset class="limit-modes">
      <legend>
        <h2>How limits work</h2>
        <p class="muted small">How many students can be out of the room at the same time.</p>
      </legend>
      <label class="check">
        <input
          type="radio"
          name="limit-mode"
          checked={account.limitMode === 'destination'}
          onchange={() => setPassOptions({ limitMode: 'destination' })}
        />
        <span>
          Each destination has its own limit
          <span class="muted small">
            Like 1 at a time for the Restroom and 3 for the Water Fountain, set on the
            <a href="/destinations">Destinations</a> page. Each limited destination has its own line. For one boy
            and one girl out at once, <a href="/guides/separate-bathroom-lines">give each bathroom its own line</a>.
          </span>
        </span>
      </label>
      <label class="check">
        <input
          type="radio"
          name="limit-mode"
          checked={account.limitMode === 'class'}
          onchange={() => setPassOptions({ limitMode: 'class' })}
        />
        <span>
          One limit for the whole class
          <span class="muted small">
            Only so many students out at once, wherever they're going. Students still choose a destination, and it's
            recorded. On the <a href="/destinations">Destinations</a> page, untick “Counts toward the class limit” for
            places like the Nurse, so students going there never wait.
          </span>
        </span>
      </label>
    </fieldset>

    {#if account.limitMode === 'class'}
      <div class="option-row">
        <div>
          <h2>Students out at once</h2>
          <p class="muted small">Your limits on each destination are kept, for if you switch back.</p>
        </div>
        <select
          aria-label="Students out at once"
          value={account.classLimit}
          onchange={(event) => setPassOptions({ classLimit: Number(event.currentTarget.value) })}
          style="width:auto"
        >
          {#each classLimitChoices as option (option)}<option value={option}>{option} at a time</option>{/each}
        </select>
      </div>
    {/if}
  </section>

  <section class="card">
    <div class="option-row">
      <div>
        <h2>Let students line up</h2>
        <p class="muted small">
          {#if account.limitMode === 'class'}
            When the class limit is reached, students can join the line at the kiosk instead of being turned away. The
            whole class shares one line, wherever each student is going. The next free spot is held for the first in
            line, and their name turns green when it's their turn.
          {:else}
            When a destination is full, students can join its line at the kiosk instead of being turned away. Each
            destination has its own line. The next free spot is held for the first in line, and their name turns green
            when it's their turn. Set how many students can be at each destination on the
            <a href="/destinations">Destinations</a> page; one with no limit never has a line.
          {/if}
        </p>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          aria-label="Let students line up"
          checked={account.lineEnabled}
          onchange={(event) => setPassOptions({ lineEnabled: event.currentTarget.checked })}
        />
        <span aria-hidden="true"></span>
      </label>
    </div>
  </section>

  <section class="card">
    <div class="option-row">
      <div>
        <h2>Pass Allowance</h2>
        <p class="muted small">
          How many passes each student gets in a stretch of time, counted across all your classes. Students see how
          many they have left when they tap their name. Untick a destination's "Counts toward the Pass Allowance" box
          for trips like the Nurse. On the <a href="/roster">Roster</a>, edit a student to tick “Can always go” for a
          medical need or an IEP or 504 plan (no allowance, limit, line or no-pass time ever holds them back), or exempt
          them from the Pass Allowance only.
        </p>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          aria-label="Pass Allowance"
          checked={allowance.enabled}
          onchange={(event) => setPassAllowance({ enabled: event.currentTarget.checked })}
        />
        <span aria-hidden="true"></span>
      </label>
    </div>

    {#if allowance.enabled}
      <div class="option-row">
        <div>
          <h2>Passes per student</h2>
        </div>
        <div class="inline">
          <select
            aria-label="Passes per student"
            value={allowance.passes}
            onchange={(event) => setPassAllowance({ passes: Number(event.currentTarget.value) })}
            style="width:80px"
          >
            {#each Array.from({ length: 20 }, (_, index) => index + 1) as option (option)}
              <option value={option}>{option}</option>
            {/each}
          </select>
          <select
            aria-label="Counted"
            value={allowance.per}
            onchange={(event) => setPassAllowance({ per: event.currentTarget.value as 'day' | 'week' | 'reset' })}
          >
            <option value="day">per day</option>
            <option value="week">per week</option>
            <option value="reset">until I reset it</option>
          </select>
        </div>
      </div>

      {#if allowance.per === 'reset'}
        <div class="option-row">
          <div>
            <h2>Counting since {shortDate(allowance.since)}</h2>
            <p class="muted small">Reset at the start of each quarter or term to give every student a fresh count.</p>
          </div>
          <button class="btn" onclick={resetPassAllowance}>Reset</button>
        </div>
      {/if}

      <div class="option-row">
        <div>
          <h2>When a student has used them all</h2>
          <p class="muted small">
            If they're stopped, they can ask you from the kiosk and you approve it on Home, or you can let them go with
            your PIN at the kiosk. Extra Passes are marked so you can see them later in History.
          </p>
        </div>
        <select
          aria-label="When a student has used them all"
          value={allowance.whenUsedUp}
          onchange={(event) => setPassAllowance({ whenUsedUp: event.currentTarget.value as 'stop' | 'warn' })}
          style="width:auto"
        >
          <option value="stop">Stop them at the kiosk</option>
          <option value="warn">Warn them, but let them go</option>
        </select>
      </div>
    {/if}
  </section>

  <section class="card" aria-labelledby="attendance-title">
    <div class="option-row">
      <div>
        <h2 id="attendance-title">Attendance</h2>
        <p class="muted small">
          Students tap their name at the kiosk when they arrive. Arriving after the period starts on your schedule is
          tardy; not arriving at all is absent, and absent students are hidden from the kiosk. This is your own log, not
          your school's official attendance.
        </p>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          aria-label="Take attendance"
          checked={!!attendance}
          onchange={(event) => setAttendance(event.currentTarget.checked ? { ...defaultAttendance } : null)}
        />
        <span aria-hidden="true"></span>
      </label>
    </div>
    {#if attendance}
      <div class="option-row">
        <label class="field">
          Minutes after the period starts before an arrival is tardy
          <input type="number" min="0" style="max-width:120px" value={attendance.graceMinutes} onchange={(event) => setMinutes('graceMinutes', event)} />
        </label>
        <label class="field">
          Minutes after class starts before a student who hasn't arrived is absent
          <input
            type="number"
            min="1"
            style="max-width:120px"
            value={attendance.absentAfterMinutes}
            onchange={(event) => setMinutes('absentAfterMinutes', event)}
          />
        </label>
      </div>
    {/if}
  </section>

  <section class="card">
    <div class="option-row">
      <div>
        <h2>Chime when a student is overdue</h2>
        <p class="muted small">A soft chime on this computer when a pass runs over its expected time. The kiosk never makes it.</p>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          aria-label="Chime when a student is overdue"
          checked={!!account.overdueChime}
          onchange={(event) => setOverdueChime(event.currentTarget.checked)}
        />
        <span aria-hidden="true"></span>
      </label>
    </div>
  </section>

  <RequestCard
    title="Need a setting we didn't think of?"
    text="Email us, and we'll add it."
    subject="Happy Hallways: a pass option idea"
  />
</div>

<style>
  .limit-modes {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .limit-modes legend {
    margin-bottom: 10px;
    padding: 0;
  }

  .limit-modes .check {
    font-size: 14px;
  }

  .limit-modes .check .muted {
    max-width: 60ch;
    margin-top: 2px;
  }

  .limit-modes + .option-row {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .option-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }

  .option-row + .option-row {
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .inline {
    display: flex;
    gap: 8px;
  }

  .option-row p {
    max-width: 60ch;
    margin-top: 3px;
  }

</style>
