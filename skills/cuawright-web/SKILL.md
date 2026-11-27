---
name: cuawright-web
description: Solve a web task code-as-action style by driving a local Playwright browser from the shell one command at a time, keeping plan.md, final_runs/run_<id>/ scripts, screenshots and an action log in the workspace, then visually verifying every critical point against the saved PNGs.
whenToUse: The user asks to automate a browser task (search, filter, form fill, multi-step flow, data extraction, price or availability lookup) and wants reusable Playwright scripts plus screenshot evidence instead of a one-shot answer.
---

# CUAWright browser skill (DeepSeek Harness)

This is the CUAWright (formerly Webwright) browser workflow, ported from the
Claude Code / Codex plugin to DeepSeek Harness. The workspace contract is
unchanged; only the tool names and the script-launch pattern changed.

Upstream, CUAWright is an LLM loop that emits one JSON-wrapped `bash_command`
per turn against a terminal plus a Playwright workspace. **Here you replace
that loop directly.** Run one shell command per step, read its output, then
decide the next step. Do not wrap commands in JSON — that constraint only
existed because the original harness parsed model output.

The OpenAI-backed `image_qa` and `self_reflection` tools are replaced by your
own abilities: inspect PNG screenshots with the `read` tool and verify success
against `plan.md`. No model API key is needed.

## Tool mapping

| Upstream (Claude Code / Codex) | Here |
|---|---|
| `Bash` | `pwsh` (Windows) or `bash` |
| `Read` (PNG or text) | `read` |
| `Write` | `write` |
| `Edit` | `edit` |
| `/cuawright:run <task>` | a plain prompt — one-shot mode |
| `/cuawright:craft <task>` | "make it a reusable CLI" — parameterized mode |

One upstream pattern does not survive the move: `python - <<'PY' … PY`
heredocs are not portable to PowerShell. Write the script to a file with
`write`, then run `python path\to\script.py` with `pwsh`. Keep one script per
exploration step (`explore_1.py`, `explore_2.py`, …) so each command stays a
single observable step.

## Modes

- **Default (one-shot).** `final_script.py` solves the task for the literal
  values the user gave. Triggered by a plain prompt.
- **CLI tool (parameterized).** `final_script.py` is a reusable CLI — one
  function with a Google-style `Args:` docstring plus an `argparse` wrapper
  whose flags default to the concrete task values, so the user can rerun it
  with different arguments. Triggered by "make it reusable", "parameterize",
  "turn this into a CLI". See `reference/cli_tool_mode.md`.

## Prerequisites (one time)

```pwsh
python -m pip install playwright
python -m playwright install chromium
```

Chromium is the engine to use on this machine. Install Firefox as well
(`python -m playwright install firefox`) only when a site refuses Chromium — see
the engine note below.

Playwright is the only hard dependency. The `cuawright` Python package is
optional — install it with `python -m pip install -e {{CUAWRIGHT_ROOT}}` only
when the user wants the `cuawright-web` CLI loop instead of this skill.

**Console encoding.** A Windows console defaults to a legacy code page, so
printing an `aria_snapshot()` that contains non-ASCII text raises
`UnicodeEncodeError` and kills the script. Set `$env:PYTHONIOENCODING = "utf-8"`
in the shell call, or add `sys.stdout.reconfigure(encoding="utf-8",
errors="replace")` at the top of every script.

## Workspace contract

Mirror what `src/cuawright/webwright/config/base.yaml` requires:

- Pick a `WORKSPACE_DIR` (for example `outputs/<task_id>/`) and work **only**
  there. Keep all generated code, screenshots, logs and notes inside it.
- The required final artifact is `WORKSPACE_DIR/final_script.py`.
- Every clean execution of the final script lives in its own
  `final_runs/run_<id>/` folder, where `<id>` is an integer higher than any
  existing `run_*` folder.
- Inside each run folder:
  - `final_runs/run_<id>/final_script.py`
  - `final_runs/run_<id>/screenshots/final_execution_<step>_<action>.png`
  - `final_runs/run_<id>/final_script_log.txt` — reset at the start of each
    clean run; one `step <n> action: <reason and action>` line per
    constraint-relevant interaction; the final datum (price, code, winner,
    quote, …) printed at the end.
- Browser mode is **local**: every run launches a fresh headless engine and the
  script reconstructs state from scratch. There is no persistent browser state.
