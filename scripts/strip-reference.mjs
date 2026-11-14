// Writes the Meetups reference app without its comments to tasks/meetups/base, the clean starting app that fix and
// hidden-bug projects plant their bugs into. The reference's comments name the bug each choice avoids, so a fixture
// that kept them would hand the agent the answer.
//   node scripts/strip-reference.mjs
// It copies the reference's tracked files, strips comments from .ts, .mts and .vue files (script blocks with the
// TypeScript parser, template comments as HTML), and keeps `@ts-` and `<reference>` pragmas. README.md loses its
// "Where things are" table, which lists what each file guards against.
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const root = join(import.meta.dirname, "..")
const reference = join(root, "tasks/meetups/reference")
const out = join(root, "tasks/meetups/base")
const pnpm = join(root, "node_modules/.pnpm")
const require = createRequire(import.meta.url)
const find = name => execFileSync("sh", ["-c", `ls -d ${pnpm}/${name}@*/node_modules/${name.replace("+", "/")} | head -1`]).toString().trim()
const ts = require(find("typescript"))
const { parse: parseSfc } = require(find("@vue+compiler-sfc"))

const keep = /@ts-|<reference |eslint-|^#!/

/** Comment ranges in TypeScript source, from the parser's trivia, so `//` inside strings and templates stays. */
function commentRanges(code) {
  const source = ts.createSourceFile("file.ts", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const ranges = new Map()
  const add = list => list?.forEach(range => ranges.set(range.pos, range.end))
  const visit = (node) => {
    add(ts.getLeadingCommentRanges(code, node.getFullStart()))
    add(ts.getTrailingCommentRanges(code, node.getEnd()))
    // Children with tokens, so a comment before a `}` (an empty catch block) is found too.
    for (const child of node.getChildren(source)) visit(child)
  }
  visit(source)
  add(ts.getLeadingCommentRanges(code, source.endOfFileToken.getFullStart()))
  return [...ranges].map(([pos, end]) => ({ pos, end })).filter(range => !keep.test(code.slice(range.pos, range.end)))
}

/** Removes ranges; a line left with only whitespace goes, and so does the space before a trailing comment. */
function removeRanges(code, ranges) {
  let text = code
  for (const { pos, end } of [...ranges].sort((a, b) => b.pos - a.pos)) {
    const lineStart = text.lastIndexOf("\n", pos - 1) + 1
    const lineEnd = text.indexOf("\n", end) === -1 ? text.length : text.indexOf("\n", end)
    const before = text.slice(lineStart, pos)
    const after = text.slice(end, lineEnd)
    if (!before.trim() && !after.trim()) text = text.slice(0, lineStart) + text.slice(Math.min(lineEnd + 1, text.length))
    else text = text.slice(0, pos).replace(/[ \t]+$/, "") + text.slice(end)
  }
  return text.replace(/\n{3,}/g, "\n\n")
}

const stripScript = code => removeRanges(code, commentRanges(code))

function stripVue(code) {
  const { descriptor } = parseSfc(code)
  const ranges = []
  for (const block of [descriptor.script, descriptor.scriptSetup].filter(Boolean)) {
    const offset = block.loc.start.offset
    for (const range of commentRanges(block.content)) ranges.push({ pos: offset + range.pos, end: offset + range.end })
  }
  if (descriptor.template) {
    const offset = descriptor.template.loc.start.offset
    for (const match of descriptor.template.content.matchAll(/<!--[\s\S]*?-->/g)) ranges.push({ pos: offset + match.index, end: offset + match.index + match[0].length })
  }
  return removeRanges(code, ranges)
}

function stripReadme(text) {
  return text.replace(/\n## Where things are[\s\S]*$/, "\n")
}

rmSync(out, { recursive: true, force: true })
const files = execFileSync("git", ["ls-files", "-z", "."], { cwd: reference }).toString().split("\0").filter(Boolean)
for (const path of files) {
  const text = readFileSync(join(reference, path), "utf8")
  const stripped = /\.(m?ts)$/.test(path) ? stripScript(text) : path.endsWith(".vue") ? stripVue(text) : path === "README.md" ? stripReadme(text) : text
  mkdirSync(dirname(join(out, path)), { recursive: true })
  writeFileSync(join(out, path), stripped)
}
console.log(`${files.length} files to ${out}`)
