# Contributing

Contributions are welcome — whether it's fixing a typo, improving an explanation, or adding a new example.

## Project structure

```
_docs/          — tutorial chapters (Jekyll docs collection)
_parts/         — part index pages
_layouts/       — Jekyll layouts
_includes/      — Jekyll includes
assets/         — CSS, diagrams (SVG + Excalidraw source)
examples/       — runnable Camel Quarkus projects
  _infra/       — Podman compose stack
  domain-model/ — shared canonical entities
presentations/  — EIP 101 + EIP 201 PPTX decks
scripts/        — setup-stack.sh, generate_diagram.py
```

## Conventions

- **Java DSL only** — no YAML DSL or XML DSL in code examples
- **Shipping domain** — all examples use orders, inventory, payments, shipping, notifications
- **Chapter front matter** — `title`, `order`, `part`, `description`, `duration`; the `part` value must match a `_parts` file's `part_name`
- **Quote YAML values with colons** — unquoted colons in front matter break the Jekyll build
- **Diagrams** — use `{% include excalidraw.html file="name" alt="..." caption="Figure N.x — ..." %}` and generate paired SVG + Excalidraw files with `scripts/generate_diagram.py`

## Running the site locally

```bash
bundle install
bundle exec jekyll serve
```

## Running examples

```bash
./scripts/setup-stack.sh          # start infrastructure
cd examples/<name>
mvn quarkus:dev                   # start with live reload
```

## Adding an example

1. Create `examples/<chapter>-<name>/` with a standard Quarkus project
2. Use `examples/domain-model` as a dependency for shared types
3. Add the example to the CI matrix in `.github/workflows/examples.yml`
4. Add a row to the examples table in `README.md`

## Adding a diagram

```python
import sys; sys.path.insert(0, "scripts")
import generate_diagram as g
g.OUT = "assets/diagrams"
g.emit("my-diagram", width, height,
       bands=[...], nodes=[...], edges=[...], notes=[...])
```

This produces `assets/diagrams/my-diagram.svg` and `assets/diagrams/my-diagram.excalidraw`. Embed with the include shown above.

## License

By contributing, you agree that your contributions will be licensed under [Apache 2.0](LICENSE).
