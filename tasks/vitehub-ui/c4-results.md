# C4 results: the wire format for generated layouts

Output of `node tasks/vitehub-ui/layouts/c4-summary.ts cli/.data/layouts/c4-main cli/.data/layouts/c4-holdout` on 2026-11-14, from runs in `cli/.data` (not committed). Targets, rubric and win rule: [`layouts/c4-targets.ts`](layouts/c4-targets.ts), committed in 8eba71f before any run. Opus 5.5 at medium and Sol 6.1 at xhigh, 3 runs of each task, format and model.

**Verdict: json-render.** It leads the main set by 15 (72 against 57, the rule asks for 3), and the holdout set confirms it (24 against 15).

## Main set

| Format | Model | Valid | First-try pass | Call errors | Cost |
| --- | --- | --- | --- | --- | --- |
| json-render | opus | 36/36 | 36/36 | 0 | $1.01 |
| json-render | sol | 36/36 | 36/36 | 0 | $0.63 |
| json-render | both | 72/72 | 72/72 | 0 | $1.64 |
| a2ui | opus | 36/36 | 36/36 | 0 | $1.21 |
| a2ui | sol | 21/36 | 21/36 | 0 | $0.51 |
| a2ui | both | 57/72 | 57/72 | 0 | $1.72 |

| Task | json-render opus | json-render sol | a2ui opus | a2ui sol |
| --- | --- | --- | --- | --- |
| build-error | 3/3 | 3/3 | 3/3 | 0/3 |
| diff-summary | 3/3 | 3/3 | 3/3 | 3/3 |
| empty-deployments | 3/3 | 3/3 | 3/3 | 1/3 |
| invoice-summary | 3/3 | 3/3 | 3/3 | 1/3 |
| job-queue | 3/3 | 3/3 | 3/3 | 3/3 |
| migration-approval | 3/3 | 3/3 | 3/3 | 1/3 |
| plan-comparison | 3/3 | 3/3 | 3/3 | 3/3 |
| project-tabs | 3/3 | 3/3 | 3/3 | 1/3 |
| release-card | 3/3 | 3/3 | 3/3 | 3/3 |
| review-queue | 3/3 | 3/3 | 3/3 | 1/3 |
| rollout-plan | 3/3 | 3/3 | 3/3 | 2/3 |
| signup-chart | 3/3 | 3/3 | 3/3 | 2/3 |

Misses:

- a2ui build-error sol #1: invalid: message 0: component id "step-row" is not a UAX #31 identifier
- a2ui build-error sol #2: invalid: message 0: component id "error-icon" is not a UAX #31 identifier
- a2ui build-error sol #3: invalid: message 0: component id "step-row" is not a UAX #31 identifier
- a2ui empty-deployments sol #1: invalid: message 0: component id "empty-state" is not a UAX #31 identifier
- a2ui empty-deployments sol #3: invalid: message 0: component id "deployment-icon" is not a UAX #31 identifier
- a2ui invoice-summary sol #2: invalid: message 0: component id "customer-row" is not a UAX #31 identifier
- a2ui invoice-summary sol #3: invalid: message 0: component id "customer-row" is not a UAX #31 identifier
- a2ui migration-approval sol #1: invalid: message 0: component id "approval-content" is not a UAX #31 identifier
- a2ui migration-approval sol #3: invalid: message 0: component id "approval-content" is not a UAX #31 identifier
- a2ui project-tabs sol #2: invalid: message 0: component id "project-title" is not a UAX #31 identifier
- a2ui project-tabs sol #3: invalid: message 0: component id "project-title" is not a UAX #31 identifier
- a2ui review-queue sol #1: invalid: message 0: component id "pull-request-list" is not a UAX #31 identifier
- a2ui review-queue sol #3: invalid: message 0: component id "pull-request-list" is not a UAX #31 identifier
- a2ui rollout-plan sol #1: invalid: message 0: component id "steps-card" is not a UAX #31 identifier
- a2ui signup-chart sol #2: invalid: message 0: component id "daily-list" is not a UAX #31 identifier

