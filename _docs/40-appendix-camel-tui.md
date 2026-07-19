---
title: "Appendix V: Camel TUI"
order: 40
part: appendices
description: "The Camel TUI terminal dashboard — monitoring routes, tracing exchanges, inspecting message flow, and debugging integration issues without leaving the terminal."
duration: "25 minutes"
---

The Camel CLI command set covered in Appendix U gives you single-shot commands for inspecting routes, dumping exchanges, and managing integrations. But when you need a continuous view — watching exchanges flow through routes, spotting latency spikes, tracing a failed message step-by-step — you need something richer than repeated `camel get` calls.

The Camel TUI (Terminal User Interface) is a full-featured dashboard that runs entirely in your terminal. Available since Camel 4.14, it provides real-time monitoring of running Camel integrations with tabbed views for routes, exchanges, diagrams, metrics, and debugging. It works over SSH, inside containers, and in any environment where a browser is unavailable or impractical. Think of it as a terminal-native alternative to Hawtio or Jolokia-based monitoring.

The code is in `examples/40-camel-tui/`.

## Getting started

The TUI is part of the Camel CLI. If you followed the installation in Appendix U, you already have it:

```bash
camel tui
```

That single command auto-discovers all running Camel integrations on the local machine and opens the dashboard. If multiple integrations are running, the TUI shows all of them in the Overview tab — select one to drill into its routes and exchanges.

To target a specific integration by name or PID:

```bash
camel tui my-integration
camel tui 12345
```

### The demo routes

To explore the TUI with live data, start the demo routes in one terminal and open the TUI in another.

**Terminal 1 — start the routes:**

```bash
cd examples/40-camel-tui
camel run *.yaml
```

This starts two YAML DSL route files:

1. **monitored-route.yaml** — a REST API that accepts orders, validates them, and publishes to Kafka topics
2. **data-generator.yaml** — a timer-based route that generates sample orders every 3 seconds

The data generator feeds the REST API with a rotating set of five orders (shipping containers, pallet jacks, cargo nets, dock bumpers, and freight scales), giving you a steady stream of exchanges to monitor in the TUI.

**Terminal 2 — open the dashboard:**

```bash
camel tui
```

The TUI discovers the running integration and populates all tabs with live data. Leave both terminals running as you work through the sections below.

### The monitored route

The REST API in `monitored-route.yaml` accepts JSON orders and validates that the required fields — `orderId`, `customerId`, and `item` — are present:

```yaml
- rest:
    path: /api/orders
    post:
      - to: "direct:validate-order"
      - consumes: application/json
        produces: application/json

- route:
    id: validate-order
    from:
      uri: "direct:validate-order"
    steps:
      - unmarshal:
          json:
            library: Jackson
      - log: "Order received: ${body}"
      - choice:
          when:
            - simple: "${body[orderId]} != null && ${body[customerId]} != null && ${body[item]} != null"
              steps:
                - setHeader:
                    name: receivedAt
                    simple: "${date:now:yyyy-MM-dd'T'HH:mm:ss.SSSZ}"
                - setHeader:
                    name: processingNode
                    simple: "tui-demo-node-1"
                - log: "Order accepted: ${body[orderId]} — customer ${body[customerId]}, item: ${body[item]}"
                - marshal:
                    json:
                      library: Jackson
                - to:
                    uri: "kafka:eip.orders.validated"
          otherwise:
            steps:
              - log:
                  message: "Order rejected — missing required fields"
                  loggingLevel: WARN
              - setHeader:
                  name: CamelHttpResponseCode
                  constant: 400
              - to:
                  uri: "kafka:eip.orders.rejected"
              - setBody:
                  simple: '{"status":"rejected","reason":"missing required fields"}'
```

Valid orders flow to `eip.orders.validated`. A second route consumes from that topic, applies a 100ms processing delay, and publishes to `eip.orders.processed`:

```yaml
- route:
    id: process-validated-orders
    from:
      uri: "kafka:eip.orders.validated"
    steps:
      - unmarshal:
          json:
            library: Jackson
      - log: "Processing validated order: ${body[orderId]}"
      - delay:
          constant: 100
      - setHeader:
          name: processingStatus
          constant: "PROCESSING"
      - log: "Order ${body[orderId]} status set to PROCESSING"
      - marshal:
          json:
            library: Jackson
      - to:
          uri: "kafka:eip.orders.processed"
```

