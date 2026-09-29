# For Future

## Dataset store

The current store keeps each parsed table in the memory of the single API process for 60 minutes ([ADR 004](adrs.md#adr-004)). A restart drops every dataset, and a second worker would not see uploads handled by the first.

That store can be replaced with Redis:

- The key is `dataset_id`. The value is the serialized table plus the filename, sheet name, and role metadata.
- The key TTL is the same 60 minutes.
- Any worker can serve `GET` and `POST` for an id created by another worker.
- A process restart keeps datasets until their TTL.

The HTTP contract stays the same. Callers still use `dataset_id`, `expires_at`, and `DELETE`.
