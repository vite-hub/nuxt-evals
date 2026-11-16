# N1 results

Output of `node tasks/vitehub-ui/n1-summary.ts` on 2026-11-13, from the runs in `cli/.data` (not committed). Targets and win rules: [TARGETS.md](TARGETS.md). Layouts are scored with the rubric of 51846c8; with the rubric of the targets commit, json-render had 18 and A2UI 19 first-try passes.

## Operate tasks

| Task | Agent | Driver | Success | Page calls (all) | Page chars (all) | Time s | Tokens | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ui-operate-settings | Opus | browser | 3/3 | 6 (8) | 7833 (13611) | 26 | 211850 | $0.44 |
| ui-operate-settings | Opus | bridge | 3/3 | 4 (4) | 3050 (3050) | 13 | 36994 | $0.13 |
| ui-operate-settings | Sol | browser | 3/3 | 7 (9) | 17945 (32194) | 40 | 133619 | $0.19 |
| ui-operate-settings | Sol | bridge | 3/3 | 4 (5) | 3050 (3066) | 24 | 55142 | $0.13 |
| ui-operate-form | Opus | browser | 3/3 | 4 (6) | 4185 (9924) | 27 | 155037 | $0.40 |
| ui-operate-form | Opus | bridge | 3/3 | 2 (2) | 2022 (2022) | 8 | 20778 | $0.10 |
| ui-operate-form | Sol | browser | 3/3 | 7 (9) | 5203 (19452) | 39 | 118069 | $0.13 |
| ui-operate-form | Sol | bridge | 3/3 | 3 (4) | 2710 (2726) | 42 | 45049 | $0.14 |

- ui-operate-settings Opus: success ok, calls 0.67x MISS, chars 0.39x MISS (all chars 0.22x) -> no win
- ui-operate-settings Sol: success ok, calls 0.57x MISS, chars 0.17x ok (all chars 0.1x) -> no win
- ui-operate-form Opus: success ok, calls 0.5x ok, chars 0.48x MISS (all chars 0.2x) -> no win
- ui-operate-form Sol: success ok, calls 0.43x ok, chars 0.52x MISS (all chars 0.14x) -> no win

Stop rule 1: bridge 12/12 against browser 12/12, median page calls 4 against 6.5: does not fire.

## Coding tasks

| Task | Agent | Scores | Median | At target | Median tool calls | Median min | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ui-dialog-form | Opus | 100%, 100%, 100% | 100% | 3/3 | 14 | 8 | $1.22 |
| ui-dialog-form | Sol | 100%, 100%, 100% | 100% | 3/3 | 50 | 14 | $1.68 |
| ui-dialog-form-uisdk | Opus | 100%, 100%, 100% | 100% | 3/3 | 19 | 2 | $2.40 |
| ui-dialog-form-uisdk | Sol | 100%, 100%, 100% | 100% | 3/3 | 49 | 12 | $1.65 |
| ui-stepper-kit | Opus | 100%, 100%, 100% | 100% | 3/3 | 19 | 4 | $1.96 |
| ui-stepper-kit | Sol | 100%, 100%, 100% | 100% | 3/3 | 56 | 15 | $1.97 |
| ui-stepper-tabs | Opus | 100%, 100%, 100% | 100% | 3/3 | 40 | 7 | $4.18 |
| ui-stepper-tabs | Sol | 100%, 92%, 100% | 100% | 3/3 | 53 | 20 | $1.91 |

- Dialog: ui-sdk 6 at 100% against Nuxt UI 6 -> tie
- Stepper: kit 6 at 90% against Tabs 6 -> ui-stepper-tabs

## Layout wire format

| Format | Agent | Valid | First-try pass | Median out tokens | Median s | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| json-render | Opus | 12/12 | 12/12 | 1182 | 8 | $0.45 |
| json-render | Sol | 12/12 | 11/12 | 1051 | 26 | $0.20 |
| json-render | both | 100% meets 90% | 96% meets 80% | | | |
| a2ui | Opus | 12/12 | 12/12 | 1195.5 | 9 | $0.67 |
| a2ui | Sol | 9/12 | 9/12 | 991 | 22 | $0.29 |
| a2ui | both | 88% misses 90% | 88% meets 80% | | | |

- Wire format: json-render 23 against A2UI 21 -> json-render

Total cost of the measured runs: $20.24

## Notes

- A browser tool call can chain several `agent-browser` commands in one shell call. Counted per command, the browser runs used 12 to 17 commands (median 13 to 14 per task and agent), against 2 to 4 bridge calls.
- In every settings run, the bridge refused "Frankfurt" for the item "Frankfurt (eu-central-1)" and listed the items, so each run spent one more `act`. Each run also saved in its own `act`, as the tool's description suggests.
- Three Sol runs stopped at the 30-minute limit (`ui-dialog-form` a2, `ui-stepper-kit` a3, `ui-stepper-tabs` a2). Their apps were graded as they stood: 100%, 100% and 92%.
- `ui-stepper-tabs` Sol a2 missed `one-tab-stop`: on Review, Tab reached Shipping, Payment and Review.
- Pilots (7 operate runs, 1 coding run) are kept in `cli/.data/operate-pilot` and `cli/.data/runs-pilot` and are not counted.
