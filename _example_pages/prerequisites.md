---
title: "Example Prerequisites"
order: 101
description: "What you need installed before running the pattern examples."
---

## Required tools

Before running any example, ensure you have the following installed:

| Tool | Version | Install |
|------|---------|---------|
| Java | 25 | `sdk install java 25.0.4-tem` (via SDKMAN) |
| Maven | 3.9+ | `sdk install maven` |
| Docker Engine | 29.x | `docker-ce` from Docker's Fedora/RHEL repository |
| Docker Compose | v2 plugin | `docker-compose-plugin` (run as `docker compose`) |

## Start the stack

```bash
./scripts/setup-stack.sh
```

Verify all services are running:

```bash
docker compose -p eip -f examples/_infra/compose.yaml ps
```

See the [Prerequisites & Setup]({{ '/docs/00-prerequisites/' | relative_url }}) chapter for detailed installation instructions.
