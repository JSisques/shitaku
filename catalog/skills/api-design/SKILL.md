---
name: api-design
description: 'Trigger: design an API, review an API, REST endpoint, OpenAPI spec, API versioning, breaking API change. Design HTTP APIs: resource naming, status codes, Problem Details errors, cursor pagination, idempotency, OpenAPI 3.1 contracts.'
---

## Activation Contract

Use when asked to design, review, or change an HTTP API: resources and endpoints, request and response shapes, status codes, errors, pagination, versioning, compatibility of a change, or an OpenAPI contract. Not for product requirements or user stories, prose API documentation or guides, implementing handlers or writing tests, or GraphQL, gRPC, and event-driven API design.

## Hard Rules

- Repository conventions first: inspect existing routes, OpenAPI documents, error bodies, field casing, pagination, and versioning; they win over the defaults in this skill.
- Contract first: the OpenAPI document is the source of truth; design and review it before any implementation.
- Resources are plural nouns in kebab-case paths (`/order-items`); no verbs in paths; nest at most one level (`/orders/{orderId}/items`).
- Use one field casing across the API; default to camelCase. Timestamps are RFC 3339 in UTC; IDs are opaque strings.
- Methods: GET reads and is safe; PUT replaces and DELETE removes, both idempotent; PATCH updates partially; POST creates or runs a non-idempotent action. Prefer a sub-resource or a state field over an action endpoint.
- Status codes: 200 OK, 201 Created with a `Location` header, 202 Accepted for async work, 204 No Content; 400 malformed, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 422 validation failed, 429 with `Retry-After`; 5xx only for server faults. Never return 200 with an error body.
- Errors use `application/problem+json` Problem Details (RFC 9457): `type`, `title`, `status`, `detail`, `instance`, plus extension members such as field errors. Never leak stack traces or internal identifiers.
- Collections use `cursor` pagination by default: an opaque cursor, a `limit` with a documented maximum, and `nextCursor` in the response. Use offset pagination only when the repository already does or random page access is a requirement.
- Filter and sort with query parameters (`?status=paid&sort=-createdAt`); never encode them in the path.
- Idempotency: retryable POST (and non-idempotent PATCH) operations accept an `Idempotency-Key` request header (IETF draft). The same key with the same payload returns the original result; reuse with a different payload is rejected with a Problem Details error.
- Versioning: when the repository has no convention, put the major version in the path (`/v1`); never put minor versions in the path.
- Classify every change as backward-compatible (new endpoint, new optional field or parameter, new response field) or breaking change (removed or renamed field, changed type or default, new required input, stricter validation, changed status code or semantics, new values in a closed enum).
- A breaking change requires a new major version and a deprecation path: mark the old operations `deprecated: true`, send the `Deprecation` header (RFC 9745) and a `Sunset` header (RFC 8594) with the removal date, publish a migration note, and run both versions until the sunset date.
- Every operation declares its security scheme; never put secrets or tokens in paths or query strings.
- Stay generic: do not assume any framework, gateway, or tool.

## Decision Gates

| Condition                                                                 | Action                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| The repository has API conventions or an OpenAPI document                 | Follow them over the defaults in this skill                                   |
| No convention is found                                                    | Apply the defaults above and list each one used                               |
| An operation does not fit a CRUD method                                   | Model a sub-resource or state change; use a POST action only as a last resort |
| A collection can grow without bound                                       | Paginate it with a cursor from the first version                              |
| A write may be retried by clients or networks                             | Require an `Idempotency-Key` on it                                            |
| A proposed change is backward-compatible                                  | Ship it in the current major version                                          |
| A proposed change is a breaking change                                    | Add a new major version, deprecate the old one, and plan the sunset           |
| Compatibility of a change is unclear                                      | Treat it as breaking and ask                                                  |
| The request is product requirements, prose docs, implementation, or tests | Out of scope; leave it to the matching workflow                               |
| The API is GraphQL, gRPC, or event-driven                                 | Out of scope; say so and stop                                                 |

## Execution Steps

1. Confirm the goal: a new API, a change to an existing one, or a review.
2. Read the conventions: existing routes, OpenAPI documents, error bodies, casing, pagination, and versioning.
3. Model resources, relationships, and operations; choose methods and status codes.
4. Define request and response schemas, errors, pagination, filtering, and idempotency.
5. For changes, classify each one as backward-compatible or breaking change, and plan versioning and deprecation.
6. Write or update the OpenAPI 3.1 contract.
7. Check the contract against the hard rules and the repository conventions.
8. Report the outcome.

## Output Contract

Return the OpenAPI 3.1 contract (or the diff to the existing one); a decision summary with the conventions applied and their source and each default used; the compatibility classification of every change with its migration and deprecation plan; review findings ordered by severity when reviewing; and open questions.

### Reference contract

```yaml
openapi: 3.1.0
info: { title: Orders API, version: 1.0.0 }
security:
  - bearerAuth: []
paths:
  /v1/orders:
    get:
      operationId: listOrders
      parameters:
        - { name: cursor, in: query, schema: { type: string } }
        - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
      responses:
        '200':
          description: One page of orders
          content:
            application/json:
              schema: { $ref: '#/components/schemas/OrderPage' }
        '400': { $ref: '#/components/responses/Problem' }
    post:
      operationId: createOrder
      parameters:
        - { name: Idempotency-Key, in: header, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/Order' }
      responses:
        '201':
          description: Order created
          headers:
            Location: { schema: { type: string } }
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Order' }
        '409': { $ref: '#/components/responses/Problem' }
        '422': { $ref: '#/components/responses/Problem' }
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer }
  responses:
    Problem:
      description: Error in Problem Details format
      content:
        application/problem+json:
          schema: { $ref: '#/components/schemas/Problem' }
  schemas:
    Problem:
      type: object
      properties:
        { type: { type: string }, title: { type: string }, status: { type: integer }, detail: { type: string } }
    Order:
      type: object
      required: [id, status]
      properties: { id: { type: string }, status: { type: string } }
    OrderPage:
      type: object
      required: [items]
      properties:
        items: { type: array, items: { $ref: '#/components/schemas/Order' } }
        nextCursor: { type: [string, 'null'] }
```
