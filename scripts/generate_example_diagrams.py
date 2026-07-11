#!/usr/bin/env python3
"""Generate data-flow diagrams for all 17 runnable example READMEs."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import generate_diagram as g

g.OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "diagrams")

# Node width/height shortcuts
W, H = 140, 45
SW, SH = 120, 40  # small
TW, TH = 130, 38  # topic


def topic(x, y, lines, style="box"):
    return {"x": x, "y": y, "w": TW, "h": TH, "style": style, "lines": lines}


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


# ── 04: Channel Types ───────────────────────────────────────────────────────
g.emit("ex-04-channel-types", 880, 480,
    bands=[
        band(10, 10, 860, 190, "Kafka"),
        band(10, 210, 860, 140, "Pulsar"),
        band(10, 360, 860, 110, "Redis"),
    ],
    nodes=[
        node(30, 40, ["Timer (5s)", "DemoDataGenerator"], "accent", w=130, h=45),
        topic(190, 42, ["eip.orders.placed"]),
        node(350, 35, ["P2P Consumer", "1 consumer group"], "info", w=140, h=50),
        topic(520, 42, ["eip.orders.processed"]),
        node(350, 110, ["Datatype Router", "route by status"], "info", w=140, h=50),
        topic(520, 100, ["eip.orders.placed.typed"]),
        topic(520, 145, ["eip.orders.cancelled"]),
        node(680, 35, ["Pub/Sub Publisher"], "info", w=130, h=45),
        topic(680, 100, ["subscriber-inventory"], "muted"),
        topic(680, 145, ["subscriber-notif."], "muted"),

        node(30, 240, ["Pulsar Timer (5s)"], "accent", w=130, h=45),
        topic(190, 242, ["pulsar:eip.orders.*"], "sub"),
        node(350, 235, ["P2P (Shared)"], "info", w=130, h=45),
        node(520, 235, ["Pub/Sub (3×Excl.)"], "info", w=140, h=45),
        topic(690, 240, ["3 subscribers"], "muted"),

        node(30, 390, ["Redis Timer (8s)"], "accent", w=130, h=45),
        topic(190, 392, ["eip.orders.notifs"], "sub"),
        node(350, 385, ["Redis Subscriber"], "info", w=140, h=50),
    ],
    edges=[
        edge(160, 62, 190, 62, amber=True),
        edge(320, 62, 350, 62, amber=True),
        edge(490, 62, 520, 62),
        edge(650, 62, 680, 62),
        edge(320, 75, 350, 135, amber=True),
        edge(490, 135, 520, 120),
        edge(490, 140, 520, 160),
        edge(810, 62, 810, 100, lx=-60),
        edge(810, 100, 810, 145, lx=-60),

        edge(160, 262, 190, 262, amber=True),
        edge(320, 262, 350, 262),
        edge(480, 258, 520, 258),
        edge(660, 258, 690, 258),

        edge(160, 412, 190, 412, amber=True),
        edge(320, 412, 350, 412),
    ],
    notes=[
        {"x": 520, "y": 190, "text": "eip.orders.refunded", "size": 10, "color": "#888"},
    ],
)


# ── 05: Reliability ─────────────────────────────────────────────────────────
g.emit("ex-05-reliability", 650, 200,
    bands=[band(10, 10, 630, 180, "Kafka")],
    nodes=[
        topic(30, 60, ["eip.orders.placed"]),
        node(190, 50, ["Order Processor", "fail every 5th"], "info", w=150, h=50),
        topic(370, 60, ["eip.orders.processed"]),
        node(190, 130, ["3 retries @ 1s"], "muted", w=130, h=35),
        topic(370, 130, ["eip.orders.dlq"], "accent"),
        node(520, 125, ["DLQ Monitor"], "info", w=110, h=40),
    ],
    edges=[
        edge(160, 78, 190, 78, amber=True),
        edge(340, 78, 370, 78),
        edge(265, 100, 265, 130, label="failure"),
        edge(320, 148, 370, 148, amber=True),
        edge(500, 148, 520, 148),
    ],
)


# ── 06: Channel Infrastructure ──────────────────────────────────────────────
g.emit("ex-06-channel-infra", 880, 380,
    bands=[
        band(10, 10, 540, 180, "Kafka — Message Bus"),
        band(10, 200, 430, 170, "Messaging Bridge"),
        band(560, 10, 310, 180, "Channel Adapter"),
    ],
    nodes=[
        node(30, 50, ["Timer / REST"], "accent", w=120, h=40),
        topic(180, 50, ["eip.orders.incoming"]),
        node(340, 40, ["Inventory Svc"], "muted", w=110, h=35),
        node(340, 80, ["Payment Svc"], "muted", w=110, h=35),
        node(340, 120, ["Notification Svc"], "muted", w=110, h=35),

        node(580, 40, ["Inbound Adapter", "REST → PG → Kafka"], "info", w=150, h=50),
        node(580, 110, ["Outbound Adapter", "Kafka → external"], "info", w=150, h=50),
        topic(770, 50, ["PostgreSQL", "orders.orders"], "sub"),

        node(30, 235, ["Pulsar→Kafka", "partner.orders"], "info", w=140, h=50),
        topic(200, 240, ["eip.orders.placed"]),
        node(30, 310, ["Kafka→Pulsar", "shipping events"], "info", w=140, h=50),
        topic(200, 315, ["eip.shipping.sched."]),
        node(370, 240, ["Fulfillment Svc"], "muted", w=120, h=40),
        topic(370, 310, ["eip.orders.fulfilled"]),
    ],
    edges=[
        edge(150, 70, 180, 70, amber=True),
        edge(310, 70, 340, 58),
        edge(310, 70, 340, 98),
        edge(310, 70, 340, 138),
        edge(730, 65, 770, 65),
        edge(170, 265, 200, 265),
        edge(330, 260, 370, 260),
        edge(370, 280, 370, 310),
        edge(170, 335, 200, 335),
    ],
)


# ── 07: Message Types ───────────────────────────────────────────────────────
g.emit("ex-07-message-types", 700, 210,
    bands=[band(10, 10, 680, 190, "Kafka")],
    nodes=[
        node(30, 35, ["Timer (6s)"], "accent", w=100, h=35),
        node(160, 30, ["Command Producer", "ProcessPayment"], "info", w=155, h=45),
        topic(345, 35, ["eip.commands", ".process-payment"]),
        node(505, 30, ["Command Consumer", "execute & log"], "muted", w=145, h=45),

        node(30, 90, ["Timer (8s)"], "accent", w=100, h=35),
        node(160, 85, ["Document Producer", "full order record"], "info", w=155, h=45),
        topic(345, 90, ["eip.documents", ".orders"]),
        node(505, 85, ["Document Consumer", "receive & log"], "muted", w=145, h=45),

        node(30, 145, ["Timer (5s)"], "accent", w=100, h=35),
        node(160, 140, ["Event Producer", "OrderPlaced envelope"], "info", w=155, h=45),
        topic(345, 145, ["eip.events", ".orders"]),
        node(505, 140, ["Event Consumer", "observe & record"], "muted", w=145, h=45),
    ],
    edges=[
        edge(130, 52, 160, 52, amber=True),
        edge(315, 52, 345, 52),
        edge(475, 52, 505, 52),
        edge(130, 107, 160, 107, amber=True),
        edge(315, 107, 345, 107),
        edge(475, 107, 505, 107),
        edge(130, 162, 160, 162, amber=True),
        edge(315, 162, 345, 162),
        edge(475, 162, 505, 162),
    ],
)


# ── 08: Message Metadata ────────────────────────────────────────────────────
g.emit("ex-08-message-metadata", 820, 370,
    bands=[
        band(10, 10, 800, 200, "Individual Orders (5s timer)"),
        band(10, 220, 800, 140, "Bulk Orders (15s timer)"),
    ],
    nodes=[
        node(30, 50, ["Timer (5s)"], "accent", w=100, h=35),
        topic(160, 50, ["eip.metadata", ".orders"]),

        node(330, 35, ["Correlation ID", "stamp UUID"], "info", w=130, h=40),
        topic(490, 35, [".correlated"]),

        node(330, 85, ["Format Indicator", "tag contentType"], "info", w=140, h=40),
        topic(500, 85, [".tagged"]),
        topic(660, 80, [".processed"], "muted"),
        topic(660, 120, [".dead"], "accent"),

        node(330, 140, ["Expiration", "stamp TTL (30s)"], "info", w=130, h=40),
        topic(490, 140, [".expiring"]),
        topic(660, 140, [".fulfilled"], "muted"),

        node(30, 260, ["Timer (15s)"], "accent", w=100, h=35),
        topic(160, 260, ["eip.metadata", ".bulk-orders"]),
        node(330, 255, ["Splitter", "split items[]"], "info", w=120, h=40),
        topic(480, 260, [".line-items"]),
        node(640, 255, ["Aggregator", "by BulkOrderId"], "info", w=130, h=40),
        topic(640, 310, [".reassembled"], "muted"),
    ],
    edges=[
        edge(130, 67, 160, 67, amber=True),
        edge(290, 55, 330, 55),
        edge(290, 70, 330, 105),
        edge(290, 80, 330, 160),
        edge(460, 55, 490, 55),
        edge(470, 105, 500, 105),
        edge(630, 100, 660, 100),
        edge(630, 112, 660, 135),
        edge(460, 160, 490, 160),
        edge(620, 155, 660, 155),

        edge(130, 277, 160, 277, amber=True),
        edge(290, 280, 330, 280),
        edge(450, 275, 480, 275),
        edge(610, 278, 640, 278),
        edge(705, 295, 705, 310),
    ],
)


# ── 09: Routing Fundamentals ────────────────────────────────────────────────
g.emit("ex-09-routing-fundamentals", 800, 310,
    bands=[band(10, 10, 780, 290, "Kafka")],
    nodes=[
        node(30, 40, ["Timer (5s)"], "accent", w=100, h=35),
        topic(160, 42, ["eip.orders.placed"]),

        node(330, 30, ["Content-Based", "Router (.choice)"], "info", w=140, h=50),
        topic(510, 30, [".hazmat"], "accent"),
        topic(510, 72, [".international"]),
        topic(510, 114, [".domestic"]),

        node(330, 110, ["Message Filter", "amount >= $100"], "info", w=140, h=45),
        topic(510, 160, [".high-value"], "muted"),

        topic(30, 195, ["eip.orders.batch"]),
        node(190, 190, ["Splitter", "split items[]"], "info", w=120, h=45),
        topic(340, 195, [".individual"]),

        topic(30, 260, ["eip.orders.shipped"]),
        node(190, 250, ["Recipient List", "parallel notify"], "info", w=140, h=50),
        topic(370, 245, ["email"], "muted"),
        topic(370, 275, ["sms / vip-desk"], "muted"),
    ],
    edges=[
        edge(130, 57, 160, 57, amber=True),
        edge(290, 55, 330, 55),
        edge(290, 70, 330, 135),
        edge(470, 50, 510, 50),
        edge(470, 65, 510, 90),
        edge(470, 75, 510, 130),
        edge(470, 140, 510, 175),
        edge(160, 215, 190, 215),
        edge(310, 215, 340, 215),
        edge(160, 275, 190, 275),
        edge(330, 270, 370, 262),
        edge(330, 280, 370, 292),
    ],
)


# ── 10: Composed Routing ────────────────────────────────────────────────────
g.emit("ex-10-composed-routing", 800, 270,
    bands=[
        band(10, 10, 780, 120, "Scatter-Gather"),
        band(10, 140, 780, 120, "Routing Slip"),
    ],
    nodes=[
        topic(30, 50, ["eip.shipping", ".rate-requests"]),
        node(200, 35, ["Scatter-Gather", "multicast (5s timeout)"], "info", w=160, h=55),
        node(400, 30, ["FedEx"], "muted", w=80, h=30),
        node(400, 65, ["UPS"], "muted", w=80, h=30),
        node(400, 100, ["USPS"], "muted", w=80, h=30),
        node(510, 45, ["BestRateStrategy", "lowest rate"], "info", w=140, h=50),
        topic(680, 55, ["eip.shipping", ".best-rate"], "accent"),

        topic(30, 180, ["eip.orders.placed"]),
        node(200, 170, ["Routing Slip", "dynamic pipeline"], "info", w=140, h=50),
        node(370, 175, ["validate"], "muted", w=80, h=35),
        node(470, 175, ["hazmat?"], "ghost", w=80, h=35),
        node(570, 175, ["customs?"], "ghost", w=80, h=35),
        node(670, 175, ["carrier"], "muted", w=80, h=35),
    ],
    edges=[
        edge(160, 70, 200, 62, amber=True),
        edge(360, 55, 400, 45),
        edge(360, 63, 400, 80),
        edge(360, 70, 400, 115),
        edge(480, 50, 510, 65),
        edge(480, 80, 510, 72),
        edge(480, 112, 510, 80),
        edge(650, 70, 680, 70),
        edge(160, 200, 200, 200, amber=True),
        edge(340, 195, 370, 195),
        edge(450, 195, 470, 195),
        edge(550, 195, 570, 195),
        edge(650, 195, 670, 195),
    ],
)


# ── 11: Advanced Routing ────────────────────────────────────────────────────
g.emit("ex-11-advanced-routing", 880, 440,
    bands=[
        band(10, 10, 860, 80, "Dynamic Router"),
        band(10, 100, 540, 80, "Wire Tap"),
        band(560, 100, 310, 80, "Resequencer"),
        band(10, 190, 540, 90, "Composed Message Processor"),
        band(560, 190, 310, 90, "Load Balancer"),
    ],
    nodes=[
        topic(30, 35, ["eip.orders.placed"]),
        node(190, 28, ["Dynamic Router", "OrderRoutingBean"], "info", w=150, h=45),
        node(370, 33, ["validate"], "muted", w=80, h=35),
        node(470, 33, ["inventory"], "muted", w=80, h=35),
        node(570, 33, ["shipping"], "muted", w=80, h=35),
        topic(680, 35, [".dynamic-routed"]),

        topic(30, 122, ["eip.orders", ".processing"]),
        node(190, 115, ["Wire Tap"], "info", w=110, h=45),
        topic(330, 110, [".processed"]),
        topic(330, 150, [".audit"], "accent"),

        topic(580, 122, [".sequenced"]),
        node(720, 115, ["Resequencer", "batch=10, 5s"], "info", w=130, h=45),

        topic(30, 220, [".composed"]),
        node(180, 215, ["Split items"], "info", w=110, h=40),
        node(320, 215, ["Process each"], "muted", w=110, h=40),
        node(320, 260, ["Aggregate"], "info", w=110, h=40),
        topic(460, 230, [".enriched"]),

        topic(580, 220, [".loadbalanced"]),
        node(730, 210, ["East / NYC"], "muted", w=100, h=30),
        node(730, 245, ["Central / CHI"], "muted", w=100, h=30),
    ],
    edges=[
        edge(160, 55, 190, 55, amber=True),
        edge(340, 55, 370, 55),
        edge(450, 55, 470, 55),
        edge(550, 55, 570, 55),
        edge(650, 55, 680, 55),

        edge(160, 142, 190, 142),
        edge(300, 132, 330, 130),
        edge(300, 148, 330, 165),

        edge(710, 142, 720, 142),

        edge(160, 240, 180, 240),
        edge(290, 235, 320, 235),
        edge(375, 255, 375, 260),
        edge(430, 280, 460, 248),

        edge(710, 240, 730, 228),
        edge(710, 248, 730, 260),
    ],
    notes=[
        {"x": 730, "y": 282, "text": "West / LAX", "size": 10, "color": "#888"},
        {"x": 850, "y": 155, "text": ".resequenced", "size": 10, "color": "#888"},
    ],
)


# ── 12: Transformation ──────────────────────────────────────────────────────
g.emit("ex-12-transformation", 750, 200,
    bands=[band(10, 10, 730, 180, "Kafka + Redis")],
    nodes=[
        topic(30, 70, ["eip.orders", ".external"]),
        node(190, 60, ["Translator", "partner → canon."], "info", w=120, h=50),
        topic(340, 70, ["eip.orders", ".placed"]),
        node(340, 130, ["Enricher", "Redis SKU lookup"], "info", w=130, h=50),
        node(500, 130, ["Redis", "product hashes"], "sub", w=110, h=40),
        topic(500, 70, [".enriched"]),
        node(500, 30, ["Filter", "strip PII"], "info", w=110, h=40),
        topic(640, 40, [".analytics"], "muted"),
    ],
    edges=[
        edge(160, 90, 190, 90, amber=True),
        edge(310, 85, 340, 85),
        edge(405, 108, 405, 130),
        edge(470, 155, 500, 155),
        edge(470, 90, 500, 90),
        edge(555, 70, 555, 50, label="filter"),
        edge(610, 50, 640, 50),
    ],
)


# ── 13: Aggregator ──────────────────────────────────────────────────────────
g.emit("ex-13-aggregator", 780, 270,
    bands=[
        band(10, 10, 760, 130, "Aggregator"),
        band(10, 150, 760, 110, "Normalizer"),
    ],
    nodes=[
        topic(30, 45, ["eip.orders", ".line-items"]),
        node(200, 30, ["Aggregator", "(in-memory)"], "info", w=140, h=45),
        topic(380, 35, [".complete"]),
        node(200, 85, ["Aggregator", "(PostgreSQL)"], "info", w=140, h=45),
        topic(380, 90, [".complete-persist."], "sub"),
        node(560, 60, ["PostgreSQL", "camel_aggregation"], "sub", w=150, h=45),

        topic(30, 185, [".partner-a"]),
        topic(30, 225, [".partner-b"]),
        topic(30, 265, [".partner-c"], "muted"),
        node(200, 190, ["Normalizer", "3 formats → canonical"], "info", w=170, h=45),
        topic(410, 205, [".normalized"]),
    ],
    edges=[
        edge(160, 65, 200, 55, amber=True),
        edge(160, 75, 200, 108),
        edge(340, 55, 380, 55),
        edge(340, 108, 380, 108),
        edge(520, 108, 560, 82),
        edge(160, 205, 200, 210),
        edge(160, 245, 200, 218),
        edge(160, 278, 200, 225),
        edge(370, 215, 410, 220),
    ],
)


# ── 14: Consumer Patterns ───────────────────────────────────────────────────
g.emit("ex-14-consumer-patterns", 880, 360,
    bands=[
        band(10, 10, 420, 170, "Kafka Consumers"),
        band(440, 10, 430, 170, "Pulsar + PostgreSQL"),
        band(10, 190, 860, 160, "Message Dispatcher"),
    ],
    nodes=[
        topic(30, 40, [".consumer.events"]),
        node(190, 33, ["Event-Driven", "push messages"], "info", w=130, h=40),

        topic(30, 90, [".consumer.compete"]),
        node(190, 83, ["Competing (3)", "parallel threads"], "info", w=130, h=40),

        topic(30, 140, [".consumer.poll"]),
        node(190, 133, ["Polling Consumer", "timer + pollEnrich"], "info", w=145, h=40),

        node(460, 33, ["Pulsar Consumer", "Shared × 3"], "info", w=140, h=45),
        topic(630, 40, ["pulsar:eip", ".consumer.events"], "sub"),

        node(460, 95, ["SQL Polling", "SELECT WHERE PLACED"], "info", w=150, h=50),
        topic(640, 100, ["PostgreSQL", "orders.orders"], "sub"),
        topic(460, 155, ["eip.orders.placed"], "accent"),

        topic(30, 225, [".consumer.dispatch"]),
        node(200, 215, ["Dispatcher", "toD(handle-{type})"], "info", w=150, h=50),
        node(390, 215, ["handle-placed"], "muted", w=120, h=35),
        node(390, 255, ["handle-cancelled"], "muted", w=120, h=35),
        node(390, 295, ["handle-refunded"], "muted", w=120, h=35),
    ],
    edges=[
        edge(160, 55, 190, 55),
        edge(160, 105, 190, 105),
        edge(160, 155, 190, 155),
        edge(600, 58, 630, 58),
        edge(610, 120, 640, 120),
        edge(535, 145, 535, 155),
        edge(160, 248, 200, 248),
        edge(350, 235, 390, 235),
        edge(350, 248, 390, 272),
        edge(350, 255, 390, 310),
    ],
)


# ── 15: Endpoint Patterns ───────────────────────────────────────────────────
g.emit("ex-15-endpoints", 880, 380,
    bands=[
        band(10, 10, 540, 160, "Idempotent + Service Activator"),
        band(10, 180, 540, 190, "Transactional Client / Outbox"),
        band(560, 10, 310, 160, "Durable Subscriber"),
    ],
    nodes=[
        node(30, 40, ["Timer (5s)"], "accent", w=100, h=35),
        topic(160, 42, ["eip.orders.placed"]),
        node(160, 100, ["Idempotent Rcvr", "JDBC dedup"], "info", w=140, h=45),
        topic(330, 105, [".deduplicated"]),
        node(330, 40, ["Service Activator", ".bean(InventorySvc)"], "info", w=155, h=50),
        topic(330, 150, [".inventory-checked"], "muted"),

        topic(30, 220, ["eip.payments", ".required"]),
        node(200, 210, ["Transactional Client", ".transacted()"], "info", w=160, h=50),
        node(200, 280, ["PostgreSQL", "payments + outbox"], "sub", w=160, h=40),
        node(400, 280, ["Outbox Publisher", "poll every 5s"], "info", w=140, h=45),
        topic(400, 340, [".payments.processed"], "accent"),

        topic(580, 40, ["pulsar:eip.orders", ".placed"], "sub"),
        node(580, 100, ["Durable Subscriber", "cursor survives restart"], "info", w=170, h=50),
    ],
    edges=[
        edge(130, 57, 160, 57, amber=True),
        edge(225, 80, 225, 100),
        edge(300, 125, 330, 125),
        edge(395, 90, 395, 105),
        edge(395, 148, 395, 155, lx=0, ly=-8),

        edge(160, 245, 200, 245, amber=True),
        edge(280, 260, 280, 280),
        edge(360, 300, 400, 300),
        edge(470, 325, 470, 340),

        edge(665, 80, 665, 100),
    ],
)


# ── 16: Endpoint Management ─────────────────────────────────────────────────
g.emit("ex-16-endpoint-management", 780, 230,
    bands=[band(10, 10, 760, 210, "Kafka")],
    nodes=[
        node(20, 40, ["Timer (5s)"], "accent", w=100, h=35),
        node(20, 130, ["Gateway (8s)", "FluentProducer"], "info", w=130, h=45),

        topic(160, 42, ["eip.orders.placed"]),
        node(320, 35, ["Selective Consumer", "drop hazmat"], "info", w=150, h=50),
        topic(500, 42, [".accepted"]),
        node(500, 100, ["Channel Purger", "drop stale > 10m"], "info", w=145, h=50),
        topic(500, 160, [".clean"]),
        node(320, 155, ["Messaging Mapper", "JSON → Order POJO"], "info", w=150, h=50),
    ],
    edges=[
        edge(120, 57, 160, 57, amber=True),
        edge(150, 155, 160, 62, amber=True),
        edge(290, 62, 320, 62),
        edge(470, 62, 500, 62),
        edge(575, 85, 575, 100),
        edge(575, 150, 575, 160),
        edge(500, 180, 470, 180, label="OrderService"),
    ],
)


# ── 17: System Management ───────────────────────────────────────────────────
g.emit("ex-17-observability", 880, 340,
    bands=[
        band(10, 10, 430, 150, "Wire Tap"),
        band(450, 10, 420, 150, "Control Bus"),
        band(10, 170, 860, 160, "Message History + Message Store"),
    ],
    nodes=[
        topic(30, 45, ["eip.orders.placed"]),
        node(190, 35, ["Wire Tap", "copy to audit"], "info", w=120, h=50),
        topic(30, 110, [".audit"], "accent"),
        topic(190, 110, [".processed"]),

        node(470, 35, ["Control Bus", "REST endpoints"], "info", w=140, h=50),
        node(640, 30, ["GET /status"], "muted", w=100, h=30),
        node(640, 65, ["POST /stop"], "muted", w=100, h=30),
        node(640, 100, ["POST /start"], "muted", w=100, h=30),

        topic(30, 210, ["eip.orders", ".incoming"]),
        node(190, 200, ["Validate"], "muted", w=100, h=40),
        node(310, 200, ["Enrich"], "muted", w=100, h=40),
        node(430, 200, ["Log History"], "info", w=120, h=40),
        topic(580, 210, [".processed"]),
        node(310, 270, ["Message Store", "wireTap → PostgreSQL"], "info", w=160, h=45),
        node(510, 275, ["PostgreSQL", "system.message_store"], "sub", w=155, h=40),
    ],
    edges=[
        edge(160, 68, 190, 68, amber=True),
        edge(250, 85, 250, 110),
        edge(250, 68, 250, 55, lx=40),
        edge(190, 55, 190, 110, lx=40, label="main flow"),
        edge(610, 50, 640, 50),
        edge(610, 68, 640, 80),
        edge(610, 85, 640, 115),
        edge(160, 230, 190, 225),
        edge(290, 225, 310, 225),
        edge(410, 225, 430, 225),
        edge(550, 225, 580, 225),
        edge(370, 240, 370, 270, label="wireTap"),
        edge(470, 292, 510, 292),
    ],
)


# ── 18: Testing and Management ──────────────────────────────────────────────
g.emit("ex-18-testing-management", 880, 370,
    bands=[
        band(10, 10, 430, 170, "Test Message"),
        band(450, 10, 420, 170, "Detour"),
        band(10, 190, 430, 170, "Circuit Breaker"),
        band(450, 190, 420, 170, "Smart Proxy"),
    ],
    nodes=[
        node(30, 40, ["Timer (5s)"], "accent", w=100, h=35),
        topic(160, 42, ["eip.orders.placed"]),
        node(160, 100, ["Business Proc.", "filter test msgs"], "info", w=140, h=45),
        topic(330, 42, [".processed"]),
        topic(330, 110, [".test.failures"], "accent"),
        node(30, 130, ["Test Injector (30s)", "negative IDs"], "accent", w=140, h=40),

        topic(470, 42, ["eip.orders.placed"]),
        node(630, 30, ["Detour"], "info", w=100, h=45),
        node(760, 30, ["Enrich"], "ghost", w=90, h=35),
        topic(630, 100, [".enriched"]),

        topic(30, 225, [".processed"]),
        node(190, 215, ["Circuit Breaker", "inventory check"], "info", w=150, h=50),
        topic(370, 220, [".inventory-checked"]),
        topic(190, 290, [".dlq"], "accent"),

        node(470, 220, ["POST /payments", "/process"], "accent", w=140, h=45),
        node(640, 215, ["Smart Proxy", "mock / production"], "info", w=140, h=50),
        node(640, 290, ["Mock GW"], "muted", w=90, h=35),
        node(760, 290, ["Prod GW"], "ghost", w=90, h=35),
    ],
    edges=[
        edge(130, 57, 160, 57, amber=True),
        edge(230, 80, 230, 100),
        edge(300, 125, 330, 62),
        edge(300, 135, 330, 130),
        edge(170, 155, 225, 100),

        edge(600, 62, 630, 52),
        edge(730, 50, 760, 48),
        edge(730, 65, 730, 100),

        edge(160, 248, 190, 248, amber=True),
        edge(340, 240, 370, 240),
        edge(265, 265, 265, 290, label="fallback"),

        edge(610, 245, 640, 245),
        edge(710, 265, 710, 290),
        edge(720, 265, 760, 295),
    ],
)


# ── Loan Broker (Case Study) ────────────────────────────────────────────────
g.emit("ex-loan-broker", 880, 350,
    bands=[band(10, 10, 860, 330, "Loan Broker Pipeline")],
    nodes=[
        node(20, 40, ["POST /api/loans"], "accent", w=130, h=40),
        node(20, 110, ["Timer (8s)"], "accent", w=100, h=35),
        node(180, 50, ["Gateway", "assign requestId"], "info", w=130, h=45),
        topic(340, 55, ["loan.requests"]),
        node(340, 120, ["Credit Enricher", "creditHistory, DTI"], "info", w=145, h=50),
        topic(340, 195, ["loan.enriched"]),
        node(340, 260, ["Recipient List", "eligible banks"], "info", w=140, h=50),

        node(530, 200, ["Bank A", "Universal 5.5%"], "muted", w=110, h=40),
        node(530, 255, ["Bank B", "Community 4.8%"], "muted", w=110, h=40),
        node(530, 310, ["Bank C", "Prime 3.9%"], "muted", w=110, h=40),

        topic(680, 260, ["loan.bank.reply"]),
        node(680, 180, ["Aggregator", "BestOfferStrategy"], "info", w=140, h=50),
        topic(680, 120, ["loan.results"], "accent"),
    ],
    edges=[
        edge(150, 62, 180, 72, amber=True),
        edge(120, 128, 180, 80, amber=True),
        edge(310, 75, 340, 75),
        edge(410, 100, 410, 120),
        edge(410, 170, 410, 195),
        edge(410, 233, 410, 260),
        edge(480, 275, 530, 225),
        edge(480, 285, 530, 275),
        edge(480, 295, 530, 330),
        edge(640, 220, 680, 280),
        edge(640, 275, 680, 280),
        edge(640, 330, 680, 290),
        edge(750, 230, 750, 200, lx=-30),
        edge(750, 180, 750, 150, lx=-30),
    ],
)


# ── Bond Trading (Case Study) ───────────────────────────────────────────────
g.emit("ex-bond-trading", 880, 420,
    bands=[
        band(10, 10, 860, 200, "Price Pipeline"),
        band(10, 220, 520, 190, "Trade Validation"),
        band(540, 220, 330, 190, "Desk Distribution"),
    ],
    nodes=[
        topic(30, 40, ["bond.feed.raw", ".bloomberg"]),
        topic(30, 85, ["bond.feed.raw", ".reuters"]),
        topic(30, 130, ["bond.feed.raw", ".exchange"]),
        node(190, 35, ["Bloomberg", "Adapter"], "info", w=110, h=40),
        node(190, 80, ["Reuters", "Adapter"], "info", w=110, h=40),
        node(190, 125, ["Exchange", "Adapter"], "info", w=110, h=40),
        topic(340, 80, ["bond.prices", ".canonical"]),
        node(500, 65, ["Normalizer", "best bid/ask by ISIN"], "info", w=155, h=55),
        topic(690, 75, ["bond.prices.best"], "accent"),

        topic(30, 260, ["bond.orders.new"]),
        node(200, 250, ["Trade Validator", "idempotent + validate"], "info", w=160, h=50),
        topic(200, 330, ["bond.audit.log"], "muted"),
        topic(400, 260, [".validated"]),
        node(200, 380, ["rejected", "(logged only)"], "muted", w=120, h=35),

        node(560, 250, ["Desk Distributor", "multicast + filter"], "info", w=155, h=50),
        topic(740, 240, ["desk-a", "(government)"], "muted"),
        topic(740, 285, ["desk-b", "(corporate)"], "muted"),
        topic(740, 330, ["desk-c", "(all bonds)"], "muted"),
    ],
    edges=[
        edge(160, 58, 190, 58),
        edge(160, 100, 190, 100),
        edge(160, 148, 190, 148),
        edge(300, 55, 340, 95),
        edge(300, 100, 340, 100),
        edge(300, 145, 340, 105),
        edge(470, 98, 500, 92),
        edge(655, 92, 690, 92),

        edge(160, 280, 200, 280, amber=True),
        edge(280, 300, 280, 330, label="wireTap"),
        edge(360, 275, 400, 275),
        edge(280, 310, 280, 380),

        edge(690, 92, 690, 160),
        {"x1": 690, "y1": 160, "x2": 635, "y2": 250, "amber": True},
        edge(715, 275, 740, 258),
        edge(715, 280, 740, 300),
        edge(715, 288, 740, 348),
    ],
    notes=[
        {"x": 500, "y": 170, "text": "BestPriceStrategy: highest bid + lowest ask", "size": 10, "color": "#888"},
    ],
)

print(f"\nDone — 17 diagram pairs generated in {g.OUT}")
