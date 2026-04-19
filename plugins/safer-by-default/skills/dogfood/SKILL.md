---
name: dogfood
version: 0.1.0
description: |
  Read any published artifact (spec, design doc, PR body, issue comment,
  investigation writeup) with NO prior session context and report on how a
  cold-start consumer would feel picking it up. Scores four numeric axes
  (clarity, completeness, actionability, trust) plus a friction list with
  evidence, emits a SHIP / REVISE / REJECT verdict, and publishes the report
  back to the artifact's GitHub thread. Use when an artifact is about to be
  handed off and you want a portability check before the next modality runs.
  Do NOT use to rewrite the artifact; this is a reading modality, not a
  writing one.
triggers:
  - dogfood this artifact
  - cold start check
  - can a fresh reader act on this
  - portability check
  - is this publishable
  - read this like you have never seen it
  - consumer check the spec
  - cold read my PR
allowed-tools:
  - Bash
  - Read
  - Agent
  - AskUserQuestion
---

# /safer:dogfood

## Read first

Read `PRINCIPLES.md` at the plugin root before invoking this skill. Your projection of the principles onto this modality:

- **Artifact discipline to Cold Start Test** is the doctrine this skill enforces. Every other modality is supposed to write for the cold-start reader. Dogfood is the check. If the artifact fails here, the upstream modality shipped debt.
- **The debt multiplier** is why this exists. A confusing artifact caught in the same session is 1x; the same confusion caught by the next agent is 3 to 5x; the same confusion caught a quarter later is 30 to 50x. Dogfood lives in row 1 of that table.
- **Principle 5 (Junior Dev Rule)** the skill reads; it does not revise. The upstream author revises. Routing a fix is forward, not sideways.
- **Principle 7 (Brake)** the subagent stops the moment it notices prior context is leaking. That leak is the bug the skill is looking for.
- **Artifact discipline to GitHub is the record** the report is published on the artifact's own thread (issue or PR). A dogfood report kept in local scratch is not a dogfood report.

## Iron rule

> **Read the artifact as if you have never seen this project before. Any context borrowed from conversation is a bug in the artifact.**

The enforcement is architectural, not aspirational. You dispatch a subagent via the `Agent` tool with a self-contained prompt: artifact content, rubric, output schema. No session history, no parent epic, no conversation crumbs. If the subagent needs context to act, the artifact did not carry its own weight; that is the finding.

## Role

You are the cold-start consumer. Given an artifact reference (GitHub issue, GitHub PR, or a local markdown file), you:

1. Resolve the artifact to a single self-contained text payload.
2. Spawn a subagent via the `Agent` tool with ONLY that payload, the rubric, and the output schema.
3. Collect the subagent's structured report.
4. Publish the report back to the artifact's thread (or stdout for a local file).
5. Report the verdict to the caller.

You do not rewrite the artifact. You do not open a PR with suggested edits. You do not "help" the author by interpreting what they meant. Every attempt to fill in context is exactly the debt pattern this skill exists to surface.

## Inputs required

- One of: `--issue N`, `--pr N`, or `--file PATH`.
- Optional: `--repo owner/name` to override the current repo.
- `gh` CLI authenticated for `--issue` and `--pr` inputs.
- Read access to the artifact.
- The `Agent` tool available in the running harness.

### Preamble (run first)

```bash
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh not authenticated. Run: gh auth login"; exit 1; }
eval "$(safer-slug 2>/dev/null)" || true
SESSION="$$-$(date +%s)"
_TEL_START=$(date +%s)
safer-telemetry-log --event-type safer.skill_run --modality dogfood --session "$SESSION" 2>/dev/null || true
_UPD=$(safer-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD"
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo unknown/unknown)}"
echo "REPO: $REPO"
echo "SESSION: $SESSION"
```

If the invocation did not specify `--issue`, `--pr`, or `--file`, ask. No artifact means no dogfood.

## Scope

### In scope

- Resolving a GitHub issue body (and optionally its comments) into a text payload.
- Resolving a GitHub PR body plus description into a text payload.
- Reading a local markdown file into a text payload.
- Dispatching the subagent with the self-contained prompt.
- Receiving the subagent's structured report.
- Publishing the report as a comment on the issue or PR via `safer-publish`.
- Printing the report to stdout when the input is a local file.
- Emitting telemetry for the run.

### Forbidden

- Editing the artifact. Dogfood does not patch.
- Opening a PR with suggested rewrites. The upstream modality revises.
- Reading the surrounding project (sibling issues, related docs, source files) to enrich the subagent's context. That leak is the exact bug the skill exists to catch.
- Passing any session history to the subagent. The subagent runs cold.
- Inferring an axis score the subagent did not emit. Scores come from the subagent; the skill only relays and publishes.
- Invoking another modality inline to "just fix the small thing." Route forward; do not sidestep.

