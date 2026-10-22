# Contributing to HomeKind

Thanks for looking. HomeKind is built and maintained by one person at
WattKind AI, a small family business, so please read this before opening
anything.

## Bug reports

Yes please. Open an issue with the app version (Settings > About), whether
you are on iPhone or Android, and the steps to reproduce. Screenshots help.
If the bug involves a backup zip or an attachment, say what kind of file it
was; do not upload a backup that contains your real receipts.

Security problems go to support@wattkind.ai, not to Issues. See
[SECURITY.md](SECURITY.md).

## Feature ideas

Also welcome as issues. Be aware that HomeKind 1.0's scope is deliberate: the
README lists what was cut on purpose (accounts, cloud sync, notifications, AI
features, analytics). Ideas in those areas are fine to raise, but they will
not be quick wins.

## Pull requests

- Small fixes are welcome: bugs, typos, accessibility, and copy.
- Anything that changes scope, adds a dependency, or touches the native
  projects under `ios/` or `android/`, the Codemagic workflow, or signing
  should start as an issue first so we can agree on it before you spend time.
- Run `npm run verify` (lint, typecheck, tests, build) before you push.
- Keep PRs focused on one change.

There is no guarantee a PR will be merged, and no promised review timeline.
Releases go through App Store and Google Play review, so even a merged fix
can take a while to reach phones.

## Local setup

See "Run locally" in the [README](README.md). The web build runs in a
browser with no device or simulator needed.

## Be kind

That is the whole code of conduct. Issues or comments that are not will be
closed.
