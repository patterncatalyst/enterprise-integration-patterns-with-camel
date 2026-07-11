#!/usr/bin/env python3
"""Regenerate all chapter diagrams (those not handled by generate_example_diagrams.py
or generate_appendix_diagrams.py)."""
import sys; sys.path.insert(0, "scripts")
import generate_diagram as g
g.OUT = "assets/diagrams"

# --- 01-order-flow ---
g.emit("01-order-flow", 900, 520,
    bands=[
        {'x': 20, 'y': 10, 'w': 860, 'h': 500, 'label': 'Shipping Domain — Order Flow'},
    ],
    nodes=[
        {'x': 370, 'y': 40, 'w': 160, 'h': 50, 'style': 'ink', 'lines': ['Customer', 'HTTP POST /orders']},
        {'x': 370, 'y': 130, 'w': 160, 'h': 55, 'style': 'accent', 'lines': ['order-service', 'PostgreSQL · orders']},
        {'x': 100, 'y': 260, 'w': 170, 'h': 55, 'lines': ['inventory-service', 'PostgreSQL · inventory']},
        {'x': 630, 'y': 260, 'w': 170, 'h': 55, 'style': 'muted', 'lines': ['notification-service', 'email / SMS']},
        {'x': 100, 'y': 370, 'w': 170, 'h': 55, 'lines': ['payment-service', 'PostgreSQL · payments']},
        {'x': 100, 'y': 460, 'w': 170, 'h': 50, 'lines': ['shipping-service', 'PostgreSQL · shipping']},
    ],
    edges=[


        {'x1': 450, 'y1': 90, 'x2': 450, 'y2': 130, 'amber': True, 'label': 'HTTP'},
        {'x1': 370, 'y1': 160, 'x2': 270, 'y2': 260, 'amber': True},
        {'x1': 530, 'y1': 160, 'x2': 630, 'y2': 260, 'amber': True},
        {'x1': 185, 'y1': 315, 'x2': 185, 'y2': 370, 'amber': True},
        {'x1': 270, 'y1': 400, 'x2': 630, 'y2': 290},
        {'x1': 185, 'y1': 425, 'x2': 185, 'y2': 460, 'amber': True},
    ],
    notes=[
        {'x': 270, 'y': 210, 'text': 'OrderPlaced', 'anchor': 'middle'},
        {'x': 630, 'y': 210, 'text': 'OrderPlaced', 'anchor': 'middle'},
        {'x': 280, 'y': 342, 'text': 'InventoryReserved', 'anchor': 'middle'},
        {'x': 510, 'y': 330, 'text': 'PaymentProcessed', 'anchor': 'middle'},
        {'x': 280, 'y': 442, 'text': 'ShipmentScheduled', 'anchor': 'middle'},
        {'x': 400, 'y': 210, 'text': 'Kafka topic: eip.orders.placed', 'size': 10},
        {'x': 55, 'y': 345, 'text': 'eip.inventory.reserved', 'size': 10},
        {'x': 55, 'y': 450, 'text': 'eip.payments.processed', 'size': 10},
    ],
)

# --- 01-stack-architecture ---
g.emit("01-stack-architecture", 900, 340,
    bands=[
        {'x': 20, 'y': 10, 'w': 420, 'h': 320, 'label': 'Messaging & Persistence'},
        {'x': 460, 'y': 10, 'w': 420, 'h': 320, 'fill': '#f8f4ef', 'label': 'Observability (LGTM)'},
    ],
    nodes=[
        {'x': 40, 'y': 50, 'w': 120, 'h': 55, 'style': 'accent', 'lines': ['Kafka', 'KRaft · 9092']},
        {'x': 180, 'y': 50, 'w': 120, 'h': 55, 'style': 'accent', 'lines': ['Pulsar', 'standalone · 6650']},
        {'x': 320, 'y': 50, 'w': 100, 'h': 55, 'lines': ['Redis', '6379']},
        {'x': 40, 'y': 130, 'w': 120, 'h': 55, 'lines': ['PostgreSQL', '5 schemas · 5432']},
        {'x': 180, 'y': 130, 'w': 120, 'h': 55, 'style': 'info', 'lines': ['Apicurio', 'registry · 8081']},
        {'x': 320, 'y': 130, 'w': 100, 'h': 55, 'style': 'muted', 'lines': ['Kafka UI', '8090']},
        {'x': 480, 'y': 50, 'w': 110, 'h': 55, 'style': 'accent', 'lines': ['Grafana', 'dashboards · 3000']},
        {'x': 610, 'y': 50, 'w': 110, 'h': 55, 'lines': ['Loki', 'logs · 3100']},
        {'x': 740, 'y': 50, 'w': 120, 'h': 55, 'lines': ['Tempo', 'traces · 3200']},
        {'x': 480, 'y': 130, 'w': 110, 'h': 55, 'lines': ['Mimir', 'metrics · 9009']},
        {'x': 610, 'y': 130, 'w': 120, 'h': 55, 'style': 'info', 'lines': ['OTel Collector', '4317 / 4318']},
        {'x': 40, 'y': 240, 'w': 160, 'h': 50, 'style': 'ink', 'lines': ['order-service', 'Quarkus · 8080']},
        {'x': 220, 'y': 240, 'w': 160, 'h': 50, 'style': 'ink', 'lines': ['inventory-service', 'Quarkus · 8082']},
        {'x': 480, 'y': 240, 'w': 160, 'h': 50, 'style': 'ink', 'lines': ['payment-service', 'Quarkus · 8083']},
        {'x': 660, 'y': 240, 'w': 160, 'h': 50, 'style': 'ink', 'lines': ['shipping-service', 'Quarkus · 8084']},
    ],
    edges=[


        {'x1': 120, 'y1': 210, 'x2': 120, 'y2': 240, 'dashed': True, 'label': 'Camel routes', 'lx': 0},
        {'x1': 300, 'y1': 210, 'x2': 300, 'y2': 240, 'dashed': True, 'label': 'Camel routes', 'lx': 0},
        {'x1': 560, 'y1': 210, 'x2': 560, 'y2': 240, 'dashed': True, 'label': 'Camel routes', 'lx': 0},
        {'x1': 740, 'y1': 210, 'x2': 740, 'y2': 240, 'dashed': True, 'label': 'Camel routes', 'lx': 0},
    ],
)

