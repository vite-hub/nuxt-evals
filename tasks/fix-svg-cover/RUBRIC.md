# A cover photo runs script: fix rubric

How we grade a fix of the report in [PROMPT.md](PROMPT.md). The agent got the Meetups app with the cover upload route checking only the type the browser declared: `ensureBlob(file, { types: ["image"] })` admits any `image/*`, `image/svg+xml` included, and the byte check (`detectContentType`) is gone. The route stores the file with the declared type, and `/images` serves an SVG with a `<script>` from the app's own origin. Each check passes, fails, or does not apply (n/a).

Rules for graders:

- Grade the agent's change, from the patch and the code. The rest of the app is the same in every run.
- The ranked solutions in S1 and S2 are the ones we know. A fix that matches none is graded on its merits; say "novel" in the evidence of S1.
- Each check names how to verify it: **run**, **read**, **log** (from the agent's session log), or **both**. **M** marks a major check, **m** a minor one.

Gate: F1
Weights: R 20, S 45, P 15, C 10, V 10

A run that fails the gate scores 0: the report isn't fixed. Otherwise sections score as in the Meetups rubric (a major check weighs 3, a minor one 1), the weights above share the rubric part, and Vite Doctor's score counts as in Meetups.
---

## 1. Fixed

A script runs it against the production build. It is the gate.

| ID | Check | How | |
| --- | --- | --- | --- |
| F1 | An organizer uploads, as an event cover, an SVG with a `<script>` declared `image/svg+xml`, and an HTML page declared `image/png` named `cover.png`. Each is refused with a 4xx, or what `/images` serves for it can't run: a real raster image served as one, or a response with `Content-Disposition: attachment` or a `sandbox` Content-Security-Policy. A real PNG still uploads, so a refusal shows the file was judged by what it is. | run | M |

## 2. Root cause

| ID | Check | How | |
| --- | --- | --- | --- |
| R1 | The agent's final message names the cause: the route trusts the type the browser declared, the short type `"image"` admits SVG (which can carry script), and nothing checks the file's bytes, so the file is served as active content from the site's origin. A message that only says "SVGs are dangerous" without the declared-type check fails. | log | M |
| R2 | The change is in what the upload route accepts or how covers are served, not only in the upload form's `accept` attribute or other browser-side checks. | read | m |

## 3. Solution

Ranked solutions we know:

- **Best:** an explicit list of raster types (JPEG, PNG, WebP) in `ensureBlob`, plus a check of the file's first bytes with `detectContentType()` that must match the declared type, and the detected type stored.
- **Acceptable:** decode and re-encode every upload as a raster image (for example with sharp): strong, costs CPU; serve covers with `Content-Disposition: attachment` and a `sandbox` Content-Security-Policy, or from a separate file origin: contains the damage without refusing the file.
- **Over-engineered:** a malware scanner or an external moderation service, a new image pipeline or storage service just for covers.
- **Masks the symptom:** sanitizing SVGs (stripping `<script>`, event handlers): sanitizer bypasses exist; refusing only `image/svg+xml` by name while other declared types still go unchecked.
- **Wrong:** checking the file name's extension: the client picks it; checking only in the browser (the form's `accept`).

| ID | Check | How | |
| --- | --- | --- | --- |
| S1 | The fix is the best solution or an acceptable one from the list above (or a novel one as sound). | read | M |
| S2 | The fix is the best one: an explicit list of raster types and a check of the bytes, so the stored type is what the file is. | read | M |
| S3 | Nothing over-engineered: no scanner, no external service, no new storage or image pipeline beyond what the fix needs. | read | M |
| S4 | No masking: the change doesn't stop at an SVG sanitizer, a denylist of `image/svg+xml`, an extension check or a browser-side check. | read | M |

## 4. Platform

| ID | Check | How | |
| --- | --- | --- | --- |
| P1 | The fix uses ViteHub Blob's own tools (`ensureBlob` with explicit types, `detectContentType` from `vite-hub/blob/content-type`, the `blob.serve` headers in `nuxt.config.ts`) and the app's `COVER_TYPES`, rather than a hand-written sniffer or a second storage client. | read | M |

## 5. No collateral damage

| ID | Check | How | |
| --- | --- | --- | --- |
| C1 | A clean clone installs, migrates, builds and starts with the commands in its README. | run | M |
| C2 | A real PNG still uploads as a cover and `/images` serves it with an image content type. (Scripted.) | run | m |
| C3 | The change touches only what the fix needs; JPEG, PNG and WebP covers still upload, show and delete. Tests and notes the fix needs are fine; rewrites of unrelated files are not. | read | m |

## 6. Verification

| ID | Check | How | |
| --- | --- | --- | --- |
| V1 | The agent reproduced the problem before changing the code: uploaded an SVG with a script or a mislabeled file and saw it accepted or served, or reasoned it through from the code and said so. | log | M |
| V2 | The agent showed the fix works after the change: the same uploads refused or served harmlessly, or a test it kept in the repo. | log | m |
