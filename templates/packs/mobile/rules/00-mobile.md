# Mobile

## Platform files

- Treat `ios/` and `android/` as generated unless the project says otherwise.
- A native permission needs a user-facing reason string.
- Do not add a permission the feature does not use.
- Keep platform config changes in their own task.

## UI

- Handle safe areas, keyboard overlap, and small screens.
- Every touch target is at least 44 points.
- Loading, empty, offline, and error states are designed, not left blank.
- No hard-coded color. Use the theme token.

## Data and network

- Assume the network fails. Show a retry.
- Do not store a token in plain storage. Use the project's secure store.
- Cache reads that must survive a cold start.
- No background task without a stop condition.

## Release

Never run a store upload, a signing command, or a production build upload. Prepare the change and hand it to the human.

## Checklist

- [ ] Permission has a reason
- [ ] Offline state handled
- [ ] Touch target large enough
- [ ] No store command run