This multi-route, multi-topic setup gives the TUI plenty to display: three routes, three Kafka topics, choice-based branching, headers being set, delays introducing measurable latency, and a steady stream of exchanges flowing end-to-end.

### The data generator

The `data-generator.yaml` route fires every 3 seconds and cycles through five sample orders:

```yaml
- route:
    id: order-generator
    from:
      uri: "timer:ordergen?period=3000"
    steps:
      - choice:
          when:
            - simple: "${exchangeProperty.CamelTimerCounter} == null || ${exchangeProperty.CamelTimerCounter} % 5 == 1"
              steps:
                - setBody:
                    constant: '{"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}'
            - simple: "${exchangeProperty.CamelTimerCounter} % 5 == 2"
              steps:
                - setBody:
                    constant: '{"orderId":"ORD-002","customerId":"C-102","item":"Pallet Jack","quantity":5}'
            - simple: "${exchangeProperty.CamelTimerCounter} % 5 == 3"
              steps:
                - setBody:
                    constant: '{"orderId":"ORD-003","customerId":"C-103","item":"Cargo Net","quantity":12}'
            - simple: "${exchangeProperty.CamelTimerCounter} % 5 == 4"
              steps:
                - setBody:
                    constant: '{"orderId":"ORD-004","customerId":"C-104","item":"Loading Dock Bumper","quantity":8}'
          otherwise:
            steps:
              - setBody:
                  constant: '{"orderId":"ORD-005","customerId":"C-105","item":"Freight Scale","quantity":1}'
      - log: "Sending order: ${body}"
      - setHeader:
          name: Content-Type
          constant: application/json
      - to:
          uri: "http://localhost:8088/api/orders"
```

The rotating orders ensure that the TUI's Activity and Inspect tabs show varied data rather than the same exchange repeated.

## Dashboard layout

{% include excalidraw.html file="40-camel-tui-dashboard" alt="Camel TUI dashboard layout" caption="Figure V.1 — The Camel TUI dashboard layout: tab bar, main content panel, and status bar." %}

The TUI occupies the full terminal window and divides it into three regions:

| Region | Location | Purpose |
|--------|----------|---------|
| **Tab bar** | Top row | Lists all available tabs; the active tab is highlighted |
| **Content panel** | Center | The main view area for the selected tab |
| **Status bar** | Bottom row | Shows the connected integration name, PID, uptime, and key hints |

Navigate between tabs using the number keys (`1` through `0` for tabs 1-10) or cycle through them with `Tab` and `Shift+Tab`. The status bar always shows context-sensitive keyboard shortcuts for the current tab.

## Overview tab

The Overview tab is the landing page. It displays all running Camel integrations discovered on the local machine in a summary table:

| Column | Description |
|--------|-------------|
| **Name** | The integration name (derived from the filename or CamelContext name) |
| **PID** | Operating system process ID |
| **Status** | `Started`, `Stopped`, `Suspended` |
| **Uptime** | How long the integration has been running |
| **Version** | Camel version (e.g., 4.20.0) |
| **Runtime** | The runtime type: `camel-jbang`, `quarkus`, `spring-boot`, or `camel-main` |

With the demo routes running, you will see a single entry for the `camel-jbang` integration with status `Started`. If you were also running a Quarkus or Spring Boot application, each would appear as a separate row.

Below the integrations table, the Overview tab shows the route summary: total routes, routes started, routes stopped, and total exchanges completed. For the demo, you will see three routes (validate-order, process-validated-orders, order-generator) all in the `Started` state, with the exchange count climbing as the data generator fires every 3 seconds.

### Infrastructure services

If you are using `camel infra` to manage infrastructure services (Kafka, Redis, PostgreSQL), the Overview tab also shows those services with their status and ports. This gives you a single pane of glass for both your integration routes and the infrastructure they depend on.

## Log tab

The Log tab streams real-time log output from the running integration. As the demo routes process orders, you will see a continuous flow of log entries:

