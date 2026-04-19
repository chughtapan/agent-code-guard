---
name: spike
version: 0.1.0
description: |
  Answer one specific feasibility question with throwaway code and a go/no-go
  verdict. Use when the user asks "can we X?", "is Y tractable?", or "does this
  library actually do what it claims?". The output is a written verdict with
  evidence, not production code. Do NOT use when the question is open-ended
  (route to /safer:research) or when the implementation path is already known
  (go straight to spec + architect + implement).
triggers:
  - can we do this
  - is this feasible
  - spike on
  - prove out
  - quick proof of concept
  - does this library work
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

# /safer:spike

## Read first

Read `PRINCIPLES.md` at the plugin root. This skill is the projection of the principles onto **feasibility code**. Specifically:

- **Principles 1 to 4 (craft) are SUSPENDED for spike code itself.** The code is throwaway. Writing `async`/`await`, `throw new Error`, `as Record<string, unknown>`, and bare `try`/`catch` is explicitly allowed inside a spike branch. The suspension is the whole point of the modality: you buy speed by promising never to ship the code.
- **Principle 5 (Junior Dev Rule) still applies.** You answer the question you were given. You do not answer a neighboring question because the code is right there.
- **Principle 6 (Budget Gate) still applies.** Time box is a budget. If the box runs out before the verdict, the absence of a verdict is itself the verdict.
- **Principle 7 (Brake) still applies.** When the iron rule below fires, stop. Do not "clean up" the spike into something shippable.
- **Principle 8 (Ratchet) still applies.** If the spike is green, escalate to `architect` or `spec`. Never graduate the spike code itself into `implement-*`.

## Iron rule

> **Spike code is throwaway. The moment it starts looking shippable, your stop rule has fired. If the spike is green, escalate to architect or spec. Never to implement.**

Shippable-looking spike code is worse than bad spike code. Shippable-looking code invites reuse. Reuse of spike code imports every corner the spike cut. The whole value of the modality is that the suspension of craft is paid back by not shipping the code. Ship the verdict, delete the code.

## Role

You take one specific yes/no question and produce two things: a verdict, and the evidence that supports it. The code is evidence. The code is not the output.

Concretely, you:

1. Frame the question as a precise yes/no with a clear passing condition.
2. Write the cheapest code that would distinguish yes from no.
3. Run it. Capture the output.
4. Name the verdict: GO, NO-GO, or MIXED with specific conditions.
5. Write the graduation plan: what modality picks this up, and what (if anything) of the spike is salvageable.
6. Publish the writeup to GitHub. Leave the branch unmerged.

You do not ship the spike code. You do not polish it. You do not write tests for it. You do not type it carefully.

## Inputs required

- One specific yes/no question. If the user gave you two questions, split them first and confirm which one this spike answers.
- A time budget. Default: 60 to 120 minutes of agent time. State the budget up front.
- The expected artifact: a verdict (GO / NO-GO / MIXED) plus evidence.

### Preamble (run first)

```bash
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh not authenticated. Run: gh auth login"; exit 1; }
eval "$(safer-slug 2>/dev/null)" || true
SESSION="$$-$(date +%s)"
_TEL_START=$(date +%s)
safer-telemetry-log --event-type safer.skill_run --modality spike --session "$SESSION" 2>/dev/null || true
_UPD=$(safer-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD"
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "unknown/unknown")
BASE=$(git branch --show-current 2>/dev/null || echo "main")
echo "REPO:    $REPO"
echo "BASE:    $BASE"
echo "SESSION: $SESSION"
```

If any `safer-*` binary is missing, continue. Telemetry is optional plumbing. The verdict stands without it.

## Scope

**In scope:**
- One specific yes/no question with a clear passing condition.
- Writing code on a dedicated branch named `spike/<slug>`.
- Running the code and capturing evidence: stdout, latency numbers, compiler output, exit codes.
- Producing a written verdict with confidence level.
- Writing a graduation plan naming the next modality.
- Publishing the verdict as a GitHub issue labeled `safer:spike`.

**Forbidden:**
- Merging the spike branch. It stays unmerged and can be deleted after the verdict is published.
- Writing tests for spike code. The code either answers the question or it does not.
- Refactoring the spike code toward production shape. That is a separate modality.
- Answering a second question "while you are at it." One spike, one question.
- Using the spike code as the implementation. The graduation plan names a fresh implementation.
- Making production commits to the base branch during the spike. The spike branch is isolated.

## Scope budget

- **One branch.** Named `spike/<slug>`. Never merged.
- **One question.** If you discover a second question mid-spike, that is a stop rule. Escalate.
- **One time box.** Default 60 to 120 minutes. When the box runs out without a verdict, emit `NO-GO` with evidence naming what was not resolved.
- **Craft principles suspended inside the branch.** Inside `spike/<slug>`, `async`/`await`, untyped throws, and `as unknown as X` are allowed. Elsewhere they remain forbidden. The branch is the boundary.
- **The writeup is the output.** Code length is irrelevant. Writeup length is bounded by evidence, not by scope.

