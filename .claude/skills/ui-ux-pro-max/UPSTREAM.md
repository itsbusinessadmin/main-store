# Upstream provenance

This skill is vendored from [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT, see `LICENSE`).

- Version: 2.13.0
- Upstream commit: 7f69fed6a2717900085f1bc3b263721f8ba025e2 (2026-09-10)
- Source path: `.claude/skills/ui-ux-pro-max/`

## Local changes

- `SKILL.md`: script invocations were rewritten from `${CLAUDE_PLUGIN_ROOT}/.claude/skills/...`
  (which only resolves when the project is installed as a Claude Code plugin) to the
  repo-relative `.claude/skills/ui-ux-pro-max/scripts/search.py`.
- `scripts/tests/` was omitted — those are upstream's own test suite, not needed at runtime.
- Only the `ui-ux-pro-max` skill was vendored. Upstream also bundles six unrelated
  claudekit skills (`brand`, `design`, `design-system`, `slides`, `ui-styling`, `banner-design`).

## Requirements

Python 3.x, no third-party dependencies. Verified with `python3 scripts/validate_data.py`.

## Updating

Re-copy the directory from a newer upstream tag and re-apply the `SKILL.md` path rewrite,
or use upstream's CLI: `npx ui-ux-pro-max-cli init --ai claude`.
