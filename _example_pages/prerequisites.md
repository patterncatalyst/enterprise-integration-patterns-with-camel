---
title: "Example Prerequisites"
order: 101
description: "What you need installed before running the pattern examples."
---

## Required tools

Before running any example, ensure you have the following installed:

| Tool | Version | Install |
|------|---------|---------|
| Java | 25 | `sdk install java 25.0.2-tem` (via SDKMAN) |
| Maven | 3.9+ | `sdk install maven` |
| Podman | 5.x+ | `sudo dnf install podman` (Fedora) |
| podman-compose | latest | `pip install podman-compose` |

## Start the stack

```bash
cd examples/_infra
podman-compose up -d
```

Verify all services are running:

```bash
podman-compose ps
```

See the [Prerequisites & Setup]({{ '/docs/00-prerequisites/' | relative_url }}) chapter for detailed installation instructions.
