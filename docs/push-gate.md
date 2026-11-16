# Repository push gate

Use Node 22, installed lockfile dependencies, gitleaks and Chrome/Edge (BUILDY_CHROME on Windows).

Run `bash scripts/push-gate.sh`; `--check-only` runs the same checks without pushing. Git Bash is supported on Windows. The shell entry delegates to scripts/push-gate.mjs; neither entry commits, stashes, resets or force-pushes.

The gate requires a clean main, including untracked files. It fetches origin/main and requires fast-forward ancestry, rebuilds runtime bundles and rejects any generated difference, parses both runtime entries, runs schema:check and the full npm run verify, then rechecks clean state, branch and HEAD before `git push origin HEAD:main`. A concurrent remote update is rejected by normal Git push. Cyrillic is allowed.

schema:check compares Page/Session/Collection schemas with public/ at the ui8kit/contract commit pinned in catalog/snapshot.config.json. It does not compare registry props. Use `npm run schema:check -- --published` only to diagnose the schema.buildy.tw deployment. verify includes chat-off no-trace and headless tests. Missing tools, unavailable network or failed checks stop delivery.

Keep unrelated work outside the delivery checkout. An isolated clean worktree is suitable; save changes explicitly rather than having the gate stash them. A generated difference must be reviewed and committed before running the gate again.