# --- 02-integration-styles ---
g.emit("02-integration-styles", 900, 280,
    bands=[
        {'x': 20, 'y': 35, 'w': 200, 'h': 220, 'label': 'File Transfer'},
        {'x': 240, 'y': 35, 'w': 200, 'h': 220, 'label': 'Shared Database'},
        {'x': 460, 'y': 35, 'w': 200, 'h': 220, 'label': 'RPI (REST/gRPC)'},
        {'x': 680, 'y': 35, 'w': 200, 'h': 220, 'fill': '#fff8ef', 'label': 'Messaging'},
    ],
    nodes=[
        {'x': 40, 'y': 70, 'w': 80, 'h': 45, 'lines': ['App A', 'producer']},
        {'x': 40, 'y': 170, 'w': 80, 'h': 45, 'lines': ['App B', 'consumer']},
        {'x': 120, 'y': 120, 'w': 80, 'h': 40, 'style': 'pattern', 'icon': 'file-transfer', 'lines': ['File', 'CSV / JSON']},
        {'x': 260, 'y': 70, 'w': 80, 'h': 45, 'lines': ['App A', 'read/write']},
        {'x': 260, 'y': 170, 'w': 80, 'h': 45, 'lines': ['App B', 'read/write']},
        {'x': 340, 'y': 120, 'w': 80, 'h': 40, 'style': 'pattern', 'icon': 'shared-database', 'lines': ['Database', 'shared']},
        {'x': 480, 'y': 70, 'w': 80, 'h': 45, 'lines': ['Client', 'caller']},
        {'x': 480, 'y': 170, 'w': 80, 'h': 45, 'lines': ['Server', 'responder']},
        {'x': 700, 'y': 70, 'w': 80, 'h': 45, 'lines': ['Sender', 'producer']},
        {'x': 700, 'y': 170, 'w': 80, 'h': 45, 'lines': ['Receiver', 'consumer']},
        {'x': 780, 'y': 120, 'w': 80, 'h': 40, 'style': 'channel', 'lines': ['Channel', 'topic / queue']},
    ],
    edges=[


        {'x1': 100, 'y1': 115, 'x2': 120, 'y2': 135, 'label': 'write'},
        {'x1': 120, 'y1': 145, 'x2': 100, 'y2': 170, 'label': 'read', 'ly': 8},
        {'x1': 320, 'y1': 115, 'x2': 340, 'y2': 130, 'dashed': True},
        {'x1': 320, 'y1': 170, 'x2': 340, 'y2': 150, 'dashed': True},
        {'x1': 520, 'y1': 115, 'x2': 520, 'y2': 170, 'amber': True},
        {'x1': 510, 'y1': 170, 'x2': 510, 'y2': 115, 'dashed': True},
        {'x1': 760, 'y1': 115, 'x2': 780, 'y2': 130, 'amber': True},
        {'x1': 780, 'y1': 150, 'x2': 760, 'y2': 170, 'amber': True},
    ],
    notes=[
        {'x': 555, 'y': 136, 'text': 'request', 'anchor': 'middle'},
        {'x': 472, 'y': 136, 'text': 'response', 'anchor': 'middle'},
        {'x': 750, 'y': 112, 'text': 'send', 'anchor': 'middle'},
        {'x': 745, 'y': 170, 'text': 'receive', 'anchor': 'middle'},
        {'x': 450, 'y': 25, 'text': 'The Four Integration Styles', 'anchor': 'middle', 'bold': True, 'size': 14},
    ],
)

# --- 03-messaging-system-components ---
g.emit("03-messaging-system-components", 900, 320,
    bands=[
        {'x': 20, 'y': 10, 'w': 860, 'h': 300, 'label': 'Messaging System'},
    ],
    nodes=[
        {'x': 40, 'y': 60, 'w': 120, 'h': 55, 'style': 'ink', 'lines': ['Sender', 'Application']},
        {'x': 40, 'y': 160, 'w': 120, 'h': 50, 'style': 'pattern', 'icon': 'message-endpoint', 'lines': ['Endpoint', '(producer)']},
        {'x': 220, 'y': 110, 'w': 130, 'h': 50, 'style': 'channel', 'lines': ['Channel', 'topic / queue']},
        {'x': 400, 'y': 60, 'w': 100, 'h': 50, 'lines': ['Filter 1', 'unmarshal']},
        {'x': 520, 'y': 60, 'w': 100, 'h': 50, 'lines': ['Filter 2', 'validate']},
        {'x': 640, 'y': 60, 'w': 100, 'h': 50, 'lines': ['Filter 3', 'enrich']},
        {'x': 520, 'y': 160, 'w': 100, 'h': 50, 'style': 'pattern', 'icon': 'content-based-router', 'lines': ['Router', 'choice()']},
        {'x': 400, 'y': 240, 'w': 100, 'h': 50, 'style': 'pattern', 'icon': 'message-translator', 'lines': ['Translator', 'marshal']},
        {'x': 740, 'y': 160, 'w': 120, 'h': 50, 'style': 'pattern', 'icon': 'message-endpoint', 'lines': ['Endpoint', '(consumer)']},
        {'x': 740, 'y': 240, 'w': 120, 'h': 55, 'style': 'ink', 'lines': ['Receiver', 'Application']},
    ],
    edges=[


        {'x1': 100, 'y1': 115, 'x2': 100, 'y2': 160, 'amber': True},
        {'x1': 160, 'y1': 185, 'x2': 220, 'y2': 140, 'amber': True},
        {'x1': 350, 'y1': 130, 'x2': 400, 'y2': 90, 'label': 'pipe', 'lx': -15, 'ly': -10},
        {'x1': 500, 'y1': 85, 'x2': 520, 'y2': 85, 'amber': True},
        {'x1': 620, 'y1': 85, 'x2': 640, 'y2': 85, 'amber': True},
        {'x1': 620, 'y1': 110, 'x2': 570, 'y2': 160, 'dashed': True},
        {'x1': 620, 'y1': 185, 'x2': 740, 'y2': 185, 'amber': True, 'label': 'route A', 'ly': -10},
        {'x1': 570, 'y1': 210, 'x2': 450, 'y2': 240, 'dashed': True, 'label': 'route B', 'ly': 8},
        {'x1': 800, 'y1': 210, 'x2': 800, 'y2': 240, 'amber': True},
    ],
    notes=[
        {'x': 140, 'y': 131, 'text': 'Message', 'anchor': 'middle'},
        {'x': 450, 'y': 30, 'text': 'The Six Building Blocks', 'anchor': 'middle', 'bold': True, 'size': 14},
        {'x': 460, 'y': 140, 'text': 'Pipes & Filters', 'anchor': 'middle', 'size': 10},
    ],
)

# --- 03-pipes-and-filters ---
g.emit("03-pipes-and-filters", 880, 240,
    bands=[
        {'x': 20, 'y': 20, 'w': 840, 'h': 200, 'label': 'Pipes and Filters'},
    ],
    nodes=[
        {'x': 50, 'y': 70, 'w': 120, 'h': 50, 'style': 'accent', 'lines': ['Message', 'Source']},
        {'x': 220, 'y': 70, 'w': 120, 'h': 50, 'style': 'pattern', 'icon': 'pipes-and-filters', 'lines': ['Filter 1', 'unmarshal']},
        {'x': 390, 'y': 70, 'w': 120, 'h': 50, 'style': 'pattern', 'icon': 'pipes-and-filters', 'lines': ['Filter 2', 'validate']},
        {'x': 560, 'y': 70, 'w': 120, 'h': 50, 'style': 'pattern', 'icon': 'pipes-and-filters', 'lines': ['Filter 3', 'enrich']},
        {'x': 730, 'y': 70, 'w': 120, 'h': 50, 'style': 'info', 'lines': ['Message', 'Sink']},
    ],
    edges=[


        {'x1': 170, 'y1': 95, 'x2': 220, 'y2': 95, 'amber': True, 'label': 'pipe'},
        {'x1': 340, 'y1': 95, 'x2': 390, 'y2': 95, 'amber': True, 'label': 'pipe'},
        {'x1': 510, 'y1': 95, 'x2': 560, 'y2': 95, 'amber': True, 'label': 'pipe'},
        {'x1': 680, 'y1': 95, 'x2': 730, 'y2': 95, 'amber': True, 'label': 'pipe'},
    ],
    notes=[
        {'x': 440, 'y': 155, 'text': 'Each filter transforms the message; pipes connect them', 'anchor': 'middle'},
        {'x': 440, 'y': 180, 'text': 'This is the core Camel route model: from() → process → to()', 'anchor': 'middle'},
    ],
)