```
INFO  Order received: {"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}
INFO  Order accepted: ORD-001 — customer C-101, item: Shipping Container
INFO  Processing validated order: ORD-001
INFO  Order ORD-001 status set to PROCESSING
INFO  Sending order: {"orderId":"ORD-002","customerId":"C-102","item":"Pallet Jack","quantity":5}
INFO  Order accepted: ORD-002 — customer C-102, item: Pallet Jack
```

### Filtering and search

Press `/` to open the search filter. Type a search term and the log view filters to matching lines only. This is invaluable when a noisy route produces hundreds of log lines and you need to find a specific order or error.

You can also filter by log level. The TUI supports adjusting the log level in real time — raise it to `WARN` to see only warnings and errors, or lower it to `DEBUG` to capture detailed routing decisions. The level change affects only the TUI display; it does not modify the running integration's logger configuration.

### Log buffer

The TUI maintains a scrollable buffer of recent log entries. Use the arrow keys or `Page Up`/`Page Down` to scroll through history. The buffer size is bounded, so very old entries are eventually evicted, but it retains enough history for practical debugging.

## Activity tab

The Activity tab is a live exchange feed. Each exchange that flows through the integration appears as a row with timing and status information:

| Column | Description |
|--------|-------------|
| **Exchange ID** | The unique identifier for the exchange |
| **Route** | The route that processed the exchange |
| **Status** | `Completed` or `Failed` |
| **Duration** | Total processing time for the exchange |
| **Timestamp** | When the exchange was created |

With the demo routes running, you will see exchanges appearing every 3 seconds — one from the data generator's HTTP call and the downstream exchanges through the validation and processing routes.

### Throughput and latency statistics

The Activity tab header shows aggregate statistics:

- **Total exchanges** — cumulative count since the integration started
- **Completed / Failed** — counts and percentages
- **Throughput** — messages per second, averaged over a rolling window
- **Latency percentiles** — p50, p95, and max processing times

For the demo routes, expect p50 latency around 100-120ms (dominated by the deliberate 100ms delay in the processing route) and throughput around 0.3 messages per second (one order every 3 seconds).

### Identifying bottlenecks

The latency percentiles immediately reveal performance characteristics. If your p95 is significantly higher than your p50, you have occasional slow exchanges — likely caused by garbage collection pauses, Kafka producer batching delays, or downstream service latency. The Activity tab lets you spot these patterns without setting up a full metrics pipeline.

## Diagram tab

The Diagram tab renders an ASCII route topology — a directed acyclic graph (DAG) showing how routes, processors, and endpoints connect. For the demo routes, the diagram shows:

```
                 ┌──────────────────┐
                 │  timer:ordergen  │
                 └────────┬─────────┘
                          │
                    ┌─────▼──────┐
                    │   choice    │
                    └─────┬──────┘
                          │
               ┌──────────▼───────────┐
               │ http://localhost:8088 │
               │     /api/orders      │
               └──────────┬───────────┘
                          │
                 ┌────────▼─────────┐
                 │ direct:validate  │
                 └────────┬─────────┘
                          │
                    ┌─────▼──────┐
                    │   choice    │
                    └──┬──────┬──┘
                       │      │
          ┌────────────▼┐  ┌──▼────────────┐
          │  kafka:eip   │  │  kafka:eip    │
          │  .orders     │  │  .orders      │
          │  .validated  │  │  .rejected    │
          └──────┬───────┘  └───────────────┘
                 │
          ┌──────▼───────┐
          │  delay(100)  │
          └──────┬───────┘
                 │
          ┌──────▼───────┐
          │  kafka:eip   │
          │  .orders     │
          │  .processed  │
          └──────────────┘
```

The actual TUI rendering is richer than this static approximation — it uses box-drawing characters, color coding (green for active routes, red for failed), and dynamic layout based on your terminal width.

### Features

The Diagram tab supports several interaction modes:

**Drill-down** — Select a route node and press `Enter` to zoom into its processors. For the `validate-order` route, drilling down shows the unmarshal, log, choice, setHeader, marshal, and Kafka producer steps individually.

