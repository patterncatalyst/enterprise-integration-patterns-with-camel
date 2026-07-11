-- Domain schemas for the EIP shipping example.
-- Matches the canonical object names from datamesh-reference-arch-python.

-- ── orders ────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS orders;

CREATE TABLE orders.orders (
    id          SERIAL PRIMARY KEY,
    customer_id VARCHAR(64)    NOT NULL,
    item_sku    VARCHAR(64)    NOT NULL,
    quantity    INTEGER        NOT NULL,
    amount      DECIMAL(12,2)  NOT NULL,
    status      VARCHAR(20)    NOT NULL DEFAULT 'PLACED',
    created_at  TIMESTAMP      NOT NULL DEFAULT NOW()
);

-- ── inventory ─────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE inventory.stock (
    sku              VARCHAR(64)  PRIMARY KEY,
    quantity_on_hand INTEGER      NOT NULL DEFAULT 0
);

INSERT INTO inventory.stock (sku, quantity_on_hand) VALUES
    ('SKU-ABC-42', 100),
    ('SKU-DEF-77', 50),
    ('SKU-GHI-13', 200);

-- ── payments ──────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS payments;

CREATE TABLE payments.payments (
    id         SERIAL PRIMARY KEY,
    order_id   INTEGER        NOT NULL,
    amount     DECIMAL(12,2)  NOT NULL,
    status     VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP      NOT NULL DEFAULT NOW()
);

-- ── shipping ──────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS shipping;

CREATE TABLE shipping.shipments (
    id              SERIAL PRIMARY KEY,
    order_id        INTEGER      NOT NULL,
    carrier         VARCHAR(64),
    tracking_number VARCHAR(128),
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── notifications ─────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS notifications;

CREATE TABLE notifications.notifications (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER      NOT NULL UNIQUE,
    event_type  VARCHAR(64)  NOT NULL,
    customer_id VARCHAR(64),
    item_sku    VARCHAR(64),
    quantity    INTEGER,
    amount      DECIMAL(12,2),
    status      VARCHAR(20),
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── outbox (transactional outbox for Ch 15) ──────────────────────────────
CREATE TABLE payments.outbox (
    event_id     VARCHAR(64)  PRIMARY KEY,
    event_type   VARCHAR(64)  NOT NULL,
    aggregate_id VARCHAR(64)  NOT NULL,
    payload      TEXT         NOT NULL,
    published    BOOLEAN      NOT NULL DEFAULT false,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_unpublished ON payments.outbox (created_at)
    WHERE published = false;

-- ── system (message store for Ch 17) ─────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS system;

CREATE TABLE system.message_store (
    message_id  VARCHAR(255) NOT NULL,
    route_id    VARCHAR(255) NOT NULL,
    timestamp   TIMESTAMP    NOT NULL DEFAULT NOW(),
    payload     TEXT         NOT NULL,
    PRIMARY KEY (message_id, route_id)
);

-- ── Camel JDBC aggregation repository (Ch 13) ────────────────────────────
CREATE TABLE camel_aggregation (
    id       VARCHAR(255) NOT NULL PRIMARY KEY,
    exchange BYTEA        NOT NULL,
    version  BIGINT       NOT NULL
);

CREATE TABLE camel_aggregation_completed (
    id       VARCHAR(255) NOT NULL PRIMARY KEY,
    exchange BYTEA        NOT NULL,
    version  BIGINT       NOT NULL
);

-- ── Camel JDBC idempotent repository (Ch 15) ─────────────────────────────
CREATE TABLE camel_messageprocessed (
    processorName VARCHAR(255) NOT NULL,
    messageId     VARCHAR(100) NOT NULL,
    createdAt     TIMESTAMP,
    PRIMARY KEY (processorName, messageId)
);