# --- 04-channel-types ---
g.emit("04-channel-types", 880, 320,
    bands=[
        {'x': 20, 'y': 20, 'w': 400, 'h': 280, 'label': 'Point-to-Point'},
        {'x': 460, 'y': 20, 'w': 400, 'h': 280, 'label': 'Publish-Subscribe'},
    ],
    nodes=[
        {'x': 60, 'y': 80, 'w': 140, 'h': 50, 'style': 'accent', 'lines': ['Producer', 'sends message']},
        {'x': 60, 'y': 200, 'w': 140, 'h': 50, 'style': 'muted', 'lines': ['Consumer B', 'idle']},
        {'x': 240, 'y': 140, 'w': 140, 'h': 50, 'style': 'channel', 'lines': ['Kafka Topic', '1 consumer group']},
        {'x': 240, 'y': 80, 'w': 140, 'h': 50, 'style': 'pattern', 'icon': 'competing-consumers', 'lines': ['Consumer A', 'receives']},
        {'x': 500, 'y': 80, 'w': 140, 'h': 50, 'style': 'accent', 'lines': ['Producer', 'publishes event']},
        {'x': 680, 'y': 60, 'w': 140, 'h': 50, 'style': 'info', 'lines': ['Group A', 'inventory-svc']},
        {'x': 680, 'y': 140, 'w': 140, 'h': 50, 'style': 'info', 'lines': ['Group B', 'payment-svc']},
        {'x': 680, 'y': 220, 'w': 140, 'h': 50, 'style': 'info', 'lines': ['Group C', 'notification-svc']},
        {'x': 500, 'y': 150, 'w': 140, 'h': 50, 'style': 'channel', 'lines': ['Kafka Topic', '3 consumer groups']},
    ],
    edges=[


        {'x1': 200, 'y1': 105, 'x2': 240, 'y2': 165, 'amber': True},
        {'x1': 380, 'y1': 165, 'x2': 380, 'y2': 105, 'label': '1 gets it'},
        {'x1': 640, 'y1': 105, 'x2': 680, 'y2': 85, 'amber': True},
        {'x1': 640, 'y1': 175, 'x2': 680, 'y2': 165, 'amber': True, 'label': 'all get it'},
        {'x1': 640, 'y1': 175, 'x2': 680, 'y2': 245, 'amber': True},
    ],
    notes=[
        {'x': 220, 'y': 265, 'text': 'Only ONE consumer processes each message', 'anchor': 'middle'},
        {'x': 700, 'y': 295, 'text': 'ALL groups get every message', 'anchor': 'middle'},
    ],
)

# --- 05-reliability-patterns ---
g.emit("05-reliability-patterns", 880, 280,
    bands=[
        {'x': 20, 'y': 20, 'w': 840, 'h': 240, 'label': 'Reliability Patterns'},
    ],
    nodes=[
        {'x': 50, 'y': 70, 'w': 140, 'h': 50, 'style': 'accent', 'lines': ['Producer', 'acks=all']},
        {'x': 240, 'y': 70, 'w': 160, 'h': 50, 'lines': ['Kafka Broker', 'min.insync.replicas=2']},
        {'x': 460, 'y': 70, 'w': 140, 'h': 50, 'style': 'info', 'lines': ['Consumer', 'groupId=svc']},
        {'x': 660, 'y': 70, 'w': 160, 'h': 50, 'lines': ['Process', 'business logic']},
        {'x': 460, 'y': 180, 'w': 140, 'h': 50, 'style': 'muted', 'lines': ['Retry', '3 attempts']},
        {'x': 660, 'y': 180, 'w': 160, 'h': 50, 'style': 'pattern', 'icon': 'dead-letter-channel', 'lines': ['Dead Letter', 'Channel (DLQ)']},
    ],
    edges=[


        {'x1': 190, 'y1': 95, 'x2': 240, 'y2': 95, 'amber': True, 'label': 'guaranteed'},
        {'x1': 400, 'y1': 95, 'x2': 460, 'y2': 95, 'label': 'consume'},
        {'x1': 600, 'y1': 95, 'x2': 660, 'y2': 95},
        {'x1': 740, 'y1': 120, 'x2': 740, 'y2': 180, 'label': 'error'},
        {'x1': 660, 'y1': 205, 'x2': 600, 'y2': 205, 'label': 'retry'},
        {'x1': 460, 'y1': 205, 'x2': 460, 'y2': 120, 'label': 'reprocess'},
    ],
    notes=[
        {'x': 740, 'y': 245, 'text': 'After all retries exhausted', 'anchor': 'middle'},
    ],
)

# --- 06-messaging-bridge ---
g.emit("06-messaging-bridge", 880, 260,
    bands=[
        {'x': 20, 'y': 20, 'w': 840, 'h': 220, 'label': 'Messaging Bridge — Kafka to Pulsar'},
    ],
    nodes=[
        {'x': 50, 'y': 80, 'w': 140, 'h': 60, 'style': 'accent', 'lines': ['Kafka', 'eip.orders.*', 'KRaft cluster']},
        {'x': 260, 'y': 80, 'w': 160, 'h': 60, 'style': 'pattern', 'icon': 'messaging-bridge', 'lines': ['Camel Bridge', 'kafka → pulsar', 'message translator']},
        {'x': 500, 'y': 80, 'w': 150, 'h': 60, 'style': 'info', 'lines': ['Pulsar', 'persistent://eip', 'multi-tenant']},
        {'x': 720, 'y': 80, 'w': 120, 'h': 60, 'lines': ['Analytics', 'subscriber']},
    ],
    edges=[


        {'x1': 190, 'y1': 110, 'x2': 260, 'y2': 110, 'amber': True, 'label': 'consume'},
        {'x1': 420, 'y1': 110, 'x2': 500, 'y2': 110, 'amber': True, 'label': 'produce'},
        {'x1': 650, 'y1': 110, 'x2': 720, 'y2': 110, 'label': 'subscribe'},
    ],
    notes=[
        {'x': 440, 'y': 175, 'text': 'Bridge connects two messaging systems without either knowing about the other', 'anchor': 'middle'},
    ],
)

# --- 07-message-types ---
g.emit("07-message-types", 880, 300,
    bands=[
        {'x': 20, 'y': 20, 'w': 840, 'h': 260, 'label': 'Message Types'},
    ],
    nodes=[
        {'x': 50, 'y': 70, 'w': 120, 'h': 50, 'style': 'pattern', 'icon': 'command-message', 'lines': ['Command', 'ProcessPayment']},
        {'x': 50, 'y': 150, 'w': 120, 'h': 50, 'style': 'pattern', 'icon': 'event-message', 'lines': ['Event', 'OrderPlaced']},
        {'x': 50, 'y': 230, 'w': 120, 'h': 50, 'style': 'pattern', 'icon': 'document-message', 'lines': ['Document', 'OrderRecord']},
        {'x': 260, 'y': 70, 'w': 200, 'h': 50, 'style': 'channel', 'lines': ['Point-to-Point Channel', 'exactly-once processing']},
        {'x': 260, 'y': 150, 'w': 200, 'h': 50, 'style': 'channel', 'lines': ['Publish-Subscribe', 'all consumers notified']},
        {'x': 260, 'y': 230, 'w': 200, 'h': 50, 'style': 'channel', 'lines': ['Any Channel', 'data transfer, no action']},
        {'x': 560, 'y': 70, 'w': 140, 'h': 50, 'style': 'muted', 'lines': ['payment-service', 'executes command']},
        {'x': 560, 'y': 130, 'w': 140, 'h': 50, 'style': 'muted', 'lines': ['inventory-service', 'reacts to event']},
        {'x': 560, 'y': 190, 'w': 140, 'h': 50, 'style': 'muted', 'lines': ['notification-svc', 'reacts to event']},
        {'x': 560, 'y': 230, 'w': 140, 'h': 50, 'style': 'muted', 'lines': ['accounting-svc', 'stores document']},
    ],
    edges=[


        {'x1': 170, 'y1': 95, 'x2': 260, 'y2': 95, 'amber': True},
        {'x1': 170, 'y1': 175, 'x2': 260, 'y2': 175, 'amber': True},
        {'x1': 170, 'y1': 255, 'x2': 260, 'y2': 255, 'amber': True},
        {'x1': 460, 'y1': 95, 'x2': 560, 'y2': 95},
        {'x1': 460, 'y1': 165, 'x2': 560, 'y2': 155},
        {'x1': 460, 'y1': 175, 'x2': 560, 'y2': 215},
        {'x1': 460, 'y1': 255, 'x2': 560, 'y2': 255},
    ],
)