**External endpoints overlay** — Kafka topics, REST services, and other external endpoints appear with connection lines showing which routes produce to and consume from each endpoint. This is especially useful for understanding message flow across multiple routes that share a topic.

**Metrics overlay** — Each node in the diagram can display its exchange count and average processing time. This turns the static topology into a live performance map. Nodes with high latency or failure rates stand out visually.

**Source code view** — Press `s` on a selected route to see its YAML or Java DSL source alongside the diagram. This is useful when the diagram shows a processor you do not recognize and you want to see the exact route definition.

## Inspect tab

The Inspect tab is the most powerful debugging tool in the TUI. It provides a step-by-step view of how a single exchange was processed — every processor it visited, what changed at each step, and how long each step took.

### Selecting an exchange

The Inspect tab shows a list of recent exchanges. Select one and press `Enter` to see its processing history. Each row in the detail view represents a processor the exchange passed through:

| Column | Description |
|--------|-------------|
| **Step** | Sequential step number |
| **Processor** | The processor name (e.g., `log`, `choice`, `to:kafka`) |
| **Duration** | Time spent in this processor |
| **BHPV** | Change indicators for Body, Headers, Properties, Variables |

### BHPV change tracking

The BHPV column is the key insight. Each letter is highlighted when the corresponding part of the exchange changed at that step:

- **B** (Body) — The message body was modified (e.g., by `unmarshal`, `setBody`, `transform`)
- **H** (Headers) — A header was added, modified, or removed (e.g., by `setHeader`, `removeHeader`)
- **P** (Properties) — An exchange property changed
- **V** (Variables) — An exchange variable changed

For the demo routes, when inspecting a validated order exchange you will see:

| Step | Processor | Duration | BHPV |
|------|-----------|----------|------|
| 1 | unmarshal (json) | 2ms | **B** |
| 2 | log | 0ms | |
| 3 | choice | 0ms | |
| 4 | setHeader (receivedAt) | 0ms | **H** |
| 5 | setHeader (processingNode) | 0ms | **H** |
| 6 | log | 0ms | |
| 7 | marshal (json) | 1ms | **B** |
| 8 | to (kafka:eip.orders.validated) | 12ms | |

The `B` indicator lights up at steps 1 and 7 (unmarshal and marshal change the body representation), and `H` lights up at steps 4 and 5 (setting the `receivedAt` and `processingNode` headers).

### Viewing changes

Select any step and press `Enter` to see the full exchange state at that point — the complete body, all headers, properties, and variables. A diff view highlights exactly what changed compared to the previous step. This is invaluable for debugging transformation issues where you need to see precisely when and how a field was modified.

### Waterfall timing view

Press `w` on a selected exchange to see a waterfall timing view. Each processor is shown as a horizontal bar proportional to its duration. The 100ms delay processor in the `process-validated-orders` route will dominate the waterfall, making it immediately obvious where time is spent.

### Diagram replay

Press `d` on a selected exchange to see its path highlighted on the route diagram. The processors the exchange visited are highlighted in green, while the ones it skipped (e.g., the `otherwise` branch of a choice) remain dimmed. This visual replay connects the abstract step list to the concrete route topology.

## Errors tab

The Errors tab aggregates information about failed exchanges:

### Failure details

Each failed exchange is listed with:

- **Exchange ID** — click to inspect the exchange step-by-step (jumps to the Inspect tab)
- **Route** — the route where the failure occurred
- **Processor** — the specific processor that threw the exception
- **Exception** — the exception class and message
- **Timestamp** — when the failure occurred

### Stack traces

Select a failed exchange and the full Java stack trace is displayed in the content panel. For integration errors, the stack trace typically shows the Camel processor chain leading to the failure, the component-specific error (e.g., Kafka producer timeout, HTTP connection refused), and the root cause.

### Exchange context at failure

Below the stack trace, the Errors tab shows the exchange state at the point of failure — the message body, all headers, and properties. This context is often the difference between understanding a failure from the stack trace alone and needing to reproduce it: you can see exactly what data was being processed when the error occurred.

### Error patterns

