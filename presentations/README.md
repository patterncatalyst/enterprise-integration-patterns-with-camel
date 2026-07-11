# EIP Presentations

Two Red Hat-branded slide decks covering the 65 Enterprise Integration Patterns from Hohpe & Woolf, implemented with Apache Camel on Quarkus.

| Deck | Slides | Focus |
|------|--------|-------|
| **EIP 101** | ~85 | Conceptual guide — pattern language, categories, visual explanations |
| **EIP 201** | ~120 | Implementation deep-dive — Java DSL, code examples, case studies |

## Prerequisites

- Node.js with `pptxgenjs` installed globally (`npm install -g pptxgenjs`)
- LibreOffice (`soffice`) and poppler (`pdftoppm`) for diagram conversion
- ImageMagick for PNG trimming

## Build

```bash
# Convert project diagrams (SVG → PNG)
cd src && bash convert-diagrams.sh

# Build both decks
bash build.sh

# Or build individually
export NODE_PATH=$(npm root -g)
node eip-101.js    # → ../eip-101.pptx
node eip-201.js    # → ../eip-201.pptx
```

## Structure

```
presentations/
├── eip-101.pptx              # EIP 101 output
├── eip-201.pptx              # EIP 201 output
├── README.md
└── src/
    ├── eip-101.js             # EIP 101 deck builder
    ├── eip-201.js             # EIP 201 deck builder
    ├── deck-helpers.js        # shared slide helpers (PptxGenJS)
    ├── build.sh               # builds both decks
    ├── convert-diagrams.sh    # SVG → PNG conversion
    ├── assets/                # brand images (cover, divider, logos)
    └── png/                   # converted diagram PNGs (26 diagrams)
```

## Diagrams

The decks embed 26 Excalidraw diagrams from the tutorial site, converted to PNG. Run `convert-diagrams.sh` to regenerate after adding or updating diagrams in `assets/diagrams/`.