# --- 08-request-reply ---
g.emit("08-request-reply", 880, 280,
    bands=[
        {'x': 20, 'y': 20, 'w': 840, 'h': 240, 'label': 'Request-Reply with Correlation'},
    ],
    nodes=[
        {'x': 50, 'y': 70, 'w': 140, 'h': 50, 'style': 'pattern', 'icon': 'request-reply', 'lines': ['order-service', 'requestor']},
        {'x': 300, 'y': 70, 'w': 180, 'h': 50, 'style': 'channel', 'lines': ['Request Channel', 'eip.inventory.check']},
        {'x': 600, 'y': 70, 'w': 140, 'h': 50, 'style': 'pattern', 'icon': 'service-activator', 'lines': ['inventory-svc', 'responder']},
        {'x': 50, 'y': 180, 'w': 140, 'h': 50, 'style': 'pattern', 'icon': 'correlation-identifier', 'lines': ['order-service', 'correlate reply']},
        {'x': 300, 'y': 180, 'w': 180, 'h': 50, 'style': 'channel', 'lines': ['Reply Channel', 'eip.inventory.result']},
        {'x': 600, 'y': 180, 'w': 140, 'h': 50, 'style': 'pattern', 'icon': 'return-address', 'lines': ['inventory-svc', 'send result']},
    ],
    edges=[


        {'x1': 190, 'y1': 95, 'x2': 300, 'y2': 95, 'amber': True, 'label': 'correlationId=abc'},
        {'x1': 480, 'y1': 95, 'x2': 600, 'y2': 95},
        {'x1': 600, 'y1': 195, 'x2': 480, 'y2': 195},
        {'x1': 300, 'y1': 205, 'x2': 190, 'y2': 205, 'amber': True, 'label': 'correlationId=abc'},
    ],
    notes=[
        {'x': 440, 'y': 145, 'text': 'Same correlationId links request to reply', 'anchor': 'middle'},
    ],
)

# --- 09-routing-patterns ---
g.emit("09-routing-patterns", 900, 360,
    bands=[
        {'x': 20, 'y': 20, 'w': 860, 'h': 320, 'label': 'Message Routing Patterns'},
    ],
    nodes=[
        {'x': 50, 'y': 70, 'w': 140, 'h': 50, 'style': 'accent', 'lines': ['Incoming', 'Order Message']},
        {'x': 240, 'y': 70, 'w': 140, 'h': 50, 'style': 'pattern', 'icon': 'content-based-router', 'lines': ['Content-Based', 'Router (choice)']},
        {'x': 440, 'y': 50, 'w': 130, 'h': 40, 'style': 'info', 'lines': ['Domestic']},
        {'x': 440, 'y': 100, 'w': 130, 'h': 40, 'style': 'info', 'lines': ['International']},
        {'x': 50, 'y': 180, 'w': 140, 'h': 50, 'style': 'accent', 'lines': ['Batch Order', '[3 items]']},
        {'x': 240, 'y': 180, 'w': 140, 'h': 50, 'style': 'pattern', 'icon': 'splitter', 'lines': ['Splitter', 'split(body)']},
        {'x': 440, 'y': 160, 'w': 100, 'h': 35, 'lines': ['Item 1']},
        {'x': 440, 'y': 200, 'w': 100, 'h': 35, 'lines': ['Item 2']},
        {'x': 440, 'y': 240, 'w': 100, 'h': 35, 'lines': ['Item 3']},
        {'x': 50, 'y': 290, 'w': 140, 'h': 40, 'style': 'accent', 'lines': ['Notification']},
        {'x': 240, 'y': 290, 'w': 140, 'h': 40, 'style': 'pattern', 'icon': 'recipient-list', 'lines': ['Recipient List', 'recipientList()']},
        {'x': 440, 'y': 280, 'w': 100, 'h': 35, 'lines': ['Email']},
        {'x': 560, 'y': 280, 'w': 100, 'h': 35, 'lines': ['SMS']},
        {'x': 680, 'y': 280, 'w': 100, 'h': 35, 'lines': ['Webhook']},
    ],
    edges=[


        {'x1': 190, 'y1': 95, 'x2': 240, 'y2': 95, 'amber': True},
        {'x1': 380, 'y1': 85, 'x2': 440, 'y2': 70},
        {'x1': 380, 'y1': 95, 'x2': 440, 'y2': 120},
        {'x1': 190, 'y1': 205, 'x2': 240, 'y2': 205, 'amber': True},
        {'x1': 380, 'y1': 195, 'x2': 440, 'y2': 178},
        {'x1': 380, 'y1': 205, 'x2': 440, 'y2': 218},
        {'x1': 380, 'y1': 215, 'x2': 440, 'y2': 258},
        {'x1': 190, 'y1': 310, 'x2': 240, 'y2': 310, 'amber': True},
        {'x1': 380, 'y1': 305, 'x2': 440, 'y2': 298},
        {'x1': 380, 'y1': 310, 'x2': 560, 'y2': 298},
        {'x1': 380, 'y1': 315, 'x2': 680, 'y2': 298},
    ],
    notes=[
        {'x': 620, 'y': 70, 'text': 'routes by content'},
        {'x': 570, 'y': 215, 'text': 'splits into parts'},
        {'x': 800, 'y': 310, 'text': 'fans out to list'},
    ],
)

# --- 10-scatter-gather ---
g.emit("10-scatter-gather", 880, 300,
    bands=[
        {'x': 20, 'y': 20, 'w': 840, 'h': 260, 'label': 'Scatter-Gather Pattern'},
    ],
    nodes=[
        {'x': 50, 'y': 110, 'w': 120, 'h': 50, 'style': 'accent', 'lines': ['Request', 'quote me']},
        {'x': 220, 'y': 110, 'w': 140, 'h': 50, 'style': 'pattern', 'icon': 'recipient-list', 'lines': ['Recipient List', 'scatter']},
        {'x': 420, 'y': 50, 'w': 120, 'h': 40, 'lines': ['Carrier A']},
        {'x': 420, 'y': 110, 'w': 120, 'h': 40, 'lines': ['Carrier B']},
        {'x': 420, 'y': 170, 'w': 120, 'h': 40, 'lines': ['Carrier C']},
        {'x': 600, 'y': 100, 'w': 130, 'h': 60, 'style': 'pattern', 'icon': 'aggregator', 'lines': ['Aggregator', 'gather + pick', 'best quote']},
        {'x': 780, 'y': 110, 'w': 80, 'h': 50, 'style': 'info', 'lines': ['Result', '$12.99']},
    ],
    edges=[


        {'x1': 170, 'y1': 135, 'x2': 220, 'y2': 135, 'amber': True},
        {'x1': 360, 'y1': 125, 'x2': 420, 'y2': 70},
        {'x1': 360, 'y1': 135, 'x2': 420, 'y2': 130, 'amber': True, 'label': 'scatter'},
        {'x1': 360, 'y1': 145, 'x2': 420, 'y2': 190},
        {'x1': 540, 'y1': 70, 'x2': 600, 'y2': 120},
        {'x1': 540, 'y1': 130, 'x2': 600, 'y2': 130, 'label': 'gather'},
        {'x1': 540, 'y1': 190, 'x2': 600, 'y2': 140},
        {'x1': 730, 'y1': 130, 'x2': 780, 'y2': 135, 'amber': True},
    ],
    notes=[
        {'x': 440, 'y': 240, 'text': 'Fan out, collect replies, pick the winner', 'anchor': 'middle'},
    ],
)