## Workflow

### Phase 1: Frame the question

Before writing any code, write down the question. One sentence. Yes/no.

Bad: "Can we use library X?"
Good: "Can we insert 10,000 rows per second into a SQLite database using `better-sqlite3`'s prepared-statement API on the target hardware?"

The question must name:
1. The operation being probed.
2. The passing condition. What value of what measurement means yes?
3. The environment. What hardware, what version, what configuration.

If any of those three is vague, ask the user via `AskUserQuestion` before starting.

### Phase 2: Design the minimum proof

Ask: what is the cheapest code that would resolve the question?

Strip everything that is not the question. No logging framework. No config file. No database pool. No error taxonomy. No modules, no interfaces, no abstractions. If the question is about insert throughput, the entire spike is one file: open the db, prepare the statement, loop, measure.

Write the design as a three-line plan:
```
Probe:  what operation
Knobs:  what varies (batch size, concurrency)
Check:  how we know the answer (metric + threshold)
```

### Phase 3: Write the code

Create the branch and scratch directory:

```bash
SLUG="<short-hyphenated-name>"
git checkout -b "spike/$SLUG"
mkdir -p "spike/$SLUG"
```

All spike code lives in `spike/$SLUG/`. Do not modify code outside that directory. The directory is the blast radius.

Inside the directory, write code at whatever quality answers the question fastest. `any` is fine. `async`/`await` is fine. `console.log` is fine. `throw new Error("nope")` is fine. This is the payment the modality makes for speed.

### Phase 4: Collect evidence

Run the code. Capture output to a file:

```bash
cd "spike/$SLUG"
<run command> 2>&1 | tee evidence.txt
```

If the probe has multiple knobs, run it across the knob grid and record all results. A MIXED verdict is often more useful than a forced binary.

Capture:
- The exact command run.
- stdout and stderr.
- Wall-clock time for the interesting operation.
- Any error messages or stack traces.
- The environment: node/bun version, OS, machine specs if they are load-bearing.

### Phase 5: Name the verdict

Choose one:

- **GO.** The question passes under the stated conditions. Confidence: LOW / MED / HIGH. Evidence attached.
- **NO-GO.** The question fails under the stated conditions. Confidence: LOW / MED / HIGH. Evidence attached.
- **MIXED.** Passes under some conditions, fails under others. Spell out each.

Confidence calibration (from PRINCIPLES.md):
- HIGH: the probe ran cleanly, the result is reproducible, there is no ambiguity in the measurement.
- MED: the probe ran but some parameter (hardware, version, config) makes the result only indicative.
- LOW: the probe ran, but the measurement leaves the question partly open.

A HIGH verdict on a NO-GO is just as valuable as a HIGH verdict on a GO. "We proved this does not work" ends a class of future debate.

### Phase 6: Write the graduation plan

If GO: name the next modality and scope.

```
Next modality: spec  (because the architecture question is now open)
Scope:         define acceptance criteria for production insert path
Salvageable:   the benchmark script can become the integration-test smoke check
Discardable:   everything else in spike/<slug>/
```

If NO-GO: name what the verdict rules out and what remains open.

```
Ruled out: better-sqlite3 for this workload at this hardware
Remaining: (a) different library, (b) different hardware, (c) different workload shape
Next modality: research, to survey candidates (a) and (c)
```

If MIXED: name each branch explicitly with its own next step.

Usually the salvageable fraction of the spike code is zero or one small script. Say so honestly. "Nothing in this branch is salvageable" is a legitimate entry.

### Phase 7: Publish

Write the verdict to a file and publish as a GitHub issue:

```bash
TMP=$(mktemp)
cat > "$TMP" <<EOF
# Spike: <question>

## Question
<one-sentence yes/no>

## Approach
<what the probe did>

## Evidence
\`\`\`
<key lines from evidence.txt>
\`\`\`
(Full output: spike/<slug>/evidence.txt on branch spike/<slug>.)

## Verdict
<GO | NO-GO | MIXED> ; Confidence: <LOW | MED | HIGH>

## Graduation plan
- Next modality: <spec | architect | research | none>
- Salvageable from this branch: <named files or "nothing">
- Discardable: <branch may be deleted>

## Session
$SESSION
EOF

URL=$(safer-publish --kind issue \
  --title "[safer:spike] <short framing>" \
  --body-file "$TMP" \
  --labels "safer:spike,done")
echo "Spike writeup: $URL"
rm -f "$TMP"

safer-telemetry-log --event-type safer.skill_end --modality spike \
  --session "$SESSION" --outcome success \
  --duration-s "$(($(date +%s) - _TEL_START))" 2>/dev/null || true
```

Leave the spike branch unmerged. The branch is evidence, not code.

Optional cleanup: after the verdict is accepted and the graduation plan has picked the work up, delete the branch.

## Stop rules

Each stop rule ends with an escalation artifact via `safer-escalate --from spike --to <target> --cause <CAUSE>`.

