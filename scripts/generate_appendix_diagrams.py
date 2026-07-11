#!/usr/bin/env python3
"""Generate diagrams for appendix chapters D, F, G, and I."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import generate_diagram as g

g.OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "diagrams")

# Node width/height shortcuts
W, H = 140, 45
SW, SH = 120, 40


def node(x, y, lines, style="info", w=W, h=H):
    return {"x": x, "y": y, "w": w, "h": h, "style": style, "lines": lines}


def edge(x1, y1, x2, y2, label=None, amber=False, **kw):
    e = {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
    if label:
        e["label"] = label
    if amber:
        e["amber"] = True
    e.update(kw)
    return e


def band(x, y, w, h, label, fill="#fafafa"):
    return {"x": x, "y": y, "w": w, "h": h, "label": label, "fill": fill}


# ── 22: Appendix D — Redis for Integration ─────────────────────────────────
# Four roles of Redis: Cache, Idempotent Store, Pub/Sub, Distributed Lock
g.emit("22-appendix-redis", 820, 380,
    bands=[
        band(10, 10, 400, 170, "Caching (Content Enricher)"),
        band(420, 10, 390, 170, "Idempotent Store"),
        band(10, 190, 400, 180, "Pub/Sub Notifications"),
        band(420, 190, 390, 180, "Distributed Locking"),
    ],
    nodes=[
        # Cache band
        node(30, 45, ["Enricher Route", "kafka consumer"], "info", w=130, h=45),
        node(190, 40, ["Redis Cache", "GET customer:{id}"], "accent", w=140, h=50),
        node(190, 110, ["PostgreSQL", "cache miss fallback"], "sub", w=140, h=40),
        node(360, 70, ["SETEX", "TTL 600s"], "muted", w=60, h=30),

        # Idempotent band
        node(440, 45, ["Kafka Consumer", "eip.payments.required"], "info", w=155, h=45),
        node(630, 40, ["Redis Set", "idempotent-keys"], "accent", w=130, h=50),
        node(630, 110, ["process-payment", "deduplicated"], "muted", w=130, h=40),

        # Pub/Sub band
        node(30, 225, ["Cache Writer", "customer update"], "info", w=130, h=45),
        node(190, 220, ["PUBLISH", "cache-invalidation"], "accent", w=140, h=50),
        node(190, 300, ["SUBSCRIBE", "cache-invalidation"], "accent", w=140, h=50),
        node(360, 305, ["Invalidate", "local cache"], "muted", w=100, h=40),

        # Distributed Lock band
        node(440, 225, ["Quartz Trigger", "nightly cron"], "info", w=130, h=45),
        node(610, 220, ["SET NX EX", "lock:nightly-export"], "accent", w=145, h=50),
        node(610, 300, ["Nightly Export", "single instance"], "muted", w=130, h=40),
        node(440, 310, ["Instance B", "lock denied"], "ghost", w=110, h=35),
    ],
    edges=[
        # Cache
        edge(160, 68, 190, 65, amber=True),
        edge(260, 90, 260, 110, label="miss"),
        edge(330, 65, 360, 80),

        # Idempotent
        edge(595, 68, 630, 65, amber=True),
        edge(695, 90, 695, 110, label="new"),

        # Pub/Sub
        edge(160, 248, 190, 248, amber=True),
        edge(260, 270, 260, 300, label="notify"),
        edge(330, 325, 360, 325),

        # Distributed Lock
        edge(570, 248, 610, 248, amber=True),
        edge(680, 270, 680, 300, label="acquired"),
        edge(550, 330, 610, 320, dashed=True, label="blocked"),
    ],
    notes=[
        {"x": 140, "y": 175, "text": "Redis 7 on port 6379", "size": 10, "color": "#888"},
    ],
)


# ── 24: Appendix F — Drools and Business Rules ─────────────────────────────
# Order flows through Drools rule engine which decides routing
g.emit("24-appendix-drools", 820, 280,
    bands=[
        band(10, 10, 800, 260, "Drools Rule-Based Content Router"),
    ],
    nodes=[
        node(30, 50, ["Kafka Consumer", "eip.orders.placed"], "info", w=145, h=50),
        node(220, 55, ["RuleBasedRouter", ".bean(ruleBasedRouter)"], "accent", w=160, h=50),

        # Rule engine internals
        node(430, 30, ["Drools Rule Unit", "OrderRoutingUnit"], "ink", w=160, h=50),
        node(430, 95, ["DRL Rules", "order-routing.drl"], "muted", w=140, h=40),
        node(430, 150, ["Decision Table", ".xls / .csv"], "muted", w=140, h=40),

        # Routing outcomes
        node(650, 35, ["hazmat"], "accent", w=100, h=35),
        node(650, 80, ["fraud-review", "international"], "info", w=110, h=40),
        node(650, 130, ["express"], "info", w=100, h=35),
        node(650, 180, ["standard"], "muted", w=100, h=35),
        node(650, 230, ["toD(direct:{decision})"], "ghost", w=150, h=30),
    ],
    edges=[
        edge(175, 75, 220, 75, amber=True),
        edge(380, 80, 430, 55, label="fire()"),
        edge(430, 80, 430, 95, dashed=True),
        edge(430, 135, 430, 150, dashed=True),
        edge(590, 55, 650, 52),
        edge(590, 60, 650, 100),
        edge(590, 65, 650, 148),
        edge(590, 70, 650, 198),
    ],
    notes=[
        {"x": 440, "y": 210, "text": "Rules evaluated in salience order", "size": 10, "color": "#888"},
    ],
)


# ── 25: Appendix G — Quarkus Flow ──────────────────────────────────────────
# Workflow state machine: Validate → CheckInventory → decision → Payment/Backorder → Ship
g.emit("25-appendix-quarkus-flow", 880, 320,
    bands=[
        band(10, 10, 860, 300, "Order Fulfillment Workflow (Serverless Workflow spec)"),
    ],
    nodes=[
        # Workflow states
        node(30, 60, ["ValidateOrder", "operation"], "info", w=130, h=45),
        node(200, 60, ["CheckInventory", "operation"], "info", w=135, h=45),
        node(380, 55, ["InventoryDecision", "switch"], "accent", w=145, h=50),

        # Happy path
        node(570, 40, ["ProcessPayment", "operation"], "info", w=140, h=45),
        node(750, 40, ["ScheduleShipping", "end state"], "ink", w=120, h=40),

        # Unhappy paths
        node(570, 120, ["BackorderNotify", "end state"], "ink", w=130, h=40),
        node(750, 120, ["PaymentFailed", "end state"], "ink", w=120, h=40),

        # CDI beans / Camel integration
        node(30, 200, ["CDI Beans", "service functions"], "muted", w=130, h=40),
        node(200, 200, ["ProducerTemplate", "Camel integration"], "info", w=150, h=45),
        node(400, 205, ["Camel Routes", "direct:check-inventory"], "accent", w=150, h=40),
        node(600, 210, ["Kafka / DB", "external systems"], "sub", w=130, h=35),

        # State persistence
        node(30, 270, ["Kogito", "state persistence"], "sub", w=120, h=35),
    ],
    edges=[
        # Workflow transitions
        edge(160, 82, 200, 82, amber=True),
        edge(335, 82, 380, 80),
        edge(525, 72, 570, 62, label="available"),
        edge(525, 88, 570, 140, label="unavailable"),
        edge(710, 62, 750, 60),
        edge(710, 85, 750, 140, dashed=True, label="error"),

        # Camel integration
        edge(160, 220, 200, 220),
        edge(350, 222, 400, 222, amber=True),
        edge(550, 225, 600, 225),
    ],
    notes=[
        {"x": 380, "y": 115, "text": "dataConditions", "size": 10, "color": "#b8650a"},
        {"x": 200, "y": 265, "text": "Workflow functions call CDI beans that invoke Camel routes", "size": 10, "color": "#888"},
    ],
)


# ── 27: Appendix I — Observability Stack (LGTM) ────────────────────────────
# Services → OTel Collector → Loki/Tempo/Mimir → Grafana
g.emit("27-appendix-observability", 880, 370,
    bands=[
        band(10, 10, 220, 350, "Camel Services"),
        band(240, 10, 200, 350, "Collection"),
        band(450, 10, 210, 350, "Storage"),
        band(670, 10, 200, 350, "Visualization"),
    ],
    nodes=[
        # Services
        node(30, 50, ["order-service", "Camel routes"], "info", w=130, h=45),
        node(30, 115, ["inventory-service", "Camel routes"], "info", w=130, h=45),
        node(30, 180, ["payment-service", "Camel routes"], "info", w=130, h=45),
        node(30, 260, ["OpenTelemetry", "auto-instrument"], "accent", w=140, h=40),
        node(30, 315, ["Micrometer", "metrics export"], "accent", w=140, h=35),

        # OTel Collector
        node(265, 75, ["OTel Collector", "receive + batch"], "ink", w=150, h=55),
        node(265, 165, ["OTLP gRPC", ":4317"], "muted", w=120, h=35),
        node(265, 215, ["OTLP HTTP", ":4318"], "muted", w=120, h=35),

        # Storage backends
        node(475, 50, ["Loki", "logs (:3100)"], "info", w=120, h=40),
        node(475, 115, ["Tempo", "traces (:3200)"], "info", w=120, h=40),
        node(475, 180, ["Mimir", "metrics (:9009)"], "info", w=120, h=40),
        node(475, 260, ["Kafka", "trace context"], "sub", w=120, h=40),

        # Grafana
        node(700, 80, ["Grafana", "dashboards (:3000)"], "accent", w=150, h=55),
        node(700, 180, ["Dashboards", "rate, errors, p99"], "muted", w=140, h=40),
        node(700, 250, ["Alerts", "error-rate > 5%"], "muted", w=120, h=35),
    ],
    edges=[
        # Services → Collector
        edge(160, 72, 265, 95, amber=True),
        edge(160, 138, 265, 108),
        edge(160, 202, 265, 118),

        # Collector → Storage
        edge(415, 90, 475, 70, label="logs"),
        edge(415, 100, 475, 135, label="traces"),
        edge(415, 110, 475, 200, label="metrics"),

        # Storage → Grafana
        edge(595, 70, 700, 100),
        edge(595, 135, 700, 110),
        edge(595, 200, 700, 120),

        # Dashboards and alerts
        edge(775, 135, 775, 180),
        edge(760, 220, 760, 250),

        # Trace propagation through Kafka
        edge(160, 210, 265, 125),
        edge(535, 180, 535, 260, dashed=True, label="context"),
    ],
    notes=[
        {"x": 265, "y": 290, "text": "W3C Trace Context propagation", "size": 10, "color": "#888"},
        {"x": 475, "y": 320, "text": "via Kafka headers (traceparent)", "size": 10, "color": "#888"},
    ],
)


print(f"\nDone — 4 appendix diagram pairs generated in {g.OUT}")
