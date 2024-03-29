A (slightly incomplete) example typescript transform to rename APIs that are marked `@internal` with
a prefix, while preserving usage for internal packages.
Some code is borrowed from `@itwin/eslint-plugin`'s `no-internal` rule.

It is not possible when typescript is outputting es modules to replace usage of exports with a warning.
That is because exported values have no way to hook into usage of them, especially primitives which
can't even be wrapped in a `Proxy`.
In commonjs you could `Object.defineProperty(exports, "a", { get() {...} })`, but not in es modules.
