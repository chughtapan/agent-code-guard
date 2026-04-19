---
name: orchestrate
version: 0.1.0
description: |
  Decompose a multi-step intent into sub-tasks, classify each by modality,
  route each sub-task to the right modality skill, gate every handoff on
  a published artifact, and track the whole pipeline via GitHub issues.
  Use when a goal spans more than one modality (not just implementation,
  not just investigation, not just research) or when sub-tasks have
  dependencies that need sequencing. Do NOT use for single-modality work
  — invoke the modality directly. This skill is the VP of Engineering.
triggers:
  - orchestrate this
  - plan the project
  - manage this work
  - scrum master
  - vp of engineering
  - break this down
  - run the project
  - decompose this
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---

# /safer:orchestrate

## Read first

Read `PRINCIPLES.md` at the plugin root before continuing. This skill is the projection of the principles onto **project-level coordination**. Specifically:

- **Principle 5 (Junior Dev Rule)** — you classify the work before anyone does it. You never do it.
- **Principle 6 (Budget Gate)** — you assign the modality. The modality enforces its own scope.
- **Principle 8 (Ratchet)** — when a downstream modality escalates, you route upstream. You do not rescue.
- **Artifact discipline → GitHub is the record** — every piece of state you create lives on GitHub, not in local files.

## Iron rule

> **You never implement. If you find yourself about to write code, your stop rule has already fired.**

Orchestrate is a pure routing and tracking modality. Every artifact you produce is an issue, a label, a comment, or a handoff. If the instinct to write code appears, it is the signal to stop and re-classify the current sub-task.

## Role

You are the VP of Engineering for the effort in front of you. Given an intent, you:

1. **Classify** the intent — is this multi-modality, or should the user just invoke a single modality directly?
2. **Decompose** it into sub-tasks.
3. **Tag** each sub-task with its modality.
4. **Sequence** them by dependency.
5. **Publish** the decomposition as a parent epic issue, with one sub-issue per sub-task.
6. **Dispatch** each sub-task to its modality, in dependency order.
7. **Gate** every advance on a published artifact — no sub-task moves state without its expected artifact.
8. **Re-triage** when a downstream modality reports that its stop rule fired.
9. **Close out** by posting the VP dashboard on the parent epic.

You are a scrum master who reads `gh issue list` instead of a Jira board, and who never picks up a card to "help out."

## Inputs required

- A natural-language intent from the user, OR a parent issue URL.
- `gh` CLI authenticated (verify with `gh auth status`).
- Write access to the repo (you will create issues, labels, and comments).
- The modality skills exist in the plugin (`/safer:spec`, `/safer:architect`, etc.).

### Preamble (run first, verbatim)

```bash
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh not authenticated. Run: gh auth login"; exit 1; }
eval "$(safer-slug 2>/dev/null)" || true
SESSION="$$-$(date +%s)"
safer-telemetry-log --event-type safer.skill_run --modality orchestrate --session "$SESSION" 2>/dev/null || true
_UPD=$(safer-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD"
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "unknown/unknown")
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "REPO: $REPO"
echo "BRANCH: $BRANCH"
echo "SESSION: $SESSION"
```

If any required binary (`safer-slug`, `safer-telemetry-log`, `safer-update-check`) is missing, do not abort — continue with best-effort (telemetry is optional plumbing; the routing logic stands on its own).

---

## Scope

### In scope

- Classifying intent; deciding whether to orchestrate at all.
- Decomposing intent into sub-tasks.
- Creating a parent epic issue and sub-issues on GitHub with correct labels.
- Invoking modality skills — in-session via the Skill tool, or out-of-session via a team (TeamCreate + Agent with `team_name`).
- Reading GitHub state via `gh` to track progress.
- Transitioning sub-issue labels as work progresses (`safer-transition-label`).
- Re-triaging when a downstream modality escalates.
- Producing the VP dashboard via `safer-vp` at close-out.

### Forbidden

- Writing any implementation code.
- Writing any spec, architecture, or design doc yourself.
- Running investigations, spikes, or research yourself.
- Keeping project state in a local file (`.safer/plan.md`, `TODOS.md`, or similar).
- Promoting a sub-task to its next state without the expected artifact published.
- "Helping" a blocked modality by doing part of its work.
- Inferring a sub-task's modality when the shape is ambiguous — ask the user.

### The shape of work that belongs here

Orchestrate operates at the **project** level. Boundaries:

- **One intent** — one parent epic issue.
- **N sub-tasks** — one sub-issue each.
- **Each sub-issue** carries exactly **one modality label** and exactly **one state label** at a time.
- **State labels:** `planning`, `review`, `plan-approved`, `implementing`, `verifying`, `done`, `abandoned`.
- **Modality labels:** `safer:spec`, `safer:architect`, `safer:implement-junior`, `safer:implement-senior`, `safer:implement-staff`, `safer:investigate`, `safer:spike`, `safer:research`, `safer:review-senior`, `safer:verify`.

If a sub-task cannot be represented in this shape, you have the wrong decomposition. Re-triage.

---

## Workflow

### Phase 1 — Triage

Before decomposing, classify what kind of work this actually is. **If the intent is single-modality, do not orchestrate.** Tell the user to invoke the modality directly. Orchestration has overhead; single modalities do not pay for it.

Classification table:

| If the intent looks like... | Route to |
|---|---|
| Ambiguous goal, no acceptance criteria | `/safer:spec` directly — no orchestration yet |
| A reproducible bug, one symptom | `/safer:investigate` directly |
| "Can we do X?" / "Is X feasible?" | `/safer:spike` directly |
| "How do X systems work?" / open question | `/safer:research` directly |
| "Fix this bug and ship the fix" | Orchestrate: investigate → implement-* → verify |
| "Build feature X" | Orchestrate: spec → architect → implement-* → verify |
| "Investigate and fix if tractable" | Orchestrate: investigate → (decide) → implement-* → verify |
| Clearly one modality, clearly done when that finishes | Decline; route directly |

When in doubt, ask the user:

> *"This could be scoped as a single `<modality>` task, or orchestrated as a <N>-step pipeline. Which do you want?"*

Emit `safer.skill_run` with `modality=orchestrate` only if you proceed.

### Phase 2 — Decompose

Build the decomposition table. Columns:

| # | Modality | Depends on | Acceptance criteria |
|---|---|---|---|

**Rules for decomposition:**

- Every sub-task has exactly one modality. If you find yourself wanting two, split into two sub-tasks.
- Every sub-task has explicit acceptance criteria — what artifact, in what state, makes this sub-task `done`.
- Dependencies are explicit. Circular dependencies are a bug in your decomposition; fix it before publishing.
- Sub-tasks are ordered by dependency, not by guess. If A must precede B, A is sub-task #1.
- Architecture comes before implementation. Always. If you cannot state the architecture, a `spec` or `architect` sub-task is your first dependency.