- **Engine.** Use `playwright.chromium.launch(headless=True)`. If a site answers
  `ERR_HTTP2_PROTOCOL_ERROR` or an Access Denied page that Chromium cannot pass
  (TLS/H2 fingerprinting, common on Akamai-protected sites), switch that script
  to `playwright.firefox.launch(headless=True)` after
  `python -m playwright install firefox`. Record the switch in the action log
  rather than silently retrying.
- **Always use `viewport={"width": 1280, "height": 1800}`. Never call
  `page.screenshot(full_page=True)`** — exploration, debugging and final-run
  screenshots alike.

## Workflow

1. **Plan.** Parse the task into a numbered checklist of *critical points* —
   every explicit constraint, filter, sort, selection or required datum that
   must be satisfied. Write it to `WORKSPACE_DIR/plan.md`:

   ```markdown
   # Critical Points
   - [ ] CP1: <description>
   - [ ] CP2: <description>
   ```

   Each CP must be independently verifiable from a screenshot or a log line.

2. **Explore.** Write scratch Playwright scripts (see
   `reference/playwright_patterns.md`) and run them one at a time to discover
   stable selectors and confirm the filter controls exist. Use `read` on the
   saved PNGs to inspect UI state. Print the URL, title, visible labels and an
   `aria_snapshot()` of the region you care about for every step.

3. **Author `final_script.py`** in a fresh `final_runs/run_<id>/`. Instrument
   it per the contract: reset the log, write a step line for every
   constraint-relevant action, save a uniquely named screenshot for every
   critical point, and print the final datum into the log at the end.

4. **Execute** the final script once and capture stdout/stderr.

5. **Self-verify** (this replaces `cuawright.webwright.tools.self_reflection`).
   Walk `plan.md`:
   - For each CP, identify a screenshot path and/or a log line that proves it.
     `read` each cited PNG and confirm the evidence is unambiguous — the
     filter chip is visible, the date matches exactly, the result list reflects
     the constraint.
   - Tick the CP only when the evidence is concrete. Be harsh with ambiguous,
     occluded or partially applied states.
   - If any CP fails, diagnose the specific issue (wrong filter value, missing
     control, selection hidden after the drawer closed, broadened range,
     missing confirmation, missing screenshot). Fix `final_script.py`, re-run
     inside `final_runs/run_<id+1>/`, and re-verify.

6. **Done.** Only when every CP in `plan.md` is checked off with cited
   evidence. Report the final datum to the user.

## Hard rules

- One shell command per step; observe its output before issuing the next.
- Use stable selectors and current-run evidence — never guess UI state.
- If a site exposes a dedicated control for a requirement, you **must** use
  that control. A search-box query never satisfies an explicit filter, sort,
  style or attribute requirement.
- Ranking language (`cheapest`, `best-selling`, `most-reviewed`,
  `highest-rated`, `lowest`, `latest`) must be grounded in the site's actual
  sort or filter — not in your own ordering of results.
- Numeric, date, quantity and unit constraints are **exact**. Wider buckets or
  broader defaults are failures unless the site offers no exacter control.
- If a selected state becomes hidden after a drawer, accordion, modal or
  dropdown closes, reopen it or capture a visible chip or summary before
  treating the state as verified.
- Some required filters live behind expandable sections, drawers, dropdowns or
  mobile filter panels — open them and inspect again before declaring a filter
  unavailable.
- For blocker claims (Access Denied, unavailable controls), stop only after
  repeated evidence from the actual site UI.
- If the task asks for a final datum, state it explicitly to the user **and**
  append it to `final_script_log.txt`.
- Do not install extra packages with pip or apt. `playwright` is already
  installed; add nothing else unless the user asks.
- Once `final_script.py` exists, prefer incremental `edit` calls over rewriting
  the whole file.

## Reference files

- `reference/playwright_patterns.md` — browser-launch skeleton, ARIA snapshot
  recipes, screenshot naming, log format, instrumentation template.
- `reference/workflow.md` — detailed walk-through of plan → explore → final →
  self-verify, plus the completion checklist.
- `reference/cli_tool_mode.md` — contract for CLI tool mode (`# Parameters`
  table, reusable function plus argparse, import safety, `step 0 params:` log
  line, completion gate).
