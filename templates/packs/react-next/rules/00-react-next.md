---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "app/**"
  - "pages/**"
  - "src/app/**"
  - "src/pages/**"
---

# React and Next.js

## Server and client

- A component is a server component unless it needs state, effects, or browser APIs.
- Put `"use client"` at the smallest leaf that needs it.
- Never import a server-only module into a client component.
- Do not pass a secret or a raw database row to a client component.

## Data

- Fetch on the server when the data is not interactive.
- Handle loading, empty, and error states explicitly.
- No fetch in a render body. No effect that only copies props to state.

## UI

- Reuse the existing component and token before adding a new one.
- Every input has a label. Every image has alt text.
- Keyboard focus is visible. A click has a keyboard equivalent.
- No layout shift from a missing size on an image.

## State

- Local state first. A store needs a reason.
- Derived values are computed, not stored.
- Do not mutate props or state objects.

## Performance

- Measure before optimizing.
- No premature `useMemo` or `useCallback`.
- A large client bundle change is reported, not hidden.

## Checklist

- [ ] Server and client boundary correct
- [ ] Loading, empty, error handled
- [ ] Accessible label and focus
- [ ] No secret sent to the client
