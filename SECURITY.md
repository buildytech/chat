# Security policy

## Supported development line

BuildY Chat is in development. Fixes target current `main`; older snapshots and forks have no separate maintenance
commitment. The hosted chat is not publicly launched. Self-hosted operators manage their own configuration and keys.

## Report privately

Use [GitHub Private Vulnerability Reporting](https://github.com/buildytech/chat/security/advisories/new).
If unavailable, email **alexyos.dev@gmail.com** with subject `BuildY Chat security report`.
Never post exploit details, credentials or private data in public Issues or Discussions.

Include affected commit/version, Browser or runtime context, minimal reproduction, expected security boundary,
potential impact and sanitized evidence. Use only systems and data you are authorized to test. Do not send real keys,
passwords or someone else's session content. Revoke/rotate exposed credentials rather than sending the secret.

Maintainers will assess reports and coordinate reproduction, fixes and disclosure through the private channel.
There is no guaranteed response deadline or bug bounty program. Please coordinate public disclosure so a fix or
mitigation can be prepared.

## Deployment guidance

Keep model keys server-side. Configure fail-closed Basic Auth for non-loopback access and follow
[deployment instructions](docs/deploy-xai.md). Browser persistence is not a credential vault. Review session exports,
logs and screenshots before sharing: they may contain private conversation and page content.
