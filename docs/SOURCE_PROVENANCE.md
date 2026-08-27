# Source provenance

## Selected source

The migration source is the exact current/latest Sites deployment recorded on 2026-08-26, not Candidate 03, the earlier V7 rollback snapshot, or a visually similar worktree.

- Sites project: `appgprj_6a654c29bed48191b866127d8b25d690`
- Deployed Sites version: `27`
- Saved version: `appgver_ca850925664481918a76f1ed1d4a1f76`
- Exact source commit: `c5585bbacb8e328797f4870a279f1ee049517087`
- Sites source package: 214 files, 172,165,120 bytes
- Sites content hash: `sha256:9d5242d2c5a515f33827af3700f33c5c893bdaace779989a894e4683497013e6`
- Sites source file identifier: `file_00000000df6081f5ab6572052e8557f1`
- Reproducible clean tracked source: `git archive --format=tar c5585bbacb8e328797f4870a279f1ee049517087`

The independently retained upload TAR was also verified as 168,316,089 bytes, 245 entries, with SHA-256 `5f4817d6b18fa1f074a966983ce0bc71eb114db0fd13b20eea30da7e5c5cd4bf`.

## Packaging method

The public experience was copied into this new package from the clean tracked archive for the exact commit. Only the required static site files were admitted:

- accepted V7 component and styling;
- current tariff/offer-domain data needed by the public UI;
- media runtime and sequence contract;
- public images, posters, videos, and media fallbacks.

The following were deliberately excluded:

- Sites hosting configuration and deployment controls;
- historical builds and rollback snapshots;
- old hosting-specific application APIs;
- old administration components;
- build artifacts and local caches;
- learner records, real application records, internal notes, credentials, and secrets.

The GitHub Pages and Worker adaptations are new code under this directory. They do not mutate the authoritative reference or the accepted Sites deployment.

## Preservation boundary

The current public Sites deployment remains the rollback reference and is read-only. Deploying this package must create a separate public origin. It must never overwrite, unpublish, redirect, or reconfigure the Sites project.
