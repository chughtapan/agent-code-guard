# `agent-code-guard/no-public-infra-type-leak`

**What it flags:** Public API types whose type graph mentions an
infrastructure package — Kysely, Pino, Express, Fastify, Prisma,
TypeORM, Sequelize, Drizzle, Bunyan, Winston, MongoDB clients, transport
SDKs, etc. The list is configurable.

This is a sibling of `no-public-vendor-type-leak`. The difference: that
rule fires on any vendor type leak; this one specifically targets the
infrastructure substitutability problem (database client, logger,
transport).

**Why:** Infrastructure libraries are volatile implementation choices.
Today you use Kysely; in two years you might want Drizzle. If your public
types name `Kysely<Database>`, that swap is a breaking change for every
consumer. Worse, consumers now have to install your infrastructure
dependency to use your library — they get pulled into a dependency they
didn't ask for.

The classic substitutability test: could a consumer plausibly want to swap
your storage layer? If yes, the public type should be a port, not the
storage SDK.

## Before (flagged)

```ts
// src/index.ts
import type { Kysely } from "kysely";
import type { Logger } from "pino";

export interface ServerHost {
  readonly db: Kysely<Database>;
  readonly logger: Logger;
}
```

Consumers using `ServerHost` now need both `kysely` and `pino` installed,
and they're locked to those exact APIs forever.

## After (preferred) — package-owned ports

```ts
// src/ports.ts (public)
export interface StoragePort {
  readonly transaction: <A>(run: () => Promise<A>) => Promise<A>;
  readonly query: <A>(sql: string, params: unknown[]) => Promise<A[]>;
}

export interface LogPort {
  readonly info: (message: string, fields?: Record<string, unknown>) => void;
  readonly error: (message: string, fields?: Record<string, unknown>) => void;
}

// src/index.ts (public)
export interface ServerHost {
  readonly db: StoragePort;
  readonly logger: LogPort;
}
```

```ts
// src/internal/kysely-adapter.ts (private)
import type { Kysely } from "kysely";
import type { StoragePort } from "../ports";

export function fromKysely(db: Kysely<Database>): StoragePort {
  return {
    transaction: (run) => db.transaction().execute(() => run()),
    query: (sql, params) => db.executeQuery(/* ... */),
  };
}
```

Consumers depend on `StoragePort`. Swapping Kysely for Drizzle is now an
internal change with the same public surface.

## After (preferred) — opaque types when full ports are heavy

When defining a full port feels like overengineering, mark the type as
opaque:

```ts
// src/index.ts
export type Storage = unknown & { readonly __brand: "Storage" };
export type Logger = unknown & { readonly __brand: "Logger" };

export interface ServerHost {
  readonly db: Storage;
  readonly logger: Logger;
}
```

Consumers can pass values they obtained from `createServer()` factories but
can't read fields off them — which is correct, since field shape is your
implementation concern.

## Options

```js
{
  "agent-code-guard/no-public-infra-type-leak": ["warn", {
    // Packages considered "infrastructure" — types from these will be
    // flagged when they appear in your public surface. Each entry MUST
    // include both `package` and `reason`; bare strings are rejected by
    // the schema. Defaults cover common storage/transport/logging libraries
    // (Kysely, Pino, Express, etc.) — see option-schemas.ts. Add or override
    // entries for packages specific to your domain.
    infrastructureTypePackages: [
      { package: "@my-org/message-broker", reason: "internal transport SDK; consumers must not depend on its types" },
    ],
  }]
}
```

## Suppressing per-file via a directive

Per-line `eslint-disable-next-line` does not suppress architecture rules
cleanly. Use a file-header directive:

```ts
// @agent-code-guard/architecture-exception: no-public-infra-type-leak
// reason: this package IS a Pino plugin; consumers expect Pino types

import type { Logger } from "pino";

export interface PinoPlugin {
  readonly install: (logger: Logger) => Logger;
}
```

The `reason:` line is required; missing reasons surface as
`architecture-directive-parse-error` diagnostics.

If you find yourself suppressing on multiple files, your package is
genuinely infrastructure-coupled and the rule's complaint isn't the issue —
your design intent is. In that case, document the dependency in your README
and consider promoting the rule from warn to off in your config.

## Rationale

Infrastructure choices are the things you're MOST likely to want to change
later. Coupling them into your public types is exactly the future-pain
trade you should avoid. See
[`docs/architecture-boundary-ledger.md`](../../architecture-boundary-ledger.md)
for the full substitutability treatment.
