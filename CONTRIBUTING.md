# Contributing

Contributions are welcome — whether it's fixing a typo, improving an explanation, or adding a new example.

## Project structure

```
_docs/          — tutorial chapters (Jekyll docs collection)
_parts/         — part index pages
_layouts/       — Jekyll layouts
_includes/      — Jekyll includes
assets/         — CSS, diagrams (SVG + Excalidraw source)
examples/       — runnable Camel projects (Quarkus + Spring Boot variants)
  _infra/       — Docker Compose stack
  domain-model/ — shared canonical entities
presentations/  — EIP 101 + EIP 201 PPTX decks
scripts/        — setup-stack.sh, generate_diagram.py
```

## Conventions

- **Java DSL** — route examples use Camel's Java DSL on both Quarkus and Spring Boot
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
./scripts/setup-stack.sh                    # start infrastructure
cd examples/<name>/quarkus && mvn quarkus:dev       # Quarkus with live reload
cd examples/<name>/spring-boot && mvn spring-boot:run  # Spring Boot
cd examples/<name>/yaml-dsl && camel run *             # YAML DSL (Camel CLI)
```

## Running the tests

The integration tests use Testcontainers, which talks to Docker Engine on
`/var/run/docker.sock` — the same engine the dev stack runs on, on the
`default` docker context. If the daemon is down, or your user is not in the
`docker` group, they fail with "Could not find a valid Docker environment":

```bash
docker info >/dev/null && echo ok
```

The tests and the dev stack **cannot both be up** — both bind 9092, 6379, 5432
and 6650. Stop the stack first:

```bash
docker compose -p eip -f examples/_infra/compose.yaml down
./scripts/build-all-examples.sh --with-tests     # ~2 hours, sequential
./scripts/build-all-examples.sh 09-routing       # or just one
```

`build-all-examples.sh --with-tests` runs `mvn verify` per project after checking
the Docker daemon. Running `mvn verify` directly in an example directory works
the same way.

## Adding an example

1. Create `examples/<chapter>-<name>/` with `quarkus/` and `spring-boot/` subdirectories (add `yaml-dsl/` for patterns that translate cleanly to YAML DSL)
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
