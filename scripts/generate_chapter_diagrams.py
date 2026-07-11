#!/usr/bin/env python3
"""Generate chapter-level conceptual diagrams for the tutorial site."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import generate_diagram as g

g.OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "diagrams")


def node(x, y, lines, style="box", w=140, h=50, icon=None):
    n = {"x": x, "y": y, "w": w, "h": h, "style": style, "lines": lines}
    if icon:
        n["icon"] = icon
    return n


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


def note(x, y, text, **kw):
    n = {"x": x, "y": y, "text": text}
    n.update(kw)
    return n


# -- 01: Order Flow -----------------------------------------------------------
g.emit("01-order-flow", 900, 520,
    bands=[band(20, 10, 860, 500, "Shipping Domain — Order Flow")],
    nodes=[
        node(370, 40, ["Customer", "HTTP POST /orders"], "ink", w=160, h=50),
        node(370, 130, ["order-service", "PostgreSQL \xb7 orders"], "accent", w=160, h=55),
        node(100, 260, ["inventory-service", "PostgreSQL \xb7 inventory"], w=170, h=55),
        node(630, 260, ["notification-service", "email / SMS"], "muted", w=170, h=55),
        node(100, 370, ["payment-service", "PostgreSQL \xb7 payments"], w=170, h=55),
        node(100, 460, ["shipping-service", "PostgreSQL \xb7 shipping"], w=170, h=50),
    ],
    edges=[
        edge(450, 90, 450, 130, label="HTTP", amber=True),
        edge(370, 160, 270, 260, amber=True),
        edge(530, 160, 630, 260, amber=True),
        edge(185, 315, 185, 370, amber=True),
        edge(270, 400, 630, 290),
        edge(185, 425, 185, 460, amber=True),
    ],
    notes=[
        note(270, 210, "OrderPlaced", anchor="middle"),
        note(630, 210, "OrderPlaced", anchor="middle"),
        note(280, 342, "InventoryReserved", anchor="middle"),
        note(510, 330, "PaymentProcessed", anchor="middle"),
        note(280, 442, "ShipmentScheduled", anchor="middle"),
        note(400, 210, "Kafka topic: eip.orders.placed", size=10),
        note(55, 345, "eip.inventory.reserved", size=10),
        note(55, 450, "eip.payments.processed", size=10),
    ],
)


# -- 01: Stack Architecture ---------------------------------------------------
g.emit("01-stack-architecture", 900, 340,
    bands=[
        band(20, 10, 420, 320, "Messaging & Persistence"),
        band(460, 10, 420, 320, "Observability (LGTM)", fill="#f8f4ef"),
    ],
    nodes=[
        node(40, 50, ["Kafka", "KRaft \xb7 9092"], "accent", w=120, h=55),
        node(180, 50, ["Pulsar", "standalone \xb7 6650"], "accent", w=120, h=55),
        node(320, 50, ["Redis", "6379"], w=100, h=55),
        node(40, 130, ["PostgreSQL", "5 schemas \xb7 5432"], w=120, h=55),
        node(180, 130, ["Apicurio", "registry \xb7 8081"], "info", w=120, h=55),
        node(320, 130, ["Kafka UI", "8090"], "muted", w=100, h=55),
        node(480, 50, ["Grafana", "dashboards \xb7 3000"], "accent", w=110, h=55),
        node(610, 50, ["Loki", "logs \xb7 3100"], w=110, h=55),
        node(740, 50, ["Tempo", "traces \xb7 3200"], w=120, h=55),
        node(480, 130, ["Mimir", "metrics \xb7 9009"], w=110, h=55),
        node(610, 130, ["OTel Collector", "4317 / 4318"], "info", w=120, h=55),
        node(40, 240, ["order-service", "Quarkus \xb7 8080"], "ink", w=160, h=50),
        node(220, 240, ["inventory-service", "Quarkus \xb7 8082"], "ink", w=160, h=50),
        node(480, 240, ["payment-service", "Quarkus \xb7 8083"], "ink", w=160, h=50),
        node(660, 240, ["shipping-service", "Quarkus \xb7 8084"], "ink", w=160, h=50),
    ],
    edges=[
        edge(120, 210, 120, 240, dashed=True, label="Camel routes", lx=0),
        edge(300, 210, 300, 240, dashed=True, label="Camel routes", lx=0),
        edge(560, 210, 560, 240, dashed=True, label="Camel routes", lx=0),
        edge(740, 210, 740, 240, dashed=True, label="Camel routes", lx=0),
    ],
)


# -- 02: Integration Styles ---------------------------------------------------
g.emit("02-integration-styles", 900, 280,
    bands=[
        band(20, 35, 200, 220, "File Transfer"),
        band(240, 35, 200, 220, "Shared Database"),
        band(460, 35, 200, 220, "RPI (REST/gRPC)"),
        band(680, 35, 200, 220, "Messaging", fill="#fff8ef"),
    ],
    nodes=[
        node(40, 70, ["App A", "producer"], w=80, h=45),
        node(40, 170, ["App B", "consumer"], w=80, h=45),
        node(120, 120, ["File", "CSV / JSON"], "muted", w=80, h=40),
        node(260, 70, ["App A", "read/write"], w=80, h=45),
        node(260, 170, ["App B", "read/write"], w=80, h=45),
        node(340, 120, ["Database", "shared"], "info", w=80, h=40),
        node(480, 70, ["Client", "caller"], w=80, h=45),
        node(480, 170, ["Server", "responder"], w=80, h=45),
        node(700, 70, ["Sender", "producer"], w=80, h=45),
        node(700, 170, ["Receiver", "consumer"], w=80, h=45),
        node(780, 120, ["Channel", "topic / queue"], "accent", w=80, h=40),
    ],
    edges=[
        edge(100, 115, 120, 135, label="write"),
        edge(120, 145, 100, 170, label="read", ly=8),
        edge(320, 115, 340, 130, dashed=True),
        edge(320, 170, 340, 150, dashed=True),
        edge(520, 115, 520, 170, amber=True),
        edge(510, 170, 510, 115, dashed=True),
        edge(760, 115, 780, 130, amber=True),
        edge(780, 150, 760, 170, amber=True),
    ],
    notes=[
        note(555, 136, "request", anchor="middle"),
        note(472, 136, "response", anchor="middle"),
        note(750, 112, "send", anchor="middle"),
        note(745, 170, "receive", anchor="middle"),
        note(450, 25, "The Four Integration Styles", anchor="middle", bold=True, size=14),
    ],
)


# -- 03: Messaging System Components ------------------------------------------
g.emit("03-messaging-system-components", 900, 320,
    bands=[band(20, 10, 860, 300, "Messaging System")],
    nodes=[
        node(40, 60, ["Sender", "Application"], "ink", w=120, h=55),
        node(40, 160, ["Endpoint", "(producer)"], "pattern", w=120, h=50, icon="message-endpoint"),
        node(220, 110, ["Channel", "topic / queue"], "channel", w=130, h=50),
        node(400, 60, ["Filter 1", "unmarshal"], w=100, h=50),
        node(520, 60, ["Filter 2", "validate"], w=100, h=50),
        node(640, 60, ["Filter 3", "enrich"], w=100, h=50),
        node(520, 160, ["Router", "choice()"], "pattern", w=100, h=50, icon="content-based-router"),
        node(400, 240, ["Translator", "marshal"], "pattern", w=100, h=50, icon="message-translator"),
        node(740, 160, ["Endpoint", "(consumer)"], "pattern", w=120, h=50, icon="message-endpoint"),
        node(740, 240, ["Receiver", "Application"], "ink", w=120, h=55),
    ],
    edges=[
        edge(100, 115, 100, 160, amber=True),
        edge(160, 185, 220, 140, amber=True),
        edge(350, 130, 400, 90, label="pipe", lx=-15, ly=-10),
        edge(500, 85, 520, 85, amber=True),
        edge(620, 85, 640, 85, amber=True),
        edge(620, 110, 570, 160, dashed=True),
        edge(620, 185, 740, 185, amber=True, label="route A", ly=-10),
        edge(570, 210, 450, 240, dashed=True, label="route B", ly=8),
        edge(800, 210, 800, 240, amber=True),
    ],
    notes=[
        note(140, 131, "Message", anchor="middle"),
        note(450, 30, "The Six Building Blocks", anchor="middle", bold=True, size=14),
        note(460, 140, "Pipes & Filters", anchor="middle", size=10),
    ],
)


# -- 03: Pipes and Filters ----------------------------------------------------
g.emit("03-pipes-and-filters", 880, 240,
    bands=[band(20, 20, 840, 200, "Pipes and Filters")],
    nodes=[
        node(50, 70, ["Message", "Source"], "accent", w=120, h=50),
        node(220, 70, ["Filter 1", "unmarshal"], "pattern", w=120, h=50, icon="pipes-and-filters"),
        node(390, 70, ["Filter 2", "validate"], "pattern", w=120, h=50, icon="pipes-and-filters"),
        node(560, 70, ["Filter 3", "enrich"], "pattern", w=120, h=50, icon="pipes-and-filters"),
        node(730, 70, ["Message", "Sink"], "info", w=120, h=50),
    ],
    edges=[
        edge(170, 95, 220, 95, label="pipe", amber=True),
        edge(340, 95, 390, 95, label="pipe", amber=True),
        edge(510, 95, 560, 95, label="pipe", amber=True),
        edge(680, 95, 730, 95, label="pipe", amber=True),
    ],
    notes=[
        note(440, 155, "Each filter transforms the message; pipes connect them", anchor="middle"),
        note(440, 180, "This is the core Camel route model: from() → process → to()", anchor="middle"),
    ],
)


# -- 04: Channel Types --------------------------------------------------------
g.emit("04-channel-types", 880, 320,
    bands=[
        band(20, 20, 400, 280, "Point-to-Point"),
        band(460, 20, 400, 280, "Publish-Subscribe"),
    ],
    nodes=[
        node(60, 80, ["Producer", "sends message"], "accent", w=140, h=50),
        node(60, 200, ["Consumer B", "idle"], "muted", w=140, h=50),
        node(240, 140, ["Kafka Topic", "1 consumer group"], "channel", w=140, h=50),
        node(240, 80, ["Consumer A", "receives"], "pattern", w=140, h=50, icon="competing-consumers"),
        node(500, 80, ["Producer", "publishes event"], "accent", w=140, h=50),
        node(680, 60, ["Group A", "inventory-svc"], "info", w=140, h=50),
        node(680, 140, ["Group B", "payment-svc"], "info", w=140, h=50),
        node(680, 220, ["Group C", "notification-svc"], "info", w=140, h=50),
        node(500, 150, ["Kafka Topic", "3 consumer groups"], "channel", w=140, h=50),
    ],
    edges=[
        edge(200, 105, 240, 165, amber=True),
        edge(380, 165, 380, 105, label="1 gets it"),
        edge(640, 105, 680, 85, amber=True),
        edge(640, 175, 680, 165, amber=True, label="all get it"),
        edge(640, 175, 680, 245, amber=True),
    ],
    notes=[
        note(220, 265, "Only ONE consumer processes each message", anchor="middle"),
        note(700, 295, "ALL groups get every message", anchor="middle"),
    ],
)


# -- 05: Reliability Patterns -------------------------------------------------
g.emit("05-reliability-patterns", 880, 280,
    bands=[band(20, 20, 840, 240, "Reliability Patterns")],
    nodes=[
        node(50, 70, ["Producer", "acks=all"], "accent", w=140, h=50),
        node(240, 70, ["Kafka Broker", "min.insync.replicas=2"], w=160, h=50),
        node(460, 70, ["Consumer", "groupId=svc"], "info", w=140, h=50),
        node(660, 70, ["Process", "business logic"], w=160, h=50),
        node(460, 180, ["Retry", "3 attempts"], "muted", w=140, h=50),
        node(660, 180, ["Dead Letter", "Channel (DLQ)"], "pattern", w=160, h=50, icon="dead-letter-channel"),
    ],
    edges=[
        edge(190, 95, 240, 95, label="guaranteed", amber=True),
        edge(400, 95, 460, 95, label="consume"),
        edge(600, 95, 660, 95),
        edge(740, 120, 740, 180, label="error"),
        edge(660, 205, 600, 205, label="retry"),
        edge(460, 205, 460, 120, label="reprocess"),
    ],
    notes=[
        note(740, 245, "After all retries exhausted", anchor="middle"),
    ],
)


# -- 06: Messaging Bridge -----------------------------------------------------
g.emit("06-messaging-bridge", 880, 260,
    bands=[band(20, 20, 840, 220, "Messaging Bridge — Kafka to Pulsar")],
    nodes=[
        node(50, 80, ["Kafka", "eip.orders.*", "KRaft cluster"], "accent", w=140, h=60),
        node(260, 80, ["Camel Bridge", "kafka → pulsar", "message translator"], "pattern", w=160, h=60, icon="messaging-bridge"),
        node(500, 80, ["Pulsar", "persistent://eip", "multi-tenant"], "info", w=150, h=60),
        node(720, 80, ["Analytics", "subscriber"], w=120, h=60),
    ],
    edges=[
        edge(190, 110, 260, 110, label="consume", amber=True),
        edge(420, 110, 500, 110, label="produce", amber=True),
        edge(650, 110, 720, 110, label="subscribe"),
    ],
    notes=[
        note(440, 175, "Bridge connects two messaging systems without either knowing about the other", anchor="middle"),
    ],
)


# -- 07: Message Types ---------------------------------------------------------
g.emit("07-message-types", 880, 300,
    bands=[band(20, 20, 840, 260, "Message Types")],
    nodes=[
        node(50, 70, ["Command", "ProcessPayment"], "pattern", w=120, h=50, icon="command-message"),
        node(50, 150, ["Event", "OrderPlaced"], "pattern", w=120, h=50, icon="event-message"),
        node(50, 230, ["Document", "OrderRecord"], "pattern", w=120, h=50, icon="document-message"),
        node(260, 70, ["Point-to-Point Channel", "exactly-once processing"], "channel", w=200, h=50),
        node(260, 150, ["Publish-Subscribe", "all consumers notified"], "channel", w=200, h=50),
        node(260, 230, ["Any Channel", "data transfer, no action"], "channel", w=200, h=50),
        node(560, 70, ["payment-service", "executes command"], "muted", w=140, h=50),
        node(560, 130, ["inventory-service", "reacts to event"], "muted", w=140, h=50),
        node(560, 190, ["notification-svc", "reacts to event"], "muted", w=140, h=50),
        node(560, 230, ["accounting-svc", "stores document"], "muted", w=140, h=50),
    ],
    edges=[
        edge(170, 95, 260, 95, amber=True),
        edge(170, 175, 260, 175, amber=True),
        edge(170, 255, 260, 255, amber=True),
        edge(460, 95, 560, 95),
        edge(460, 165, 560, 155),
        edge(460, 175, 560, 215),
        edge(460, 255, 560, 255),
    ],
)


# -- 08: Request-Reply ---------------------------------------------------------
g.emit("08-request-reply", 880, 280,
    bands=[band(20, 20, 840, 240, "Request-Reply with Correlation")],
    nodes=[
        node(50, 70, ["order-service", "requestor"], "pattern", w=140, h=50, icon="request-reply"),
        node(300, 70, ["Request Channel", "eip.inventory.check"], "channel", w=180, h=50),
        node(600, 70, ["inventory-svc", "responder"], "pattern", w=140, h=50, icon="service-activator"),
        node(50, 180, ["order-service", "correlate reply"], "pattern", w=140, h=50, icon="correlation-identifier"),
        node(300, 180, ["Reply Channel", "eip.inventory.result"], "channel", w=180, h=50),
        node(600, 180, ["inventory-svc", "send result"], "pattern", w=140, h=50, icon="return-address"),
    ],
    edges=[
        edge(190, 95, 300, 95, label="correlationId=abc", amber=True),
        edge(480, 95, 600, 95),
        edge(600, 195, 480, 195),
        edge(300, 205, 190, 205, label="correlationId=abc", amber=True),
    ],
    notes=[
        note(440, 145, "Same correlationId links request to reply", anchor="middle"),
    ],
)


# -- 09: Routing Patterns ------------------------------------------------------
g.emit("09-routing-patterns", 900, 360,
    bands=[band(20, 20, 860, 320, "Message Routing Patterns")],
    nodes=[
        node(50, 70, ["Incoming", "Order Message"], "accent", w=140, h=50),
        node(240, 70, ["Content-Based", "Router (choice)"], "pattern", w=140, h=50, icon="content-based-router"),
        node(440, 50, ["Domestic"], "info", w=130, h=40),
        node(440, 100, ["International"], "info", w=130, h=40),
        node(50, 180, ["Batch Order", "[3 items]"], "accent", w=140, h=50),
        node(240, 180, ["Splitter", "split(body)"], "pattern", w=140, h=50, icon="splitter"),
        node(440, 160, ["Item 1"], w=100, h=35),
        node(440, 200, ["Item 2"], w=100, h=35),
        node(440, 240, ["Item 3"], w=100, h=35),
        node(50, 290, ["Notification"], "accent", w=140, h=40),
        node(240, 290, ["Recipient List", "recipientList()"], "pattern", w=140, h=40, icon="recipient-list"),
        node(440, 280, ["Email"], w=100, h=35),
        node(560, 280, ["SMS"], w=100, h=35),
        node(680, 280, ["Webhook"], w=100, h=35),
    ],
    edges=[
        edge(190, 95, 240, 95, amber=True),
        edge(380, 85, 440, 70),
        edge(380, 95, 440, 120),
        edge(190, 205, 240, 205, amber=True),
        edge(380, 195, 440, 178),
        edge(380, 205, 440, 218),
        edge(380, 215, 440, 258),
        edge(190, 310, 240, 310, amber=True),
        edge(380, 305, 440, 298),
        edge(380, 310, 560, 298),
        edge(380, 315, 680, 298),
    ],
    notes=[
        note(620, 70, "routes by content"),
        note(570, 215, "splits into parts"),
        note(800, 310, "fans out to list"),
    ],
)


# -- 10: Scatter-Gather --------------------------------------------------------
g.emit("10-scatter-gather", 880, 300,
    bands=[band(20, 20, 840, 260, "Scatter-Gather Pattern")],
    nodes=[
        node(50, 110, ["Request", "quote me"], "accent", w=120, h=50),
        node(220, 110, ["Recipient List", "scatter"], "pattern", w=140, h=50, icon="recipient-list"),
        node(420, 50, ["Carrier A"], w=120, h=40),
        node(420, 110, ["Carrier B"], w=120, h=40),
        node(420, 170, ["Carrier C"], w=120, h=40),
        node(600, 100, ["Aggregator", "gather + pick", "best quote"], "pattern", w=130, h=60, icon="aggregator"),
        node(780, 110, ["Result", "$12.99"], "info", w=80, h=50),
    ],
    edges=[
        edge(170, 135, 220, 135, amber=True),
        edge(360, 125, 420, 70),
        edge(360, 135, 420, 130, label="scatter", amber=True),
        edge(360, 145, 420, 190),
        edge(540, 70, 600, 120),
        edge(540, 130, 600, 130, label="gather"),
        edge(540, 190, 600, 140),
        edge(730, 130, 780, 135, amber=True),
    ],
    notes=[
        note(440, 240, "Fan out, collect replies, pick the winner", anchor="middle"),
    ],
)


# -- 11: Wire Tap --------------------------------------------------------------
g.emit("11-wire-tap", 880, 260,
    bands=[band(20, 20, 840, 220, "Wire Tap Pattern")],
    nodes=[
        node(50, 70, ["Incoming", "Order"], "accent", w=140, h=50),
        node(280, 70, ["Wire Tap", "copies message"], "pattern", w=160, h=50, icon="wire-tap"),
        node(540, 70, ["Main Flow", "process order"], w=140, h=50),
        node(740, 70, ["Continue", "processing"], "info", w=100, h=50),
        node(280, 170, ["Monitoring", "audit log / metrics"], "muted", w=160, h=50),
    ],
    edges=[
        edge(190, 95, 280, 95, amber=True),
        edge(440, 95, 540, 95, label="original", amber=True),
        edge(680, 95, 740, 95),
        edge(360, 120, 360, 170, label="copy"),
    ],
    notes=[
        note(360, 235, "Copy sent to secondary channel without affecting main flow", anchor="middle"),
    ],
)


# -- 12: Transformation Flow --------------------------------------------------
g.emit("12-transformation-flow", 880, 260,
    bands=[band(20, 20, 840, 220, "Transformation Pipeline")],
    nodes=[
        node(50, 70, ["Raw Order", "external format"], "accent", w=130, h=50),
        node(230, 70, ["Translator", "normalize"], "pattern", w=130, h=50, icon="message-translator"),
        node(410, 70, ["Enricher", "add address"], "pattern", w=130, h=50, icon="content-enricher"),
        node(590, 70, ["Filter", "remove PII"], "pattern", w=130, h=50, icon="content-filter"),
        node(750, 70, ["Canonical", "Order"], "info", w=100, h=50),
        node(410, 170, ["Address DB", "external lookup"], "muted", w=130, h=50),
    ],
    edges=[
        edge(180, 95, 230, 95, amber=True),
        edge(360, 95, 410, 95),
        edge(540, 95, 590, 95),
        edge(720, 95, 750, 95, amber=True),
        edge(475, 120, 475, 170, label="lookup"),
    ],
    notes=[
        note(450, 50, "Pipes and Filters — each step transforms the message", anchor="middle"),
    ],
)


# -- 13: Aggregator ------------------------------------------------------------
g.emit("13-aggregator", 880, 280,
    bands=[band(20, 20, 840, 240, "Aggregator Pattern")],
    nodes=[
        node(50, 80, ["Msg A (id=1)"], w=120, h=40),
        node(50, 130, ["Msg B (id=1)"], w=120, h=40),
        node(50, 180, ["Msg C (id=1)"], w=120, h=40),
        node(250, 100, ["Aggregator", "correlate by id", "completionSize=3"], "pattern", w=180, h=80, icon="aggregator"),
        node(510, 120, ["Combined", "Result"], "accent", w=160, h=50),
        node(740, 120, ["Next", "Processor"], "info", w=100, h=50),
    ],
    edges=[
        edge(170, 100, 250, 130),
        edge(170, 150, 250, 140, amber=True),
        edge(170, 200, 250, 160),
        edge(430, 140, 510, 145, label="aggregate", amber=True),
        edge(670, 145, 740, 145),
    ],
    notes=[
        note(350, 210, "Waits for all correlated messages before emitting", anchor="middle"),
    ],
)


# -- 14: Consumer Patterns -----------------------------------------------------
g.emit("14-consumer-patterns", 880, 300,
    bands=[
        band(20, 20, 410, 260, "Competing Consumers"),
        band(460, 20, 400, 260, "Event-Driven Consumer"),
    ],
    nodes=[
        node(50, 80, ["Kafka Topic", "3 partitions"], "channel", w=140, h=50),
        node(240, 60, ["Instance 1", "P0, P1"], "info", w=140, h=40),
        node(240, 110, ["Instance 2", "P2"], "info", w=140, h=40),
        node(240, 170, ["Instance 3", "(standby)"], "muted", w=140, h=40),
        node(500, 80, ["Kafka Topic", "event stream"], "channel", w=140, h=50),
        node(700, 80, ["Consumer", "callback on msg"], "pattern", w=130, h=50, icon="event-driven-consumer"),
    ],
    edges=[
        edge(190, 95, 240, 80, amber=True),
        edge(190, 110, 240, 130),
        edge(640, 105, 700, 105, label="push", amber=True),
    ],
    notes=[
        note(220, 240, "Scale by adding instances", anchor="middle"),
        note(700, 170, "Consumer reacts when message arrives", anchor="middle"),
    ],
)


# -- 15: Outbox Pattern --------------------------------------------------------
g.emit("15-outbox-pattern", 880, 300,
    bands=[band(20, 20, 840, 260, "Outbox Pattern — Transactional Client")],
    nodes=[
        node(50, 80, ["Application", "business logic"], "accent", w=130, h=50),
        node(240, 60, ["orders table", "INSERT order"], w=150, h=40),
        node(240, 120, ["outbox table", "INSERT event"], w=150, h=40),
        node(160, 170, ["TX COMMIT"], "pattern", w=100, h=30, icon="transactional-client"),
        node(480, 100, ["CDC / Poller", "reads outbox"], "info", w=140, h=50),
        node(680, 100, ["Kafka", "event published"], "accent", w=140, h=50),
    ],
    edges=[
        edge(180, 95, 240, 80, amber=True),
        edge(180, 110, 240, 140, label="same TX", amber=True),
        edge(390, 140, 480, 125, label="poll/CDC"),
        edge(620, 125, 680, 125, label="publish", amber=True),
    ],
    notes=[
        note(300, 220, "Both writes in one DB transaction — atomic", anchor="middle"),
        note(620, 180, "Eventually consistent with Kafka", anchor="middle"),
    ],
)


# -- 16: Messaging Gateway -----------------------------------------------------
g.emit("16-messaging-gateway", 880, 260,
    bands=[band(20, 20, 840, 220, "Messaging Gateway Pattern")],
    nodes=[
        node(50, 80, ["Application", "REST / gRPC"], "accent", w=130, h=50),
        node(240, 80, ["Messaging Gateway", "hides messaging", "from application"], "pattern", w=160, h=60, icon="messaging-gateway"),
        node(470, 60, ["Kafka Producer", "eip.orders.*"], w=140, h=40),
        node(470, 120, ["Kafka Consumer", "eip.inventory.*"], w=140, h=40),
        node(680, 80, ["Messaging", "System"], "info", w=140, h=50),
    ],
    edges=[
        edge(180, 105, 240, 110, label="method call", amber=True),
        edge(400, 100, 470, 80),
        edge(400, 115, 470, 140),
        edge(610, 80, 680, 95, amber=True),
        edge(610, 140, 680, 115, amber=True),
    ],
    notes=[
        note(320, 175, "Application code never touches Kafka directly", anchor="middle"),
    ],
)


# -- 17: Control Bus -----------------------------------------------------------
g.emit("17-control-bus", 880, 260,
    bands=[band(20, 20, 840, 220, "Control Bus — Observability")],
    nodes=[
        node(50, 70, ["Operator", "control panel"], "accent", w=120, h=50),
        node(240, 70, ["Control Bus", "controlbus:route"], "pattern", w=160, h=50, icon="control-bus"),
        node(500, 50, ["Route: order-flow", "status: started"], w=140, h=40),
        node(500, 100, ["Route: debug-tap", "status: stopped"], "muted", w=140, h=40),
        node(500, 150, ["Route: dlq-handler", "status: started"], w=140, h=40),
        node(720, 70, ["Metrics", "OTel + Grafana"], "info", w=120, h=50),
    ],
    edges=[
        edge(170, 95, 240, 95, label="start/stop", amber=True),
        edge(400, 85, 500, 70),
        edge(400, 95, 500, 120, label="manage"),
        edge(400, 105, 500, 170),
        edge(640, 90, 720, 90, label="export"),
    ],
    notes=[
        note(440, 215, "Start, stop, and query routes at runtime without redeployment", anchor="middle"),
    ],
)


# -- 18: Testing Patterns ------------------------------------------------------
g.emit("18-testing-patterns", 880, 280,
    bands=[
        band(20, 20, 410, 240, "Test Message"),
        band(460, 20, 400, 240, "Detour Pattern"),
    ],
    nodes=[
        node(50, 80, ["Test Injector", "synthetic msg"], "pattern", w=120, h=50, icon="test-message"),
        node(220, 80, ["Normal Route", "process msg"], w=130, h=50),
        node(220, 180, ["Verifier", "check result"], "info", w=130, h=50),
        node(500, 80, ["Message", "incoming"], "accent", w=120, h=50),
        node(660, 60, ["Main Flow", "always runs"], w=130, h=40),
        node(660, 120, ["Debug Step", "toggled on/off"], "pattern", w=130, h=40, icon="detour"),
        node(660, 180, ["Continue", "processing"], w=130, h=40),
    ],
    edges=[
        edge(170, 105, 220, 105, label="inject", amber=True),
        edge(285, 130, 285, 180, label="verify"),
        edge(620, 105, 660, 80, amber=True),
        edge(620, 105, 660, 140, label="if enabled"),
        edge(790, 80, 790, 180),
        edge(790, 160, 790, 180),
    ],
    notes=[
        note(220, 245, "Verify system health", anchor="middle"),
        note(700, 225, "Toggle via config/feature flag", anchor="middle"),
    ],
)


# -- 20: Kafka Architecture ---------------------------------------------------
g.emit("20-kafka-architecture", 900, 320,
    bands=[band(20, 20, 860, 280, "Kafka Cluster (KRaft)")],
    nodes=[
        node(50, 70, ["Producer", "acks=all"], "accent", w=120, h=50),
        node(50, 180, ["Consumer", "group.id=svc"], "info", w=120, h=50),
        node(240, 60, ["Broker 1", "controller"], w=130, h=40),
        node(240, 110, ["Broker 2", "follower"], w=130, h=40),
        node(240, 160, ["Broker 3", "follower"], w=130, h=40),
        node(440, 55, ["P0"], "ink", w=90, h=35),
        node(540, 55, ["P1"], "ink", w=90, h=35),
        node(640, 55, ["P2"], "ink", w=90, h=35),
        node(440, 100, ["P0 replica"], "muted", w=90, h=35),
        node(540, 100, ["P1 replica"], "muted", w=90, h=35),
        node(640, 100, ["P2 replica"], "muted", w=90, h=35),
        node(440, 150, ["P0 replica"], "muted", w=90, h=35),
        node(540, 150, ["P1 replica"], "muted", w=90, h=35),
        node(640, 150, ["P2 replica"], "muted", w=90, h=35),
        node(780, 60, ["C1", "P0, P1"], "info", w=80, h=40),
        node(780, 120, ["C2", "P2"], "info", w=80, h=40),
        node(780, 190, ["C3", "standby"], "muted", w=80, h=40),
    ],
    edges=[
        edge(170, 95, 240, 80, label="write", amber=True),
        edge(170, 205, 240, 180, label="read"),
        edge(730, 73, 780, 80),
        edge(730, 73, 780, 140, label="assign"),
    ],
    notes=[
        note(560, 210, "3 partitions \xd7 3 replicas = 9 segment copies", anchor="middle"),
        note(560, 240, "min.insync.replicas=2 for durability", anchor="middle"),
    ],
)


# -- 21: Pulsar Architecture --------------------------------------------------
g.emit("21-pulsar-architecture", 900, 320,
    bands=[band(20, 20, 860, 280, "Pulsar Cluster")],
    nodes=[
        node(50, 80, ["Producer", "tenant/ns/topic"], "accent", w=120, h=50),
        node(50, 190, ["Consumer", "subscription"], "info", w=120, h=50),
        node(240, 60, ["Broker 1", "stateless"], w=130, h=50),
        node(240, 130, ["Broker 2", "stateless"], w=130, h=50),
        node(450, 60, ["BookKeeper", "bookie 1"], "ink", w=140, h=50),
        node(450, 130, ["BookKeeper", "bookie 2"], "ink", w=140, h=50),
        node(450, 200, ["BookKeeper", "bookie 3"], "ink", w=140, h=50),
        node(680, 90, ["Tenant: eip", "ns: shipping", "topic: orders.placed"], "muted", w=160, h=60),
    ],
    edges=[
        edge(170, 105, 240, 85, label="publish", amber=True),
        edge(170, 215, 240, 155, label="subscribe"),
        edge(370, 85, 450, 85, label="store"),
        edge(370, 155, 450, 155, label="store"),
        edge(590, 85, 680, 110, amber=True),
        edge(590, 155, 680, 130),
    ],
    notes=[
        note(560, 270, "Stateless brokers + BookKeeper storage = independent scaling", anchor="middle"),
    ],
)


# -- 23: Promotion Workflow ----------------------------------------------------
g.emit("23-promotion-workflow", 900, 260,
    bands=[band(20, 20, 860, 220, "JBang → Quarkus Promotion Workflow")],
    nodes=[
        node(40, 80, ["JBang / camel run", "camel run --dev", "fast prototype"], "accent", w=140, h=60),
        node(240, 80, ["camel export", "--runtime=quarkus", "generate project"], "ink", w=140, h=60),
        node(440, 80, ["Quarkus Project", "mvn quarkus:dev", "full IDE support"], w=150, h=60),
        node(650, 80, ["Native Binary", "~20ms startup", "~50MB memory"], "info", w=150, h=60),
    ],
    edges=[
        edge(180, 110, 240, 110, label="promote", amber=True),
        edge(380, 110, 440, 110, label="develop", amber=True),
        edge(590, 110, 650, 110, label="build native", amber=True),
    ],
    notes=[
        note(450, 180, "Prototype fast → promote to production-grade → deploy native", anchor="middle"),
    ],
)


# -- 26: Feature Flags ---------------------------------------------------------
g.emit("26-feature-flags", 880, 260,
    bands=[band(20, 20, 840, 220, "Feature Flags — flagd + OpenFeature")],
    nodes=[
        node(50, 80, ["Camel Route", "evaluates flag", "via OpenFeature"], "accent", w=150, h=60),
        node(300, 80, ["flagd", "evaluation", "daemon :8013"], "ink", w=130, h=60),
        node(520, 80, ["flags.json", "flag definitions", "ConfigMap"], w=140, h=60),
        node(730, 60, ["Flag: ON", "route to enricher"], "info", w=120, h=40),
        node(730, 120, ["Flag: OFF", "skip enrichment"], "muted", w=120, h=40),
    ],
    edges=[
        edge(200, 110, 300, 110, label="gRPC", amber=True),
        edge(430, 110, 520, 110, label="watch"),
        edge(200, 90, 730, 80),
        edge(200, 130, 730, 140),
    ],
    notes=[
        note(440, 180, "Dynamic flag evaluation — no redeployment needed", anchor="middle"),
    ],
)


# -- 28: Loan Broker -----------------------------------------------------------
g.emit("28-loan-broker", 900, 340,
    bands=[band(20, 20, 860, 300, "Loan Broker — Scatter-Gather")],
    nodes=[
        node(40, 80, ["Customer", "loan request"], "accent", w=110, h=50),
        node(190, 80, ["Gateway", "REST → Kafka"], "pattern", w=110, h=50, icon="messaging-gateway"),
        node(340, 80, ["Enricher", "credit bureau"], "pattern", w=120, h=50, icon="content-enricher"),
        node(500, 80, ["Recipient List", "select banks"], "pattern", w=130, h=50, icon="recipient-list"),
        node(680, 50, ["Bank A"], w=100, h=40),
        node(680, 100, ["Bank B"], w=100, h=40),
        node(680, 150, ["Bank C"], w=100, h=40),
        node(680, 200, ["Bank D"], w=100, h=40),
        node(500, 250, ["Aggregator", "best offer"], "pattern", w=130, h=50, icon="aggregator"),
        node(340, 250, ["Best Rate", "result"], "accent", w=120, h=50),
    ],
    edges=[
        edge(150, 105, 190, 105, amber=True),
        edge(300, 105, 340, 105),
        edge(460, 105, 500, 105),
        edge(630, 95, 680, 70),
        edge(630, 100, 680, 120),
        edge(630, 105, 680, 170, label="scatter", amber=True),
        edge(630, 110, 680, 220),
        edge(780, 70, 780, 250),
        edge(780, 250, 630, 275, label="gather"),
        edge(500, 275, 460, 275, amber=True),
    ],
    notes=[
        note(180, 290, "Customer gets best rate from all qualifying banks"),
    ],
)


# -- 29: Bond Trading ----------------------------------------------------------
g.emit("29-bond-trading", 900, 340,
    bands=[band(20, 20, 860, 300, "Bond Trading — Market Data Distribution")],
    nodes=[
        node(40, 60, ["Bloomberg", "feed"], w=110, h=45),
        node(40, 115, ["Reuters", "feed"], w=110, h=45),
        node(40, 170, ["Exchange", "feed"], w=110, h=45),
        node(200, 100, ["Channel Adapters", "+ Normalizer", "canonical format"], "pattern", w=140, h=60, icon="normalizer"),
        node(400, 110, ["Best Price", "Aggregator"], "pattern", w=140, h=50, icon="aggregator"),
        node(600, 60, ["Desk A", "govt bonds"], "info", w=120, h=40),
        node(600, 110, ["Desk B", "corporate"], "info", w=120, h=40),
        node(600, 160, ["Desk C", "short-term"], "info", w=120, h=40),
        node(600, 240, ["Trade Engine", "validate + exec"], "ink", w=120, h=50),
        node(780, 240, ["Audit", "Wire Tap"], "muted", w=80, h=50),
    ],
    edges=[
        edge(150, 83, 200, 120),
        edge(150, 138, 200, 130, amber=True),
        edge(150, 193, 200, 145),
        edge(340, 130, 400, 135),
        edge(540, 125, 600, 80),
        edge(540, 135, 600, 130, label="filter", amber=True),
        edge(540, 145, 600, 180),
        edge(660, 160, 660, 240, label="order"),
        edge(720, 265, 780, 265, label="copy"),
    ],
    notes=[
        note(450, 290, "Multiple feeds → normalize → filter → trade → audit", anchor="middle"),
    ],
)


# -- Resequencer ---------------------------------------------------------------
g.emit("11-resequencer", 880, 260,
    bands=[band(20, 20, 840, 220, "Resequencer — Restoring Message Order")],
    nodes=[
        node(50, 60, ["Msg 3"], "accent", w=90, h=40),
        node(50, 110, ["Msg 1"], "accent", w=90, h=40),
        node(50, 160, ["Msg 2"], "accent", w=90, h=40),
        node(220, 90, ["Resequencer", "sort by seqNum"], "pattern", w=160, h=70, icon="resequencer"),
        node(460, 60, ["Msg 1"], "info", w=90, h=40),
        node(460, 110, ["Msg 2"], "info", w=90, h=40),
        node(460, 160, ["Msg 3"], "info", w=90, h=40),
        node(630, 60, ["Stream", "sliding window"], "muted", w=130, h=40),
        node(630, 120, ["Batch", "collect + sort"], "muted", w=130, h=40),
    ],
    edges=[
        edge(140, 80, 220, 110, amber=True),
        edge(140, 130, 220, 125, amber=True),
        edge(140, 180, 220, 140, amber=True),
        edge(380, 115, 460, 80, amber=True, label="ordered"),
        edge(380, 125, 460, 130, amber=True),
        edge(380, 135, 460, 175, amber=True),
    ],
    notes=[
        note(440, 215, "Out-of-order input → sorted output by sequence number", anchor="middle"),
    ],
)


# -- Type Conversion ----------------------------------------------------------
g.emit("12-type-conversion", 880, 240,
    bands=[band(20, 20, 840, 200, "Type Conversion — Camel's Automatic Type System")],
    nodes=[
        node(40, 70, ["byte[]", "raw payload"], "muted", w=110, h=50),
        node(200, 70, ["String", "text body"], "box", w=110, h=50),
        node(360, 70, ["JSON", "jackson"], "pattern", w=110, h=50, icon="message-translator"),
        node(520, 70, ["POJO", "Order.class"], "accent", w=110, h=50),
        node(700, 70, ["marshal()", "json()"], "pattern", w=130, h=50, icon="canonical-data-model"),
    ],
    edges=[
        edge(150, 95, 200, 95, amber=True, label="decode"),
        edge(310, 95, 360, 95, amber=True, label="parse"),
        edge(470, 95, 520, 95, amber=True, label="bind"),
        edge(630, 95, 700, 95, label="serialize"),
    ],
    notes=[
        note(440, 165, "Camel chains converters automatically: getBody(Order.class)", anchor="middle"),
    ],
)


# -- Channel Purger + Smart Proxy ---------------------------------------------
g.emit("17-purger-proxy", 880, 300,
    bands=[
        band(20, 20, 400, 260, "Channel Purger"),
        band(460, 20, 400, 260, "Smart Proxy"),
    ],
    nodes=[
        node(50, 70, ["Test Runner", "before test"], "accent", w=130, h=50),
        node(230, 70, ["Kafka Topic", "test data"], "channel", w=130, h=50),
        node(50, 180, ["Reset Offsets", "to-earliest"], "pattern", w=130, h=50, icon="channel-purger"),
        node(230, 180, ["Clean Topic", "ready for test"], "info", w=130, h=50),
        node(500, 70, ["Producer", "sends messages"], "accent", w=120, h=50),
        node(670, 70, ["Smart Proxy", "intercept"], "pattern", w=130, h=50, icon="smart-proxy"),
        node(670, 180, ["Monitor", "log + metrics"], "muted", w=130, h=50),
        node(500, 180, ["Consumer", "reads messages"], "info", w=120, h=50),
    ],
    edges=[
        edge(180, 95, 230, 95, amber=True, label="purge"),
        edge(130, 120, 130, 180, label="reset"),
        edge(310, 120, 310, 180, amber=True),
        edge(620, 95, 670, 95, amber=True),
        edge(735, 120, 735, 180, label="copy"),
        edge(670, 205, 620, 205, amber=True, label="forward"),
    ],
    notes=[
        note(210, 255, "Clear test data", anchor="middle"),
        note(660, 255, "Observe without disrupting", anchor="middle"),
    ],
)


# -- Virtual Threads -----------------------------------------------------------
g.emit("31-virtual-threads", 900, 340,
    bands=[
        band(20, 20, 400, 300, "Platform Threads (1:1)"),
        band(460, 20, 420, 300, "Virtual Threads (M:N)", fill="#fff8ef"),
    ],
    nodes=[
        node(50, 70, ["OS Thread 1"], "muted", w=120, h=40),
        node(50, 120, ["OS Thread 2"], "muted", w=120, h=40),
        node(50, 170, ["OS Thread 3"], "muted", w=120, h=40),
        node(220, 70, ["JVM Thread 1", "Kafka consumer"], "ink", w=150, h=40),
        node(220, 120, ["JVM Thread 2", "HTTP handler"], "ink", w=150, h=40),
        node(220, 170, ["JVM Thread 3", "JDBC query"], "ink", w=150, h=40),
        node(490, 70, ["Carrier Pool", "ForkJoinPool"], "accent", w=140, h=55),
        node(490, 160, ["VT 1", "mounted"], "info", w=70, h=35),
        node(570, 160, ["VT 2", "mounted"], "info", w=70, h=35),
        node(490, 210, ["VT 3", "parked"], "muted", w=70, h=35),
        node(570, 210, ["VT 4", "parked"], "muted", w=70, h=35),
        node(650, 160, ["VT 5", "parked"], "muted", w=70, h=35),
        node(650, 210, ["VT 6", "parked"], "muted", w=70, h=35),
        node(730, 160, ["VT 7", "parked"], "muted", w=70, h=35),
        node(730, 210, ["VT 8", "parked"], "muted", w=70, h=35),
        node(490, 265, ["~1KB stack", "per thread"], "box", w=100, h=35),
        node(650, 265, ["I/O → park", "unmount"], "box", w=100, h=35),
    ],
    edges=[
        edge(170, 90, 220, 90, label="1:1"),
        edge(170, 140, 220, 140, label="1:1"),
        edge(170, 190, 220, 190, label="1:1"),
        edge(560, 125, 525, 160, amber=True, label="mount"),
        edge(560, 125, 605, 160, amber=True),
    ],
    notes=[
        note(210, 240, "~1MB stack per thread", anchor="middle"),
        note(210, 260, "Limited by OS resources", anchor="middle"),
        note(640, 125, "2 carriers run many VTs", anchor="middle"),
    ],
)


print(f"Done — 30 chapter diagram pairs generated in {g.OUT}")