1. **Spike code starts looking shippable.** You notice the code has types, has tests, or reads like production. This is the iron rule. Stop. Do not polish. Publish whatever verdict you have with current evidence. Target: `orchestrate` if one is running, otherwise user.
2. **Time box exceeded without an answer.** The budget ran out. This is itself the verdict: emit `NO-GO` with cause "time box exceeded; probe did not resolve within budget". Target: user.
3. **The question turned out to be two questions.** You discovered the original framing contained a hidden disjunction. Stop, do not keep going. Emit `ESCALATED` to `orchestrate` or user for decomposition. Target: `orchestrate` or user.
4. **Graduation attempted silently.** You catch yourself copying spike code into production paths. The ratchet requires explicit handoff. Stop. Emit `ESCALATED` and let the next modality start fresh. Target: `orchestrate` or user.
5. **The probe needs production credentials, data, or infrastructure you do not have.** Do not fake. Emit `BLOCKED`, name the missing resource. Target: user.

## Completion status

Your final output carries exactly one status marker on the last line.

- `DONE` ; verdict published, graduation plan named, branch exists and is unmerged. Verdict is one of GO / NO-GO / MIXED with confidence stated.
- `DONE_WITH_CONCERNS` ; verdict published, but one or more knobs in the probe were not exhausted; list each.
- `ESCALATED` ; a stop rule fired (iron rule, two-question discovery, or silent graduation). Escalation artifact published.
- `BLOCKED` ; external dependency missing. State what is needed.
- `NEEDS_CONTEXT` ; the question as stated cannot be probed without user clarification. State the clarification needed.

## Escalation artifact template

Emit via `safer-escalate --from spike --to <target> --cause <CAUSE>`.

```markdown
# Escalation from spike

**Status:** <ESCALATED | BLOCKED | NEEDS_CONTEXT>

**Cause:** <one line>

## Context
- Spike issue: #<N>
- Spike branch: `spike/<slug>`
- Question (as framed): <one sentence>
- Time budget: <N min>
- Time consumed: <M min>

## What was attempted
- <bullet>
- <bullet>

## What blocked progress
- <bullet>

## Evidence collected so far
<path to evidence.txt on the spike branch, or inline snippet>

## Recommended next action
- <one action the target can take>

## Confidence
<LOW | MED | HIGH> ; <evidence>
```

Post the artifact as a comment on the spike issue. If operating under `orchestrate`, also cross-link on the parent epic.

## Publication map

| Artifact | Destination | Label |
|---|---|---|
| Verdict writeup | New GitHub issue | `safer:spike,done` |
| Evidence log | File on `spike/<slug>` branch, referenced from issue body | not applicable |
| Graduation plan | Section in the spike issue body | not applicable |
| Escalation artifact | Comment on the spike issue | not applicable |
| Code | Branch `spike/<slug>`, unmerged | not applicable |

The branch is not a PR. Do not open a PR. PRs signal intent to merge; spike branches never merge.

## Anti-patterns

- **"The spike works, so I will clean it up into the real implementation."** Iron rule violation. The spike branch never ships. A fresh implementation picks up the graduation plan.
- **"I will add one test to make the spike robust."** No. Suspension of craft is the modality's payment. A test signals you think this code will live. It will not.
- **"The question is a little fuzzy, I will figure it out as I code."** Phase 1 violation. A fuzzy question produces a fuzzy verdict. Framing is upstream of code.
- **"I hit an adjacent question, so I answered it too."** Junior Dev Rule violation. One question per spike. File the second question separately.
- **"The time box ran out but I am almost there; one more hour."** Stop rule 2. The box is literal. "Almost there" after the box is `NO-GO`.
- **"The verdict is probably GO, confidence HIGH."** "Probably" and "HIGH" cannot coexist. Re-rate.
- **"I will delete the branch before publishing the verdict."** No. The branch is evidence. Delete after the verdict is published and accepted.
- **"I will skip the graduation plan; it is obvious."** No. Obvious graduation plans take one sentence. Missing graduation plans produce quiet defaults.

## Checklist before declaring `DONE`

- [ ] Question is written down as one yes/no sentence.
- [ ] Branch `spike/<slug>` exists, holds all spike code, and is unmerged.
- [ ] `spike/<slug>/evidence.txt` exists with the probe's output.
- [ ] Verdict is one of GO / NO-GO / MIXED with a stated confidence level.
- [ ] Graduation plan names the next modality and names what is salvageable.
- [ ] Spike issue labeled `safer:spike,done` is published.
- [ ] `safer.skill_end` event emitted.
- [ ] Status marker is the last line of the reply to the caller.

If any box is unchecked, the status is not `DONE`.

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

See `PRINCIPLES.md` voice section. The verdict is terse. Numbers over adjectives. The evidence block speaks for the code. No AI filler. End with the status marker.

The next agent reading the spike issue is deciding whether to act on the graduation plan. Write for that reader. They will not read the code. They will read the verdict.
