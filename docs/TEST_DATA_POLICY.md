# Synthetic test-data policy

Automated local tests use only invented values explicitly labeled `Synthetic` or `SYNTHETIC TEST DATA`, documentation-only domains ending in `.invalid`, and reserved documentation IP address `192.0.2.44`. These records live only in isolated local D1 state and are deleted before and after the Worker suite.

Never use a learner’s real name, contact, schedule, goal, notes, application reference, or internal note in a fixture, screenshot, console output, GitHub Action, bug report, or documentation.

## Production acceptance record

If the user authorizes a production persistence test, create exactly one record with clearly synthetic values and a `.invalid` contact. Do not use a real communication address and do not cause a real follow-up. Record only the public reference and test time in the acceptance log—never the payload.

After protected admin verification:

1. mark the record `closed` with an internal note stating that it is synthetic;
2. delete it through an approved, authenticated D1 administrative procedure if retention is not required;
3. query only by its exact public reference to confirm absence;
4. remove related rate-limit rows only when their keyed hashes can be identified without exposing raw identifiers;
5. report `archived` or `deleted and absent on readback` precisely—do not call a status change deletion.

The initial UI intentionally has no delete button to reduce accidental destruction. Production deletion is an explicit administrative operation, not part of ordinary application review.