## Scope budget

One artifact per invocation. One report per artifact. The report has exactly the sections in the output schema (below). No free-form prose outside those sections.

| Dimension | Rule |
|---|---|
| Artifacts per invocation | 1 |
| Subagent invocations | 1 (re-invoke only on subagent timeout, max 2 total) |
| Axes scored | 5 (clarity, completeness, actionability, trust; friction is a list) |
| Score range | 0 to 10 per axis, integer |
| Verdict options | `SHIP`, `REVISE`, or `REJECT`, exactly one |
| Report destinations | 1 (the artifact's own thread, or stdout for local files) |

If the artifact resolves to more than one document (e.g., an issue with load-bearing comment threads), treat it as one artifact and note in the report that the comments are part of the consumed payload. Do not fan out into multiple subagent invocations.

## Workflow

### Phase 1 - Resolve inputs

Parse the invocation arguments:

```bash
KIND=""
ID=""
FILE_PATH=""
INCLUDE_COMMENTS="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --issue)    KIND="issue"; ID="$2"; shift 2 ;;
    --pr)       KIND="pr"; ID="$2"; shift 2 ;;
    --file)     KIND="file"; FILE_PATH="$2"; shift 2 ;;
    --repo)     REPO="$2"; shift 2 ;;
    --with-comments) INCLUDE_COMMENTS="true"; shift ;;
    *) echo "ERROR: unknown arg: $1"; exit 1 ;;
  esac
done

[ -z "$KIND" ] && { echo "ERROR: one of --issue N, --pr N, --file PATH required"; exit 1; }
```

### Phase 2 - Fetch the artifact payload

Build a single text payload containing every byte a cold-start reader would see.

For `--issue N`:

```bash
PAYLOAD=$(mktemp)
{
  echo "# Artifact: GitHub issue $REPO#$ID"
  echo
  gh issue view "$ID" --repo "$REPO" --json title,body,labels \
    -q '"## Title\n\(.title)\n\n## Labels\n\(.labels | map(.name) | join(", "))\n\n## Body\n\(.body)"'
  if [ "$INCLUDE_COMMENTS" = "true" ]; then
    echo
    echo "## Comments"
    gh issue view "$ID" --repo "$REPO" --json comments \
      -q '.comments[] | "--- comment by \(.author.login) ---\n\(.body)\n"'
  fi
} > "$PAYLOAD"
ARTIFACT_REF="issue #$ID in $REPO"
```

For `--pr N`:

```bash
PAYLOAD=$(mktemp)
{
  echo "# Artifact: GitHub PR $REPO#$ID"
  echo
  gh pr view "$ID" --repo "$REPO" --json title,body,labels \
    -q '"## Title\n\(.title)\n\n## Labels\n\(.labels | map(.name) | join(", "))\n\n## Body\n\(.body)"'
} > "$PAYLOAD"
ARTIFACT_REF="PR #$ID in $REPO"
```

For `--file PATH`:

```bash
[ ! -f "$FILE_PATH" ] && { echo "ERROR: file not found: $FILE_PATH"; exit 1; }
PAYLOAD=$(mktemp)
{
  echo "# Artifact: local file $FILE_PATH"
  echo
  cat "$FILE_PATH"
} > "$PAYLOAD"
ARTIFACT_REF="local file $FILE_PATH"
```

If the resulting payload is empty (the issue has no body, the PR has no description, the file is empty), fire the "artifact is empty" stop rule. Do not dispatch the subagent against nothing.

### Phase 3 - Construct the self-contained prompt

Build the subagent prompt as a single string. It contains ONLY: the artifact payload, the rubric, the output schema. No references to the current session, the parent epic, the user, or any other file in the repo.

```bash
PROMPT=$(mktemp)
cat > "$PROMPT" <<'PROMPT_EOF'
You are a cold-start consumer. You have never seen this project before. You
have no session history, no parent epic, no conversation context. You have
only the artifact below.

Your task: read the artifact, score it on four axes, list friction points,
and emit a verdict in the output schema exactly as specified.

# Rubric

Score each axis 0 to 10, integer. Cite evidence from the artifact for each
score (a quoted phrase or a location reference).

- Clarity - can a cold-start reader understand the artifact without asking
  questions? 10 = unambiguous; 0 = unreadable without a guide.
- Completeness - does the artifact contain every piece of information needed
  to act on it? 10 = self-contained; 0 = missing load-bearing context.
- Actionability - is the next step obvious after reading? 10 = the reader
  knows exactly what to do; 0 = no path forward.
- Trust - are claims supported by evidence the reader can verify? 10 = every
  claim has a receipt; 0 = bare assertions.

Friction is a list, not a score. Each entry names:
- A specific location in the artifact (section, quoted phrase, or line).
- Why a consumer would stumble there.

# Verdict

- SHIP - every axis scores at least 8, AND no friction entry blocks action.
- REVISE - any axis scores 6 or below, OR a friction entry blocks action.
  Name the specific revisions.
- REJECT - clarity or completeness scores 4 or below. Not publishable as-is.

# Output schema

Emit exactly this structure. No preamble. No postscript. No prose outside the
sections.

```markdown
# Dogfood report - <artifact ref>

**Verdict:** `SHIP` | `REVISE` | `REJECT`

## Scores
| Axis | Score | Evidence |
|---|---|---|
| Clarity | N/10 | ... |
| Completeness | N/10 | ... |
| Actionability | N/10 | ... |
| Trust | N/10 | ... |

## Friction log
1. [location] - [why a consumer stumbles]
2. ...

## Recommended revisions
- ...

## Confidence
`LOW` | `MED` | `HIGH`
```

# Stop rules for the subagent

Stop and report if any of the following fires:

1. You notice yourself drawing on context outside the artifact payload. That
   is the iron rule firing; name it in the friction log as "the artifact does
   not carry the context a reader needs."
2. The artifact payload is empty or unparseable. Emit `REJECT` with clarity
   and completeness scored 0; friction log names the emptiness.
3. The artifact refers to a document the payload does not include (e.g.,
   "see the plan" with no plan). Emit `REVISE` or `REJECT` depending on how
   many such references there are; name each one in the friction log.

# The artifact

PROMPT_EOF

cat "$PAYLOAD" >> "$PROMPT"

echo >> "$PROMPT"
echo "Artifact ref for the report title: $ARTIFACT_REF" >> "$PROMPT"
```

Key property: `PROMPT_EOF` is quoted, so the heredoc does not interpolate any local variables. The prompt is literally the rubric plus the payload. Nothing leaks.

### Phase 4 - Dispatch the subagent

Invoke the `Agent` tool with the prompt. The subagent runs cold. The skill waits for its structured report.

Concrete invocation (copy-pasteable — read `$PROMPT` into the `prompt` parameter before calling):

```
Agent(
  description="Dogfood cold-start read",
  subagent_type="general-purpose",
  prompt="<contents of file at $PROMPT, read with the Read tool and inlined here>"
)
```

Mechanics:
1. Read the prompt file into a string: `PROMPT_TEXT=$(cat "$PROMPT")` (or use the Read tool on `$PROMPT`).
2. Pass that string as the `prompt` parameter to a single `Agent` tool call. No other parameters are set; no session history, parent epic, or extra files are attached.
3. The `description` stays generic ("Dogfood cold-start read") so it leaks no project-specific context into the subagent's bootstrap.

The skill's own body never reads `$PAYLOAD` beyond piping it to the prompt file. The subagent is the only reader of the artifact text. That is the architectural enforcement.

Capture the subagent's final reply into `$REPORT_FILE`:

```bash
REPORT_FILE=$(mktemp)
# Write the subagent's final reply (the text returned by the Agent tool call) to $REPORT_FILE.
# The reply should contain the output-schema markdown (either between two fences, or raw).
# Extract the block starting with "# Dogfood report" and write it to $REPORT_FILE.
```

`$REPORT_FILE` is the canonical handle used by Phases 5 and 6. Do not re-read the subagent's reply from memory after this point; Phases 5 and 6 operate on the file.

If the subagent returns something that does not match the schema, re-invoke once with a reminder: "Your previous reply did not match the output schema. Emit only the schema block, no prose around it." Do not re-invoke more than once; two failed schema attempts is a "subagent could not produce a valid report" signal and escalates.

### Phase 5 - Validate the report

Mechanical checks on the subagent's reply:

- Report starts with `# Dogfood report - `.
- Verdict line contains exactly one of `SHIP`, `REVISE`, `REJECT`.
- Scores table has four rows (Clarity, Completeness, Actionability, Trust), each with an integer 0 to 10.
- Friction log has at least one entry (if verdict is `SHIP`, the log may still name minor friction, but SHIP requires no entry that blocks action).
- Confidence line contains exactly one of `LOW`, `MED`, `HIGH`.

If any check fails, re-invoke the subagent once (see Phase 4). If the second attempt also fails, emit the report as-is with a skill-level note that schema validation failed. That is the caller's signal that the subagent struggled; it is not a reason for the skill to rewrite the report.

### Phase 6 - Publish

The destination depends on the input kind:

```bash
case "$KIND" in
  issue)
    URL=$(safer-publish --kind comment --issue "$ID" --repo "$REPO" --body-file "$REPORT_FILE")
    echo "Published: $URL"
    ;;
  pr)
    URL=$(safer-publish --kind comment --pr "$ID" --repo "$REPO" --body-file "$REPORT_FILE")
    echo "Published: $URL"
    ;;
  file)
    cat "$REPORT_FILE"
    if [ -n "${SAFER_PARENT_ISSUE:-}" ]; then
      URL=$(safer-publish --kind comment --issue "$SAFER_PARENT_ISSUE" --repo "$REPO" --body-file "$REPORT_FILE")
      echo "Also published to orchestrator sub-issue: $URL"
    fi
    ;;
esac
```

The `--file` path prints to stdout unconditionally. Optional orchestrator hand-off only happens if `SAFER_PARENT_ISSUE` is set in the environment, which the orchestrator supplies.

> **`SAFER_PARENT_ISSUE`** is set by `/safer:orchestrate` when it invokes this skill as a sub-task; it holds the orchestrator's parent issue number so the dogfood report can be cross-posted there. When dogfood is invoked standalone (not from orchestrate), the variable is empty and the cross-post is skipped.

### Phase 7 - Close out

Emit the end event and report the status marker:

```bash
safer-telemetry-log --event-type safer.skill_end --modality dogfood \
  --session "$SESSION" --outcome success \
  --duration-s "$(($(date +%s) - $_TEL_START))" 2>/dev/null || true
```

Clean up temporary files (`$PAYLOAD`, `$PROMPT`, `$REPORT_FILE`). Report the status based on the verdict:

- Subagent emitted `SHIP`: status `DONE`.
- Subagent emitted `REVISE`: status `DONE_WITH_CONCERNS`. The concerns are the friction log.
- Subagent emitted `REJECT`: status `DONE_WITH_CONCERNS`. The artifact failed dogfood; the caller routes upstream.

## Stop rules

Each stop rule fires on a specific condition. When fired, produce the escalation artifact via `safer-escalate --from dogfood --to <target> --cause <CAUSE>` and stop.

1. **Artifact is empty.** The issue body, PR description, or file is empty or whitespace-only. Status: `BLOCKED`. Cause: `ARTIFACT_EMPTY`. Report to caller: the artifact did not carry text; there is nothing to dogfood.
2. **Artifact is not resolvable.** `gh issue view` or `gh pr view` returns an error, or the file path does not exist. Status: `BLOCKED`. Cause: `ARTIFACT_MISSING`. Include the resolver error in the escalation body.
3. **Subagent reports prior context leak.** The subagent's friction log includes "the artifact does not carry the context a reader needs" or an equivalent. That is the iron rule firing and is a normal `REVISE` or `REJECT` outcome, not an escalation. No stop rule fires; publish the report. Note: `REVISE` and `REJECT` are normal-completion verdicts for this skill — they map to `DONE_WITH_CONCERNS` (see Completion status), not to `ESCALATED`. The dogfood run itself succeeded; the artifact failed the rubric, and the caller routes the artifact back to its upstream author.
4. **Subagent could not produce a valid report.** Two invocations failed schema validation. Status: `ESCALATED`. Cause: `SUBAGENT_SCHEMA_FAILURE`. Attach both attempts to the escalation artifact.
5. **Input argument missing or conflicting.** No `--issue`, `--pr`, or `--file`, or more than one of them set. Status: `NEEDS_CONTEXT`. Cause: `INVALID_INVOCATION`. Ask the caller for a single unambiguous input.
6. **Implementation instinct.** The skill is about to read the artifact's surrounding project to "help the subagent." That is the Brake firing. Stop, discard whatever extra context was gathered, and dispatch the subagent with the original payload only.

## Completion status

Every invocation ends with exactly one status marker on the last line of your reply.

- `DONE` report published; subagent verdict is `SHIP`; no schema validation issues.
- `DONE_WITH_CONCERNS` report published; verdict is `REVISE` or `REJECT`; the concerns are the friction entries named in the report.
- `ESCALATED` stop rule fired (subagent schema failure or analogous); escalation artifact posted.
- `BLOCKED` artifact empty or missing; escalation artifact posted; name the missing piece.
- `NEEDS_CONTEXT` invocation arguments invalid; caller must resupply.

## Escalation artifact template

Emit via `safer-escalate --from dogfood --to <target> --cause <CAUSE>`. Populate from structured inputs; do not freehand this.

```markdown
# Escalation from dogfood

**Status:** <ESCALATED|BLOCKED|NEEDS_CONTEXT>

**Cause:** <one line>

## Context
- Artifact ref: <issue / PR / file path>
- Session: <SESSION>

## What was attempted
- <bullet>
- <bullet>

## What blocked progress
- <bullet>

## Subagent attempts (if applicable)
- Attempt 1: <summary or "schema validation failed">
- Attempt 2: <summary or "schema validation failed">

## Recommended next action
- <one action: revise the artifact, resupply inputs, split the artifact into smaller payloads>

## Confidence
<LOW|MED|HIGH> <evidence>
```

Post as a comment on the artifact's thread when possible; otherwise return the artifact to the caller with the escalation body inline.

## Publication map

| Input | Destination |
|---|---|
| `--issue N` | Comment on issue N via `safer-publish --kind comment --issue N` |
| `--pr N` | Comment on PR N via `safer-publish --kind comment --pr N` |
| `--file PATH` | stdout; optionally also a comment on `SAFER_PARENT_ISSUE` if set |
| Escalation artifact | Comment on the artifact's thread (issue or PR); if `--file` without orchestrator, returned inline to caller |
| Telemetry | `safer.skill_run` at preamble; `safer.skill_end` at close |

Nothing dogfood produces lives outside GitHub unless the input is a local file and no orchestrator parent is set.

## Anti-patterns

- **"Let me pass the parent epic body alongside the artifact so the subagent has context."** Iron rule violation. The subagent runs cold; context is the bug, not the fix.
- **"I'll skim the linked design doc and summarize it in the prompt."** Same violation. If the artifact needs the design doc, the artifact should inline or properly cross-reference it; that is the finding.
- **"The subagent's score feels wrong; I'll bump Clarity from 6 to 8."** No. The subagent is the reader. The skill publishes what the subagent emits.
- **"I'll rewrite the artifact's confusing sentence while I'm here."** Junior Dev Rule violation. Dogfood reads; the upstream author revises.
- **"The artifact is a PR; I'll include the full diff in the payload."** The payload is what a cold-start consumer sees first: title, body, labels. Diffs are a separate modality's input (`review-senior`). Do not over-include.
- **"The subagent did not return a valid schema; I'll write the report myself."** Escalate. The subagent's failure is a signal about the artifact's fit for this rubric; do not paper over it.
- **"I'll run dogfood on three related artifacts at once."** One artifact per invocation. Run the skill three times.
- **"The friction log is one entry; I'll approve SHIP anyway."** SHIP requires no friction entry that blocks action. Minor friction is fine; action-blocking friction is `REVISE` regardless of the score table.

## Checklist before declaring status

- [ ] Exactly one input kind resolved (`--issue`, `--pr`, or `--file`).
- [ ] Artifact payload is non-empty.
- [ ] Subagent prompt was built from the payload, the rubric, and the output schema only. No session context leaked.
- [ ] Subagent was invoked via the `Agent` tool.
- [ ] Subagent's reply was validated against the output schema.
- [ ] Verdict is one of `SHIP`, `REVISE`, `REJECT`.
- [ ] Scores table has four rows, each with an integer 0 to 10 and evidence.
- [ ] Friction log has at least one entry (may be "no action-blocking friction observed" for SHIP).
- [ ] Confidence is `LOW`, `MED`, or `HIGH`.
- [ ] Report published to the correct destination per the publication map.
- [ ] `safer.skill_end` event emitted.
- [ ] Status marker on the last line of the reply.

If any box is unchecked, the status is not final; reopen the phase.

## Communication discipline

Before you post a status marker or close your turn, **SendMessage to `team-lead` immediately** with a one-line summary and the artifact URL. The team-lead is coordinating other teammates and cannot gate your handoff until it receives a push notification. Do not make the team-lead poll.

```
SendMessage({
  to: "team-lead",
  summary: "<3-8 word summary>",
  message: "STATUS: DONE. Artifact: <URL>. Next: <modality or handoff>."
})
```

Emit the `SendMessage` before your final-reply output. The final reply is for the harness; the `SendMessage` is for the team-lead who dispatched you.

If you were invoked outside an orchestrate context (no team), skip this step.


## Voice (reminder)

See `PRINCIPLES.md`, Voice section. The subagent's report is terse, concrete, and evidence-first. Every score is a number with a quoted phrase or a location. Every friction entry is a specific location and a specific reason. No "this might be improved by," no "I think the clarity could be higher."

The next agent reading this report is the upstream modality's author, revising. They need to know where to cut and what to add, not to be flattered about what worked. The author is a junior; write for them.