# --- 11-wire-tap ---
g.emit("11-wire-tap", 880, 260,
    bands=[
        {'x': 20, 'y': 20, 'w': 840, 'h': 220, 'label': 'Wire Tap Pattern'},
    ],
    nodes=[
        {'x': 50, 'y': 70, 'w': 140, 'h': 50, 'style': 'accent', 'lines': ['Incoming', 'Order']},
        {'x': 280, 'y': 70, 'w': 160, 'h': 50, 'style': 'pattern', 'icon': 'wire-tap', 'lines': ['Wire Tap', 'copies message']},
        {'x': 540, 'y': 70, 'w': 140, 'h': 50, 'lines': ['Main Flow', 'process order']},
        {'x': 740, 'y': 70, 'w': 100, 'h': 50, 'style': 'info', 'lines': ['Continue', 'processing']},
        {'x': 280, 'y': 170, 'w': 160, 'h': 50, 'style': 'muted', 'lines': ['Monitoring', 'audit log / metrics']},
    ],
    edges=[


        {'x1': 190, 'y1': 95, 'x2': 280, 'y2': 95, 'amber': True},
        {'x1': 440, 'y1': 95, 'x2': 540, 'y2': 95, 'amber': True, 'label': 'original'},
        {'x1': 680, 'y1': 95, 'x2': 740, 'y2': 95},
        {'x1': 360, 'y1': 120, 'x2': 360, 'y2': 170, 'label': 'copy'},
    ],
    notes=[
        {'x': 360, 'y': 235, 'text': 'Copy sent to secondary channel without affecting main flow', 'anchor': 'middle'},
    ],
)

# --- 12-transformation-flow ---
g.emit("12-transformation-flow", 880, 260,
    bands=[
        {'x': 20, 'y': 20, 'w': 840, 'h': 220, 'label': 'Transformation Pipeline'},
    ],
    nodes=[
        {'x': 50, 'y': 70, 'w': 130, 'h': 50, 'style': 'accent', 'lines': ['Raw Order', 'external format']},
        {'x': 230, 'y': 70, 'w': 130, 'h': 50, 'style': 'pattern', 'icon': 'message-translator', 'lines': ['Translator', 'normalize']},
        {'x': 410, 'y': 70, 'w': 130, 'h': 50, 'style': 'pattern', 'icon': 'content-enricher', 'lines': ['Enricher', 'add address']},
        {'x': 590, 'y': 70, 'w': 130, 'h': 50, 'style': 'pattern', 'icon': 'content-filter', 'lines': ['Filter', 'remove PII']},
        {'x': 750, 'y': 70, 'w': 100, 'h': 50, 'style': 'info', 'lines': ['Canonical', 'Order']},
        {'x': 410, 'y': 170, 'w': 130, 'h': 50, 'style': 'muted', 'lines': ['Address DB', 'external lookup']},
    ],
    edges=[


        {'x1': 180, 'y1': 95, 'x2': 230, 'y2': 95, 'amber': True},
        {'x1': 360, 'y1': 95, 'x2': 410, 'y2': 95},
        {'x1': 540, 'y1': 95, 'x2': 590, 'y2': 95},
        {'x1': 720, 'y1': 95, 'x2': 750, 'y2': 95, 'amber': True},
        {'x1': 475, 'y1': 120, 'x2': 475, 'y2': 170, 'label': 'lookup'},
    ],
    notes=[
        {'x': 450, 'y': 50, 'text': 'Pipes and Filters — each step transforms the message', 'anchor': 'middle'},
    ],
)

# --- 13-aggregator ---
g.emit("13-aggregator", 880, 280,
    bands=[
        {'x': 20, 'y': 20, 'w': 840, 'h': 240, 'label': 'Aggregator Pattern'},
    ],
    nodes=[
        {'x': 50, 'y': 80, 'w': 120, 'h': 40, 'lines': ['Msg A (id=1)']},
        {'x': 50, 'y': 130, 'w': 120, 'h': 40, 'lines': ['Msg B (id=1)']},
        {'x': 50, 'y': 180, 'w': 120, 'h': 40, 'lines': ['Msg C (id=1)']},
        {'x': 250, 'y': 100, 'w': 180, 'h': 80, 'style': 'pattern', 'icon': 'aggregator', 'lines': ['Aggregator', 'correlate by id', 'completionSize=3']},
        {'x': 510, 'y': 120, 'w': 160, 'h': 50, 'style': 'accent', 'lines': ['Combined', 'Result']},
        {'x': 740, 'y': 120, 'w': 100, 'h': 50, 'style': 'info', 'lines': ['Next', 'Processor']},
    ],
    edges=[


        {'x1': 170, 'y1': 100, 'x2': 250, 'y2': 130},
        {'x1': 170, 'y1': 150, 'x2': 250, 'y2': 140, 'amber': True},
        {'x1': 170, 'y1': 200, 'x2': 250, 'y2': 160},
        {'x1': 430, 'y1': 140, 'x2': 510, 'y2': 145, 'amber': True, 'label': 'aggregate'},
        {'x1': 670, 'y1': 145, 'x2': 740, 'y2': 145},
    ],
    notes=[
        {'x': 350, 'y': 210, 'text': 'Waits for all correlated messages before emitting', 'anchor': 'middle'},
    ],
)

# --- 14-consumer-patterns ---
g.emit("14-consumer-patterns", 880, 300,
    bands=[
        {'x': 20, 'y': 20, 'w': 410, 'h': 260, 'label': 'Competing Consumers'},
        {'x': 460, 'y': 20, 'w': 400, 'h': 260, 'label': 'Event-Driven Consumer'},
    ],
    nodes=[
        {'x': 50, 'y': 80, 'w': 140, 'h': 50, 'style': 'channel', 'lines': ['Kafka Topic', '3 partitions']},
        {'x': 240, 'y': 60, 'w': 140, 'h': 40, 'style': 'info', 'lines': ['Instance 1', 'P0, P1']},
        {'x': 240, 'y': 110, 'w': 140, 'h': 40, 'style': 'info', 'lines': ['Instance 2', 'P2']},
        {'x': 240, 'y': 170, 'w': 140, 'h': 40, 'style': 'muted', 'lines': ['Instance 3', '(standby)']},
        {'x': 500, 'y': 80, 'w': 140, 'h': 50, 'style': 'channel', 'lines': ['Kafka Topic', 'event stream']},
        {'x': 700, 'y': 80, 'w': 130, 'h': 50, 'style': 'pattern', 'icon': 'event-driven-consumer', 'lines': ['Consumer', 'callback on msg']},
    ],
    edges=[


        {'x1': 190, 'y1': 95, 'x2': 240, 'y2': 80, 'amber': True},
        {'x1': 190, 'y1': 110, 'x2': 240, 'y2': 130},
        {'x1': 640, 'y1': 105, 'x2': 700, 'y2': 105, 'amber': True, 'label': 'push'},
    ],
    notes=[
        {'x': 220, 'y': 240, 'text': 'Scale by adding instances', 'anchor': 'middle'},
        {'x': 700, 'y': 170, 'text': 'Consumer reacts when message arrives', 'anchor': 'middle'},
    ],
)

