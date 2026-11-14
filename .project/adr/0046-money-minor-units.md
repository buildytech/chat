# 0046. Money: minor units in the document, major units for the model and the author

Status: accepted (owner t194u, t196u)

## Context

The registry's Codex v0.4 says a money prop is an integer in minor units (`fmtMoney(minor, currency)` divides by `10 ** digits`:
65000 RUB shows as 650). The model and the Inspector wrote 650, so dish-showcase showed `RUB 6.50`. Asking the model to multiply by
100 is unreliable. The symbol (`RUB 650` instead of `650 ₽`: the generated formatter hardcodes `en-US`) is upstream (codegen-x) and is
not touched here.

## Decision

- The document and the registry templates are untouched: money is stored in minor units.
- Which props are money is derived, never listed by hand: `scripts/lib/registry-derive.mjs` reads the registry sources (the property
  a block hands to `fmtMoney` as its whole first argument, following a local `$derived`; a number whose doc comment says "minor
  units") into `catalog/money.json`; a number prop with one of those names beside a `currency` prop of its object is money
  (`props-schema.ts`, `node.money`). The names are in `snapshot:check`.
- One pure pair, `toMajor` / `toMinor` (`catalog/money.ts`, digits 2 except JPY and KRW 0). One boundary module, `page-doc/money-view.ts`:
  - what the model reads is shown in major units: the page in the prompt, `get_page`, the `get_block` sample;
  - what it writes is converted before the gate: a whole `page`, and the value of every JSON Patch operation (a lone money prop, a
    row, a list, the props, a block; block adds and removes are tracked so later indices find their block);
  - the Inspector shows and takes major units (`InspectorField.money`, `inspectorShown`, `inspectorValue`) and stores minor ones.
- The prompt and `get_block` say nothing about minor units: the model never meets them. No "looks like major units" warning.
- Samples start from a sample amount (1000 minor = 10 whole units) instead of 0.
- Not converted: other hosts (client gate, export, Code pane) work on the stored document.

## Known edge

Changing `currency` on a row changes the digits the stored amount is shown with (RUB 65000 shows 650, JPY 65000 shows 65000): the
stored number is kept. The model and the author set the price after the currency.

## Tests

`scripts/m4-api-tests/money.test.ts`: names derived from the registry, `toMinor(toMajor(x)) = x` over many amounts and five
currencies, model-view to write to model-view identity on random pages, every patch shape, JPY, the Inspector, samples, and the Shashlyk
replay (the model writes 890, 89000 is stored, the card renders `RUB 890`, the next turn reads 890).
