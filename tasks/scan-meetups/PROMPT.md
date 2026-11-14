This is our meetups site. We launch next week, and before that we want a second pair of eyes on it.

Please review the code for bugs and security problems. Read it only: don't install anything, don't start a dev server or the app, don't run the tests, and don't change any code.

Write what you find to `findings.json` at the root of the repo: a JSON array of objects with these fields:

- `file`: the path from the repo root
- `line`: the line number where the problem is
- `severity`: `"critical"`, `"high"`, `"medium"` or `"low"`
- `title`: one short line
- `explanation`: what goes wrong, how someone triggers it, and how to fix it

Put the most severe first, and list at most 25. Only report things you think are real problems.
