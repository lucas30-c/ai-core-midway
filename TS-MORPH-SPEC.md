# Spec: AST Module Boundary Rules v1 (Configurable, ts-morph)

## Goal

Add an AST-based configurable rule to `ai-debt` that detects forbidden imports across architectural layers in TypeScript projects, using `ts-morph`.

This rule should integrate into existing analyze pipeline:

Diff → Parse changed files → Rules → Findings → Report → Markdown/JSON.

## Non-goals

* No autofix / code rewrite
* No full repo dependency graph
* No external package import checks
* No JS/Java/Python
* No “dynamic import()” resolution in v1

---

## User Experience

### CLI

Add optional CLI option:

```bash
ai-debt analyze ... --config <path>
```

Config resolution order:

1. If `--config` provided: load it
2. Else if `${cwd}/.ai-debt.json` exists: load it
3. Else: use built-in default preset

### Output

Violations show as findings:

* Rule: `ast-boundary`
* Severity: config-controlled (default HIGH)
* File: importer file (relative path)
* Line: import statement line
* Message: includes `fromLayer -> toLayer`, and module specifier

Example:

> `pages -> domain is not allowed: import ../../domain/user/service`

---

## Config Format (`.ai-debt.json`)

```json
{
  "schemaVersion": "1.0.0",
  "layers": [
    { "name": "pages",   "match": ["src/pages/**"] },
    { "name": "modules", "match": ["src/modules/**"] },
    { "name": "domain",  "match": ["src/domain/**"] },
    { "name": "infra",   "match": ["src/infra/**", "src/db/**"] }
  ],
  "rules": [
    { "from": "pages",   "disallow": ["domain", "infra"], "message": "pages should not import domain/infra directly" },
    { "from": "modules", "disallow": ["infra"],           "message": "modules should not import infra directly" },
    { "from": "domain",  "disallow": ["infra"],           "message": "domain must not depend on infra/db" }
  ],
  "severity": {
    "boundary": "HIGH",
    "runtime": "LOW"
  }
}
```

Notes:

* `layers[].match` supports glob patterns
* `rules[]` defines forbidden dependencies
* `severity.boundary` default `HIGH`
* `severity.runtime` default `LOW` (ts-morph/tsconfig error should not crash)

---

## Rule Behavior (v1)

### Scope

* Only analyze changed files from diff
* Only file extensions: `.ts`, `.tsx`
* Only analyze **relative imports**:

  * module specifier starts with `./` or `../`
* Ignore:

  * external packages (`react`, `lodash`)
  * type-only vs value import difference (treat same)
  * dynamic `import()`

### Steps

For each changed file (TS/TSX):

1. Parse with ts-morph `Project` (tsconfig-based)
2. Collect import-like statements:

   * `ImportDeclaration` (`import x from '...'`)
   * `ExportDeclaration` (`export * from '...'`)
3. Resolve module specifier to absolute file path:

   * use ts-morph resolution if possible
   * fallback: resolve relative path from importer directory + try extensions:
     `.ts`, `.tsx`, `.d.ts`, `/index.ts`, `/index.tsx`
4. Determine `fromLayer` and `toLayer` by matching file path against config layer globs
5. If any rule applies:

   * rule where `from === fromLayer` and `toLayer in disallow`
   * emit finding

### Severity

* boundary violation → `severity.boundary` (default HIGH)
* runtime error (no tsconfig / ts-morph failure) → emit a single LOW finding:

  * Rule: `ast-boundary:runtime`
  * File: `__summary__`
  * Message: `ts-morph initialization failed: <reason>`
  * Do NOT crash analysis

---

## Integration Requirements

### 1) New dependency

Add `ts-morph` dependency.

### 2) Add config contract

Create:

* `src/domain/analyze/config/config.types.ts`

  * `AiDebtConfig`, `LayerConfig`, `BoundaryRuleConfig`, `SeverityConfig`

### 3) Config loader (CLI adapter)

Create:

* `src/cli/adapters/config/config.loader.ts`

Responsibilities:

* `loadAiDebtConfig(cwd: string, configPath?: string): AiDebtConfig`
* implements resolution order (arg → .ai-debt.json → default preset)
* validates minimal shape:

  * schemaVersion exists
  * layers/rules arrays exist
  * layer names unique
* normalize:

  * default severities if missing
* on invalid config: throw `UsageError` (exit 2)

### 4) Pass config into analyzer

Update CLI options:

* `AnalyzeCommandOptions` add `config?: string`

Update executor:

* call `loadAiDebtConfig(options.cwd, options.config)`
* pass into AnalyzeService `analyzeDiff(diff, { tscMode, cwd, config })`

Update AnalyzeService options type:

* `AnalyzeOptions` add `config?: AiDebtConfig`

### 5) Implement rule

Create:

* `src/domain/analyze/rules/rules/ast-boundary.rule.ts`

Implements existing rule interface.

Inputs:

* changed files list + cwd + config

Outputs:

* list of findings

### 6) RuleEngine wiring

Register `AstBoundaryRule` alongside existing rules.

---

## Performance Constraints (MVP)

* Create ONE `Project` per run (not per file)
* Only load changed files
* Avoid scanning whole repo
* Keep runtime under a few seconds for typical diffs (<200 files)

---

## Tests

### Config loader tests

Create:

* `src/cli/adapters/config/__tests__/config.loader.test.ts`

Cases:

* no config file → returns default preset
* `--config` path → loads
* invalid JSON / missing fields → UsageError
* duplicate layer names → UsageError

### AST rule tests (lightweight)

Create fixtures:

```
fixtures/ast/
  tsconfig.json
  src/pages/a.ts
  src/domain/b.ts
  src/infra/c.ts
```

Test:

* pages importing domain triggers ast-boundary HIGH
* domain importing infra triggers ast-boundary HIGH
* modules importing domain passes
* non-relative import ignored

Implementation suggestion:

* construct a fake diff report with changed files set to those fixture files

---

## Acceptance Criteria

* With default preset, a repo using `src/pages|modules|domain|infra` structure produces boundary findings.
* With `.ai-debt.json`, rules are customizable.
* CLI `--config` overrides default.
* No crashes on missing tsconfig / ts-morph errors (runtime finding instead).
* Build + tests pass.

---

## Deliverables

Files expected:

* Add ts-morph dependency
* Add config types + loader + tests
* Add `ast-boundary.rule.ts` + tests
* Wire config into CLI → executor → AnalyzeService → RuleEngine
