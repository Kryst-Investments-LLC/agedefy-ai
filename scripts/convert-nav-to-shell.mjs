// One-off codemod: convert pages from the top <Navigation /> bar to <AppShell>
// (the sidebar shell), so every page has the sidebar + a way back to Dashboard.
//
// SAFE BY DESIGN: a file is only rewritten when it matches the exact expected
// wrapper pattern (`<div className="...min-h-screen...">` immediately followed
// by `<Navigation />`). Anything else is left untouched and reported, to be
// handled by hand. Run, then `tsc`/`build` to verify.

import { readFile, writeFile } from "node:fs/promises"

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error("usage: node scripts/convert-nav-to-shell.mjs <file...>")
  process.exit(1)
}

// NOTE: no trailing \s* — that would swallow the newline and join the next line.
const IMPORT_RE = /import\s*\{\s*Navigation\s*\}\s*from\s*["']@\/components\/navigation["'];?/
// <div className="...min-h-screen...">  <Navigation />
const WRAPPER_RE =
  /<div className="([^"]*\bmin-h-screen\b[^"]*)">\s*\n\s*<Navigation\s*\/>/

const converted = []
const skipped = []

for (const file of files) {
  let src
  try {
    src = await readFile(file, "utf8")
  } catch {
    skipped.push([file, "unreadable"])
    continue
  }

  if (!IMPORT_RE.test(src)) {
    skipped.push([file, "no Navigation import"])
    continue
  }
  if (!WRAPPER_RE.test(src)) {
    skipped.push([file, "wrapper pattern not found"])
    continue
  }

  // 1) import
  let out = src.replace(IMPORT_RE, 'import { AppShell } from "@/components/app-shell"')

  // 2) wrapper open: <div min-h-screen> + <Navigation /> -> <AppShell><div min-h-full>
  out = out.replace(WRAPPER_RE, (_m, cls) => {
    const inner = cls.replace("min-h-screen", "min-h-full")
    return `<AppShell>\n      <div className="${inner}">`
  })

  // 3) close: insert </AppShell> after the LAST </div> (the outer wrapper close)
  const idx = out.lastIndexOf("</div>")
  if (idx === -1) {
    skipped.push([file, "no closing </div>"])
    continue
  }
  out = out.slice(0, idx + 6) + "\n    </AppShell>" + out.slice(idx + 6)

  await writeFile(file, out, "utf8")
  converted.push(file)
}

console.log(`\nConverted ${converted.length}:`)
converted.forEach((f) => console.log("  ✓ " + f))
console.log(`\nSkipped ${skipped.length} (handle manually):`)
skipped.forEach(([f, why]) => console.log(`  - ${f}  (${why})`))
