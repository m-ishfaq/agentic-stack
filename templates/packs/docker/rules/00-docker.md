# Docker

## Images

- Pin a version tag. Never `latest` in a deployable image.
- Multi-stage build for compiled languages.
- Run as a non-root user.
- No secret in a build argument or a layer. Secrets belong in the runtime environment.

## Compose

- No host network mode.
- Bind a database port only for local development, never in the production file.
- Name volumes.
- Set a health check for a service other services wait on.

## Commands

Never run `docker push`, `docker login`, or a deploy command. Building locally is allowed.

## Tests

A test container uses a disposable database and a nonstandard port. It never points at the development volume.

## Checklist

- [ ] Version tag, not `latest`
- [ ] Non-root user
- [ ] No secret in a layer
- [ ] Health check present