# --- 15-outbox-pattern ---
g.emit("15-outbox-pattern", 880, 300,
    bands=[
        {'x': 20, 'y': 20, 'w': 840, 'h': 260, 'label': 'Outbox Pattern — Transactional Client'},
    ],
    nodes=[
        {'x': 50, 'y': 80, 'w': 130, 'h': 50, 'style': 'accent', 'lines': ['Application', 'business logic']},
        {'x': 240, 'y': 60, 'w': 150, 'h': 40, 'lines': ['orders table', 'INSERT order']},
        {'x': 240, 'y': 120, 'w': 150, 'h': 40, 'lines': ['outbox table', 'INSERT event']},
        {'x': 160, 'y': 170, 'w': 100, 'h': 30, 'style': 'pattern', 'icon': 'transactional-client', 'lines': ['TX COMMIT']},
        {'x': 480, 'y': 100, 'w': 140, 'h': 50, 'style': 'info', 'lines': ['CDC / Poller', 'reads outbox']},
        {'x': 680, 'y': 100, 'w': 140, 'h': 50, 'style': 'accent', 'lines': ['Kafka', 'event published']},
    ],
    edges=[


        {'x1': 180, 'y1': 95, 'x2': 240, 'y2': 80, 'amber': True},
        {'x1': 180, 'y1': 110, 'x2': 240, 'y2': 140, 'amber': True, 'label': 'same TX'},
        {'x1': 390, 'y1': 140, 'x2': 480, 'y2': 125, 'label': 'poll/CDC'},
        {'x1': 620, 'y1': 125, 'x2': 680, 'y2': 125, 'amber': True, 'label': 'publish'},
    ],
    notes=[
        {'x': 300, 'y': 220, 'text': 'Both writes in one DB transaction — atomic', 'anchor': 'middle'},
        {'x': 620, 'y': 180, 'text': 'Eventually consistent with Kafka', 'anchor': 'middle'},
    ],
)

# --- 16-messaging-gateway ---
g.emit("16-messaging-gateway", 880, 260,
    bands=[
        {'x': 20, 'y': 20, 'w': 840, 'h': 220, 'label': 'Messaging Gateway Pattern'},
    ],
    nodes=[
        {'x': 50, 'y': 80, 'w': 130, 'h': 50, 'style': 'accent', 'lines': ['Application', 'REST / gRPC']},
        {'x': 240, 'y': 80, 'w': 160, 'h': 60, 'style': 'pattern', 'icon': 'messaging-gateway', 'lines': ['Messaging Gateway', 'hides messaging', 'from application']},
        {'x': 470, 'y': 60, 'w': 140, 'h': 40, 'lines': ['Kafka Producer', 'eip.orders.*']},
        {'x': 470, 'y': 120, 'w': 140, 'h': 40, 'lines': ['Kafka Consumer', 'eip.inventory.*']},
        {'x': 680, 'y': 80, 'w': 140, 'h': 50, 'style': 'info', 'lines': ['Messaging', 'System']},
    ],
    edges=[


        {'x1': 180, 'y1': 105, 'x2': 240, 'y2': 110, 'amber': True, 'label': 'method call'},
        {'x1': 400, 'y1': 100, 'x2': 470, 'y2': 80},
        {'x1': 400, 'y1': 115, 'x2': 470, 'y2': 140},
        {'x1': 610, 'y1': 80, 'x2': 680, 'y2': 95, 'amber': True},
        {'x1': 610, 'y1': 140, 'x2': 680, 'y2': 115, 'amber': True},
    ],
    notes=[
        {'x': 320, 'y': 175, 'text': 'Application code never touches Kafka directly', 'anchor': 'middle'},
    ],
)

# --- 17-control-bus ---
g.emit("17-control-bus", 880, 260,
    bands=[
        {'x': 20, 'y': 20, 'w': 840, 'h': 220, 'label': 'Control Bus — Observability'},
    ],
    nodes=[
        {'x': 50, 'y': 70, 'w': 120, 'h': 50, 'style': 'accent', 'lines': ['Operator', 'control panel']},
        {'x': 240, 'y': 70, 'w': 160, 'h': 50, 'style': 'pattern', 'icon': 'control-bus', 'lines': ['Control Bus', 'controlbus:route']},
        {'x': 500, 'y': 50, 'w': 140, 'h': 40, 'lines': ['Route: order-flow', 'status: started']},
        {'x': 500, 'y': 100, 'w': 140, 'h': 40, 'style': 'muted', 'lines': ['Route: debug-tap', 'status: stopped']},
        {'x': 500, 'y': 150, 'w': 140, 'h': 40, 'lines': ['Route: dlq-handler', 'status: started']},
        {'x': 720, 'y': 70, 'w': 120, 'h': 50, 'style': 'info', 'lines': ['Metrics', 'OTel + Grafana']},
    ],
    edges=[


        {'x1': 170, 'y1': 95, 'x2': 240, 'y2': 95, 'amber': True, 'label': 'start/stop'},
        {'x1': 400, 'y1': 85, 'x2': 500, 'y2': 70},
        {'x1': 400, 'y1': 95, 'x2': 500, 'y2': 120, 'label': 'manage'},
        {'x1': 400, 'y1': 105, 'x2': 500, 'y2': 170},
        {'x1': 640, 'y1': 90, 'x2': 720, 'y2': 90, 'label': 'export'},
    ],
    notes=[
        {'x': 440, 'y': 215, 'text': 'Start, stop, and query routes at runtime without redeployment', 'anchor': 'middle'},
    ],
)

# --- 18-testing-patterns ---
g.emit("18-testing-patterns", 880, 280,
    bands=[
        {'x': 20, 'y': 20, 'w': 410, 'h': 240, 'label': 'Test Message'},
        {'x': 460, 'y': 20, 'w': 400, 'h': 240, 'label': 'Detour Pattern'},
    ],
    nodes=[
        {'x': 50, 'y': 80, 'w': 120, 'h': 50, 'style': 'pattern', 'icon': 'test-message', 'lines': ['Test Injector', 'synthetic msg']},
        {'x': 220, 'y': 80, 'w': 130, 'h': 50, 'lines': ['Normal Route', 'process msg']},
        {'x': 220, 'y': 180, 'w': 130, 'h': 50, 'style': 'info', 'lines': ['Verifier', 'check result']},
        {'x': 500, 'y': 80, 'w': 120, 'h': 50, 'style': 'accent', 'lines': ['Message', 'incoming']},
        {'x': 660, 'y': 60, 'w': 130, 'h': 40, 'lines': ['Main Flow', 'always runs']},
        {'x': 660, 'y': 120, 'w': 130, 'h': 40, 'style': 'pattern', 'icon': 'detour', 'lines': ['Debug Step', 'toggled on/off']},
        {'x': 660, 'y': 180, 'w': 130, 'h': 40, 'lines': ['Continue', 'processing']},
    ],
    edges=[


        {'x1': 170, 'y1': 105, 'x2': 220, 'y2': 105, 'amber': True, 'label': 'inject'},
        {'x1': 285, 'y1': 130, 'x2': 285, 'y2': 180, 'label': 'verify'},
        {'x1': 620, 'y1': 105, 'x2': 660, 'y2': 80, 'amber': True},
        {'x1': 620, 'y1': 105, 'x2': 660, 'y2': 140, 'label': 'if enabled'},
        {'x1': 790, 'y1': 80, 'x2': 790, 'y2': 180},
        {'x1': 790, 'y1': 160, 'x2': 790, 'y2': 180},
    ],
    notes=[
        {'x': 220, 'y': 245, 'text': 'Verify system health', 'anchor': 'middle'},
        {'x': 700, 'y': 225, 'text': 'Toggle via config/feature flag', 'anchor': 'middle'},
    ],
)

