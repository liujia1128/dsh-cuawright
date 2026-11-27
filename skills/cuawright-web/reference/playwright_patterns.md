# Playwright patterns (DeepSeek Harness)

Canonical patterns for the CUAWright browser skill, adapted from the upstream
heredoc style. Upstream ran `python - <<'PY' … PY` through one `Bash` call per
turn; here you `write` a script file and run it with `pwsh`, which keeps each
step observable and works on Windows.

## Browser launch skeleton (local mode)

Use **Playwright Chromium** — `python -m playwright install chromium` installs
it. Some sites (cars.com and other Akamai-protected sites) reject Playwright
Chromium with `ERR_HTTP2_PROTOCOL_ERROR` from TLS/H2 fingerprinting; for those,
install Firefox (`python -m playwright install firefox`) and swap the single
launch line to `playwright.firefox.launch(headless=True)`. Note the switch in
the action log.

Write `WORKSPACE_DIR/explore_1.py`:

```python
import asyncio
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

# A Windows console defaults to a legacy code page; without this, printing a
# non-ASCII aria_snapshot() raises UnicodeEncodeError and kills the script.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

WORKSPACE = Path(os.environ.get("WORKSPACE_DIR", "."))
SCREENSHOTS = WORKSPACE / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        await page.goto("<START_URL>", wait_until="domcontentloaded")
        await page.screenshot(path=str(SCREENSHOTS / "explore_1_start.png"))

        print("URL:", page.url)
        print("TITLE:", await page.title())

        # Inspect the region you care about with an ARIA snapshot
        snapshot = await page.locator("body").aria_snapshot()
        print("ARIA:", snapshot)

        await browser.close()


asyncio.run(main())
```

Then run it:

```pwsh
$env:WORKSPACE_DIR = "outputs\demo"
python outputs\demo\explore_1.py
```

Rules:

- **Always** set `viewport={"width": 1280, "height": 1800}`.
- **Never** call `page.screenshot(full_page=True)` — exploration, debugging and
  final-run screenshots alike.
- Each Playwright run is fresh: navigate from the start URL, reapply filters,
  reconstruct state in code. There is no persistent session.
- Keep one script per step so a failed step is one file to fix.

## Targeting elements with role + name

```python
await page.get_by_role("button", name="Filters").click()
await asyncio.sleep(1)

# Snapshot the *parent* of the control to see siblings and options
panel = page.get_by_role("button", name="Filters").first.locator("..")
print(await panel.aria_snapshot())

await page.get_by_role("checkbox", name="BMW").check()
await asyncio.sleep(1)
```

If a selected state becomes hidden after a drawer or dropdown closes, reopen it
before capturing the verification screenshot.

## Prefer interactive form filling over deep-link URLs

When a task requires parameterizing a search (locations, dates, filters, query
strings), **drive the on-page form interactively** rather than constructing a
deep-link URL with the parameters baked into the query string. Deep links are
convenient for the one case you explored but brittle as a CLI surface:

- Sites silently drop parameters they cannot parse, leaving downstream fields
  blank.
- URL parsers vary by locale, A/B bucket and signed-in state.
- A working deep link for one input set says nothing about another.

Interactive filling with the same controls a human would click is the most
reliable strategy across input variations. Make it the **primary** path in the
final script; use a deep link only as an opportunistic shortcut, verify the form
state afterwards, and fall back to interactive filling when any field is empty
or wrong.

```python
form_state = await page.locator("input[aria-label]").evaluate_all(
    "els => els.map(e => ({label: e.getAttribute('aria-label'), "
    "value: e.value, hidden: e.offsetParent === null}))"
)
if not form_is_fully_populated(form_state, expected):
    await fill_form_interactively(page, expected)
```

Guidelines for the interactive path:

- Use `get_by_role` and `aria-label` selectors, not brittle CSS classes.
- Type the value, wait for the suggestion listbox, then click the option whose
  text contains the canonical token for the input.
- For paired fields rendered inside a single modal (date range pickers, stepper
  groups), open the modal **once** and `Tab` between fields instead of clicking
  each input separately — clicking the second input while the modal is open is
  often blocked by the modal's own overlay.
- After filling, click the explicit submit control rather than relying on
  auto-submit.
- Re-read the form state and assert each checkpoint (CP1..CPn) before
  extracting results.

## Final-script instrumentation

`final_runs/run_<id>/final_script.py` must write
`final_runs/run_<id>/screenshots/final_execution_<step>_<action>.png`, reset and
append to `final_runs/run_<id>/final_script_log.txt`, and print the final datum
at the end of the log.

```python
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

RUN_DIR = Path(__file__).parent
SCREENSHOTS = RUN_DIR / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)
LOG = RUN_DIR / "final_script_log.txt"
LOG.write_text("")  # reset


def log(step: int, msg: str) -> None:
    line = f"step {step} action: {msg}\n"
    with LOG.open("a") as handle:
        handle.write(line)
    print(line, end="")


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        await page.goto("<START_URL>", wait_until="domcontentloaded")
        await page.screenshot(path=str(SCREENSHOTS / "final_execution_1_open_start_page.png"))
        log(1, "open start page")

        # ... apply CP1, screenshot, log ...
        # ... apply CP2, screenshot, log ...

        final_value = "<extracted price / code / winner>"
        with LOG.open("a") as handle:
            handle.write(f"\nFINAL_RESPONSE: {final_value}\n")

        await browser.close()


asyncio.run(main())
```

## Inspection commands

```pwsh
# Latest run tree and log
Get-ChildItem -Recurse final_runs\run_<id> | Select-Object FullName
Get-Content final_runs\run_<id>\final_script_log.txt

# Quick file read (or use the `read` tool with offset/limit)
Get-Content final_runs\run_<id>\final_script.py -TotalCount 220
```

For visual checks, use the `read` tool on individual PNG files inside
`final_runs/run_<id>/screenshots/` rather than calling an external image-QA
service.
