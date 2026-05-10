# Security Specification - WriteSpace AI

## Data Invariants
1. **Ownership**: Every competitor analysis, blog post, and search record must have an `authorId` that matches the `request.auth.uid`.
2. **Settings**: Application settings are private to the user and identified by their `userId` as the document ID.
3. **Drafts**: Blog post drafts are stored per-user for autosave persistence.
4. **Immutability**: Once created, `authorId` cannot be changed on any document.
5. **Timestamps**: `createdAt` can only be set on creation, and `updatedAt` should match `request.time`.

## The "Dirty Dozen" Payload Test Suite

| Test ID | Method | Collection | Description | Expected |
|---------|--------|------------|-------------|----------|
| DD-01 | Create | users/public | Attempt to write to a non-existent/catch-all path | DENY |
| DD-02 | Create | settings/{otherId} | Attempt to write settings for another user | DENY |
| DD-03 | Update | settings/{uid} | Attempt to polarize 'updatedAt' to a client-time | DENY |
| DD-04 | Create | competitors | Missing required field 'url' | DENY |
| DD-05 | Create | competitors | Injecting shadow field 'isVerified: true' | DENY |
| DD-06 | List | competitors | Attempt to list without authorId filter | DENY |
| DD-07 | Create | posts | Setting status to 'invalid_status' | DENY |
| DD-08 | Update | posts | Changing 'authorId' of an existing post | DENY |
| DD-09 | Delete | settings/{uid} | Unauthenticated delete attempt | DENY |
| DD-10 | Create | searches | Query string longer than 1000 characters | DENY |
| DD-11 | Update | settings/{uid} | Injecting unknown field 'hack: true' during update | DENY |
| DD-12 | Get | competitors/{id} | Unverified email account reading data | DENY |

## Implementation Verification
The current `firestore.rules` enforces:
1. `isVerified()` gate (requires `email_verified == true`).
2. `isValidId()` for all path variables.
3. `incoming().diff(existing()).affectedKeys().hasOnly()` for settings updates.
4. Mandatory field type and size checks in all `isValid[Entity]` helpers.
5. Strict `authorId` equality check against `request.auth.uid`.
