# Appendix V: Camel TUI

Terminal-based dashboard for monitoring Camel integrations in real time.
The TUI provides a rich, interactive view of running routes, exchanges,
and message flow — all without leaving the terminal.

## Prerequisites

- **JBang with Camel CLI** — `jbang app install camel@apache/camel` (see Appendix U)
- **Java 25+** — `java -version`
- **Kafka** — running from the Podman stack (`./scripts/setup-stack.sh`)

## Running

Open two terminals.

**Terminal 1 — start the routes and data generator:**

```bash
cd examples/40-camel-tui
camel run *.yaml
```

The data generator sends a sample order to the REST API every 3 seconds.
The monitored route validates each order and publishes to Kafka topics.

**Terminal 2 — open the TUI dashboard:**

```bash
camel tui
```

The TUI auto-discovers the running integration and displays the dashboard.
Use number keys or Tab to switch between tabs.

## Dashboard tabs

| Tab | What it shows |
|-----|---------------|
| **Overview** | Running integrations, uptime, version, runtime type |
| **Log** | Real-time log output with filtering and search |
| **Activity** | Live exchange feed with throughput and latency stats |
| **Diagram** | ASCII route topology with metrics overlay |
| **Inspect** | Step-by-step exchange history with BHPV change tracking |
| **Errors** | Failed exchanges with stack traces and context |

## Key shortcuts

| Key | Action |
|-----|--------|
| `1`-`0` | Switch to tab 1-10 |
| `Tab` | Next tab |
| `Shift+Tab` | Previous tab |
| `F2` | Actions menu |
| `q` | Quit |
| `/` | Search/filter |
| `Enter` | Select/drill-down |
| `Esc` | Back/cancel |

---

*Verification status: unverified.*