When multiple exchanges fail with the same exception, the Errors tab groups them and shows the frequency. A sudden spike in `org.apache.kafka.common.errors.TimeoutException` failures, for example, immediately points to Kafka connectivity issues rather than a bug in your route logic.

## Actions menu

Press `F2` from any tab to open the Actions menu. This menu provides interactive operations that go beyond passive monitoring.

### Send test messages

The Actions menu can send test messages to REST endpoints defined in your routes. For the demo routes, it detects the `POST /api/orders` endpoint and lets you compose and send a test order directly from the TUI. The response appears inline, and the resulting exchange shows up in the Activity and Inspect tabs.

This is useful for ad-hoc testing — send a malformed order to verify the validation logic, or send a specific order to trace its path through the route.

### Run example routes

The Actions menu provides access to the Camel examples catalog. You can browse and run example routes (Kamelets, EIP demonstrations, component samples) directly from the TUI. Each example starts in a separate integration that appears in the Overview tab.

### Infrastructure management

If you have `camel infra` configured, the Actions menu lets you start and stop infrastructure services (Kafka, Redis, PostgreSQL) without leaving the TUI. This is the interactive equivalent of `camel infra start kafka`.

### Doctor

The Doctor action runs a diagnostic check on the running integration. It looks for common issues:

- Missing or unresolved component dependencies
- Endpoints that are configured but unreachable (e.g., Kafka broker down)
- Configuration properties that reference undefined placeholders
- Routes that are defined but not started

The Doctor output appears in the content panel with actionable suggestions for each issue found.

### Screenshot

The screenshot action captures the current TUI state to a file. This is useful for documentation, bug reports, or sharing the current state of your integration with a colleague. The output can be saved as a text file preserving the terminal rendering.

## Advanced tabs

Beyond the core tabs, the TUI includes specialized views for deeper inspection. These tabs appear automatically when the running integration has the relevant components or configurations.

### Beans

The Beans tab lists all beans registered in the Camel context — CDI beans in Quarkus, Spring beans in Spring Boot, or manually registered beans in standalone Camel. For each bean, it shows the bean name, type, scope, and whether it is a Camel component, data format, or language. This is useful for verifying that dependency injection is wired correctly.

### Circuit Breaker

If your routes use the Circuit Breaker EIP (backed by Resilience4j or MicroProfile Fault Tolerance), this tab shows the state of each circuit breaker:

| Column | Description |
|--------|-------------|
| **Name** | The circuit breaker name |
| **State** | `CLOSED` (normal), `OPEN` (tripped), or `HALF_OPEN` (testing recovery) |
| **Failure rate** | Percentage of failures in the sliding window |
| **Slow call rate** | Percentage of calls exceeding the slow-call threshold |
| **Calls** | Total, successful, and failed counts |

This tab lets you monitor circuit breaker behavior in real time — watch a breaker trip when a downstream service goes down, then recover when it comes back.

### CVE Audit

The CVE Audit tab scans the integration's dependencies for known security vulnerabilities. It reports:

- Component name and version
- CVE identifier and severity (Critical, High, Medium, Low)
- Whether a fix is available and in which version

This is a quick security health check that does not require a separate scanning tool.

### Health

The Health tab shows Camel health check results — both liveness and readiness checks. Each check is listed with its status (`UP` or `DOWN`), the check group (e.g., `camel`, `kafka`, `context`), and details about what was checked.

For the demo routes, expect to see:

- `context` — UP (the CamelContext is running)
- `routes` — UP (all routes are started)
- `consumers` — UP (Kafka consumers are connected)

When a health check fails, the details column explains why — for example, "Kafka consumer not connected: broker localhost:9092 unreachable."

### Memory

The Memory tab displays JVM memory usage:

- **Heap** — used, committed, and maximum heap size
- **Non-heap** — metaspace and code cache usage
- **GC** — garbage collector type, collection count, and total pause time

A simple bar chart visualizes heap usage over time. Sudden increases in GC pause time or steady heap growth suggest a memory leak or undersized heap.

### Metrics

If the integration has Micrometer configured (common in Quarkus and Spring Boot deployments), the Metrics tab shows all registered metrics:

- Camel route metrics (exchange counts, timing histograms)
- Component-specific metrics (Kafka consumer lag, HTTP client connection pool)
- Custom application metrics

Each metric is displayed with its current value, and counter/timer metrics show their rate of change.

### Spans

When OpenTelemetry is configured, the Spans tab shows distributed trace spans for recent exchanges. Each span includes:

- Trace ID and span ID
- Operation name (route or processor)
- Duration and status
- Parent span (for nested calls)

This is useful for correlating Camel processing with upstream and downstream services in a distributed system, especially when the full tracing backend (Jaeger, Tempo) is not available or convenient.

## AI integration

The TUI includes an experimental AI panel, activated with:

```bash
camel tui --mcp
```

This starts an embedded MCP (Model Context Protocol) server that exposes the running integration's state — routes, exchanges, errors, configuration — to an AI assistant. The AI panel appears as an additional tab where you can interact using natural language and slash commands.

### Slash commands

| Command | Action |
|---------|--------|
| `/explain` | Explain the currently selected route in plain language |
| `/suggest` | Suggest improvements to route design, error handling, or performance |
| `/debug` | Help debug a failed exchange — analyze the stack trace, exchange context, and route configuration |

The AI panel connects to Claude, GPT, or local models via MCP. The MCP server provides the model with structured context about the running integration, so the AI's responses are grounded in the actual route definitions and runtime state rather than generic advice.

### Example interaction

Select a failed exchange in the Errors tab, switch to the AI panel, and type `/debug`. The AI receives the full exchange context — body, headers, stack trace, route definition — and produces a targeted analysis explaining why the failure occurred and how to fix it.

## Themes and recording

### Themes

The TUI supports dark and light themes. Toggle between them from the Actions menu (`F2`) or set the default at launch:

```bash
camel tui --theme=light
camel tui --theme=dark
```

The dark theme (default) uses a dark background with light text and color-coded status indicators. The light theme inverts the palette for terminals with light backgrounds.

### Recording

Tape recording captures a TUI session for demos and documentation:

```bash
camel tui --record
```

The recording is saved as a tape file that can be replayed or exported. This is useful for creating reproducible demonstrations of integration behavior — start the demo routes, interact with the TUI, and share the recording with your team.

Screenshot export captures the current TUI state as a static file:

```bash
# From within the TUI, press F2 → Screenshot
```

## Keyboard shortcut reference

| Key | Action |
|-----|--------|
| `1`-`0` | Switch to tab 1 through 10 |
| `Tab` | Next tab |
| `Shift+Tab` | Previous tab |
| `F2` | Actions menu |
| `q` | Quit the TUI |
| `/` | Search or filter within the current tab |
| `Enter` | Select an item or drill down |
| `Esc` | Back or cancel |
| `s` | Source code view (Diagram tab) |
| `w` | Waterfall timing view (Inspect tab) |
| `d` | Diagram replay (Inspect tab) |
| Arrow keys | Navigate within lists and panels |
| `Page Up` / `Page Down` | Scroll through long content |

## When to use the TUI

The TUI fits specific scenarios better than other monitoring approaches:

| Scenario | Why the TUI works |
|----------|-------------------|
| **Local development** | Watch exchanges flow through routes as you develop, without configuring a metrics stack |
| **SSH debugging** | Connect to a production server and inspect a running integration — no browser, no port forwarding |
| **Container troubleshooting** | `kubectl exec` into a pod and run `camel tui` to inspect the integration in place |
| **Demo and training** | Show integration behavior in real time during presentations and pair programming |
| **Quick health checks** | Faster than opening Grafana or Jaeger for a quick "is it working?" check |

For production monitoring with alerting, dashboards, and historical data, you still need a proper observability stack (see Chapter 17 and Appendix I). The TUI is a complement, not a replacement — it excels at interactive, real-time inspection where the observability stack excels at aggregate, historical analysis.

## References

- [Camel TUI documentation](https://camel.apache.org/manual/camel-jbang.html#_tui)
- [Camel CLI overview (Appendix U)]({% link _docs/39-appendix-camel-cli.md %})

---

*Verification status: unverified. TUI features reference Apache Camel 4.20.0.*
