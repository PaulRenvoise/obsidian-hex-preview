# hex-preview

A small Obsidian plugin that adds inline swatches to `#RRGGBB` and `#RRGGBBAA` colors.

## Features

- Case-insensitive six- and eight-digit hex detection. No shorthand, RGB, or HSL syntax.
- Live Preview and Reading view: swatches beside colors in prose and inline code.
- Native Bases tables, including embedded Bases: previews in text properties, individual list-property pills, and rendered formula values when the entire value is a hex color.
- Checkerboard backgrounds make transparency visible. The final two digits specify alpha (`00` transparent, `FF` opaque).
- Native Bases text, property controls, sorting, and filtering remain intact. Swatches are CSS decorations and disappear in focused text editors.
- No note rewriting, network requests, settings, custom view types, or color picker.

## Install the local build

1. Copy the `dist/hex-preview` folder into `<vault>/.obsidian/plugins/`.
2. Reload Obsidian.
3. In **Settings → Community plugins**, enable **Hex Preview** (plugin ID: `hex-preview`).

The folder contains `main.js`, `manifest.json`, and `styles.css`. For development, these files are also available at the project root after building. Do not install the entire source tree or `node_modules` into your vault.

## Usage

Write `#23264F` or `#23264F80` in a note, optionally in inline code. A small swatch appears before the original text. Bare hex values can still be Obsidian tags; the plugin preserves that behavior. Inline code avoids the ambiguity.

For Bases, store a hex color in a text property or each entry of a list property. When editing YAML directly, quote values beginning with `#`:

```yaml
---
color: "#23264F"
colors:
  - "#23264F"
  - "#23264F80"
---
```

Add `color` or `colors` as a column in the existing table view. No changes to the `.base` configuration are required. The `examples/` folder contains two sample notes and a Base; copy the folder to `Hex Preview examples` in a test vault to try both note and column previews.

## Deliberate boundaries

- Source mode, fenced code blocks, link destinations, linked filenames, frontmatter source, and math are excluded from note previews.
- Bases previews require a whole text value or list item to be a valid hex color. Arbitrary prose inside a property cell is not decorated.
- Ordinary Properties panels outside Bases are not included.
- Hex-looking tags keep their existing tag behavior.
- Bases integration relies on native `.bases-table-cell` markup because there is no documented cell-decoration hook. It may need adjustments after Obsidian updates.
- Minimum declared version: Obsidian 1.10.0. Local development uses API types from 1.14.4. Mobile and pop-out window behavior still need manual verification.

## Development

Use a recent Node.js LTS release and pnpm.

```sh
pnpm install
pnpm test
pnpm build
```

`pnpm dev` watches source changes and rebuilds `main.js`. `pnpm build` type-checks and produces the installable folder in `dist/`. CodeMirror and Obsidian are provided by the host app and excluded from the bundle.

The tests cover matching boundaries, editor syntax exclusions, preservation of native Bases nodes/text, list values, focus behavior, recycled cells, dynamic rows, and cleanup.

Inspired by [obsidian-color-preview](https://github.com/stephanteig/obsidian-color-preview). This is a new implementation focused on hex previews.
