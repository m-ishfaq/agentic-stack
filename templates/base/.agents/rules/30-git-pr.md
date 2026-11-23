# Git and pull requests

## Git is read-only

Allowed: `git status`, `diff`, `log`, `show`, `blame`, `branch --show-current`.

Never run: `add`, `commit`, `push`, `tag`, `merge`, `rebase`, `reset`, `stash`, `cherry-pick`, `clean`, `checkout`, `switch`, `restore`, branch delete, `gh pr create`.

No force push, no history rewrite. The human owns history and the remote.

A blocked git command is the system working. Do not route around it.

## Why

Review happens before history is written. An agent that commits removes the human's chance to inspect the diff.

## Text for the human

- Branch: `feat/<short>`, `fix/<short>`, `chore/<short>`.
- Commit: conventional, imperative, subject under 72 characters.
- Body: why, not what. Reference the issue.

Offer the command. Do not run it.

## Pull request

1. What changed, one paragraph.
2. Why, with the issue link.
3. How it was tested, with exact commands.
4. Risk and rollback.
5. Screenshots only for visible UI.

Keep it under 400 changed lines when possible. A larger change is split or explained.

## Checklist

- [ ] No git write command run
- [ ] No secret in the diff
- [ ] Commit text offered, not executed
- [ ] PR body has test evidence
