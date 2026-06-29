# num2text

> A dyscalculia-friendly Chrome extension that adds word equivalents beside numbers while keeping the original numbers visible.

![Screenshot](https://i0.wp.com/auliawiradarmo.blog/wp-content/uploads/2026/02/Screenshot-2026-06-28-174232.png?w=893&ssl=1)

## About

While digital products are often designed to be user-friendly, they can be quietly inaccessible to neurodivergent users. Built in response to the assumption that numbers speak clearly to everyone, **num2text** is a critical interface intervention that helps reduce the invisible cognitive labour experienced by people with dyscalculia.

Integrated as an overlay within a Google Chrome extension, it aims to fix the environment rather than the user by expanding numerical representations into linguistic representations. The name itself comes from a design inversion: computers often translate words into numbers, and this tool turns numbers back into words for people.

## Features

- Toggle ON/OFF from the Chrome extension icon
- Badge shows current state: `ON` or `OFF`
- Automatically scans webpage text
- Adds number words in brackets
- Preserves original numerical symbols
- Restores original text when disabled
- Supports dynamically loaded pages, such as infinite scroll

### Supported number types

| Type | Example |
|---|---|
| Whole numbers | `3 → 3 (three)` |
| Large comma-separated numbers | `1,000 → 1,000 (one thousand)` |
| Negative numbers | `-5 → -5 (minus five)` |
| Decimals | `3.14 → 3.14 (three point one four)` |
| Percentages | `25% → 25% (twenty five percent)` |
| Decimal percentages | `12.5% → 12.5% (twelve point five percent)` |
| Currency | `£9.99 → £9.99 (nine pounds and ninety nine pence)` |
| Ordinals | `2nd → 2nd (second)` |
| Fractions | `1/2 → 1/2 (one over two)` |
| Vulgar fractions | `½ → ½ (one half)` |
| Times | `09:30 → 09:30 (nine thirty)` |
| Ranges | `3-5 → 3-5 (three to five)` |
| Scientific notation | `1e6 → 1e6 (one times ten to the power of six)` |
| Roman numerals | `World War II → World War II (two)` |

### Date support

num2text converts numeric month values in common date formats into named months.

| Original | Annotated |
|---|---|
| `2026-10-01` | `2026-October-01` |
| `2026/10/01` | `2026/October/01` |
| `01-10-2026` | `01-October-2026` |
| `01/10/2026` | `01/October/2026` |

For dates, only the month is converted. If the month cannot be confidently detected, the date is left unchanged.

## Limitations

- Very large numbers above `9,999,999,999` are not annotated
- Some formats may be ambiguous and can produce false positives
- Roman numerals may be detected incorrectly in some contexts
- Fractions and ranges can be ambiguous
- Phone-like numbers are skipped where possible, but detection may not be perfect
- Complex date formats are not fully supported
- Superscript and subscript numbers are not specially handled
- IDs, codes, references, and version numbers are not specially handled

## Installation

1. Create a folder called `num2text`.

2. Add the extension files:

```text
manifest.json
background.js
content.js
```

3. Open Google Chrome and go to:

```text
chrome://extensions
```

4. Turn on **Developer mode**.

5. Click **Load unpacked**.

6. Select the `num2text` folder.

7. Pin the extension from the puzzle-piece menu.

8. Click the extension icon to turn num2text `ON` or `OFF`.
