## Why

The repo currently holds only an Inngest + Express "hello world" placeholder. We
have ~4 hours to stand up the *plumbing half* of MEATBAGS (Scott's split): the
durable Inngest agent loop, the human-backed tool harness, the Discord bridge,
and Horizon Postgres persistence. We need a module skeleton that makes the
Must-have demo path — model → tool → Discord post → `waitForEvent` → tool result →
next tool — real end-to-end, while stubbing Should/Could tiers so they're easy to
fill in on the clock. This scaffold is also where the `tasks` table contract with
the TUI half gets pinned down.

## What Changes

- Replace the `hello-world` placeholder with a durable **`agent-loop`** Inngest
  function that drives an Azure Foundry model through a tool-calling loop and
  emails the user when everything is handled.
- Add a **human-tool harness**: ordinary-looking tools (`read_file`,
  `write_code`, `run_tests`, `deploy`) whose implementations assign a human, post
  the task to Discord, and block on `waitForEvent` matched by thread id. The
  model must not be able to tell these from real tools (**the load-bearing joke**).
- Fold in the **escalation ladder** (levels 1–4): timeout → nag → re-wait, with
  ElevenLabs voicemail and Resend email `step.run` wrappers.
- Add a **discord.js gateway bot** that creates a thread per task, posts asks, and
  on a human reply emits `human/task.completed` keyed by `thread.id`; it also
  upserts anyone who speaks in `#general` into the roster.
- Add **Horizon Postgres persistence**: a `pg` client plus the `agents`, `tasks`,
  and (stretch) `reviews` schema and a seed script — the seam with Brian's TUI.
- Establish the directory layout (`src/inngest`, `src/tools`, `src/discord`,
  `src/db`, `src/services`, `src/foundry`) and the `.env` contract.

Scope discipline: the scaffold makes the **Must** tier functional and leaves
**Should** (Resend tiers 3–4, end email) and **Could** (The Bobs, Milton,
Realtime, pgvector) as wired stubs.

## Capabilities

### New Capabilities
- `agent-loop`: the durable Inngest function that runs the model's tool-calling
  loop, dispatches tool calls, feeds results back until done, then writes stats
  and emails the user.
- `human-tools`: the tool harness — mundane tool schemas whose impls assign a
  human, post to Discord, block on `waitForEvent` (matched by thread id), return
  the human's reply verbatim as the tool result, and escalate on timeout.
- `discord-bridge`: the discord.js gateway bot — thread-per-task creation, posting
  asks, translating human thread replies into `human/task.completed` events, and
  upserting speakers into the roster.
- `persistence`: Horizon Postgres access — the `pg` client, the `agents` /
  `tasks` / `reviews` schema, and the seed script that is the contract with the
  TUI half.

### Modified Capabilities
<!-- None: no existing specs in this repo. -->

## Impact

- **Code**: replaces `index.ts` wiring and the `src/inngest/` placeholder; adds
  `src/tools`, `src/discord`, `src/db`, `src/services`, `src/foundry`.
- **Dependencies (new)**: `discord.js`, `pg`, `resend`, `@elevenlabs/elevenlabs-js`,
  and the Azure AI Foundry SDK. (`inngest`, `express` already present.)
- **Services / config**: `.env` grows to cover Discord bot token + intents,
  Horizon connection string, Foundry endpoint/key/deployment, ElevenLabs
  `voice_id`, and Resend API key.
- **Runtime**: still local-only — Express serve endpoint + `inngest-cli dev` on
  :8288 + the gateway bot in one Node/TS process. No public URL.
- **Contract**: the `tasks` table shape is shared with Brian's TUI; changes must
  be coordinated.
