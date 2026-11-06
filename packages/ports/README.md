# @buildytech/ports

Interfaces for the shared Page Store:

- `CatalogPort` — list pages
- `PagePort` — get / save by id or unique slug
- `PublishPort` — publish / unpublish
- `PreviewPort` — preview URL

Implementations live in `adapters/*`. The chat SPA talks to ports over HTTP (or a mock), never to CMS internals.