**Decomposition anti-patterns.**
- "We'll figure out the architecture as we go." *(No. Architecture sub-task first.)*
- "This is all one `implement-staff` task." *(If it would touch >5 files or cross modules, it wants an `architect` sub-task before it.)*
- "We'll skip verify." *(No. The verify sub-task is how the pipeline knows the thing shipped.)*
- "We'll investigate in the same session we fix." *(Separate sub-tasks. Investigation is its own modality.)*

### Phase 3 — Publish parent epic

Create the parent epic issue on GitHub. Use `safer-publish` (wraps `/zapbot-publish`; falls back to `gh`):

```bash
safer-publish --kind epic \
  --title "<compressed intent, <70 chars>" \
  --body-file /tmp/safer-epic-body.md \
  --labels triaged
```

Epic body template:

```markdown
## Intent

<the user's intent, verbatim or lightly clarified>

## Context

- **Project:** <name> (<https://github.com/OWNER/REPO>)
- **Linear project:** <name>   <!-- one of the projects in the MOL team; required if Linear sync is desired -->
- **Motivation:** <one sentence, in the user's own words if they stated it — why this matters now>
- **Prior artifacts:** <bullet list of full URLs to every spec, issue, comment, PR, or doc this epic depends on. If none, write "none.">

This section is the cold-start reader's anchor. A teammate opening this epic with zero session context must be able to start from here alone.

## Decomposition

| # | Modality | Depends on | Acceptance | Sub-issue |
|---|---|---|---|---|
| 1 | spec | — | SPEC.md published as a comment on this epic; goals, non-goals, and explicit acceptance criteria present; `safer:spec` label; state `review` | <https://github.com/OWNER/REPO/issues/NNN> |
| 2 | architect | 1 | Design doc published as sub-issue body; modules named with file paths; public interfaces typed; stub files pushed to branch; state `review` | <https://github.com/OWNER/REPO/issues/NNN> |
| 3 | implement-senior | 2 | Draft PR opened with `[impl-senior]` title prefix; all stubs replaced with bodies; `safer-diff-scope` reports `senior`; lint/typecheck/tests green locally; state `review` | <https://github.com/OWNER/REPO/issues/NNN> |
| 4 | verify | 3 | Verify comment posted on PR #M naming each acceptance criterion and its ship/hold verdict; CI green; state `done` | <https://github.com/OWNER/REPO/issues/NNN> |

Every external reference in this body is a full URL, not a bare `#N`. A reader on another repo or in a fresh session cannot resolve `#N` alone.

## Status

`triaged`

## Orchestrator session

`<SESSION>`

## Next step

- **First dispatch:** sub-issue <https://github.com/OWNER/REPO/issues/NNN> (row #1, modality `<MODALITY>`).
- **Teammate:** `<teammate-name>` on team `<team-name>` — or `TBD` if not yet spawned.
- **Gating artifact:** <what must land on that sub-issue before row #2 dispatches>.
```

Record the parent epic's issue number.

**Body rules (apply when filling the template above).**

1. **Context is required, not optional.** The `## Context` section exists so a cold-start reader does not need the conversation history. If you cannot state the project, the motivation, and the prior artifacts in three bullets, you do not yet have enough context to orchestrate — ask the user.
2. **Every acceptance cell answers "what artifact, in what state, makes this row done."** One-line stubs like "tests green" are insufficient. Name the artifact type (PR, comment, sub-issue body, label), the location, and the state transition that closes the row.
3. **Every external reference is a full URL.** `#5`, `PR #12`, "see the spec" are all invalid. Write `<https://github.com/OWNER/REPO/issues/5>`. This applies to sub-issues, prior artifacts, linked PRs, and any other cross-reference in the body. A bare `#N` breaks the moment the reader is in a different repo or session.
4. **The `## Next step` section is mandatory.** The epic is only useful if the next action is explicit. Name the first sub-issue to dispatch (by URL), its modality, and the teammate (or `TBD`) that will pick it up.
5. **The `Linear project` line is mandatory if Linear sync is enabled for this repo.** Pick the project from the live Linear `MOL` team list. If the epic is genuinely cross-project, name the dominant project and add a comment cross-link rather than splitting the epic.

### Phase 4 — Create sub-issues

For each row in the decomposition table, create a sub-issue:

```bash
gh issue create \
  --title "[safer:$MODALITY] $SUBTASK_TITLE" \
  --body "$(cat <<EOF
Parent: #$PARENT_NUMBER
Modality: $MODALITY
Depends on: $DEPENDS_ON
Acceptance: $ACCEPTANCE

## Context
$CONTEXT

## Status
\`planning\`
EOF
)" \
  --label "safer:$MODALITY,planning"
```

After creating each sub-issue, **edit the parent epic's body** to fill in the sub-issue number in the decomposition table. The decomposition table on the parent epic is the durable route map.

### Phase 5 — Dispatch and gate

For each sub-issue in dependency order:

**Step 5a — Invoke the modality.**

Dispatch via a team. First `TeamCreate` a team for the epic if one does not exist, then `Agent` with `team_name` and a `name` per teammate.

**Never invoke a modality in-session.** The `Skill` tool executes in your own context. That means orchestrate is doing the work, which is the Iron Rule violation this skill exists to prevent. Modalities run as teammates.

**Never dispatch via `Agent` without `team_name`.** Standalone subagents are fire-and-forget; teammates are the unit of orchestration. Teams provide shared task lists, peer DM, idle notifications to the team lead, and persistent config at `~/.claude/teams/<team-name>/`.

Teammate prompt template:

```
You are a teammate on team `<team-name>` invoking the /safer:<MODALITY> skill.

Context:
- Parent epic: <URL>
- Your sub-issue: <URL>
- Read both issues before starting.
- Read PRINCIPLES.md at the plugin root.
- Read skills/<MODALITY>/SKILL.md at the plugin root.

Your assignment:
<the sub-issue's acceptance criteria, verbatim>

When you finish, your final output MUST include one of these status markers:
DONE, DONE_WITH_CONCERNS, ESCALATED, BLOCKED, NEEDS_CONTEXT.

Publish your artifact back to your sub-issue (comment, PR, or label change per
the modality's publication rule). Use TaskUpdate to mark your task complete
and SendMessage to notify the team lead.
```

**Step 5b — Wait for the artifact.**

