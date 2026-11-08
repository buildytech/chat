# @buildytech/ports

Interfaces for the shared Page Store:

- `CatalogPort` — list pages
- `PagePort` — get / save by id or unique slug
- `PublishPort` — publish / unpublish
- `PreviewPort` — preview URL

Host adapters (when present) implement these. The Creator SPA talks to ports over HTTP or the local mock, never to CMS internals. `published` on the Page DTO is a domain status, not a CMS product.
