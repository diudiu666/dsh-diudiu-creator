# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-10-26

### Added

- First release: a bundle patch that inserts the **创造模式** agent preset
  (`id: cordis-skills`), a faithful copy of the shipped `cordis` preset whose
  only difference is that the `skill-filesystem` row no longer sets
  `customSkillDirs`. That key resolved to
  `createRequire(app.asar baseUrl).resolve('@deepseek-ai/dsh-agent-preset/package.json') + 'skills'`,
  a path inside `app.asar` that never exists, so skill discovery came up empty
  and every skill answered "unknown or no longer available". Dropping the key
  restores the default roots (project roots rank 100/200, user root rank 400).
- Structural tests (`node --test`) for the patch, the preset identity, the group
  rows and the `!!js` platform conditions, plus a packaging guard.