Poll the sub-issue until one of:
- Label changed to `review` (or `implementing`, per the modality's lifecycle). → proceed to 5c.
- New comment matching `STATUS: ESCALATED` or `STATUS: BLOCKED` or `STATUS: NEEDS_CONTEXT`. → proceed to Phase 6 (Backtrack).
- Timeout / no movement. → treat as `BLOCKED`, proceed to Phase 6.

**Step 5c — Review the artifact.**

- For code-producing sub-tasks (`implement-*`):
  - **If `safer-diff-scope --pr $PR` reports tier ≥ `senior` OR `public_surface_changed > 0` OR the sub-issue modality is `implement-staff`:** invoke `/safer:stamina --pr <PR>`. Stamina routes to the review family and gates on consensus; do not also invoke `/safer:review-senior` standalone.
  - **Else:** invoke `/safer:review-senior` on the PR (existing single-reviewer path).
- For design-producing sub-tasks (`spec`, `architect`, `design-module`):
  - **If the sub-issue modality is `spec` or `architect` (high-blast-radius by default):** invoke `/safer:stamina --plan <sub-issue-URL>`.
  - **Else:** read the artifact and judge against acceptance (existing path). Ask the user if any criterion is ambiguous.
- For exploration sub-tasks (`investigate`, `spike`, `research`): read the writeup; judge against acceptance.
- For verify sub-tasks: the sub-task itself is the review. Trust its verdict.

If accepted:

```bash
safer-transition-label --issue $N --from review --to plan-approved
```

Then cascade forward per modality lifecycle:
- `spec` / `architect` / `design-module` → `plan-approved` → (next sub-task starts, this one closes to `done`).
- `implement-*` → `plan-approved` → `implementing` (the PR is merged) → `verifying` (verify sub-task runs) → `done`.
- `investigate` / `spike` / `research` → `plan-approved` → `done` (these produce writeups, not code).

Once accepted, run the four steps below in order. These are the canonical gate-and-dispatch procedure; the Phase 5d auto-monitor calls into them (step 5 → Step 5c.1–5c.2; step 6 → Step 5c.3–5c.4).

**Step 5c.1 — Post the gating comment and close the sub-issue.**

The gating comment is human-visible proof of the state transition. Never close a sub-issue without it; a silent close strands the next reader.

```bash
# $N = current sub-issue, $NEXT_N = next sub-issue number (or "TBD" if not yet created),
# $NEXT_MOD = next modality, $PARENT = parent epic number.
gh issue comment "$N" --body "Gated: acceptance met. Transitioning to \`plan-approved\` and closing.

Next: #${NEXT_N} (\`safer:${NEXT_MOD}\`) — see parent epic #${PARENT} decomposition table."
gh issue close "$N" --reason completed
```

**Step 5c.2 — Update the parent epic's Progress section.**

After every sub-issue close, rewrite the `## Progress` section at the end of the parent epic body. This keeps the epic the single source of truth a cold-start reader can open and understand without scrolling through comments.

Shape:
- Markdown checkbox list: `- [x]` for closed sub-issues, `- [ ]` for open.
- Each row: sub-issue number linked (full URL) + short title + one-line status note.
- Trailing line: `Last updated: <ISO8601>` (UTC, from `date -u +%Y-%m-%dT%H:%M:%SZ`).

Procedure: read the current body, strip any existing `## Progress` section, append the rebuilt one, write it back. Copy-paste template:

```bash
# $PARENT = parent epic number; $REPO = owner/name from preamble.
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
gh issue view "$PARENT" --json body -q .body > /tmp/epic-body.md

# Strip prior Progress section (everything from "## Progress" to EOF).
awk '/^## Progress$/{exit} {print}' /tmp/epic-body.md > /tmp/epic-body.trimmed

# Rebuild Progress from the decomposition rows on the parent epic.
# For each sub-issue referenced in the decomposition table, emit a checkbox row.
{
  echo ""
  echo "## Progress"
  echo ""
  gh issue list --repo "$REPO" --search "in:body #${PARENT}" \
    --state all --json number,title,url,state \
    --jq '.[] | "- [\(if .state=="CLOSED" then "x" else " " end)] [#\(.number)](\(.url)) \(.title) — \(.state|ascii_downcase)"'
  echo ""
  echo "Last updated: ${TS}"
} >> /tmp/epic-body.trimmed

gh issue edit "$PARENT" --body-file /tmp/epic-body.trimmed
```

If the decomposition table has richer status notes ("PR #42 merged", "verify green"), prefer those over the raw GitHub state. The jq form above is the fallback when no richer note is available.

**Step 5c.3 — Create the next sub-issue if the decomposition row is `#TBD`.**

Read the parent epic's decomposition table. Find the row whose `Depends on` column is the just-closed sub-issue. If its `Sub-issue` column is `#TBD` (or blank), create that sub-issue now using the same title/body template Phase 4 used for prior rows, then edit the parent body to replace `#TBD` with the new issue's URL.

```bash
# $NEXT_MOD, $NEXT_TITLE, $NEXT_ACCEPTANCE, $NEXT_DEPS come from the decomposition row.
NEXT_URL=$(gh issue create \
  --title "[safer:${NEXT_MOD}] ${NEXT_TITLE}" \
  --body "$(cat <<EOF
Parent: #${PARENT}
Modality: ${NEXT_MOD}
Depends on: ${NEXT_DEPS}
Acceptance: ${NEXT_ACCEPTANCE}

## Status
\`planning\`
EOF
)" \
  --label "safer:${NEXT_MOD},planning")
NEXT_N=$(basename "$NEXT_URL")
# Replace the #TBD placeholder in the parent epic body with the real URL.
sed -i "0,/#TBD/s|#TBD|${NEXT_URL}|" /tmp/epic-body.trimmed
gh issue edit "$PARENT" --body-file /tmp/epic-body.trimmed
```

If the row does not exist at all (the decomposition table is shorter than the work actually required), escalate via Phase 6 — this is the `Plan gap` case. Do not invent new rows.

**Step 5c.4 — Dispatch the next teammate.**

Use `TeamCreate` + `Agent` with `team_name` per Phase 5a. Never standalone subagent; never in-session `Skill`. The teammate prompt is the Phase 5a template with the newly-created sub-issue URL filled in.

Capacity check: if the team roster already holds the configured max active teammates, skip the dispatch and leave the sub-issue in `planning`. The next auto-monitor tick retries once a seat frees up.

**Guardrails for the whole 5c.1–5c.4 sequence.**

- Never auto-close a sub-issue whose artifact is missing or ambiguous. The artifact must be a specific comment, PR, or label change already published on the sub-issue. "Teammate said DONE in chat" is not an artifact.
- Never skip the human-visible gating comment in 5c.1. The comment is what proves the gate fired; without it, a future reader cannot reconstruct the decision.
- Never auto-dispatch in 5c.4 without an available teammate pane. Over-cap is how the loop starts killing work it should not touch.
- Never invent decomposition rows in 5c.3. `#TBD` means "orchestrator knew this row would exist"; no row means "something is wrong with the decomposition" — route through Phase 6.
- If the auto-monitor calls any of these steps and any guardrail fails, the step is skipped and deferred to the next human-driven tick. Ambiguity is skipped, not resolved.

If rejected:
- State the specific failure against the acceptance criterion.
- Transition `review` → `planning` (the modality revises).
- Do not revise the artifact yourself.

### Step 5d — Auto-monitor loop (MANDATORY)

**This step is mandatory for every orchestrate run that dispatches more than one teammate.** Skipping it is a stop-rule violation: orchestrate sitting idle between user prompts defeats the entire point of async dispatch.

Teammates complete asynchronously. Polling every sub-issue by hand is how orchestrate drifts into idle sit-and-wait. The loop runs the sweep for you.

**Why.** Without a loop, the team lead either spins waiting for prompts or wakes up only when the user nudges. Both defeat the point of orchestration. The loop is how orchestrate earns the "scrum master who reads `gh issue list`" framing at runtime.

**Install.** Run `CronCreate` **before your first dispatch**, not after. Session-only job (`recurring: true`, `durable: false`). Mandatory cadence is every 2 minutes:

```
CronCreate({
  schedule: "*/2 * * * *",
  recurring: true,
  durable: false,
  prompt: "<loop body — see below>"
})
```

Record the returned job id on the parent epic (comment) so the next operator can cancel it.

**Loop body.** Each tick does exactly the checks below, in order. The loop writes no code and makes no decisions that are not already encoded in an artifact.

1. **Team roster.** Read `~/.claude/teams/<team-name>/config.json` with `jq` to list teammates and their `isActive` flag. Example: `jq -r '.members[] | "\(.name)\t\(.isActive)\t\(.paneId // "-")"' ~/.claude/teams/<team-name>/config.json`.
2. **Review-ready sub-issues.** `gh issue list --label review --json number,title,url,labels` for this repo. Any hit is a candidate for Step 5c.
3. **Open PRs.** `gh pr list --json number,url,isDraft,mergeable,statusCheckRollup` to see which draft PRs are green.
4. **Auto-shutdown + auto-delete idle done teammates.** Two paths run on every tick. The `shutdown_request` protocol is unreliable — teammates' system prompts frequently do not handle it — so direct pane kill plus roster rewrite is the reliable path.

   **First, compute the authoritative list of live panes.** This is the one command the loop depends on getting right:

   ```bash
   ALIVE=$(tmux list-panes -a -F '#{pane_id}' 2>/dev/null | sort -u)
   ```

   **Do NOT** use `tmux list-panes -a | awk '{print $NF}'` to harvest pane IDs. `tmux list-panes -a` prints the literal string `(active)` as the last whitespace-separated field on any pane that is currently the active pane in its window. `awk '{print $NF}'` on that output returns `(active)`, NOT the pane id, and the resulting set silently drops every active pane — producing false "dead" verdicts on the panes the loop most needs to protect. Use `-F '#{pane_id}'`. Always.

   **Path (a): dead-pane cleanup.** For every teammate (other than `team-lead`), if their `tmuxPaneId` is NOT in `$ALIVE` (`echo "$ALIVE" | grep -qx "<paneId>"` returns false), their process is already gone. Remove them from the roster; no kill command needed:

   ```bash
   jq --arg name "<teammate-name>" \
      '.members |= map(select(.name != $name))' \
      ~/.claude/teams/<team-name>/config.json > /tmp/team.tmp \
      && mv /tmp/team.tmp ~/.claude/teams/<team-name>/config.json
   ```

   **Path (b): done-teammate cleanup.** For every teammate whose pane IS alive but whose assigned sub-issue is in a terminal state (`done`, `abandoned`, closed) OR whose assigned PR is merged, kill the pane and rewrite the roster:

   ```bash
   tmux kill-pane -t <paneId>
   jq --arg name "<teammate-name>" \
      '.members |= map(select(.name != $name))' \
      ~/.claude/teams/<team-name>/config.json > /tmp/team.tmp \
      && mv /tmp/team.tmp ~/.claude/teams/<team-name>/config.json
   ```

   Guardrails (the loop enforces these before touching anything):
   - Never delete `team-lead` from the roster. Never kill the team-lead pane.
   - Path (b) requires BOTH pane-alive AND sub-issue-terminal. Neither alone is enough.
   - Path (a) requires only pane-missing from `$ALIVE`. A teammate whose work is incomplete but whose process died is still removed — their pane is gone either way, and the work needs to be re-dispatched.
   - When uncertain whether a teammate is truly done, leave them. A held pane is cheaper than lost work.

5. **Auto-gate + update epic progress.** For each sub-issue whose acceptance is mechanically verifiable (clean draft PR green on CI, review-ready comment matching the acceptance criterion, etc.), run **Step 5c.1 and Step 5c.2**: transition `review → plan-approved`, post the gating comment, close the sub-issue, then rewrite the parent epic's `## Progress` section. Skip the sub-issue when tests are red, CI is pending, or the acceptance artifact requires human judgment (any criterion the modality delegates to `/safer:review-senior`).
6. **Auto-dispatch pending work (work-queue scan).** The prior steps react to state the loop already knows about. Step 6 is the proactive scan: enumerate pending sub-issues across every repo this team serves, filter out the ones that are already in flight, prioritize what is left, and dispatch up to the per-tick cap. Without this step the orchestrator idles between user prompts even when work is queued. Step 6 is mandatory once a team is installed.

**Step 6a — enumerate pending work.** Scan every repo this team watches (`~/.claude/teams/<team-name>/config.json` carries `repos: []`; fall back to the current repo if the field is absent). For each, list open sub-issues whose labels name a dispatchable modality:

```bash
for repo in $(jq -r '.repos[]?' ~/.claude/teams/<team-name>/config.json 2>/dev/null || echo "$REPO"); do
  gh issue list --repo "$repo" --state open --limit 200 \
    --json number,title,labels,url,body \
    --jq '.[] | select(.labels | map(.name) | any(test("^safer:(implement-(junior|senior|staff)|verify|spike|research|spec)$")))'
done > /tmp/orch-queue.jsonl
```

Filter the queue in-process. The first two filters are body-only and cheap; the marker filter requires a per-candidate `gh issue view --json comments` call (the marker is a comment, not in the issue body) and should run last so we only pay for survivors:

- Drop any row whose title or body references a teammate already in `config.json` `.members[].name` (already in flight).
- Drop any row whose parent epic (from `## Parent` or `Parent: #N` in the body) has a linked open PR authored by the dispatching team (somebody is on it).
- For each surviving candidate, fetch comments and scan for the idempotency marker. The marker is `<!-- orchestrate:dispatched teammate=<name> at=<iso> -->`; drop the candidate if any comment matches and its `at=` timestamp is within the last 30 minutes (re-entrance guard against a team-lead crash mid-tick):

  ```bash
  window_start=$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
              || date -u -v-30M +%Y-%m-%dT%H:%M:%SZ)
  marker_ts=$(gh issue view "$N" --repo "$repo" --json comments \
    --jq '.comments[].body
      | capture("<!-- orchestrate:dispatched teammate=[A-Za-z0-9_-]+ at=(?<ts>[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z) -->")
      | .ts' \
    | sort | tail -1)
  if [ -n "$marker_ts" ] && [ "$marker_ts" \> "$window_start" ]; then
    # marker is fresh — skip this candidate
    continue
  fi
  ```

The surviving rows are the candidate queue. Record the count (`queue_len`) for the log line in 6b.

**Step 6b — compute capacity.** Pane ceiling is set to 20 based on an empirical observation that tmux starts rejecting splits as the pane count approaches that range on default kernels; `"no space for new pane"` from the Agent tool is the authoritative safety net if the ceiling is ever wrong in a given environment. Count live panes once per tick:

```bash
live_panes=$(tmux list-panes -a -F '#{pane_id}' 2>/dev/null | wc -l)
pane_ceiling=20
spare=$(( pane_ceiling - live_panes ))
per_tick_cap=3
budget=$(( spare < per_tick_cap ? spare : per_tick_cap ))
```

If `budget <= 0`: log `at capacity: panes=$live_panes, queue_len=$queue_len, skip dispatch`. Skip to the next tick. The cap of 3 new dispatches per tick is hard — do not raise it even when `spare > 3`, so a single tick never over-saturates the team.

**Step 6c — prioritize pending.** Sort the surviving candidates by tier, then by parent-epic decomposition order within a tier. The four tiers, highest first:

1. **Blocker-level** — sub-issue is on a parent epic's critical path AND is currently at label `review`. These gate downstream dispatches; unblocking them has the highest leverage.
2. **Spike or verify** — these unblock downstream implementation (spike answers a go/no-go; verify finalizes a PR).
3. **Implement-\*** — ordered by the parent epic's decomposition table (not arbitrary).
4. **Research** — long-running, rarely merge-blocking.

Within a tier, break ties by oldest `createdAt`. Do not invent additional heuristics; the four tiers are the ceiling of complexity for this step.

Executable reference (feed `<tier>\t<created_at_epoch>\t<issue_number>` on stdin):

```bash
# tier: 1=blocker(review on critical path), 2=spike|verify, 3=implement-*, 4=research
priority_sort() {
  sort -k1,1n -k2,2n | cut -f3
}
```

**Step 6d — post marker first, then dispatch (order matters).** For each candidate in priority order, up to `budget`, dispatch using the inline template that matches its `safer:<modality>` label (see *Per-modality dispatch prompt templates* below). The marker MUST be posted before the `Agent` call so a concurrent next tick reading comments in Step 6a sees it and skips; if we dispatched first, a slow Agent spawn (>2 min) plus the cron interval could re-dispatch the same issue. Dispatch `Agent` call includes the `model` parameter per the Model routing table — every modality has a default; override only if user explicitly names a different model.

For each candidate:

1. **Post the idempotency marker first** (reserves the sub-issue for this dispatch):

   ```bash
   TEAMMATE_NAME="<modality>-<issue-number>"
   MARKER_BODY="<!-- orchestrate:dispatched teammate=$TEAMMATE_NAME at=$(date -u +%Y-%m-%dT%H:%M:%SZ) -->"
   # gh issue comment prints the comment URL on success; parse the comment id
   # out of the `#issuecomment-<id>` fragment so step 3 can delete it on rollback.
   MARKER_URL=$(gh issue comment "$N" --repo "$repo" --body "$MARKER_BODY" 2>/dev/null) \
     || { echo "marker post failed; skip"; continue; }
   MARKER_ID="${MARKER_URL##*issuecomment-}"
   ```

2. **Dispatch the teammate.** Use `TeamCreate` (if the team does not exist) + `Agent` with `team_name` and the unique teammate `name`. Fill template placeholders per the schema in *Per-modality dispatch prompt templates*. Pass `source: orchestrate-auto-dispatch` in the prompt header so the audit trail is visible. Never standalone `Agent` without `team_name`; never invoke the modality via in-session `Skill`.

3. **On dispatch failure, delete the marker** so the next tick is free to retry. The Agent tool returning `"no space for new pane"`, a `TeamCreate` error, or any other dispatch error must roll back the reservation:

   ```bash
   gh api --method DELETE "repos/$repo/issues/comments/$MARKER_ID" >/dev/null 2>&1 || true
   ```

   Then break the dispatch loop (the ceiling was hit, or team state is bad); the remaining queue defers to the next tick.

The 30-minute freshness window in Step 6a is deliberate: if an Agent process crashed *after* posting the marker but *before* producing an artifact, the sub-issue is eligible for re-dispatch on the next tick past that window. Markers older than 30 minutes with no resulting PR are treated as stale reservations.

Stop iterating the moment any of these fire: `budget` reaches 0, the Agent tool returns `"no space for new pane"` (ceiling hit mid-tick; marker was already rolled back in step 3 above), or the candidate queue is empty.

**Failure modes Step 6 handles (fail-closed).** Every case below is a skip, not a fix.

- **Pane ceiling hit mid-dispatch.** Catch `"no space for new pane"` from the Agent tool. Log `pane_ceiling_hit: queued=<remaining>`. Break the dispatch loop; the remaining queue defers to the next tick.
- **Sub-issue already has an open PR.** Skip. The implementer is already working; re-dispatching would fork.
- **Sub-issue has a teammate in `config.json`.** Skip. Same reason.
- **Idempotency marker posted within the last 30 minutes.** Skip.
- **Label-to-modality mismatch.** If the sub-issue carries two `safer:*` modality labels, or a `safer:*` label not in the catalog, log `label_modality_mismatch: issue=#N labels=<list>` and skip. Never guess a modality.
- **`safer:implement-staff` without a `plan-approved` parent epic.** Skip. Staff-tier work requires an architect sign-off; auto-dispatching without one is a Ratchet violation.
- **`safer:verify` on a PR that is not `MERGEABLE state=CLEAN`.** Skip. Verify runs against a known-green PR; running it earlier produces noise that has to be re-run anyway.
- **Parent epic is missing or closed.** Skip. A sub-issue with no live parent is an orchestration artifact to be cleaned up by a human, not auto-dispatched.

**What the loop MUST NEVER do.**

- Kill the team-lead pane, or delete `team-lead` from the roster.
- Kill or delete a teammate whose `isActive == true`, or whose sub-issue is not terminal. Both conditions must hold, or the loop leaves them.
- Merge a PR with failing tests, failing CI, or unresolved review comments.
- Gate a sub-issue whose acceptance criteria require judgment the loop cannot encode (design review, spec approval, any criterion the modality's `review` step delegates to `/safer:review-senior`).
- Write code, edit files, or run `/safer:<modality>` skills in-session. Dispatch via teammate only.

If any check above is ambiguous, the loop skips that action and leaves it for the next human-driven tick. Ambiguity is not a bug; acting on ambiguity is.

**Tuning the interval.**

Default is `*/2 * * * *` (every 2 minutes) and you should not change it without a specific reason. Slower intervals make idle-teammate and merge-ready PR detection lag by multiple minutes and re-introduce the exact "orchestrate sits idle" failure this step exists to prevent.

| Epic shape | Interval |
|---|---|
| Any active epic with teammates dispatched | `*/2 * * * *` (2 min — mandatory default) |
| Single-modality task | no loop; orchestrate is the wrong skill |

**Cancel.** Keep the job id from `CronCreate`. To stop the loop: `CronDelete({ jobId: "<id>" })`. Also run this in Phase 7 at close-out (see below).

### Model routing

The `Agent` call in Step 6d includes the `model` parameter per the table below. Every modality has a default model; override only if the user explicitly names a different model for a task.

| Modality | Model | Rationale |
|---|---|---|
| `safer:implement-junior` | haiku (claude-haiku-4-5) | "fill in body of one module" is small-model territory |
| `safer:implement-senior` | sonnet (claude-sonnet-4-6) | cross-module-within-plan; judgment without creativity |
| `safer:implement-staff` | opus (claude-opus-4-7) | new modules / new public interfaces / new architectural patterns |
| `safer:dogfood` | haiku | **acid test**: if haiku can't cold-read the artifact, the artifact has portability bug |
| `safer:spike` | opus | throwaway feasibility requires exploratory reasoning |
| `safer:research` | opus | iterative hypothesis loop over literature |
| `safer:architect` | opus | design-module decisions; high blast radius |
| `safer:review-senior` | opus | review is high-stakes reading |
| `safer:verify` | opus | formal sign-off |
| `safer:spec` | opus | translating intent to acceptance criteria |

> **Dogfood-on-haiku is an acid test.** Upgrading dogfood to opus masks portability debt. Keep dogfood on haiku.

### Codex dispatch pattern

Three modes mirror gstack `/codex`. Invoke via the gstack `/codex` skill — do NOT call `codex` binary or `@openai/sdk` raw; the harness CLI is the routing boundary.

1. **Review mode (spec, architect upstream stages):** claude drafts; codex reviews the published artifact before `review → plan-approved`. Verdict: `approve` / `changes-requested` / `reject`. `changes-requested` routes back to the drafting modality as one revision round; `reject` escalates to the user with codex's reasoning. Opus stays the primary author — the SDS paper's independent-hypothesis claim motivates independent *evaluation*, not independent *generation*.
2. **Supervisor mode (research):** per-round. Researcher output lands as a comment; codex reads and stamps `continue` / `hold` / `escalate` before the next round's dispatch. Breaks single-model groupthink on multi-round reasoning.
3. **Diff review mode (implement-staff mandatory; implement-senior optional):** codex reads the PR diff, independent of `/safer:review-senior`. Verdict posted as a PR comment before the human review fires. Counts as one independent pass toward the stamina N budget (PRINCIPLES.md → Durability).

**Budget.** One codex pass per artifact for spec/architect; one per research round for supervisor; one per staff PR for diff review. No over-calling — over-calling defeats the cost model.

**Fallthrough.** If `/codex` is not installed or fails, proceed without the codex pass and log the skip on the sub-issue. Cross-model coverage is durability-additive, not a hard blocker.

### Conflict resolution

When routing rules conflict, this order governs. Earlier rules dominate.

1. **User override wins.** User explicitly names a model, skips a gate, or routes differently → follow. Log override on sub-issue.
2. **Scope discipline wins over capability upgrades.** If a scenario needs opus reasoning but the modality is junior, re-triage to senior. Never silently upgrade the junior's model — that hides scope drift.
3. **Dogfood-on-haiku overrides artifact's model hint.** Dogfood IS the small-model test. If haiku cannot cold-read the artifact, fix the artifact, not the test.
4. **Codex unavailable falls through to claude-only.** Log the skip. Blocking all spec work on a third-party CLI failure is worse than missing one cross-model pass.
5. **Simplify finding conflicts with plan-approved architect decision.** Plan wins; skip finding; cite plan line in PR body.
6. **Stamina N budget overlaps with codex + review-senior.** A codex diff-review pass and a `/safer:review-senior` pass count as N=2 (independent roles: mechanical/cross-model vs human-style). They do not double-count as N=1.
7. **Gate failures are never silent.** Simplify errored, codex unreachable, review-senior did not fire: post a gate-skip comment on the sub-issue with the reason.

### Per-modality dispatch prompt templates

Step 6d dispatches by filling the template that matches the sub-issue's `safer:<modality>` label. Every template is a copy-pasteable block. Every template carries the `source: orchestrate-auto-dispatch` header so a post-hoc audit can separate auto-dispatched work from human-driven dispatches. Every template ends with the mandatory status-marker instruction.

**Placeholder schema.** Every template draws from this fixed set — no template may introduce a placeholder outside it, and every placeholder below has one definition used consistently across all seven templates:

| Placeholder | Source | Notes |
|---|---|---|
| `{TEAM}` | `~/.claude/teams/<team-name>/config.json` → `name` | the team the dispatching orchestrator runs under; the dispatched teammate joins this team |
| `{ISSUE_URL}` | sub-issue `url` from `gh issue list --json url` | full URL including host |
| `{PARENT_URL}` | parent epic URL resolved from `Parent: #N` or `## Parent` in the sub-issue body | full URL; empty only if the epic is missing (which is itself a Step 6 skip case) |
| `{ACCEPTANCE}` | the `Acceptance:` line verbatim from the sub-issue body | if the sub-issue has no such line, skip the candidate — Step 6 never synthesizes acceptance |
| `{BRANCH_HINT}` | derived; see format below | empty string for modalities that produce no branch (`verify`, `research`, `spec`) |

`{BRANCH_HINT}` format: `<modality-short>/<issue-number>-<slug>` where

- `<modality-short>` is one of `junior`, `senior`, `staff`, `verify`, `spike`, `research`, `spec` — the final token of the `safer:<modality>` label (drop the `implement-` prefix).
- `<issue-number>` is the sub-issue number with no `#` prefix.
- `<slug>` is the sub-issue title lowercased, non-alphanumerics collapsed to `-`, trimmed of leading/trailing `-`, and truncated to 40 characters. Example: sub-issue `#66` titled `[impl-senior] orchestrate: Step 6 work-queue scan` becomes `senior/66-impl-senior-orchestrate-step-6-work`.

For `verify`, `research`, and `spec`, `{BRANCH_HINT}` is the empty string; their templates omit the `Branch: ...` line entirely.

#### implement-junior

```
source: orchestrate-auto-dispatch
Dispatch with: `model: haiku` per orchestrate Model routing table.
You are a teammate on team `{TEAM}` invoking `/safer:implement-junior`.

Sub-issue: {ISSUE_URL}
Parent epic: {PARENT_URL}
Branch: {BRANCH_HINT}

Read PRINCIPLES.md and skills/implement-junior/SKILL.md at the plugin root.
Read the sub-issue and parent epic before touching code.

Acceptance: {ACCEPTANCE}

Scope is ONE module. If you need to touch a second module, stop and escalate.
If the diff exceeds 50 LOC or introduces shared helpers, consider running /simplify
before opening the PR. Open a draft PR titled `[impl-junior] ...`. Move the
sub-issue to `review`. Emit a status marker (DONE / DONE_WITH_CONCERNS /
ESCALATED / BLOCKED / NEEDS_CONTEXT) on your final output and SendMessage the
team lead with the PR URL.
```

#### implement-senior

```
source: orchestrate-auto-dispatch
Dispatch with: `model: sonnet` per orchestrate Model routing table.
You are a teammate on team `{TEAM}` invoking `/safer:implement-senior`.

Sub-issue: {ISSUE_URL}
Parent epic: {PARENT_URL}
Branch: {BRANCH_HINT}

Read PRINCIPLES.md and skills/implement-senior/SKILL.md at the plugin root.
Load the architect plan the parent epic references. No plan, escalate.

Acceptance: {ACCEPTANCE}

Scope is cross-module WITHIN the plan. Do not introduce new modules, new public
surface outside the plan, or new deps. `safer-diff-scope --head HEAD` must report
`senior`. Before opening the PR, run /simplify on the diff (mandatory); apply
findings unless a finding conflicts with a plan-approved decision (cite the plan
line in the PR body). Open a draft PR titled `[impl-senior] ...` with a
plan-anchor table. /safer:review-senior is mandatory before merge.
Status marker + SendMessage the team lead with the PR URL.
```

#### implement-staff

```
source: orchestrate-auto-dispatch
Dispatch with: `model: opus` per orchestrate Model routing table.
You are a teammate on team `{TEAM}` invoking `/safer:implement-staff`.

Sub-issue: {ISSUE_URL}
Parent epic: {PARENT_URL}
Branch: {BRANCH_HINT}

PRECONDITION: the parent epic carries label `plan-approved`. If not, STOP and
escalate — staff-tier work without architect sign-off is a Ratchet violation.

Read PRINCIPLES.md and skills/implement-staff/SKILL.md at the plugin root.
Read the approved spec + architect plan the parent epic references.

Acceptance: {ACCEPTANCE}

You may introduce new modules, new public interfaces, and new deps — all of
which must trace to the approved plan. Before opening the PR:
1. Run /simplify on the diff (mandatory, stricter than senior — apply every
   finding unless it conflicts with a plan-approved architect decision; cite the
   plan line in the PR body for any skipped finding).
2. Run /codex on the PR diff (mandatory): post the codex verdict as a PR comment
   before /safer:review-senior fires. This counts as one independent pass toward
   the stamina N budget. If /codex is unavailable, log the skip on the sub-issue.
Open a draft PR titled `[impl-staff] ...`. /safer:review-senior is mandatory
before merge. Status marker + SendMessage the team lead with the PR URL.
```

#### verify

```
source: orchestrate-auto-dispatch
Dispatch with: `model: opus` per orchestrate Model routing table.
You are a teammate on team `{TEAM}` invoking `/safer:verify`.

Sub-issue: {ISSUE_URL}
Parent epic: {PARENT_URL}

PRECONDITION: the PR under test is `MERGEABLE state=CLEAN`. If not, STOP;
this tick's auto-dispatch should not have picked you up.

Read PRINCIPLES.md and skills/verify/SKILL.md at the plugin root.

Acceptance: {ACCEPTANCE}

Run the repo test suite and lint. Post a ship/hold verdict as a PR comment
naming each acceptance criterion. Do NOT apply fixes — hand back if anything
fails. Status marker + SendMessage the team lead with the verdict URL.
```

#### spike

```
source: orchestrate-auto-dispatch
Dispatch with: `model: opus` per orchestrate Model routing table.
You are a teammate on team `{TEAM}` invoking `/safer:spike`.

Sub-issue: {ISSUE_URL}
Parent epic: {PARENT_URL}
Branch: {BRANCH_HINT}  (throwaway — do NOT merge)

Read PRINCIPLES.md and skills/spike/SKILL.md at the plugin root.

Acceptance: {ACCEPTANCE}

Answer one feasibility question with throwaway code. Publish a go/no-go
writeup as a sub-issue comment. The branch stays unmerged. Status marker
+ SendMessage the team lead with the writeup URL.
```

#### research

```
source: orchestrate-auto-dispatch
Dispatch with: `model: opus` (Researcher); Supervisor role uses codex.
You are a teammate on team `{TEAM}` invoking `/safer:research`.

Sub-issue: {ISSUE_URL}
Parent epic: {PARENT_URL}

Read PRINCIPLES.md and skills/research/SKILL.md at the plugin root.

Acceptance: {ACCEPTANCE}

Run an iterative hypothesis loop; post one comment per iteration on the
sub-issue as your research ledger. Produce no code. The Supervisor role
for each round is codex (run /codex --mode supervisor on the Researcher
output before advancing to the next round). If /codex is unavailable,
log the skip and continue with the internal Supervisor turn. Status marker
+ SendMessage the team lead with the ledger URL when the loop converges
or the budget runs out.
```

#### spec

```
source: orchestrate-auto-dispatch
Dispatch with: `model: opus` per orchestrate Model routing table.
You are a teammate on team `{TEAM}` invoking `/safer:spec`.

Sub-issue: {ISSUE_URL}
Parent epic: {PARENT_URL}

Read PRINCIPLES.md and skills/spec/SKILL.md at the plugin root.

Acceptance: {ACCEPTANCE}

Produce a spec with goals, non-goals, invariants, and explicit acceptance
criteria. No architecture, no libraries, no code. Publish as a comment on
the parent epic (or sub-issue body per the skill's publication rule).
After publishing, run /codex --mode review on the published artifact. The
codex verdict must be `approve` before transitioning to `review`. If
`changes-requested`, revise and re-run (one revision round). If `reject`,
escalate to the user with codex's reasoning. If /codex is unavailable, log
the skip and transition to `review` without the codex pass.
Transition the sub-issue to `review`. Status marker + SendMessage the
team lead with the spec URL.
```

Templates are intentionally terse. They do not replicate the full modality charter; they point the teammate at `SKILL.md` and carry the scope contract that differs per modality. If a template grows beyond ~25 lines, the modality has shifted; revisit the template rather than expanding it in-place.

### Phase 6 — Backtrack

When a sub-task reports `ESCALATED` / `BLOCKED` / `NEEDS_CONTEXT`, do not rescue. Read the escalation artifact, classify the cause, and route:

| Cause | Route |
|---|---|
| Spec ambiguity | New `spec` sub-task, OR revise existing spec sub-task. Blocked sub-task waits. |
| Architecture mismatch | New `architect` sub-task. Blocked sub-task waits. |
| Scope miscalibration (modality too tight) | Relabel blocked sub-task to next-tier modality. Reopen it in `planning`. |
| Scope miscalibration (modality too loose) | Split blocked sub-task into two, each correctly scoped. |
| External dependency | Comment on the parent epic with the blocker. Post `NEEDS_CONTEXT` to the user. |
| Research gap | New `research` or `spike` sub-task. Blocked sub-task waits. |
| Duplicate sub-task discovered | Close the duplicate with a cross-link. |

Update the decomposition table on the parent epic to reflect the re-triage. Emit `safer.modality_handoff` with the cause.

**Three-strikes rule.** If a single sub-task has been re-triaged **3 times without reaching `done`**, the project is mis-scoped. Stop and escalate to the user via the Confusion Protocol (below). Do not attempt a fourth triage.

### Phase 7 — Close out

When every sub-issue is in state `done` or `abandoned`:

1. **Cancel the auto-monitor loop.** If Step 5d installed a cron, run `CronDelete({ jobId: "<id>" })` now. Session-only jobs expire after 7d on their own, but an epic that closes early should not leave the loop polling a done project.
2. Run `safer-vp 7d` (or the appropriate window) — this produces a markdown dashboard with modality funnel, calibration, scope reverts, stop-rule fires, per-sub-task latency.
3. Post the dashboard as a comment on the parent epic.
4. Transition the parent from `triaged` to `completed`; close the issue.
5. Emit the final telemetry event:

```bash
safer-telemetry-log --event-type safer.skill_end \
  --modality orchestrate --session "$SESSION" \
  --outcome success --duration-s "$(($(date +%s) - $_TEL_START))" 2>/dev/null || true
```

6. Report status `DONE` to the caller.

---

## Stop rules

Orchestrate has five stop rules. Each fires on a specific condition; each requires an escalation artifact via `safer-escalate --from orchestrate --to <target> --cause <CAUSE>`.

1. **Under-specified intent.** The intent is so vague that decomposition would be guessing. → Create a `spec` sub-task first; do not attempt further decomposition until the spec is `done`. Status: `NEEDS_CONTEXT`.
2. **Circular dependency.** Two sub-tasks mutually depend on each other. → The decomposition is wrong. Re-decompose. Status: internal; do not publish.
3. **Three-strikes triage.** A sub-task has been re-triaged 3 times. → Project is mis-scoped. Status: `BLOCKED` to user with what was learned.
4. **Missing modality.** You classified a sub-task into a modality that does not exist in the catalog. → Either the catalog is incomplete or your classification is wrong. Status: `NEEDS_CONTEXT` to user.
5. **Implementation instinct.** You notice yourself about to write code. → This is the Iron Law firing. Stop; re-classify the current sub-task. Status: internal; abort the current action.

---

## Confusion Protocol

Orchestrate is a low-ambiguity skill. When ambiguity arises, it is usually about scope. Stop and ask. Never guess when the guess would change the decomposition.

Triggers:
- Two plausible decompositions with different modality sets.
- A sub-task that could be junior OR senior depending on a detail you don't know.
- An intent that could be one modality or three, depending on user preference.
- A destructive operation in a sub-task's acceptance criteria (dropping a table, deleting a branch, force-pushing) where the scope is unclear.

Format:

```
STATUS: NEEDS_CONTEXT
AMBIGUITY: <one sentence>
OPTIONS:
  A) <option A, with tradeoff>
  B) <option B, with tradeoff>
  (C) <option C if relevant>
RECOMMENDATION: <A|B|C>, because <reason>. Confidence: <LOW|MED|HIGH>.
```

Then `AskUserQuestion`. Do not proceed until the user answers.

---

## Completion status

Your final output to the caller carries exactly one status marker. No orchestration run ends without one.

- `DONE` — every sub-issue is `done`; parent epic is closed; VP dashboard posted.
- `DONE_WITH_CONCERNS` — sub-issues closed but at least one carried `DONE_WITH_CONCERNS`; list each.
- `ESCALATED` — a sub-task escalated and orchestrate cannot unblock without user input.
- `BLOCKED` — external dependency; name it.
- `NEEDS_CONTEXT` — user-resolvable ambiguity; state the question.

---

## Escalation artifact template

Emit via `safer-escalate`. Populate from structured inputs; do not freehand this.

```markdown
# Escalation from orchestrate

**Status:** <ESCALATED|BLOCKED|NEEDS_CONTEXT>

**Cause:** <one line>

## Context
- Parent epic: #<N>
- Current sub-task: #<M> (modality: <X>, state: <Y>)
- Artifact(s): <URLs>

## What was attempted
- <bullet>
- <bullet>

## What blocked progress
- <bullet>

## Recommended next action
- <one action the user or upstream modality can take>

## Confidence
<LOW|MED|HIGH> — <evidence>
```

Post the artifact as a comment on the blocked sub-issue and cross-link on the parent epic.

---

## Publication map

| Artifact | Destination | Label |
|---|---|---|
| Parent epic | GitHub issue (this repo) | `triaged` |
| Sub-issues | GitHub issues (this repo) | `safer:<modality>,planning` |
| Progress updates | Comments on sub-issues | — |
| State transitions | Label changes via `safer-transition-label` | — |
| Escalation artifacts | Comments on blocked sub-issues | — |
| Final VP dashboard | Comment on parent epic | — |

Nothing orchestrate produces lives outside GitHub (see Artifact discipline → GitHub is the record).

---

## Anti-patterns (orchestrate-specific)

- **"I'll just implement this last sub-task myself since everything else is done."** → Iron Law violation. Dispatch the sub-task.
- **"The modality is blocked; let me fix its escalation artifact."** → Ratchet violation. You route; you do not produce.
- **"The sub-task is 90% there; I'll do the last 10% to save time."** → This is the failure mode the Iron Law exists to prevent.
- **"Two sub-tasks can be merged to save an issue."** → Merging discards the dependency signal. Keep them separate.
- **"The plan is fine in my head; I don't need to publish the epic yet."** → Paper Trail violation. Publish before dispatching.
- **"I'll skip the VP dashboard; the user can see the PRs."** → No. The dashboard is how the pipeline proves itself healthy.
- **"The user wants it fast; I'll skip the spec sub-task."** → Three-strikes rule will find you within 2 re-triages. Do the spec.
- **"This is the same sub-task that escalated last week; I'll just run it again."** → Re-triage. Something is structurally different; find it.

---

## Checklist before declaring `DONE`

- [ ] Every sub-issue is in state `done` or `abandoned`.
- [ ] Parent epic is closed.
- [ ] VP dashboard posted to the parent epic.
- [ ] `safer.skill_end` event emitted with final outcome.
- [ ] No open sub-issue is in a non-terminal state.
- [ ] Decomposition table on the parent epic reflects the final sub-issue numbers.
- [ ] No orchestrate-authored code exists anywhere in the diff (verify via `gh pr list --author @me` during this session).

If any box is unchecked, the status is not `DONE`.

---

## Voice (reminder)

See PRINCIPLES.md → Voice. Short paragraphs. Concrete specifics. No AI filler. No em-dashes. Direct quality judgments. End with what to do.

The next agent reading your decomposition is a junior. Write the decomposition so they can execute their sub-task without asking you clarifying questions. That is the Cold Start Test applied to orchestration.