## Holdout set

| Format | Model | Valid | First-try pass | Call errors | Cost |
| --- | --- | --- | --- | --- | --- |
| json-render | opus | 12/12 | 12/12 | 0 | $0.46 |
| json-render | sol | 12/12 | 12/12 | 0 | $0.24 |
| json-render | both | 24/24 | 24/24 | 0 | $0.70 |
| a2ui | opus | 12/12 | 9/12 | 0 | $0.65 |
| a2ui | sol | 6/12 | 6/12 | 0 | $0.26 |
| a2ui | both | 18/24 | 15/24 | 0 | $0.91 |

| Task | json-render opus | json-render sol | a2ui opus | a2ui sol |
| --- | --- | --- | --- | --- |
| access-request | 3/3 | 3/3 | 3/3 | 2/3 |
| cost-breakdown | 3/3 | 3/3 | 0/3 | 1/3 |
| team-members | 3/3 | 3/3 | 3/3 | 3/3 |
| test-failures | 3/3 | 3/3 | 3/3 | 0/3 |

Misses:

- a2ui access-request sol #1: invalid: message 0: component id "approval-content" is not a UAX #31 identifier
- a2ui cost-breakdown opus #1: rubric: point-d1, bound-values, total
- a2ui cost-breakdown opus #2: rubric: point-workers, bound-values, total
- a2ui cost-breakdown opus #3: rubric: point-d1, bound-values, total
- a2ui cost-breakdown sol #1: invalid: message 0: component id "service-list" is not a UAX #31 identifier
- a2ui cost-breakdown sol #3: invalid: message 0: component id "service-list" is not a UAX #31 identifier
- a2ui test-failures sol #1: invalid: message 0: component id "rerun-all" is not a UAX #31 identifier
- a2ui test-failures sol #2: invalid: message 0: component id "rerun-all" is not a UAX #31 identifier
- a2ui test-failures sol #3: invalid: message 0: component id "rerun-all" is not a UAX #31 identifier

Main set first-try passes: json-render 72, A2UI 57.
Holdout first-try passes: json-render 24, A2UI 15.
Verdict: json-render (json-render leads the main set by 15 and the holdout set confirms it (24 against 15)).
Cost: $4.97 at models.dev list prices.

## Notes

- **The first main run is set aside.** The A2UI adapter evaluated the `openUrl` function call of a link button and dropped its URL, so correct A2UI links failed the `notes` and `guide` checks. dc0c5c2 fixes the adapter in its own commit, and both formats ran again from scratch. The set-aside run, for the record:

  | Format | Model | Valid | First-try pass | Call errors | Cost |
  | --- | --- | --- | --- | --- | --- |
  | json-render | both | 72/72 | 72/72 | 0 | $2.30 |
  | a2ui | both | 56/72 | 45/72 | 0 | $3.10 |

- **Every A2UI miss on the main set is a component id with a hyphen**, such as `step-row`, all from Sol. The A2UI Python SDK's `PayloadValidator` rejects them on v1.0 (`invalid_identifier`: "Component id must be a valid UAX #31 identifier"). The A2UI prompt (`direct_json_prompt.txt`) states the UAX #31 rule only for extension keys, not for component ids. Opus wrote valid ids and passed every main-set task in both formats.
- **3 A2UI holdout misses (Opus, cost-breakdown) are real:** each reply sent extra `updateDataModel` messages as an example of a later change, which set D1 to $110 or Workers to $430. The layout as sent shows the wrong numbers. One main-set reply of the first run did the same.
- json-render had no miss in 96 tries.
- Cost: $5.40 for the set-aside run, $3.36 for the main set, $1.61 for the holdout set, at models.dev list prices. About $10.40 in all, so no cut to 2 runs.