# --- 20-kafka-architecture ---
g.emit("20-kafka-architecture", 900, 320,
    bands=[
        {'x': 20, 'y': 20, 'w': 860, 'h': 280, 'label': 'Kafka Cluster (KRaft)'},
    ],
    nodes=[
        {'x': 50, 'y': 70, 'w': 120, 'h': 50, 'style': 'accent', 'lines': ['Producer', 'acks=all']},
        {'x': 50, 'y': 180, 'w': 120, 'h': 50, 'style': 'info', 'lines': ['Consumer', 'group.id=svc']},
        {'x': 240, 'y': 60, 'w': 130, 'h': 40, 'lines': ['Broker 1', 'controller']},
        {'x': 240, 'y': 110, 'w': 130, 'h': 40, 'lines': ['Broker 2', 'follower']},
        {'x': 240, 'y': 160, 'w': 130, 'h': 40, 'lines': ['Broker 3', 'follower']},
        {'x': 440, 'y': 55, 'w': 90, 'h': 35, 'style': 'ink', 'lines': ['P0']},
        {'x': 540, 'y': 55, 'w': 90, 'h': 35, 'style': 'ink', 'lines': ['P1']},
        {'x': 640, 'y': 55, 'w': 90, 'h': 35, 'style': 'ink', 'lines': ['P2']},
        {'x': 440, 'y': 100, 'w': 90, 'h': 35, 'style': 'muted', 'lines': ['P0 replica']},
        {'x': 540, 'y': 100, 'w': 90, 'h': 35, 'style': 'muted', 'lines': ['P1 replica']},
        {'x': 640, 'y': 100, 'w': 90, 'h': 35, 'style': 'muted', 'lines': ['P2 replica']},
        {'x': 440, 'y': 150, 'w': 90, 'h': 35, 'style': 'muted', 'lines': ['P0 replica']},
        {'x': 540, 'y': 150, 'w': 90, 'h': 35, 'style': 'muted', 'lines': ['P1 replica']},
        {'x': 640, 'y': 150, 'w': 90, 'h': 35, 'style': 'muted', 'lines': ['P2 replica']},
        {'x': 780, 'y': 60, 'w': 80, 'h': 40, 'style': 'info', 'lines': ['C1', 'P0, P1']},
        {'x': 780, 'y': 120, 'w': 80, 'h': 40, 'style': 'info', 'lines': ['C2', 'P2']},
        {'x': 780, 'y': 190, 'w': 80, 'h': 40, 'style': 'muted', 'lines': ['C3', 'standby']},
    ],
    edges=[


        {'x1': 170, 'y1': 95, 'x2': 240, 'y2': 80, 'amber': True, 'label': 'write'},
        {'x1': 170, 'y1': 205, 'x2': 240, 'y2': 180, 'label': 'read'},
        {'x1': 730, 'y1': 73, 'x2': 780, 'y2': 80},
        {'x1': 730, 'y1': 73, 'x2': 780, 'y2': 140, 'label': 'assign'},
    ],
    notes=[
        {'x': 560, 'y': 210, 'text': '3 partitions × 3 replicas = 9 segment copies', 'anchor': 'middle'},
        {'x': 560, 'y': 240, 'text': 'min.insync.replicas=2 for durability', 'anchor': 'middle'},
    ],
)

# --- 21-pulsar-architecture ---
g.emit("21-pulsar-architecture", 900, 320,
    bands=[
        {'x': 20, 'y': 20, 'w': 860, 'h': 280, 'label': 'Pulsar Cluster'},
    ],
    nodes=[
        {'x': 50, 'y': 80, 'w': 120, 'h': 50, 'style': 'accent', 'lines': ['Producer', 'tenant/ns/topic']},
        {'x': 50, 'y': 190, 'w': 120, 'h': 50, 'style': 'info', 'lines': ['Consumer', 'subscription']},
        {'x': 240, 'y': 60, 'w': 130, 'h': 50, 'lines': ['Broker 1', 'stateless']},
        {'x': 240, 'y': 130, 'w': 130, 'h': 50, 'lines': ['Broker 2', 'stateless']},
        {'x': 450, 'y': 60, 'w': 140, 'h': 50, 'style': 'ink', 'lines': ['BookKeeper', 'bookie 1']},
        {'x': 450, 'y': 130, 'w': 140, 'h': 50, 'style': 'ink', 'lines': ['BookKeeper', 'bookie 2']},
        {'x': 450, 'y': 200, 'w': 140, 'h': 50, 'style': 'ink', 'lines': ['BookKeeper', 'bookie 3']},
        {'x': 680, 'y': 90, 'w': 160, 'h': 60, 'style': 'muted', 'lines': ['Tenant: eip', 'ns: shipping', 'topic: orders.placed']},
    ],
    edges=[


        {'x1': 170, 'y1': 105, 'x2': 240, 'y2': 85, 'amber': True, 'label': 'publish'},
        {'x1': 170, 'y1': 215, 'x2': 240, 'y2': 155, 'label': 'subscribe'},
        {'x1': 370, 'y1': 85, 'x2': 450, 'y2': 85, 'label': 'store'},
        {'x1': 370, 'y1': 155, 'x2': 450, 'y2': 155, 'label': 'store'},
        {'x1': 590, 'y1': 85, 'x2': 680, 'y2': 110, 'amber': True},
        {'x1': 590, 'y1': 155, 'x2': 680, 'y2': 130},
    ],
    notes=[
        {'x': 560, 'y': 270, 'text': 'Stateless brokers + BookKeeper storage = independent scaling', 'anchor': 'middle'},
    ],
)

# --- 23-promotion-workflow ---
g.emit("23-promotion-workflow", 900, 260,
    bands=[
        {'x': 20, 'y': 20, 'w': 860, 'h': 220, 'label': 'JBang → Quarkus Promotion Workflow'},
    ],
    nodes=[
        {'x': 40, 'y': 80, 'w': 140, 'h': 60, 'style': 'accent', 'lines': ['JBang / camel run', 'camel run --dev', 'fast prototype']},
        {'x': 240, 'y': 80, 'w': 140, 'h': 60, 'style': 'ink', 'lines': ['camel export', '--runtime=quarkus', 'generate project']},
        {'x': 440, 'y': 80, 'w': 150, 'h': 60, 'lines': ['Quarkus Project', 'mvn quarkus:dev', 'full IDE support']},
        {'x': 650, 'y': 80, 'w': 150, 'h': 60, 'style': 'info', 'lines': ['Native Binary', '~20ms startup', '~50MB memory']},
    ],
    edges=[


        {'x1': 180, 'y1': 110, 'x2': 240, 'y2': 110, 'amber': True, 'label': 'promote'},
        {'x1': 380, 'y1': 110, 'x2': 440, 'y2': 110, 'amber': True, 'label': 'develop'},
        {'x1': 590, 'y1': 110, 'x2': 650, 'y2': 110, 'amber': True, 'label': 'build native'},
    ],
    notes=[
        {'x': 450, 'y': 180, 'text': 'Prototype fast → promote to production-grade → deploy native', 'anchor': 'middle'},
    ],
)

