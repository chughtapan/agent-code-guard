# `agent-code-guard/folder-readme-required`

**What it flags:** Folders with at least the configured number of direct
production/semantic children and no configured README file.

Default: 4 direct production children. The default documentation file is
`README.md`.

**Why:** A folder with several semantic children has become a boundary that a
reader needs to understand. The code tree can show inventory, but it cannot
explain ownership, public entry points, private implementation areas, or why
the folder exists. A short README makes that boundary explicit instead of
leaving future edits to infer it from imports.

This rule warns because missing documentation is a design smell, not a proof
of broken behavior.

## Before (flagged)

```text
src/rules/architecture/
├── exports/
├── folder-shape/
├── imports/
└── package-api/
```

The folder has enough semantic children to be a design surface, but there is
no local description of how those children relate.

## After (preferred)

```text
src/rules/architecture/
├── README.md
├── exports/
├── folder-shape/
├── imports/
└── package-api/
```

The README names the boundary, the public module, and the ownership rule for
new subfolders.

## Options

```js
{
  "agent-code-guard/folder-readme-required": ["warn", {
    // Minimum direct production/semantic children that require a README.
    // Default: 4.
    minFolderReadmeChildren: 4,

    // README filenames accepted for the folder. Default: ["README.md"].
    folderReadmeFileNames: ["README.md", "ARCHITECTURE.md"],
  }]
}
```

Generated files are ignored automatically. `index.ts` and configured
`facadeFiles` do not count as direct file children.
