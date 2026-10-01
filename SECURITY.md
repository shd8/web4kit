# Security policy

## Supported versions

| version | supported |
|---|---|
| 0.2.x | yes |
| < 0.2 | no |

All `@web4kit/*` packages, `create-web4kit` and `web4kit` share one version.

## Reporting a vulnerability

Please **don't open a public issue**. Use GitHub's private vulnerability reporting instead: the repository's **Security** tab, then **Report a vulnerability** ([direct link](https://github.com/shd8/web4kit/security/advisories/new)).

Include the affected package and version, what an attacker can do, and steps to reproduce. You'll get an answer within 7 days. A fix and an advisory follow, crediting you unless you'd rather not be named.

## What counts

The areas that matter most:

- **Privacy:** the Page Plan must never contain user data, and the model must never receive raw signals (coordinates, timestamps, cookies). A way around either is a vulnerability.
- **Prompt injection:** third-party text (reviews, captions) must never reach the model.
- **The scaffolder and the CLI:** anything that writes outside the target directory, or runs code it shouldn't.

Engine keys belong in `.env`, which the starters ignore. A key committed to your own repository is a problem for you to rotate, not a vulnerability in web4kit.
