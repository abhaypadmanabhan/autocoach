# Lessons Learned

- **Missing Backend Endpoints**: When developing resuming logic for an active sprint, we found that relying on `/sprint/{sessionId}/questions` would not work because that endpoint does not exist. Always rely on the base context fetch `/sprint/today` and verify the available keys directly from the typescript model to ensure synchronization with the backend routing, avoiding fallback cascades.
- **Sentry SDK 2.x FastAPI Integration**: In sentry-sdk 2.x, the FastAPI integration is enabled automatically when initializing `sentry_sdk.init` in an environment where the fastapi package is installed. Do not manually import or instantiate `FastAPIIntegration` from `sentry_sdk.integrations.fastapi`, as it can lead to import errors.
- **Git Worktree Environment Setup**: When creating a git worktree, untracked/ignored files (like `.env` and virtual environments `venv`) are not copied to the new worktree. Symlinking the main `venv` and `.env` files to the worktree allows running tests and servers instantly without duplicate configuration.
- **GDPR User Data Cleanup Idempotency**: Admin deletion scripts should be idempotent and handle potential exceptions (e.g. database 404/missing table errors for tables like `user_xp` or `user_documents_progress` that might not be mapped in SQLAlchemy but are in the schema) to guarantee the script runs successfully to completion without breaking midway.
- **Langfuse Cloud Configuration Mapping**: When configuring settings in Pydantic-settings based FastAPI apps, ensure the environment variables match the expected `BaseSettings` attributes (e.g., `LANGFUSE_HOST` mapping to `langfuse_host`), rather than assuming default SDK names (like `LANGFUSE_BASE_URL`).
- **Secrets Auditing**: When handling environment variable swaps, perform a manual `git diff --staged` audit before committing to verify that no credentials or gitignored files (like local `.env`) are accidentally committed to the branch.
- **Nixpacks Build Runtime Verification**: To verify what runtime version is actually compiled and executed by Railway/Nixpacks in production, use the `railway logs --build` command rather than guessing from local config files or local developer machine configurations.




## 2026-07-27 — Design corrections (AutoCoach iOS M3)

- **Numbered mono kickers (`01 / TODAY`, `02 / LIBRARY`) are AI slop. Never again.** No shipping
  product uses them. Screens get a real title in the display face, or nothing. I had this exact
  rule in the UI-UX vault's `AI Design Tells.md` and overrode it because the project CLAUDE.md
  mandated kickers — wrong call. When the house design rules and a project design system
  disagree on something that *looks* generated, the house rules win; a project design system can
  be stale.
- **Don't let a secondary mechanic own a whole block.** The credits row was a full-width section
  in second position on the home screen. Usage/quota is ambient status: compact it inline, put it
  top or in Settings, and never render it twice in the app.
- **Never ship the same section in two places.** Credits appeared on Today *and* in Settings.
  Pick the owner.
- **Hairline progress bars are unreadable.** 1–2px bars fail as UI. A progress bar has to be
  visible at arm's length; "hairline" is for dividers, not for data.
- **Don't add features the product doesn't need.** Camera scan was pulled in because competitors
  have it — AutoCoach uploads documents, it is not a scanner. Competitive research lists what
  others do; it does not decide what we build.
- **Delegating visual work without looking at the result is the root cause.** Agents marked
  visual criteria "met" from a clean compile. Screenshot every screen before reporting done.
- **Use the available design tooling** (Mobbin MCP, image generation, Stitch) to explore layout
  *before* coding, not as a citation added afterwards.
- **Spawn agents as sibling panes in the current tab** (`herdr pane split --current`), not via
  `herd spawn`'s worktree mode, which creates a new workspace per agent.
