---
name: cuawright-desktop
description: Run a CUAWright desktop task in the pinned OSWorld-V2 Ubuntu Docker VM through the cuawright desktop CLI, covering setup and verification, custom instructions, official scored reproductions, credentials and proxy files, and the manifest, trace and result artifacts a run leaves behind.
whenToUse: The user wants to automate a desktop application inside a VM (GUI file editing, office apps, CAD, OS settings), reproduce an OSWorld-V2 benchmark task with a score, or debug a cuawright desktop setup, credential or proxy problem.
---

# CUAWright desktop skill (DeepSeek Harness)

Desktop execution uses the pinned OSWorld-V2 Ubuntu Docker VM and a persistent
terminal Actor. The browser runtime (`cuawright.webwright`) and the desktop
runtime (`cuawright.desktop`) do not share their loops, messages, compaction or
completion semantics — do not mix this workflow with `cuawright-web`.

Unlike the browser skill, the desktop Actor is an LLM loop inside the CLI, so a
Responses-compatible API key **is** required. You drive the CLI and read its
artifacts; you do not act as the desktop Actor.

Repository root for this checkout: `{{CUAWRIGHT_ROOT}}`.

## Two workflows

| Command | Loads a task class | Evaluator and score |
|---|---|---|
| `cuawright desktop run` | no | none |
| `cuawright desktop reproduce osworld` | yes, official gated task | yes, score in `[0, 1]` |

Plain model text never completes either workflow. The Actor must execute, inside
the VM:

```bash
python /opt/cuawright-tools/submit.py
```

If a run ends without a submission, treat it as unfinished rather than as a
result.

## Prerequisites

- Python 3.12+, Git, Docker (KVM preferred), and a Responses-compatible API key.
- Accepted access to both gated datasets:
  <https://huggingface.co/datasets/xlangai/osworld_v2_tasks> and
  <https://huggingface.co/datasets/xlangai/osworld_v2_assets_gated>.
- About 15 GB of free disk for the VM archive plus the extracted image.

## Install

From the checkout root, install the desktop extra:

```pwsh
Set-Location {{CUAWRIGHT_ROOT}}
python -m pip install -e ".[desktop]"
python -m pip install huggingface_hub
hf auth login
```

## Setup and verify

```pwsh
cuawright setup osworld --root ~/.cache/cuawright/osworld-v2-2026.08.08
cuawright verify osworld --setup ~/.cache/cuawright/osworld-v2-2026.08.08/setup.json
```

`verify` checks the clean source commit, all 108 task classes against the
official hash manifest, nonempty assets and the registered VM hash. Setup
downloads the pinned source, task classes, assets and VM; if the files already
exist, register them instead of copying with `--source`, `--tasks`, `--assets`,
`--task-manifest`, `--vm` and `--skip-install`. `setup.json` records the VM hash
actually used, so register a repaired or expanded VM with `--vm`.

## Credentials, proxies, results

- **Credentials** are a user-owned file with mode `0600`, kept outside the
  checkout, task, asset and result directories. Never write the key into
  `manifest.json`, examples or diagnostics.
- **`--responses-url`** is always the full POST URL ending in `/responses`.
  CUAWright derives the OpenAI SDK API root by removing exactly that segment, so
  do not append `/responses` yourself.
- **Proxies**: tasks whose setup includes a `proxy` step need a proxy you supply
  as a private JSON list, passed with `--proxy-config`. Setup ships no proxy.
- **Results**: the result directory must not exist before launch, and its parent
  must exist.

```pwsh
New-Item -ItemType Directory -Force ~/cuawright-results | Out-Null
```

## Smoke test and custom task

A smoke test makes paid model requests; run it before a long task:

```pwsh
cuawright smoke osworld --setup <SETUP_JSON> --credentials <API_KEY_FILE> `
  --results ~/cuawright-results/smoke --model <MODEL> `
  --responses-url https://api.example/v1/responses
```

Then run an arbitrary instruction:

```pwsh
cuawright desktop run --setup <SETUP_JSON> --credentials <API_KEY_FILE> `
  --results ~/cuawright-results/custom --model <MODEL> `
  --responses-url https://api.example/v1/responses `
  --instruction "Create /home/user/notes.txt containing a three-item checklist for planning a meeting. Reopen the file and verify its contents."
```

Custom runs start from the VM's reset state. There are no CLI options to stage
input files or export generated files, and the VM closes when the task ends —
arrange any file transfer during the task, or the artifact stays inside the VM.
The host result directory holds the run record, not the generated files.

## Official scored reproduction

List the downloaded task classes, read the chosen file for its instruction and
setup requirements, then reproduce it:

```pwsh
Get-ChildItem ~/.cache/cuawright/osworld-v2-2026.08.08/tasks/task_*.py
cuawright verify osworld --setup <SETUP_JSON>
cuawright desktop reproduce osworld --setup <SETUP_JSON> --credentials <API_KEY_FILE> `
  --results ~/cuawright-results/task-001 --task-id 001 --model <MODEL> `
  --responses-url https://api.example/v1/responses --reasoning xhigh
```

`--reasoning` defaults to `xhigh`. To reproduce a reported score, pass the
effort used for that model: GPT-5.6 Sol uses `max` (67.9 partial score), GPT-5.5
uses `xhigh` (63.2). Re-run `cuawright verify osworld` before each reproduction
and keep task and asset files unchanged after verification — a run records
hashes but does not recheck the whole setup lock.

## Artifacts

Every run writes into its result directory:

- `manifest.json` — versions, hashes and settings for code, task, assets, VM,
  prompts and tools.
- `trace.jsonl` — model requests and responses, commands, retries, cleanup;
  images the agent viewed are embedded in the trace.
- `result.json` — the outcome or an explicit failure stage, plus the evaluator
  score for an official task.

Read `result.json` first, then `manifest.json`, then the tail of `trace.jsonl`
when diagnosing. Failures record a stage name without exception text or hidden
evaluator state.

## Hard rules

- Never claim a desktop task succeeded without a submitted run and, for an
  official task, a score in `result.json`.
- Keep the pinned release, task setup, evaluator, provenance and score intact;
  a modified harness does not reproduce a reported benchmark number.
- Do not print, copy or commit credential contents, proxy credentials or custom
  endpoint URLs.
- Read `src/cuawright/desktop/config/prompts.py` in full before changing desktop
  prompts; plain final text never completes a desktop task.
- Keep the browser and desktop runtimes separate. Browser work belongs to
  `cuawright-web` and `src/cuawright/webwright/`.