# --- 26-feature-flags ---
g.emit("26-feature-flags", 880, 260,
    bands=[
        {'x': 20, 'y': 20, 'w': 840, 'h': 220, 'label': 'Feature Flags — flagd + OpenFeature'},
    ],
    nodes=[
        {'x': 50, 'y': 80, 'w': 150, 'h': 60, 'style': 'accent', 'lines': ['Camel Route', 'evaluates flag', 'via OpenFeature']},
        {'x': 300, 'y': 80, 'w': 130, 'h': 60, 'style': 'pattern', 'icon': 'detour', 'lines': ['flagd', 'evaluation', 'daemon :8013']},
        {'x': 520, 'y': 80, 'w': 140, 'h': 60, 'lines': ['flags.json', 'flag definitions', 'ConfigMap']},
        {'x': 730, 'y': 60, 'w': 120, 'h': 40, 'style': 'info', 'lines': ['Flag: ON', 'route to enricher']},
        {'x': 730, 'y': 120, 'w': 120, 'h': 40, 'style': 'muted', 'lines': ['Flag: OFF', 'skip enrichment']},
    ],
    edges=[


        {'x1': 200, 'y1': 110, 'x2': 300, 'y2': 110, 'amber': True, 'label': 'gRPC'},
        {'x1': 430, 'y1': 110, 'x2': 520, 'y2': 110, 'label': 'watch'},
        {'x1': 200, 'y1': 90, 'x2': 730, 'y2': 80},
        {'x1': 200, 'y1': 130, 'x2': 730, 'y2': 140},
    ],
    notes=[
        {'x': 440, 'y': 180, 'text': 'Dynamic flag evaluation — no redeployment needed', 'anchor': 'middle'},
    ],
)

# --- 28-loan-broker ---
g.emit("28-loan-broker", 900, 340,
    bands=[
        {'x': 20, 'y': 20, 'w': 860, 'h': 300, 'label': 'Loan Broker — Scatter-Gather'},
    ],
    nodes=[
        {'x': 40, 'y': 80, 'w': 110, 'h': 50, 'style': 'accent', 'lines': ['Customer', 'loan request']},
        {'x': 190, 'y': 80, 'w': 110, 'h': 50, 'style': 'pattern', 'icon': 'messaging-gateway', 'lines': ['Gateway', 'REST → Kafka']},
        {'x': 340, 'y': 80, 'w': 120, 'h': 50, 'style': 'pattern', 'icon': 'content-enricher', 'lines': ['Enricher', 'credit bureau']},
        {'x': 500, 'y': 80, 'w': 130, 'h': 50, 'style': 'pattern', 'icon': 'recipient-list', 'lines': ['Recipient List', 'select banks']},
        {'x': 680, 'y': 50, 'w': 100, 'h': 40, 'lines': ['Bank A']},
        {'x': 680, 'y': 100, 'w': 100, 'h': 40, 'lines': ['Bank B']},
        {'x': 680, 'y': 150, 'w': 100, 'h': 40, 'lines': ['Bank C']},
        {'x': 680, 'y': 200, 'w': 100, 'h': 40, 'lines': ['Bank D']},
        {'x': 500, 'y': 250, 'w': 130, 'h': 50, 'style': 'pattern', 'icon': 'aggregator', 'lines': ['Aggregator', 'best offer']},
        {'x': 340, 'y': 250, 'w': 120, 'h': 50, 'style': 'accent', 'lines': ['Best Rate', 'result']},
    ],
    edges=[


        {'x1': 150, 'y1': 105, 'x2': 190, 'y2': 105, 'amber': True},
        {'x1': 300, 'y1': 105, 'x2': 340, 'y2': 105},
        {'x1': 460, 'y1': 105, 'x2': 500, 'y2': 105},
        {'x1': 630, 'y1': 95, 'x2': 680, 'y2': 70},
        {'x1': 630, 'y1': 100, 'x2': 680, 'y2': 120},
        {'x1': 630, 'y1': 105, 'x2': 680, 'y2': 170, 'amber': True, 'label': 'scatter'},
        {'x1': 630, 'y1': 110, 'x2': 680, 'y2': 220},
        {'x1': 780, 'y1': 70, 'x2': 780, 'y2': 250},
        {'x1': 780, 'y1': 250, 'x2': 630, 'y2': 275, 'label': 'gather'},
        {'x1': 500, 'y1': 275, 'x2': 460, 'y2': 275, 'amber': True},
    ],
    notes=[
        {'x': 180, 'y': 290, 'text': 'Customer gets best rate from all qualifying banks'},
    ],
)

# --- 29-bond-trading ---
g.emit("29-bond-trading", 900, 340,
    bands=[
        {'x': 20, 'y': 20, 'w': 860, 'h': 300, 'label': 'Bond Trading — Market Data Distribution'},
    ],
    nodes=[
        {'x': 40, 'y': 60, 'w': 110, 'h': 45, 'lines': ['Bloomberg', 'feed']},
        {'x': 40, 'y': 115, 'w': 110, 'h': 45, 'lines': ['Reuters', 'feed']},
        {'x': 40, 'y': 170, 'w': 110, 'h': 45, 'lines': ['Exchange', 'feed']},
        {'x': 200, 'y': 100, 'w': 140, 'h': 60, 'style': 'pattern', 'icon': 'normalizer', 'lines': ['Channel Adapters', '+ Normalizer', 'canonical format']},
        {'x': 400, 'y': 110, 'w': 140, 'h': 50, 'style': 'pattern', 'icon': 'aggregator', 'lines': ['Best Price', 'Aggregator']},
        {'x': 600, 'y': 60, 'w': 120, 'h': 40, 'style': 'info', 'lines': ['Desk A', 'govt bonds']},
        {'x': 600, 'y': 110, 'w': 120, 'h': 40, 'style': 'info', 'lines': ['Desk B', 'corporate']},
        {'x': 600, 'y': 160, 'w': 120, 'h': 40, 'style': 'info', 'lines': ['Desk C', 'short-term']},
        {'x': 600, 'y': 240, 'w': 120, 'h': 50, 'style': 'ink', 'lines': ['Trade Engine', 'validate + exec']},
        {'x': 780, 'y': 240, 'w': 80, 'h': 50, 'style': 'pattern', 'icon': 'wire-tap', 'lines': ['Audit', 'Wire Tap']},
    ],
    edges=[


        {'x1': 150, 'y1': 83, 'x2': 200, 'y2': 120},
        {'x1': 150, 'y1': 138, 'x2': 200, 'y2': 130, 'amber': True},
        {'x1': 150, 'y1': 193, 'x2': 200, 'y2': 145},
        {'x1': 340, 'y1': 130, 'x2': 400, 'y2': 135},
        {'x1': 540, 'y1': 125, 'x2': 600, 'y2': 80},
        {'x1': 540, 'y1': 135, 'x2': 600, 'y2': 130, 'amber': True, 'label': 'filter'},
        {'x1': 540, 'y1': 145, 'x2': 600, 'y2': 180},
        {'x1': 660, 'y1': 160, 'x2': 660, 'y2': 240, 'label': 'order'},
        {'x1': 720, 'y1': 265, 'x2': 780, 'y2': 265, 'label': 'copy'},
    ],
    notes=[
        {'x': 450, 'y': 290, 'text': 'Multiple feeds → normalize → filter → trade → audit', 'anchor': 'middle'},
    ],
)

print(f"Done — 26 chapter diagram pairs generated in {g.OUT}")
