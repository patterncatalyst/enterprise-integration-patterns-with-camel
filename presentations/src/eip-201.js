#!/usr/bin/env node
// eip-201.js — EIP 201: Implementation Deep-Dive (~120 slides)
// Enterprise Integration Patterns with Apache Camel — Java DSL on Quarkus
"use strict";

const {
  COLOR, FONT, W, H, PNG, ASSETS,
  newDeck,
  addFooter, addContentTitle, addBullets, addTwoColBullets, addStatusTable,
  addCaption, addPerfCallout,
  addDiagramSlide, addCodeSlide, addLangChip, addSectionDivider, addNotes,
  addPatternCard, addComparisonSlide, addIconGrid, addFlowSlide, addKeyValueSlide,
} = require("./deck-helpers.js");

const pres = newDeck();
pres.title  = "Enterprise Integration Patterns with Apache Camel — EIP 201";
pres.author = "Robert Sedor";

let PAGE = 0;

/** Create a content slide with footer and auto-incrementing page number. */
function S() {
  const s = pres.addSlide();
  PAGE++;
  addFooter(s, PAGE);
  return s;
}

/** Create a section divider slide (no page number). */
function divider(code, title, subtitle, notes) {
  const s = pres.addSlide();
  addSectionDivider(s, code, title, subtitle);
  if (notes) addNotes(s, notes);
  return s;
}

/** Helper for headline + detail bullet pairs. */
function bsub(items) {
  const out = [];
  for (const ln of items) {
    if (typeof ln === "string" || !ln.sub) { out.push(ln); continue; }
    out.push({
      text: ln.text,
      options: {
        bullet: { code: "25CF" }, bold: true,
        paraSpaceAfter: 2, breakLine: true,
        ...(ln.options || {}),
      },
    });
    out.push({
      text: ln.sub,
      options: {
        bullet: false, color: COLOR.body, fontSize: 13,
        indentLevel: 1, paraSpaceAfter: 12, breakLine: true,
      },
    });
  }
  return out;
}

// ============================================================================
// SECTION 00 — Cover + Agenda  (3 slides)
// ============================================================================

// --- Slide 1: Cover ---
{
  const s = pres.addSlide();
  s.background = { color: COLOR.ink };
  try {
    s.addImage({ path: `${ASSETS}/section-panel.png`, x: 0, y: 0, w: W, h: H });
  } catch (e) { /* ok */ }
  s.addText("Enterprise Integration Patterns", {
    x: 6.20, y: 1.60, w: 6.60, h: 2.00,
    fontFace: FONT.title, fontSize: 42, bold: true, color: COLOR.white,
    align: "left", valign: "top",
  });
  s.addText("with Apache Camel\nImplementation Deep-Dive: Java DSL on Quarkus", {
    x: 6.20, y: 3.65, w: 6.60, h: 1.10,
    fontFace: FONT.body, fontSize: 17, color: "FFD9D9",
    align: "left", valign: "top", lineSpacingMultiple: 1.30,
  });
  s.addText("Robert Sedor", {
    x: 6.20, y: 5.30, w: 6.60, h: 0.50,
    fontFace: FONT.body, fontSize: 15, color: COLOR.white,
    align: "left", valign: "middle",
  });
  s.addText("Kafka  |  Pulsar  |  Redis  |  PostgreSQL  |  Podman", {
    x: 6.20, y: 5.80, w: 6.60, h: 0.35,
    fontFace: FONT.mono, fontSize: 12, color: "FFD9D9",
    align: "left", valign: "middle",
  });
  try {
    s.addImage({ path: `${ASSETS}/redhat-logo-white.png`, x: 11.42, y: 6.88, w: 1.33, h: 0.31 });
  } catch (e) { /* ok */ }
  addNotes(s, "Welcome to EIP 201 — the Implementation Deep-Dive. This deck assumes you have seen EIP 101 or are already familiar with the 65 Enterprise Integration Patterns from Hohpe and Woolf. Today we go hands-on: every pattern shown in real Apache Camel 4.x Java DSL running on Quarkus 3.x with Kafka, Pulsar, Redis, and PostgreSQL. The shipping domain ties every example together — orders flow from placement through validation, payment, fulfillment, and notification. We will build, debug, and reason about each pattern in code, not just in theory.");
}

// --- Slide 2: Agenda ---
{
  const s = S();
  addContentTitle(s, "EIP 201", "Agenda — 12 Sections");
  addTwoColBullets(s,
    [
      "01 — The Camel Runtime",
      "02 — Infrastructure Stack",
      "03 — Channel Patterns in Code",
      "04 — Message Construction in Code",
      "05 — Routing Patterns in Code",
      "06 — Transformation in Code",
    ],
    [
      "07 — Endpoint Patterns in Code",
      "08 — System Management in Code",
      "09 — Observability & Production",
      "10 — Case Study: Loan Broker",
      "11 — Case Study: Bond Trading",
      "12 — Closing + Appendices",
    ],
  );
  addNotes(s, "Here is our roadmap. Twelve sections that walk through every EIP category with real running code. Sections 01 and 02 lay the foundation — the Camel runtime model and the infrastructure stack you need to run the examples. Sections 03 through 08 mirror the six EIP categories from Hohpe and Woolf: channels, messages, routing, transformation, endpoints, and system management. Section 09 covers observability and production readiness. Then we close with two full case studies — the Loan Broker and Bond Trading — that wire dozens of patterns together into cohesive applications. Every code slide is extracted from a runnable Quarkus project you can launch with mvn quarkus:dev.");
}

// --- Slide 3: Prerequisites ---
{
  const s = S();
  addContentTitle(s, "EIP 201", "Prerequisites — What You Should Know");
  addBullets(s, bsub([
    { text: "EIP 101 or equivalent", sub: "Familiarity with the 65 Enterprise Integration Patterns from Hohpe & Woolf" },
    { text: "Java 17+ fundamentals", sub: "Records, lambdas, streams, CDI basics — we use modern Java throughout" },
    { text: "Apache Camel concepts", sub: "Routes, exchanges, processors, components — at least conceptual level" },
    { text: "Messaging basics", sub: "Topics, queues, consumer groups, partitions — Kafka or similar" },
    { text: "Container tooling", sub: "Podman or Docker for running the infrastructure stack locally" },
    { text: "Maven basics", sub: "Running mvn quarkus:dev and reading pom.xml dependencies" },
  ]));
  addNotes(s, "Before we dive in, let us set expectations. This is a 201-level deck — it assumes you already know what the Enterprise Integration Patterns are, either from EIP 101 or from reading the Hohpe and Woolf book. You should be comfortable with modern Java — we use records, lambdas, and CDI injection heavily. Familiarity with messaging concepts like topics, consumer groups, and partitions will help, though we cover Kafka architecture in Section 02. You will need Podman or Docker installed locally to run the infrastructure stack, and Maven to build and run the Quarkus examples. If any of these are unfamiliar, the tutorial site at the companion GitHub repo walks through setup step by step.");
}

// ============================================================================
// SECTION 01 — The Camel Runtime  (10 slides)
// ============================================================================

divider("01", "The Camel\nRuntime", "Apache Camel 4.x — the integration framework",
  "Section 01 introduces the Apache Camel runtime — the engine that drives every integration pattern in this tutorial. We will explore the route model, the CamelContext container, RouteBuilder classes, the processor pipeline, components, and why Quarkus is the ideal runtime for cloud-native Camel. This section builds the mental model you need to read every code slide that follows.");

// Slide 4: Apache Camel 4.x overview
{
  const s = S();
  addContentTitle(s, "THE CAMEL RUNTIME", "Apache Camel 4.x — The Integration Framework");
  addBullets(s, bsub([
    { text: "350+ components", sub: "Kafka, REST, HTTP, JMS, File, S3, gRPC, JDBC, Bean — connectors for everything" },
    { text: "Type-safe Java DSL", sub: "Compile-time checks, IDE auto-complete, refactoring support — no XML guessing" },
    { text: "Extensible processor pipeline", sub: "Every route is a chain of processors: marshal, transform, filter, split, aggregate" },
    { text: "Enterprise Integration Patterns built in", sub: "Every EIP from Hohpe & Woolf has a first-class DSL method — choice(), split(), aggregate()" },
    { text: "Lightweight runtime", sub: "Camel 4.x dropped legacy baggage — faster startup, smaller footprint, Java 17+" },
  ]));
  addNotes(s, "Apache Camel is the most comprehensive integration framework in the Java ecosystem. Version 4.x is a major modernization — it requires Java 17 minimum, drops deprecated APIs, and delivers significantly faster startup. The 350+ components mean you almost never have to write low-level connector code. The Java DSL gives you compile-time safety: if you misspell an endpoint URI or pass the wrong type, your IDE catches it before you even run. Every Enterprise Integration Pattern from Hohpe and Woolf has a direct DSL counterpart — you literally call .choice(), .split(), or .aggregate() in your route definition. This is not an abstraction over patterns; it IS the patterns.");
}

// Slide 5: The route model — code slide
{
  const s = S();
  addCodeSlide(s, "THE CAMEL RUNTIME", "The Route Model — from().process().to()", "Java", [
    '// A simple Camel route: consume from Kafka, log, produce to Kafka',
    'from("kafka:orders.placed")',
    '    .log("Order received: ${body}")',
    '    .marshal().json()',
    '    .to("kafka:orders.validated");',
    '',
    '// Every route follows this pattern:',
    '//   from(source)          — the consumer endpoint',
    '//     .process(...)       — zero or more processors',
    '//     .to(destination)    — the producer endpoint',
    '',
    '// The Exchange flows through each step:',
    '//   source → processor₁ → processor₂ → ... → destination',
  ], "Figure 1.1 — The fundamental from-process-to route pattern");
  addNotes(s, "This is the most fundamental thing in Camel: the route. Every route starts with from() — a consumer endpoint that listens for incoming messages. Here we consume from a Kafka topic called orders.placed. The message flows through a pipeline of processors — in this case a log step that prints the body, then a marshal step that converts the exchange body to JSON. Finally, to() sends the processed message to a producer endpoint — another Kafka topic. This from-process-to pattern is the backbone of every integration you will build. The exchange object carries the message through each step, preserving headers, properties, and the message body. Think of it as an assembly line where each station does one thing to the message.");
}

// Slide 6: CamelContext
{
  const s = S();
  addKeyValueSlide(s, "THE CAMEL RUNTIME", "CamelContext — The Runtime Container", [
    { key: "Runtime Container", value: "Manages the lifecycle of all routes, components, endpoints, and type converters" },
    { key: "Auto-configured", value: "No manual CamelContext creation — Quarkus CDI handles it via camel-quarkus-core" },
    { key: "Route Lifecycle", value: "start(), stop(), suspend(), resume() — control individual routes at runtime" },
    { key: "Registry Integration", value: "Camel's registry bridges to CDI — any @ApplicationScoped bean is auto-discoverable" },
    { key: "Component Discovery", value: "Add a Maven dependency, Camel discovers the component — no manual registration" },
    { key: "Thread Pools", value: "Manages thread pools for parallel processing, SEDA queues, and async operations" },
  ]);
  addNotes(s, "The CamelContext is the brain of the operation. It is the runtime container that owns and manages every route, component, and endpoint in your application. In traditional Camel you had to manually create and start the CamelContext. With Quarkus, this is completely automatic — the camel-quarkus-core extension creates the context, discovers your RouteBuilder classes via CDI, and starts everything at boot time. The registry integration is particularly powerful: any CDI bean you define with @ApplicationScoped is automatically available to Camel routes via the bean: component. Component auto-discovery means you just add a Maven dependency like camel-quarkus-kafka and the kafka: component is immediately usable in endpoint URIs. No XML configuration, no manual wiring.");
}

// Slide 7: RouteBuilder — code slide
{
  const s = S();
  addCodeSlide(s, "THE CAMEL RUNTIME", "RouteBuilder — Where Routes Live", "Java", [
    '@ApplicationScoped',
    'public class OrderProcessingRoute extends RouteBuilder {',
    '',
    '    @Override',
    '    public void configure() {',
    '        // Error handling for all routes in this builder',
    '        errorHandler(defaultErrorHandler()',
    '            .maximumRedeliveries(3)',
    '            .redeliveryDelay(500));',
    '',
    '        // Route 1: validate incoming orders',
    '        from("kafka:eip.orders.placed")',
    '            .routeId("order-validation")',
    '            .bean(OrderValidator.class)',
    '            .to("kafka:eip.orders.validated");',
    '',
    '        // Route 2: process validated orders',
    '        from("kafka:eip.orders.validated")',
    '            .routeId("order-processing")',
    '            .bean(OrderProcessor.class)',
    '            .to("kafka:eip.orders.processed");',
    '    }',
    '}',
  ], "Figure 1.2 — A RouteBuilder with two routes and shared error handling");
  addNotes(s, "The RouteBuilder is where you define your routes. It is a class that extends RouteBuilder and overrides configure(). In Quarkus, you annotate it with @ApplicationScoped so CDI discovers it automatically — Camel calls configure() at startup and registers all the routes. Notice the routeId() calls — these give each route a human-readable name for logging, monitoring, and management. The error handler is defined once at the top and applies to all routes in this builder. You can have multiple RouteBuilder classes in your application, each responsible for a different concern. This is exactly how we structure the tutorial examples: one RouteBuilder per logical concern, each in its own file.");
}

// Slide 8: Processors — the processing pipeline
{
  const s = S();
  addKeyValueSlide(s, "THE CAMEL RUNTIME", "Processors — The Processing Pipeline", [
    { key: "Exchange", value: "Carries the In message, optional Out message, headers, properties, and exception state" },
    { key: "Message", value: "Body (any Java object) + headers (String→Object map) — travels through the pipeline" },
    { key: "Headers", value: "CamelKafkaTopic, CamelKafkaOffset, correlationId, contentType — routing hints" },
    { key: "Processor", value: "void process(Exchange exchange) — the fundamental processing unit, stateless by design" },
    { key: "Bean Binding", value: ".bean(MyService.class) — Camel auto-maps Exchange body/headers to method parameters" },
    { key: "Type-safe Generics", value: "exchange.getIn().getBody(Order.class) — automatic type conversion via Camel converters" },
  ]);
  addNotes(s, "The Exchange is the central abstraction in Camel's processing model. Think of it as an envelope that wraps the actual message. The Exchange carries an In message — the current payload — plus headers that act as metadata. Headers are key-value pairs where the key is always a String. Kafka-specific headers like CamelKafkaTopic and CamelKafkaOffset are set automatically by the Kafka component. The Processor interface is the lowest-level way to process a message: you get the Exchange and can read or modify anything on it. In practice, you rarely implement Processor directly — instead you use .bean() to delegate to a CDI bean, and Camel automatically maps the exchange body and headers to your method parameters. This bean binding is remarkably smart: if your method takes an Order parameter, Camel will convert the body to Order automatically.");
}

// Slide 9: Components — connecting to the world
{
  const s = S();
  addIconGrid(s, "THE CAMEL RUNTIME", "Components — Connecting to the World", [
    { icon: "message-channel", label: "kafka:", desc: "Produce/consume Kafka topics — consumer groups, partitions, serializers, exactly-once" },
    { icon: "pipes-and-filters", label: "direct:", desc: "Synchronous in-memory call between routes — like a method call, same thread" },
    { icon: "message-channel", label: "seda:", desc: "Asynchronous in-memory queue between routes — decoupled, different thread" },
    { icon: "polling-consumer", label: "timer: / quartz:", desc: "Trigger routes on a schedule — polling consumers, batch processing" },
    { icon: "messaging-gateway", label: "rest:", desc: "Expose REST APIs — auto-generates OpenAPI, supports GET/POST/PUT/DELETE" },
    { icon: "service-activator", label: "bean:", desc: "Invoke CDI beans — Camel handles parameter binding and type conversion" },
    { icon: "message-store", label: "sql: / jpa:", desc: "Database access — queries, inserts, stored procedures, JPA entity management" },
    { icon: "channel-adapter", label: "platform-http:", desc: "Quarkus-native HTTP server — Vert.x under the hood, no extra servlet container" },
  ], { cols: 4, cellH: 1.75, iconSize: 0.48 });
  addNotes(s, "Camel components are the connectors that let your routes talk to the outside world. Each component provides a scheme for endpoint URIs. The kafka: component is our workhorse — it handles producing and consuming messages with full support for consumer groups, partition assignment, and serialization. The direct: and seda: components are critical for internal routing — direct: is synchronous (same thread, like a method call) while seda: is asynchronous (different thread, with an internal queue). The rest: component lets you expose REST APIs that feed into Camel routes, which is how the Loan Broker example accepts HTTP requests and converts them into message flows. The bean: component bridges to your CDI beans. In Quarkus, platform-http: replaces the traditional servlet-based HTTP component with a Vert.x-based one that is much faster.");
}

// Slide 10: Camel on Quarkus
{
  const s = S();
  addContentTitle(s, "THE CAMEL RUNTIME", "Camel on Quarkus — Why It Matters");
  addBullets(s, bsub([
    { text: "CDI injection in routes", sub: "@Inject any bean into your RouteBuilder — configuration, services, repositories" },
    { text: "Dev Services", sub: "Quarkus auto-starts Kafka, Redis, PostgreSQL in containers — zero config for development" },
    { text: "Sub-second startup", sub: "Camel Quarkus optimizes route building at compile time — 0.3s JVM, 0.02s native" },
    { text: "GraalVM native builds", sub: "mvn package -Dnative — ahead-of-time compilation for minimal footprint" },
    { text: "Live reload", sub: "Change a route, save the file — Quarkus reloads in milliseconds, no restart" },
    { text: "Continuous testing", sub: "Tests run automatically on save — instant feedback on route changes" },
  ]));
  addPerfCallout(s, "Quarkus Camel starts in ~300ms on JVM, ~20ms native — compared to ~4s on Spring Boot. That is 10-200x faster cold start.");
  addNotes(s, "Quarkus is not just another way to run Camel — it fundamentally changes the developer experience. Dev Services are a game-changer: when you add the Kafka extension, Quarkus automatically starts a Kafka broker in a container at dev time. No docker-compose, no manual setup. CDI injection means your RouteBuilder can @Inject configuration properties, service beans, and repositories directly. The sub-second startup comes from build-time optimization — Quarkus analyzes your routes at compile time and pre-computes as much as possible, eliminating runtime reflection. Live reload means you edit a route, save the file, and your changes are running in milliseconds. For production, native compilation with GraalVM gives you a ~20ms startup time, which is critical for serverless and scale-to-zero deployments.");
}

// Slide 11: JBang prototyping to Quarkus — diagram
{
  const s = S();
  addDiagramSlide(s, "THE CAMEL RUNTIME", "JBang Prototyping to Quarkus Promotion", "23-promotion-workflow",
    "Figure 1.3 — The prototyping-to-production promotion workflow");
  addNotes(s, "Camel JBang is an incredible prototyping tool. You write a single Java file with your route, run 'camel run MyRoute.java', and it executes immediately — no Maven project, no pom.xml, no build step. This is perfect for experimenting with a new pattern or testing a component configuration. When your prototype works, you promote it to a full Quarkus project with 'camel export --runtime=quarkus'. This generates a complete Maven project with pom.xml, application.properties, and your route wrapped in a proper RouteBuilder. The diagram shows this workflow: prototype with JBang, validate the pattern works, then export to Quarkus for production-grade development with testing, CI/CD, and native compilation. Several of our tutorial examples started life as JBang prototypes.");
}

// Slide 12: JBang code slide
{
  const s = S();
  addCodeSlide(s, "THE CAMEL RUNTIME", "JBang Prototype to Quarkus Export", "Java", [
    '// Step 1: Prototype with JBang (single file, no project)',
    '// Save as OrderRoute.java and run:',
    '//   camel run OrderRoute.java',
    '',
    'from("timer:generate?period=5000")',
    '    .setBody(constant("{\\"orderId\\":\\"ORD-001\\",\\"total\\":99.95}"))',
    '    .log("Generating test order: ${body}")',
    '    .to("kafka:eip.orders.placed");',
    '',
    '// Step 2: Export to Quarkus project',
    '//   camel export --runtime=quarkus --directory=order-service',
    '',
    '// Step 3: Run as Quarkus application',
    '//   cd order-service && mvn quarkus:dev',
  ], "Figure 1.4 — From single-file prototype to full Quarkus project in two commands");
  addNotes(s, "Here is the JBang workflow in action. In step one, you write your route in a single Java file — no class declaration needed for JBang, just the route DSL. The camel run command downloads dependencies, compiles the file, and starts the route. You can iterate rapidly — change the file and rerun. In step two, camel export generates a full Quarkus Maven project from your prototype. It creates the pom.xml with all required dependencies, wraps your route in a RouteBuilder class, and generates application.properties. Step three is standard Quarkus development: mvn quarkus:dev starts the app with live reload, Dev Services, and continuous testing. This three-step workflow is how we recommend exploring new patterns before committing to a full implementation.");
}

// Slide 13: Error handling
{
  const s = S();
  addCodeSlide(s, "THE CAMEL RUNTIME", "Error Handling — onException, Dead Letter Channel", "Java", [
    '// Global error handler — dead letter channel with retry',
    'errorHandler(deadLetterChannel("kafka:eip.dead-letter")',
    '    .maximumRedeliveries(3)',
    '    .redeliveryDelay(1000)',
    '    .retryAttemptedLogLevel(LoggingLevel.WARN)',
    '    .useOriginalMessage());',
    '',
    '// Exception-specific handling',
    'onException(ValidationException.class)',
    '    .handled(true)',
    '    .log(LoggingLevel.ERROR, "Validation failed: ${exception.message}")',
    '    .to("kafka:eip.orders.invalid");',
    '',
    'onException(IOException.class)',
    '    .maximumRedeliveries(5)',
    '    .redeliveryDelay(2000)',
    '    .backOffMultiplier(2.0)',
    '    .to("kafka:eip.errors.io");',
  ], "Figure 1.5 — Layered error handling: global dead letter + exception-specific routes");
  addNotes(s, "Error handling in Camel is layered and powerful. The errorHandler defines the default behavior for any unhandled exception — here we use a dead letter channel that retries three times with one-second delays before routing the failed message to a dead-letter Kafka topic. The useOriginalMessage() call ensures the dead letter receives the original input, not a partially-processed version. On top of the global handler, onException blocks handle specific exception types. ValidationException is marked as handled(true), meaning Camel will not propagate it further — the message goes to the invalid orders topic and processing continues. IOException gets special retry behavior with exponential backoff — the delay doubles each time. This layered approach means transient failures get retried while business validation failures get routed to the appropriate error channel.");
}

// Slide 14: Type converters
{
  const s = S();
  addContentTitle(s, "THE CAMEL RUNTIME", "Type Converters — Automatic Type Conversion");
  addBullets(s, bsub([
    { text: "Automatic conversion", sub: "exchange.getIn().getBody(Order.class) — Camel finds a converter chain automatically" },
    { text: "Built-in converters", sub: "String ↔ byte[], InputStream → String, JSON → Map, XML → Document, and 400+ more" },
    { text: "Jackson JSON integration", sub: "camel-jackson auto-registers JSON ↔ POJO converters for marshal()/unmarshal()" },
    { text: "Custom converters", sub: "@Converter annotation on a method — register domain-specific conversions" },
    { text: "Converter chain resolution", sub: "Camel can chain converters: byte[] → String → JSON → POJO in a single getBody() call" },
    { text: "Build-time optimization", sub: "Quarkus discovers converters at build time — no classpath scanning at startup" },
  ]));
  addNotes(s, "Type conversion is one of Camel's most underappreciated features. When you call exchange.getIn().getBody(Order.class), you are not just casting — Camel actively looks for a converter that can transform whatever the body currently is into an Order. If the body is a JSON string, it will find the Jackson converter and deserialize it. If the body is a byte array, it will first convert to String, then to JSON, then to your POJO — chaining converters automatically. The built-in converter library covers over 400 type pairs. You can register your own with the @Converter annotation. In Quarkus, converter discovery happens at build time rather than runtime classpath scanning, which contributes to the fast startup. This automatic type conversion eliminates enormous amounts of boilerplate that you would otherwise write manually at every step of your routes.");
}

// ============================================================================
// SECTION 02 — Infrastructure Stack  (8 slides)
// ============================================================================

divider("02", "Infrastructure\nStack", "Kafka, Pulsar, Redis, PostgreSQL on Podman",
  "Section 02 walks through the infrastructure stack that powers our shipping domain examples. We will examine each technology — Kafka with KRaft, Pulsar, Redis, and PostgreSQL — and how Camel connects to each one. We also cover the Podman compose stack that spins up the entire environment with a single command. Understanding this infrastructure is essential for running the examples yourself.");

// Slide 15: The shipping domain stack — diagram
{
  const s = S();
  addDiagramSlide(s, "INFRASTRUCTURE STACK", "The Shipping Domain Stack", "01-stack-architecture",
    "Figure 2.1 — Complete infrastructure stack: Camel services, Kafka, Pulsar, Redis, PostgreSQL");
  addNotes(s, "This diagram shows the full stack for our shipping domain. At the center is Kafka, acting as the primary messaging backbone — all order, payment, inventory, and shipping events flow through Kafka topics. Pulsar provides multi-tenant messaging for scenarios that need topic-level isolation and geo-replication. Redis serves as the caching layer and idempotent repository — we store claim checks and deduplication keys there. PostgreSQL backs the outbox pattern and provides durable message stores. The Camel Quarkus services sit on top, each consuming from and producing to these systems. Everything runs in Podman containers orchestrated by a compose file, making the entire stack reproducible on any developer machine.");
}

// Slide 16: Kafka with KRaft — diagram
{
  const s = S();
  addDiagramSlide(s, "INFRASTRUCTURE STACK", "Kafka with KRaft — The Messaging Backbone", "20-kafka-architecture",
    "Figure 2.2 — Kafka architecture: brokers, topics, partitions, consumer groups");
  addNotes(s, "Kafka is our primary messaging system, running in KRaft mode — which means no ZooKeeper dependency. KRaft uses Raft consensus for metadata management, simplifying operations significantly. The key concepts map directly to EIP patterns: topics are channels, consumer groups implement competing consumers, and partitions provide parallelism. In our shipping domain, we use topics like eip.orders.placed, eip.orders.validated, eip.payments.completed, and eip.shipments.dispatched. Each topic has multiple partitions for throughput, and the partition key (usually orderId) ensures ordering within a partition. Kafka's durability guarantees — replication, committed offsets, and acknowledgment modes — map directly to the Guaranteed Delivery pattern.");
}

// Slide 17: Kafka in Camel — code slide
{
  const s = S();
  addCodeSlide(s, "INFRASTRUCTURE STACK", "Kafka in Camel — The kafka: Component", "Java", [
    '// Consuming from Kafka with consumer group',
    'from("kafka:eip.orders.placed?brokers={{kafka.brokers}}" +',
    '     "&groupId=order-processor" +',
    '     "&autoOffsetReset=earliest" +',
    '     "&keyDeserializer=org.apache.kafka.common.serialization.StringDeserializer")',
    '    .log("Received order: key=${header.kafka.KEY}, partition=${header.kafka.PARTITION}")',
    '    .process(exchange -> {',
    '        String body = exchange.getIn().getBody(String.class);',
    '        Order order = objectMapper.readValue(body, Order.class);',
    '        exchange.getIn().setBody(order);',
    '    })',
    '    .to("direct:validate-order");',
    '',
    '// Producing to Kafka with partition key',
    'from("direct:emit-order-event")',
    '    .setHeader("kafka.KEY", simple("${body.orderId}"))',
    '    .marshal().json()',
    '    .to("kafka:eip.orders.validated");',
  ], "Figure 2.3 — Full Kafka consumer and producer configuration in Camel");
  addNotes(s, "This slide shows both sides of the Kafka component. The consumer uses the kafka: URI scheme with several key parameters. The brokers property uses Quarkus config interpolation with double curly braces. The groupId puts this consumer into a consumer group for load balancing. autoOffsetReset=earliest means new consumer groups start from the beginning of the topic. On the consumer side, Camel automatically sets headers like kafka.KEY, kafka.PARTITION, and kafka.OFFSET that you can use in your route logic. The producer side is simpler — you set the kafka.KEY header to control which partition the message lands in (messages with the same key go to the same partition, preserving order), marshal the body to JSON, and send to the target topic. The partition key is critical for the shipping domain: all events for the same orderId must be ordered.");
}

// Slide 18: Apache Pulsar — diagram
{
  const s = S();
  addDiagramSlide(s, "INFRASTRUCTURE STACK", "Apache Pulsar — Multi-Tenant Messaging", "21-pulsar-architecture",
    "Figure 2.4 — Pulsar architecture: tenants, namespaces, topics, subscriptions");
  addNotes(s, "Pulsar brings capabilities that complement Kafka. Its multi-tenancy model — tenants, namespaces, and topics — provides natural isolation between different applications or teams sharing the same cluster. Pulsar's subscription model offers four consumption patterns: exclusive, shared, failover, and key-shared. The key-shared subscription is particularly interesting for EIP patterns because it guarantees ordering per key while still allowing parallel consumption — something that requires careful partition assignment in Kafka. In our examples, we use Pulsar for scenarios that benefit from its built-in message deduplication, delayed message delivery, and the ability to replay from any point in the topic's history. The messaging bridge pattern connects Kafka and Pulsar when messages need to flow between the two systems.");
}

// Slide 19: Redis
{
  const s = S();
  addIconGrid(s, "INFRASTRUCTURE STACK", "Redis — Caching, Idempotency, and Pub/Sub", [
    { icon: "idempotent-consumer", label: "Idempotent Repository", desc: "Store processed message IDs in Redis — deduplication across restarts and replicas" },
    { icon: "claim-check", label: "Claim Check Store", desc: "Store large payloads in Redis, pass a claim key through the route — retrieve later" },
    { icon: "content-enricher", label: "Distributed Cache", desc: "Cache enrichment data — credit scores, customer profiles, product catalogs" },
    { icon: "publish-subscribe-channel", label: "Pub/Sub Messaging", desc: "Redis Pub/Sub for real-time notifications — lower latency than Kafka for ephemeral messages" },
  ], { cols: 2, cellH: 2.20 });
  addNotes(s, "Redis plays three distinct roles in our integration architecture. First, as an idempotent repository: when we need to ensure a message is processed only once — even across application restarts or multiple replicas — we store the message ID in Redis and check it before processing. The RedisIdempotentRepository is a Camel built-in that handles this automatically. Second, as a claim check store: when a message payload is too large to send through Kafka efficiently, we store the payload in Redis and send just a claim key through the route. The downstream consumer retrieves the full payload using that key. Third, Redis provides a distributed cache for enrichment data — caching credit scores or customer profiles so the content enricher pattern does not hit the database on every message. Redis Pub/Sub is also useful for lightweight real-time notifications where Kafka's durability overhead is unnecessary.");
}

// Slide 20: PostgreSQL
{
  const s = S();
  addIconGrid(s, "INFRASTRUCTURE STACK", "PostgreSQL — Outbox Pattern and Message Stores", [
    { icon: "transactional-client", label: "Transactional Outbox", desc: "Write domain event + business data in a single DB transaction — then relay to Kafka" },
    { icon: "message-store", label: "Message Store", desc: "Persist every exchange for replay, debugging, and compliance — JPA entity mapping" },
    { icon: "saga", label: "Saga Persistence", desc: "Store saga state in PostgreSQL — survive restarts, enable distributed coordination" },
    { icon: "aggregator", label: "Aggregation Repository", desc: "JDBC-backed aggregation repository — survive restarts during long-running aggregations" },
  ], { cols: 2, cellH: 2.20 });
  addNotes(s, "PostgreSQL is the durable state store that makes several EIP patterns production-safe. The Transactional Outbox pattern is perhaps the most important: when a service processes an order, it writes the updated order state AND the outbound event to the same database transaction. A separate process — either Debezium CDC or a polling route — reads the outbox table and relays events to Kafka. This guarantees that the event is published if and only if the business operation succeeded. The message store pattern uses PostgreSQL to persist every exchange for audit and replay. The JDBC-backed aggregation repository ensures that in-progress aggregations survive application restarts — critical for the scatter-gather and aggregator patterns that collect responses over time. Quarkus Dev Services starts a PostgreSQL container automatically in dev mode.");
}

// Slide 21: Podman compose stack — code slide
{
  const s = S();
  addCodeSlide(s, "INFRASTRUCTURE STACK", "The Podman Compose Stack", "Java", [
    '# Start the base infrastructure stack',
    '$ ./scripts/setup-stack.sh',
    '',
    '# Compose services started:',
    '#   kafka       — KRaft mode, port 9092',
    '#   pulsar      — standalone, port 6650 (binary), 8080 (admin)',
    '#   redis       — standalone, port 6379',
    '#   postgresql  — port 5432, db: eip_tutorial',
    '',
    '# With observability (Grafana, Loki, Tempo, Mimir):',
    '$ ./scripts/setup-stack.sh --lgtm',
    '',
    '# Verify services are running:',
    '$ podman ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
    '',
    '# Directory structure:',
    '#   examples/_infra/compose.yaml       — base services',
    '#   examples/_infra/compose-lgtm.yaml  — observability overlay',
  ], "Figure 2.5 — One command to start the entire infrastructure stack");
  addNotes(s, "The setup-stack.sh script is your single command to start everything. It uses Podman Compose to bring up Kafka in KRaft mode, Pulsar in standalone mode, Redis, and PostgreSQL — all with the right port mappings, health checks, and initial configuration. The --lgtm flag adds the observability stack: Grafana for dashboards, Loki for log aggregation, Tempo for distributed tracing, and Mimir for metrics. This is the same stack we cover in Section 09. The compose files live in examples/_infra/ and are designed to be idempotent — running setup-stack.sh twice will not create duplicate containers. Health checks ensure each service is actually ready before the script exits. This matters because Camel routes will fail fast if they try to connect to a Kafka broker that is not yet accepting connections.");
}

// Slide 22: Running an example
{
  const s = S();
  addFlowSlide(s, "INFRASTRUCTURE STACK", "Running an Example", [
    { label: "Start Stack", desc: "./scripts/setup-stack.sh\n\nKafka, Pulsar, Redis, PostgreSQL in containers" },
    { label: "Navigate", desc: "cd examples/<name>\n\nEach chapter has its own Maven project" },
    { label: "Launch", desc: "mvn quarkus:dev\n\nLive reload, Dev Services, continuous testing" },
    { label: "Observe", desc: "Camel logs route startups, message flow, and errors to console" },
    { label: "Iterate", desc: "Edit a Java file, save — Quarkus reloads in milliseconds" },
  ]);
  addPerfCallout(s, "Dev Mode startup: ~1.2s including route initialization. Live reload: ~200ms. Compare to traditional app server: 15-30s restart.");
  addNotes(s, "Here is the workflow for running any tutorial example end to end. First, start the infrastructure stack with setup-stack.sh — this is a one-time step that stays running in the background. Then navigate to the specific example directory. Each chapter has its own self-contained Maven project with its own pom.xml and application.properties. Run mvn quarkus:dev to start the application in Dev Mode. You will see Camel log each route starting up, and then messages flowing through the routes. The key power of Dev Mode is iteration speed: edit any Java file, save it, and Quarkus hot-reloads your changes in about 200 milliseconds. You do not restart the JVM. Press 'r' to run your test suite, or 'o' to enable continuous testing where tests automatically re-run on every save. This tight feedback loop makes it practical to experiment with different pattern implementations.");
}

// ============================================================================
// SECTION 03 — Channel Patterns in Code  (10 slides)
// ============================================================================

divider("03", "Channel Patterns\nin Code", "Point-to-Point, Pub/Sub, Dead Letter, and more",
  "Section 03 implements the messaging channel patterns in Camel Java DSL. Channels are the pipes that carry messages between components. We will code point-to-point channels, publish-subscribe channels, dead letter channels, channel adapters, messaging bridges, and more — all using Kafka topics as the underlying transport. Each pattern gets a working code example you can run yourself.");

// Slide 23: Channel types overview — diagram
{
  const s = S();
  addDiagramSlide(s, "CHANNEL PATTERNS", "Channel Types Overview", "04-channel-types",
    "Figure 3.1 — The channel taxonomy: point-to-point, pub/sub, dead letter, datatype");
  addNotes(s, "This diagram shows the four major channel types from the EIP catalog. Point-to-point channels deliver each message to exactly one consumer — in Kafka, this maps to a single consumer group. Publish-subscribe channels deliver each message to all subscribers — in Kafka, this means multiple consumer groups each reading the same topic independently. Dead letter channels capture messages that could not be processed after all retries are exhausted. Datatype channels carry messages of a specific schema, enforced by serialization configuration. Understanding these channel types is fundamental because every integration scenario requires choosing the right channel semantics. The wrong choice — using pub/sub when you need point-to-point — leads to duplicate processing and data corruption.");
}

// Slide 24: Point-to-Point with Kafka
{
  const s = S();
  addCodeSlide(s, "CHANNEL PATTERNS", "Point-to-Point — Single Consumer Group", "Java", [
    '// Point-to-Point channel: exactly ONE consumer processes each message.',
    '// In Kafka, this means all consumers share the SAME consumer group.',
    '',
    '// Consumer 1 (replica A)',
    'from("kafka:eip.orders.placed?groupId=order-processor")',
    '    .routeId("order-consumer-a")',
    '    .bean(OrderProcessor.class)',
    '    .to("kafka:eip.orders.validated");',
    '',
    '// Consumer 2 (replica B) — same groupId!',
    '// Kafka assigns different partitions to each consumer.',
    '// Each message is delivered to exactly one consumer.',
    '',
    '// With 6 partitions and 2 consumers:',
    '//   Consumer A gets partitions 0, 1, 2',
    '//   Consumer B gets partitions 3, 4, 5',
  ], "Figure 3.2 — Point-to-Point semantics via Kafka consumer groups");
  addNotes(s, "Point-to-point is the most common channel pattern. In Kafka, you achieve point-to-point semantics by having all consumers use the same consumer group ID. Kafka then assigns partitions across the consumers in the group — each partition is consumed by exactly one consumer, so each message is processed exactly once. If you scale to three replicas of your order processor service, Kafka rebalances the partition assignments automatically. This is the Competing Consumers pattern (which we cover in Section 07) built into Kafka's consumer group protocol. The key insight is that point-to-point in Kafka is not about the topic — it is about the consumer group. The same topic can be both point-to-point and pub/sub depending on how consumers configure their group IDs.");
}

// Slide 25: Pub/Sub with Kafka
{
  const s = S();
  addCodeSlide(s, "CHANNEL PATTERNS", "Publish-Subscribe — Multiple Consumer Groups", "Java", [
    '// Pub/Sub channel: EVERY subscriber receives every message.',
    '// In Kafka, each subscriber uses a DIFFERENT consumer group.',
    '',
    '// Subscriber 1: Inventory service',
    'from("kafka:eip.orders.placed?groupId=inventory-service")',
    '    .routeId("inventory-listener")',
    '    .bean(InventoryReserver.class);',
    '',
    '// Subscriber 2: Payment service',
    'from("kafka:eip.orders.placed?groupId=payment-service")',
    '    .routeId("payment-listener")',
    '    .bean(PaymentInitiator.class);',
    '',
    '// Subscriber 3: Notification service',
    'from("kafka:eip.orders.placed?groupId=notification-service")',
    '    .routeId("notification-listener")',
    '    .bean(OrderConfirmationSender.class);',
    '',
    '// All three services read from the SAME topic independently.',
  ], "Figure 3.3 — Pub/Sub semantics: three independent consumer groups");
  addNotes(s, "Publish-subscribe is the flip side of point-to-point. Here, three different services — inventory, payment, and notification — all consume from the same eip.orders.placed topic but with different consumer group IDs. Each service gets its own copy of every message, processes it independently, and maintains its own committed offset position. This is how event-driven architectures work: a single order-placed event triggers inventory reservation, payment initiation, and confirmation notification — all in parallel, all decoupled. If the payment service goes down for maintenance, it simply resumes from its last committed offset when it comes back up, processing all the messages it missed. No message is lost, and no other service is affected.");
}

// Slide 26: Dead Letter Channel — diagram
{
  const s = S();
  addDiagramSlide(s, "CHANNEL PATTERNS", "Dead Letter Channel — When Processing Fails", "05-reliability-patterns",
    "Figure 3.4 — Dead letter channel: retry exhaustion → DLQ → manual inspection");
  addNotes(s, "The dead letter channel is your safety net. When a message cannot be processed after all retry attempts are exhausted, it must go somewhere — you cannot just drop it or let it block the pipeline. The dead letter channel captures these failed messages with their original payload, exception details, and processing metadata. In our shipping domain, a dead letter message might be an order with an invalid address that fails address validation after three retries. The operations team can inspect the dead letter topic, fix the underlying issue, and replay the message. The diagram shows the flow: normal processing → retry loop → DLQ on exhaustion. The key design decision is what information to include with the dead-lettered message — we include the original message, the exception stack trace, the route ID, and the number of delivery attempts.");
}

// Slide 27: Dead Letter Channel — code slide
{
  const s = S();
  addCodeSlide(s, "CHANNEL PATTERNS", "Dead Letter Channel — Camel Implementation", "Java", [
    '// Configure dead letter channel with retry policy',
    'errorHandler(deadLetterChannel("kafka:eip.dead-letter")',
    '    .maximumRedeliveries(3)',
    '    .redeliveryDelay(1000)',
    '    .retryAttemptedLogLevel(LoggingLevel.WARN)',
    '    .useOriginalMessage()',
    '    .onPrepareFailure(exchange -> {',
    '        Exception cause = exchange.getProperty(',
    '            Exchange.EXCEPTION_CAUGHT, Exception.class);',
    '        exchange.getIn().setHeader("FailureReason",',
    '            cause != null ? cause.getMessage() : "unknown");',
    '        exchange.getIn().setHeader("FailedRouteId",',
    '            exchange.getProperty(Exchange.FAILURE_ROUTE_ID));',
    '        exchange.getIn().setHeader("DeliveryCount",',
    '            exchange.getIn().getHeader(Exchange.REDELIVERY_COUNTER));',
    '    }));',
  ], "Figure 3.5 — Dead letter channel with metadata enrichment for debugging");
  addNotes(s, "This code shows a production-grade dead letter channel configuration. The deadLetterChannel() method wraps the error handler — after three redeliveries with one-second delays, the message goes to the eip.dead-letter Kafka topic. The useOriginalMessage() call is critical: without it, the dead-lettered message would contain whatever partial state the route had produced before the failure, which is usually useless for debugging. The onPrepareFailure callback enriches the dead letter with metadata: the failure reason, the route ID where the failure occurred, and the delivery count. These headers make it possible for an operations dashboard to triage dead letters without digging through logs. This pattern is used in every production example in the tutorial — it is non-negotiable for reliable messaging.");
}

// Slide 28: Guaranteed Delivery
{
  const s = S();
  addKeyValueSlide(s, "CHANNEL PATTERNS", "Guaranteed Delivery — Kafka Acks and Transactions", [
    { key: "Producer Acks", value: "acks=all — wait for all in-sync replicas to confirm the write before proceeding" },
    { key: "Idempotent Producer", value: "enable.idempotence=true — Kafka deduplicates retries using sequence numbers" },
    { key: "Transactional Producer", value: "Produce to multiple topics atomically — all messages committed or none" },
    { key: "Offset Management", value: "autoCommitEnable=false — commit offsets only after successful processing" },
    { key: "Delivery Guarantees", value: "At-least-once: commit after processing. Exactly-once: Kafka transactions + idempotent consumer" },
  ], { rowH: 0.65 });
  addPerfCallout(s, "acks=all adds ~5ms latency per produce but eliminates data loss. Always use acks=all in production.");
  addNotes(s, "Guaranteed delivery is not a single setting — it is a combination of producer and consumer configurations that together ensure no message is lost. On the producer side, acks=all means the broker does not acknowledge the write until all in-sync replicas have received the message. The idempotent producer setting prevents duplicates from producer retries — if the network drops the acknowledgment and the producer retries, Kafka deduplicates using a sequence number. On the consumer side, setting autoCommitEnable=false means you control when offsets are committed — you commit after successful processing, not before. If the consumer crashes before committing, the message will be redelivered. This gives you at-least-once semantics. For exactly-once, you combine Kafka transactions with idempotent consumers — we cover the idempotent consumer pattern in Section 07.");
}

// Slide 29: Channel Adapter — code slide
{
  const s = S();
  addCodeSlide(s, "CHANNEL PATTERNS", "Channel Adapter — REST to Kafka", "Java", [
    '// Channel Adapter: connect a non-messaging system (REST)',
    '// to the messaging system (Kafka)',
    '',
    'rest("/api/orders")',
    '    .post()',
    '    .consumes("application/json")',
    '    .type(Order.class)',
    '    .to("direct:submit-order");',
    '',
    'from("direct:submit-order")',
    '    .routeId("rest-to-kafka-adapter")',
    '    .log("REST order received: ${body.orderId}")',
    '    .setHeader("kafka.KEY", simple("${body.orderId}"))',
    '    .marshal().json()',
    '    .to("kafka:eip.orders.placed")',
    '    .setBody(constant("{\\"status\\":\\"accepted\\"}"));',
  ], "Figure 3.6 — Channel adapter bridging REST API to Kafka topic");
  addNotes(s, "The channel adapter pattern connects a non-messaging endpoint to the messaging system. Here, a REST API endpoint accepts Order objects via HTTP POST and routes them into the Kafka messaging backbone. The rest() DSL defines the HTTP endpoint — Quarkus handles the HTTP server via Vert.x. The direct: component connects the REST handler to the processing route synchronously. We set the Kafka partition key to the orderId to ensure all events for the same order land in the same partition. After producing to Kafka, we set the response body to a simple JSON acknowledgment. This adapter is the entry point for the entire shipping domain flow — external systems submit orders via REST, and from that point everything is event-driven through Kafka. The adapter translates between the synchronous HTTP world and the asynchronous messaging world.");
}

// Slide 30: Messaging Bridge — diagram + code
{
  const s = S();
  addDiagramSlide(s, "CHANNEL PATTERNS", "Messaging Bridge — Kafka to Pulsar", "06-messaging-bridge",
    "Figure 3.7 — Messaging bridge connecting two messaging systems");
  addNotes(s, "The messaging bridge connects two different messaging systems. In our stack, we bridge between Kafka and Pulsar when messages need to flow from one system to the other. This is different from a channel adapter, which connects a non-messaging system. The bridge must handle the impedance mismatch between the two systems — different serialization formats, different header conventions, different acknowledgment semantics. In Camel, a messaging bridge is simply a route that consumes from one messaging system and produces to another. The bridge route can optionally transform the message format, map headers, and apply filtering. This pattern is essential in enterprise environments where teams use different messaging technologies and need to share events across boundaries.");
}

// Slide 31: Messaging Bridge — code
{
  const s = S();
  addCodeSlide(s, "CHANNEL PATTERNS", "Messaging Bridge — Kafka to Pulsar in Code", "Java", [
    '// Bridge: Kafka → Pulsar',
    '// Forward order events from Kafka to Pulsar for multi-tenant access',
    '',
    'from("kafka:eip.orders.placed?groupId=pulsar-bridge")',
    '    .routeId("kafka-to-pulsar-bridge")',
    '    .log("Bridging order to Pulsar: ${header.kafka.KEY}")',
    '    // Map Kafka headers to Pulsar properties',
    '    .setHeader("orderId", header("kafka.KEY"))',
    '    .removeHeaders("kafka.*")',
    '    // Produce to Pulsar topic',
    '    .to("pulsar:persistent://eip/orders/placed");',
    '',
    '// Bridge: Pulsar → Kafka (reverse direction)',
    'from("pulsar:persistent://eip/shipping/dispatched" +',
    '     "?subscriptionName=kafka-bridge&subscriptionType=Shared")',
    '    .routeId("pulsar-to-kafka-bridge")',
    '    .setHeader("kafka.KEY", header("shipmentId"))',
    '    .to("kafka:eip.shipping.dispatched");',
  ], "Figure 3.8 — Bidirectional messaging bridge between Kafka and Pulsar");
  addNotes(s, "Here is the messaging bridge implemented in Camel. The first route consumes from a Kafka topic and produces to a Pulsar topic. Notice the header mapping — Kafka headers use the kafka.* prefix which is meaningless in Pulsar, so we extract the values we need (like orderId from kafka.KEY) and remove the Kafka-specific headers. The Pulsar endpoint URI uses the persistent:// scheme with tenant/namespace/topic format. The second route goes the opposite direction — from Pulsar to Kafka. Pulsar subscriptions are named and typed; here we use a Shared subscription so multiple bridge instances can run in parallel. The bridge runs in its own consumer group (pulsar-bridge) so it does not interfere with other consumers of the orders topic. This bidirectional bridge enables mixed Kafka/Pulsar architectures common in large enterprises.");
}

// Slide 32: When to use which channel type — comparison table
{
  const s = S();
  addContentTitle(s, "CHANNEL PATTERNS", "When to Use Which Channel Type");
  addStatusTable(s, [
    { code: "P2P",      name: "Point-to-Point",   purpose: "Exactly one consumer processes each message — order processing, task queues", codeColor: COLOR.svc },
    { code: "Pub/Sub",  name: "Publish-Subscribe", purpose: "All subscribers receive every message — event notification, fan-out", codeColor: COLOR.svc },
    { code: "DLQ",      name: "Dead Letter",       purpose: "Capture unprocessable messages after retry exhaustion — error handling", codeColor: COLOR.red },
    { code: "Bridge",   name: "Messaging Bridge",  purpose: "Connect two different messaging systems — Kafka ↔ Pulsar migration", codeColor: COLOR.data },
    { code: "Adapter",  name: "Channel Adapter",   purpose: "Connect non-messaging endpoint to messaging — REST → Kafka, File → Kafka", codeColor: COLOR.data },
    { code: "Typed",    name: "Datatype Channel",  purpose: "Schema-enforced topics — Avro/JSON Schema validation at the channel level", codeColor: COLOR.platform },
    { code: "Invalid",  name: "Invalid Message",   purpose: "Route malformed/unparseable messages to a quarantine channel", codeColor: COLOR.red },
  ], { colW: [1.20, 2.60, 8.29], rowH: 0.55 });
  addNotes(s, "This table summarizes the channel patterns and when to reach for each one. Point-to-point is your default for command processing — one consumer handles each message. Publish-subscribe is for event notification where multiple services need to react. Dead letter channels are mandatory in production — every route should have one. Messaging bridges connect different messaging systems within your enterprise. Channel adapters connect non-messaging systems like REST APIs or file systems to your messaging backbone. Datatype channels enforce schema contracts at the channel level — use Avro or JSON Schema to ensure producers and consumers agree on the message format. Invalid message channels quarantine messages that cannot be parsed at all — a step before business validation, catching truly malformed payloads.");
}

// ============================================================================
// SECTION 04 — Message Construction in Code  (8 slides)
// ============================================================================

divider("04", "Message\nConstruction", "Commands, Events, Documents — as Java records",
  "Section 04 covers message construction patterns — how to design the messages themselves. We will implement commands, documents, and events as Java records, set up request-reply exchanges, use correlation identifiers for matching requests to responses, and handle message expiration. These patterns determine the contract between message producers and consumers.");

// Slide 33: Message types — diagram
{
  const s = S();
  addDiagramSlide(s, "MESSAGE CONSTRUCTION", "Message Types — Command, Document, Event", "07-message-types",
    "Figure 4.1 — The three fundamental message types in the shipping domain");
  addNotes(s, "Every message in an integration system falls into one of three categories. A Command tells a service to do something — PlaceOrder, ShipPackage, ProcessPayment. Commands have a single target consumer and expect that consumer to act on them. A Document carries data from one place to another — a full Order object, an InventorySnapshot, a CustomerProfile. Documents are informational; the sender does not prescribe what the receiver should do with them. An Event notifies interested parties that something happened — OrderPlaced, PaymentCompleted, ShipmentDispatched. Events are past tense, immutable facts. The distinction matters for channel design: commands go on point-to-point channels, events go on publish-subscribe channels, and documents can go on either depending on the use case.");
}

// Slide 34: Commands, Documents, Events as Java records
{
  const s = S();
  addCodeSlide(s, "MESSAGE CONSTRUCTION", "Commands, Documents, Events as Java Records", "Java", [
    '// Command — tells a service to DO something',
    'public record PlaceOrder(String orderId, String customerId,',
    '                          List<LineItem> items) {}',
    '',
    '// Document — carries data for information purposes',
    'public record OrderDocument(String orderId, String customerId,',
    '    List<LineItem> items, Address shippingAddress,',
    '    BigDecimal total, Instant createdAt) {}',
    '',
    '// Event — notifies that something HAPPENED (past tense)',
    'public record OrderPlaced(String orderId, Instant timestamp) {}',
    'public record PaymentCompleted(String orderId, String paymentId,',
    '                                BigDecimal amount) {}',
    'public record ShipmentDispatched(String orderId, String trackingId,',
    '                                  String carrier) {}',
  ], "Figure 4.2 — Java records enforce immutability and provide equals/hashCode/toString");
  addNotes(s, "Java records are perfect for message types. They are immutable by default — once created, a message cannot be modified, which is exactly what you want for messages flowing through a pipeline. Records auto-generate equals(), hashCode(), and toString(), which are essential for logging, deduplication, and debugging. The PlaceOrder command names an action — it tells the order service to place an order. The OrderDocument carries the full data — all fields needed to represent a complete order. The events use past tense — OrderPlaced, PaymentCompleted, ShipmentDispatched — because they represent things that already happened. Notice how the event is much smaller than the document: an event carries only identification and timestamp, not the full payload. Consumers who need the full data can look it up using the orderId.");
}

// Slide 35: Request-Reply — diagram + code
{
  const s = S();
  addDiagramSlide(s, "MESSAGE CONSTRUCTION", "Request-Reply — Synchronous Over Async", "08-request-reply",
    "Figure 4.3 — Request-reply pattern: request channel + reply channel + correlation ID");
  addNotes(s, "The request-reply pattern layers synchronous request-response semantics on top of asynchronous messaging. The requestor sends a message on the request channel with two key headers: a correlation ID (to match the reply to the request) and a reply-to address (telling the replier where to send the response). The replier processes the request and sends the response back on the reply channel, copying the correlation ID. The requestor matches incoming replies to outstanding requests using the correlation ID. In Camel, this pattern is built into the ExchangePattern — setting InOut mode automatically handles the correlation. This is essential for the Loan Broker case study where we send rate requests to multiple banks and need to match each bank's response to the original loan request.");
}

// Slide 36: Request-Reply code
{
  const s = S();
  addCodeSlide(s, "MESSAGE CONSTRUCTION", "Request-Reply — InOut Exchange Pattern", "Java", [
    '// Requestor: send a request and wait for the reply',
    'from("direct:get-credit-score")',
    '    .routeId("credit-score-request")',
    '    .setHeader("correlationId", simple("${exchangeId}"))',
    '    .setHeader("replyTo", constant("direct:credit-score-reply"))',
    '    .to(ExchangePattern.InOut, "direct:credit-bureau");',
    '',
    '// Replier: process request and return the response',
    'from("direct:credit-bureau")',
    '    .routeId("credit-bureau-replier")',
    '    .bean(CreditBureauService.class, "lookupScore")',
    '    .log("Credit score for ${header.customerId}: ${body}");',
    '',
    '// The reply is automatically routed back to the requestor',
    '// because we used ExchangePattern.InOut — Camel handles',
    '// the correlation and return path.',
  ], "Figure 4.4 — Request-reply with InOut exchange pattern and automatic correlation");
  addNotes(s, "In Camel, request-reply is remarkably simple when using the direct: component because it is synchronous in-memory. The ExchangePattern.InOut tells Camel that this is a two-way exchange — the requestor expects a response. Camel automatically handles the correlation: the exchange flows to the replier, the replier sets the body to the response, and Camel returns it to the requestor. For asynchronous request-reply over Kafka, you would set the replyTo header to a Kafka topic and use a correlation ID to match replies. The direct: version shown here is common for internal request-reply within the same application — calling a credit bureau service before deciding how to route an order. The key thing to understand is that ExchangePattern controls whether Camel expects a response or fires and forgets.");
}

// Slide 37: Correlation Identifier
{
  const s = S();
  addCodeSlide(s, "MESSAGE CONSTRUCTION", "Correlation Identifier — Matching Requests to Replies", "Java", [
    '// Setting correlation ID on outbound messages',
    'from("kafka:eip.loan.requests")',
    '    .routeId("loan-request-router")',
    '    .process(exchange -> {',
    '        String correlationId = exchange.getIn()',
    '            .getHeader("correlationId", String.class);',
    '        if (correlationId == null) {',
    '            correlationId = UUID.randomUUID().toString();',
    '            exchange.getIn().setHeader("correlationId", correlationId);',
    '        }',
    '        log.info("Processing loan request: {}", correlationId);',
    '    })',
    '    .to("kafka:eip.loan.bank-requests");',
    '',
    '// Reading correlation ID to match responses',
    'from("kafka:eip.loan.bank-responses")',
    '    .routeId("loan-response-collector")',
    '    .log("Bank response for correlation: ${header.correlationId}")',
    '    .to("direct:aggregate-bank-responses");',
  ], "Figure 4.5 — Correlation ID propagation through request and response messages");
  addNotes(s, "Correlation identifiers are the glue that holds asynchronous request-reply together. When a loan request is fanned out to multiple banks, each bank response must be matched back to the original request. We propagate the correlation ID as a message header. If the incoming message does not already have one, we generate a UUID. This same ID travels through the entire pipeline — from the initial request, to each bank, and back in each bank's response. The aggregator in the Loan Broker example uses this correlation ID as the aggregation key, collecting all bank responses that share the same ID into a single aggregate. In Kafka, headers survive the produce-consume cycle, so the correlation ID set by the producer is available to the consumer without any extra configuration.");
}

// Slide 38: Return Address
{
  const s = S();
  addKeyValueSlide(s, "MESSAGE CONSTRUCTION", "Return Address — Routing Replies Back", [
    { key: "replyTo Header", value: "The requestor sets a header telling the replier where to send the response" },
    { key: "Dynamic Channels", value: "Each requestor can specify a different reply channel — unique temp topics or direct: endpoints" },
    { key: "Camel Convention", value: "CamelReplyTo header is recognized by request-reply components (JMS, Kafka, direct)" },
    { key: "Kafka Reply Topics", value: "Use a dedicated reply topic with partition assignment — or per-requestor topics" },
    { key: "With Correlation ID", value: "Return address says WHERE to reply; correlation ID says WHICH request it answers" },
  ]);
  addNotes(s, "The return address pattern complements the correlation identifier. While the correlation ID tells the requestor which request a reply corresponds to, the return address tells the replier where to send the reply. In Camel, the CamelReplyTo header is the conventional way to specify the return address. For direct: and JMS components, Camel handles this automatically when you use InOut exchange patterns. For Kafka, you typically set a custom replyTo header with the name of a reply topic. In more sophisticated setups, each requestor instance has its own reply topic partition, so replies go directly to the right instance without needing to filter. The return address is most valuable in distributed systems where the requestor and replier are in different applications or even different data centers.");
}

// Slide 39: Message Expiration
{
  const s = S();
  addContentTitle(s, "MESSAGE CONSTRUCTION", "Message Expiration and Format Indicator");
  addBullets(s, bsub([
    { text: "Message Expiration — TTL on Kafka records", sub: "Set retention time per topic or per-message TTL to auto-expire stale messages" },
    { text: "Camel TTL headers", sub: "Check message age in routes: filter messages older than threshold before processing" },
    { text: "Format Indicator — version headers", sub: "Set a 'schemaVersion' header — consumers can route or transform based on message version" },
    { text: "Schema evolution", sub: "Version 1 → Version 2: add fields with defaults, deprecate old fields, never remove required fields" },
    { text: "Message Sequence — ordering with partition keys", sub: "Use orderId as Kafka partition key — all events for one order are in the same partition, in order" },
  ]));
  addNotes(s, "Message expiration prevents stale messages from being processed. In Kafka, you set topic-level retention to automatically delete old messages. You can also check message age in your Camel routes — if an order was placed 48 hours ago and has not been processed, it may no longer be valid. The format indicator pattern addresses schema evolution: by including a schemaVersion header, consumers can detect the message format and apply the appropriate deserialization or transformation. This is essential when evolving your message schemas over time — you might have Version 1 consumers and Version 2 consumers running simultaneously during a rolling deployment. Message sequences leverage Kafka partition keys: by using the orderId as the partition key, all events for the same order are guaranteed to be in the same partition and therefore processed in order. This is how we maintain causal ordering in the shipping domain.");
}

// Slide 40: Message sequences — ordering
{
  const s = S();
  addCodeSlide(s, "MESSAGE CONSTRUCTION", "Message Sequences — Ordering with Partition Keys", "Java", [
    '// All events for the same order go to the same partition',
    '// This guarantees causal ordering: placed → validated → paid → shipped',
    '',
    'from("direct:emit-order-event")',
    '    .routeId("order-event-emitter")',
    '    // Partition key = orderId → same partition → same order → in order',
    '    .setHeader("kafka.KEY", simple("${body.orderId}"))',
    '    .marshal().json()',
    '    .to("kafka:eip.orders.lifecycle");',
    '',
    '// Consumer sees events in order for each orderId:',
    '//   ORD-001: OrderPlaced → OrderValidated → PaymentCompleted → ShipmentDispatched',
    '//   ORD-002: OrderPlaced → OrderValidated → ...',
    '// BUT events from DIFFERENT orders may interleave.',
    '// Per-partition ordering, not global ordering.',
  ], "Figure 4.6 — Partition key-based ordering for causal event sequences");
  addNotes(s, "Message ordering is one of the most misunderstood aspects of Kafka. Kafka guarantees ordering only within a partition, not across partitions. By using the orderId as the partition key, we ensure that all events for order ORD-001 land in the same partition and are consumed in the exact order they were produced: OrderPlaced, then OrderValidated, then PaymentCompleted, then ShipmentDispatched. However, events from different orders in different partitions may be consumed in any order — ORD-002's OrderPlaced might be consumed before ORD-001's ShipmentDispatched. This is fine because the events are independent. The partition key strategy is a fundamental design decision: choose it based on what needs to be ordered together. For the shipping domain, orderId is the natural choice because all events in an order's lifecycle must be causally ordered.");
}

// ============================================================================
// SECTION 05 — Routing Patterns in Code  (15 slides)
// ============================================================================

divider("05", "Routing Patterns\nin Code", "Content-based router, splitter, aggregator, and more",
  "Section 05 is the heart of the deck — the routing patterns that determine how messages flow through your system. We implement fifteen routing patterns in Camel Java DSL: content-based router, message filter, dynamic router, recipient list, splitter, aggregator, scatter-gather, routing slip, process manager, composed message processor, message broker, and resequencer. Every code example runs in the shipping domain with real Kafka topics.");

// Slide 41: The routing problem — diagram
{
  const s = S();
  addDiagramSlide(s, "ROUTING PATTERNS", "The Routing Problem — Getting Messages to the Right Place", "09-routing-patterns",
    "Figure 5.1 — The routing problem: one input, many possible destinations");
  addNotes(s, "The routing problem is simple to state and endlessly complex in practice: a message arrives, and we need to decide where it goes. Should this order go to express processing or standard processing? Should this payment notification go to the fraud detection service? Should this inventory update be broadcast to all warehouse systems or just one? The EIP catalog defines over a dozen routing patterns, each addressing a different variant of this problem. Some patterns make static routing decisions based on message content. Others compute routing destinations dynamically at runtime. Some split a single message into many. Others aggregate many messages into one. The common thread is that the routing logic is separated from the processing logic — the router does not process the message; it just decides where it goes.");
}

// Slide 42: Content-Based Router
{
  const s = S();
  addCodeSlide(s, "ROUTING PATTERNS", "Content-Based Router — choice() with Predicates", "Java", [
    'from("kafka:eip.orders.placed")',
    '    .routeId("order-content-router")',
    '    .unmarshal().json(Order.class)',
    '    .choice()',
    '        .when(jsonpath("$.priority").isEqualTo("HIGH"))',
    '            .log("Express: ${body.orderId}")',
    '            .to("direct:express-processing")',
    '        .when(jsonpath("$.total").isGreaterThan(1000))',
    '            .log("Large order review: ${body.orderId}")',
    '            .to("direct:large-order-review")',
    '        .when(simple("${body.items.size()} > 10"))',
    '            .to("direct:bulk-processing")',
    '        .otherwise()',
    '            .to("direct:standard-processing")',
    '    .end();',
  ], "Figure 5.2 — Content-based routing with multiple predicates and an otherwise clause");
  addNotes(s, "The content-based router is probably the most-used routing pattern. Camel implements it with the choice() DSL method, which creates an if-else-if chain based on message content. Each when() clause evaluates a predicate against the message. Here we check three conditions in order: is the priority HIGH? Is the total greater than 1000? Are there more than 10 items? The first matching predicate wins. The otherwise() clause catches everything that did not match any condition — always include an otherwise() to avoid silently dropping messages. Notice the three different expression languages: jsonpath for navigating JSON structures, simple for Camel's built-in expression language, and Java method calls. In production, keep the predicates simple and the number of branches manageable — if you have more than five or six branches, consider a dynamic router instead.");
}

// Slide 43: Message Filter
{
  const s = S();
  addCodeSlide(s, "ROUTING PATTERNS", "Message Filter — Dropping Unwanted Messages", "Java", [
    '// Filter: only process orders from the US region',
    'from("kafka:eip.orders.placed")',
    '    .routeId("us-order-filter")',
    '    .unmarshal().json(Order.class)',
    '    .filter(simple("${body.region} == \'US\'"))',
    '        .log("US order accepted: ${body.orderId}")',
    '        .to("direct:us-order-processing")',
    '    .end();',
    '',
    '// Filter with custom predicate (bean method)',
    'from("kafka:eip.orders.placed")',
    '    .routeId("fraud-filter")',
    '    .filter().method(FraudDetector.class, "isLegitimate")',
    '        .to("direct:process-legitimate-order")',
    '    .end();',
    '',
    '// Messages that don\'t match the filter are silently dropped.',
  ], "Figure 5.3 — Message filter with Simple expression and bean predicate");
  addNotes(s, "The message filter is a special case of the content-based router where there are only two outcomes: the message passes the filter and continues, or it is silently dropped. In the first example, we filter for US region orders — only US orders proceed to processing. Non-US orders are simply discarded. In the second example, we delegate the filter decision to a CDI bean — the FraudDetector's isLegitimate method returns a boolean that determines whether the message continues. Bean-based predicates are powerful for complex business logic that does not fit neatly into a Simple expression. The .end() call is important — it marks the end of the filter block, so any steps after .end() would process all messages regardless of the filter result. Without .end(), subsequent steps would only process filtered messages.");
}

// Slide 44: Dynamic Router
{
  const s = S();
  addCodeSlide(s, "ROUTING PATTERNS", "Dynamic Router — Runtime-Computed Destinations", "Java", [
    '// Dynamic Router: routing destination computed at runtime',
    'from("kafka:eip.orders.placed")',
    '    .routeId("dynamic-order-router")',
    '    .dynamicRouter(method(OrderRoutingBean.class, "route"));',
    '',
    '@ApplicationScoped',
    'public class OrderRoutingBean {',
    '    public String route(@Body Order order,',
    '                        @ExchangeProperties Map<String, Object> props) {',
    '        // Return null to stop routing (required!)',
    '        if (props.containsKey("routed")) return null;',
    '        props.put("routed", true);',
    '',
    '        // Compute destination based on runtime state',
    '        if (order.requiresCustoms())',
    '            return "direct:customs-processing";',
    '        if (inventoryService.isBackordered(order))',
    '            return "direct:backorder-handling";',
    '        return "direct:standard-fulfillment";',
    '    }',
    '}',
  ], "Figure 5.4 — Dynamic router with bean-based routing decisions");
  addNotes(s, "The dynamic router computes the destination at runtime, potentially calling external services or querying databases to make the decision. Unlike the content-based router where destinations are hardcoded in the route definition, the dynamic router delegates to a bean that can implement arbitrarily complex logic. The critical thing to understand is the iteration protocol: Camel calls the routing bean repeatedly until it returns null. Each call can return a different destination, allowing multi-step dynamic routing. If you forget to return null, you get an infinite loop — which is why the 'routed' property guard is essential. In this example, we check two runtime conditions: does the order require customs processing (which might involve a rules engine), and is it backordered (which requires an inventory service call). This pattern is ideal when routing logic depends on external state that cannot be evaluated with simple predicates.");
}

// Slide 45: Recipient List
{
  const s = S();
  addCodeSlide(s, "ROUTING PATTERNS", "Recipient List — One Message, Multiple Destinations", "Java", [
    '// Recipient List: send to multiple destinations computed at runtime',
    'from("kafka:eip.notifications.pending")',
    '    .routeId("notification-recipient-list")',
    '    .recipientList(method(NotificationRouter.class, "route"))',
    '    .parallelProcessing()',
    '    .stopOnException();',
    '',
    '@ApplicationScoped',
    'public class NotificationRouter {',
    '    public String[] route(@Body Notification notification) {',
    '        List<String> destinations = new ArrayList<>();',
    '        if (notification.emailEnabled())',
    '            destinations.add("direct:send-email");',
    '        if (notification.smsEnabled())',
    '            destinations.add("direct:send-sms");',
    '        if (notification.pushEnabled())',
    '            destinations.add("direct:send-push");',
    '        return destinations.toArray(String[]::new);',
    '    }',
    '}',
  ], "Figure 5.5 — Recipient list with bean-computed destinations and parallel processing");
  addNotes(s, "The recipient list sends a single message to multiple destinations. Unlike multicast, which sends to a fixed set of destinations, the recipient list computes the destination list dynamically for each message. Here, the NotificationRouter bean determines which notification channels are enabled for this particular notification — email, SMS, push, or any combination. The parallelProcessing() modifier means all channels are notified concurrently rather than sequentially, reducing latency. stopOnException() means if one channel fails, the remaining channels are not attempted — you might want to remove this if channels should be independent. The bean returns a String array of endpoint URIs. This pattern is perfect for notification fan-out, where different customers have different notification preferences. The recipient list is also used heavily in the Loan Broker example to fan requests out to different banks.");
}

// Slide 46: Splitter
{
  const s = S();
  addCodeSlide(s, "ROUTING PATTERNS", "Splitter — Breaking Composite Messages Apart", "Java", [
    '// Splitter: split an order into individual line items',
    'from("kafka:eip.orders.validated")',
    '    .routeId("order-item-splitter")',
    '    .unmarshal().json(Order.class)',
    '    .split(simple("${body.items}"))',
    '        .log("Processing item: ${body.productId} x ${body.quantity}")',
    '        .bean(InventoryChecker.class, "checkAvailability")',
    '        .choice()',
    '            .when(simple("${body.available}"))',
    '                .to("direct:reserve-inventory")',
    '            .otherwise()',
    '                .to("direct:backorder-item")',
    '        .end()',
    '    .end()',
    '    .log("All items processed for order: ${header.orderId}");',
    '',
    '// After .end() of split, we are back to the original message.',
  ], "Figure 5.6 — Splitter decomposing an order into line items for individual processing");
  addNotes(s, "The splitter breaks a composite message into individual pieces. Here, an order containing multiple line items is split so each item can be processed independently — checked for availability, reserved, or backordered. Camel's split() method accepts an expression that evaluates to an iterable. The simple expression ${body.items} accesses the items list on the Order object. Inside the split block, each sub-message has its body set to a single LineItem. You can nest other patterns inside the split — here we have a content-based router that checks availability. After the closing .end(), the route returns to the original unsplit message. This is the composed message processor pattern in miniature: split, route each piece, then continue with the original. For large orders with many items, add .parallelProcessing() to process items concurrently across threads.");
}

// Slide 47: Aggregator — diagram
{
  const s = S();
  addDiagramSlide(s, "ROUTING PATTERNS", "Aggregator — Combining Multiple Messages", "13-aggregator",
    "Figure 5.7 — Aggregator: correlation → accumulation → completion → output");
  addNotes(s, "The aggregator is the complement of the splitter — it combines multiple related messages into a single message. The aggregation process has three phases: correlation (which messages belong together), accumulation (how to merge them), and completion (when the aggregate is done). Correlation is done by a correlation expression — typically a message header or body field. Accumulation is defined by an AggregationStrategy — a Java interface you implement to specify how two messages merge. Completion can be based on size (got all N pieces), timeout (waited long enough), or a predicate (a specific condition is met). The diagram shows messages arriving with the same correlation ID being collected into a bucket, and when the completion condition triggers, the aggregate is released for downstream processing.");
}

// Slide 48: Aggregator — code
{
  const s = S();
  addCodeSlide(s, "ROUTING PATTERNS", "Aggregator — AggregationStrategy and Completion", "Java", [
    'from("kafka:eip.inventory.checks")',
    '    .routeId("inventory-aggregator")',
    '    .aggregate(header("orderId"), new InventoryAggregationStrategy())',
    '        .completionSize(header("expectedItems"))',
    '        .completionTimeout(30_000)',
    '        .to("direct:all-items-checked");',
    '',
    'public class InventoryAggregationStrategy',
    '        implements AggregationStrategy {',
    '    @Override',
    '    public Exchange aggregate(Exchange oldExchange,',
    '                              Exchange newExchange) {',
    '        if (oldExchange == null) return newExchange;',
    '        List<ItemStatus> items = oldExchange.getIn()',
    '            .getBody(List.class);',
    '        items.add(newExchange.getIn().getBody(ItemStatus.class));',
    '        oldExchange.getIn().setBody(items);',
    '        return oldExchange;',
    '    }',
    '}',
  ], "Figure 5.8 — Aggregator with size-based and timeout-based completion");
  addNotes(s, "This code shows a complete aggregator implementation. The aggregate() method takes two arguments: a correlation expression (header orderId groups messages by order) and an AggregationStrategy that defines how messages are combined. The InventoryAggregationStrategy accumulates ItemStatus objects into a list — the first message initializes the exchange (oldExchange is null), and subsequent messages add their payloads to the growing list. Completion has two conditions: completionSize waits until we have received the expected number of items (read from a header), and completionTimeout ensures we do not wait forever — after 30 seconds, the aggregate is released even if not all items have arrived. This dual completion strategy is critical for reliability: you do not want an aggregator to hold messages indefinitely if one upstream producer fails to send.");
}

// Slide 49: Scatter-Gather — diagram
{
  const s = S();
  addDiagramSlide(s, "ROUTING PATTERNS", "Scatter-Gather — Fan Out and Collect", "10-scatter-gather",
    "Figure 5.9 — Scatter-gather: broadcast request → collect responses → select best");
  addNotes(s, "Scatter-gather is a compound pattern that combines recipient list (or multicast) with aggregator. The scatter phase sends the same request to multiple providers — think of requesting shipping rates from multiple carriers. The gather phase collects all responses and selects the best one. In our shipping domain, the scatter-gather pattern is used to get the best shipping rate: we send a rate request to FedEx, UPS, and USPS simultaneously, collect all three responses, and pick the cheapest. The diagram shows the fan-out broadcast on the left, the multiple responses converging in the middle, and the aggregated result on the right. This is one of the most powerful compound patterns in the EIP catalog, and it appears prominently in the Loan Broker case study.");
}

// Slide 50: Scatter-Gather — code
{
  const s = S();
  addCodeSlide(s, "ROUTING PATTERNS", "Scatter-Gather — Multicast + Aggregate Best Rate", "Java", [
    '// Scatter-Gather: query multiple carriers, pick best rate',
    'from("direct:get-shipping-rate")',
    '    .routeId("scatter-gather-rates")',
    '    .multicast(new BestRateStrategy())',
    '        .parallelProcessing()',
    '        .timeout(5000)',
    '        .to("direct:fedex-rate",',
    '            "direct:ups-rate",',
    '            "direct:usps-rate")',
    '    .end()',
    '    .log("Best rate: ${body.carrier} @ $${body.rate}");',
    '',
    'public class BestRateStrategy implements AggregationStrategy {',
    '    public Exchange aggregate(Exchange old, Exchange curr) {',
    '        if (old == null) return curr;',
    '        ShippingRate oldRate = old.getIn().getBody(ShippingRate.class);',
    '        ShippingRate newRate = curr.getIn().getBody(ShippingRate.class);',
    '        return newRate.rate() < oldRate.rate() ? curr : old;',
    '    }',
    '}',
  ], "Figure 5.10 — Scatter-gather with multicast, parallel processing, and best-rate selection");
  addNotes(s, "Here is scatter-gather implemented in Camel. The multicast() DSL method fans the request out to three carrier rate endpoints simultaneously. The BestRateStrategy is the aggregation logic that runs as each response comes back — it compares rates and keeps the cheaper one. parallelProcessing() means all three requests go out concurrently. The timeout(5000) is critical: if one carrier takes more than five seconds to respond, we proceed without it rather than blocking forever. The .end() closes the multicast block, and by that point the body contains the single best rate selected by the strategy. This exact pattern is used in the Loan Broker case study — instead of shipping carriers, it queries banks for loan rates. The key design decision is the AggregationStrategy: best-rate, lowest-latency, first-response, or even a weighted scoring function.");
}

// Slide 51: Routing Slip
{
  const s = S();
  addCodeSlide(s, "ROUTING PATTERNS", "Routing Slip — Header-Based Step List", "Java", [
    '// Routing Slip: steps are defined in a header, not in the route',
    'from("kafka:eip.orders.placed")',
    '    .routeId("order-routing-slip")',
    '    .bean(OrderWorkflowPlanner.class, "computeSteps")',
    '    .routingSlip(header("routingSteps"));',
    '',
    '@ApplicationScoped',
    'public class OrderWorkflowPlanner {',
    '    public void computeSteps(@Body Order order,',
    '                             @Headers Map<String, Object> headers) {',
    '        List<String> steps = new ArrayList<>();',
    '        steps.add("direct:validate-address");',
    '        if (order.requiresFraudCheck())',
    '            steps.add("direct:fraud-check");',
    '        if (order.isInternational())',
    '            steps.add("direct:customs-declaration");',
    '        steps.add("direct:calculate-shipping");',
    '        steps.add("direct:finalize-order");',
    '        headers.put("routingSteps", String.join(",", steps));',
    '    }',
    '}',
  ], "Figure 5.11 — Routing slip with dynamically computed step list");
  addNotes(s, "The routing slip pattern processes a message through a sequence of steps that are determined at runtime and stored in the message itself. Unlike the content-based router where the route definition contains the logic, the routing slip separates the routing computation from the route execution. The OrderWorkflowPlanner bean computes the processing steps based on the order's characteristics — every order gets address validation and shipping calculation, but only international orders get customs declaration, and only suspicious orders get fraud checks. The steps are stored as a comma-separated list of endpoint URIs in the routingSteps header. The routingSlip() DSL method reads this header and processes the message through each step in order. This pattern is powerful for workflows where different messages need different processing pipelines, and the steps are not known until the message is examined.");
}

// Slide 52: Process Manager — saga
{
  const s = S();
  addPatternCard(s, "ROUTING PATTERNS", "Process Manager — Stateful Routing with Saga",
    "process-manager",
    "Multi-step workflows require coordination across services. Each step may need to be undone if a later step fails. Without a process manager, partial failures leave the system in an inconsistent state — inventory reserved but payment never charged.",
    "The Camel Saga pattern coordinates multi-step workflows without two-phase commit. Each step defines a compensation action: reserve inventory → charge payment → ship order. On failure, compensations fire automatically (release inventory, refund payment). Saga state persists in PostgreSQL to survive restarts."
  );
  addNotes(s, "The process manager is the most complex routing pattern. It maintains state across multiple processing steps and handles compensations when steps fail. In traditional distributed systems, you would use two-phase commit — but that does not work with messaging systems. Instead, Camel's saga pattern implements the Saga pattern from microservices: each step defines a compensation action that undoes its work. If the payment step succeeds but the shipping step fails, the saga automatically invokes the payment compensation (refund) and the inventory compensation (release reservation). The saga state is persisted to PostgreSQL so it survives application restarts. This is essential for long-running workflows that might span minutes or hours. The process manager pattern appears in our shipping domain for the full order fulfillment workflow: reserve → pay → ship, with compensations at each step.");
}

// Slide 53: Composed Message Processor
{
  const s = S();
  addFlowSlide(s, "ROUTING PATTERNS", "Composed Message Processor — Split, Route, Aggregate", [
    { label: "Split", desc: "Decompose composite message into parts\n\n.split(simple('${body.items}'))" },
    { label: "Route", desc: "Each piece is routed independently via content-based router" },
    { label: "Process", desc: "Individual processing per piece — warehouse lookup, validation" },
    { label: "Aggregate", desc: "Reassemble results with AggregationStrategy — automatic after split" },
  ]);
  addNotes(s, "The composed message processor is a pattern that combines three other patterns: splitter, router, and aggregator. It is so common that Camel provides a shortcut — the split() method accepts an AggregationStrategy parameter that automatically aggregates the results after all split pieces have been processed. The canonical example is order processing: an order with five line items is split into five individual messages, each routed to the appropriate warehouse based on product category, and then the fulfillment results are aggregated back into a single order status. Without this compound pattern, you would need to wire up the splitter, router, and aggregator separately with correlation and completion logic. With Camel's built-in support, it is a single split() call with a strategy parameter.");
}

// Slide 54: Message Broker
{
  const s = S();
  addContentTitle(s, "ROUTING PATTERNS", "Message Broker — Centralized Routing with direct/seda");
  addBullets(s, bsub([
    { text: "Centralized routing hub", sub: "A single route that receives messages and dispatches them to the right destination" },
    { text: "direct: for synchronous dispatch", sub: "Same-thread call — the sender waits for the destination to complete" },
    { text: "seda: for asynchronous dispatch", sub: "In-memory queue — the sender continues immediately, destination processes later" },
    { text: "Decouples producers from consumers", sub: "Producers send to the broker; the broker decides where messages go" },
    { text: "Useful for internal application routing", sub: "Not a replacement for Kafka — use for intra-application message routing" },
    { text: "Combines with content-based router", sub: "The broker IS a content-based router — choice() dispatches to typed endpoints" },
  ]));
  addNotes(s, "The message broker pattern creates a centralized routing hub within your application. In Camel, the direct: and seda: components implement synchronous and asynchronous in-memory endpoints. A typical message broker route consumes from a well-known endpoint like direct:incoming-messages, examines each message, and dispatches it to the appropriate processing route. The difference between direct: and seda: is threading: direct: runs synchronously in the caller's thread, while seda: queues the message and processes it in a separate thread. This distinction matters for error handling — with direct:, exceptions propagate back to the caller; with seda:, they do not. Use the message broker pattern for intra-application routing where messages need to be dispatched based on content. For inter-application routing, Kafka topics with consumer groups are the right choice.");
}

// Slide 55: Resequencer — diagram
{
  const s = S();
  addDiagramSlide(s, "ROUTING PATTERNS", "Resequencer — Restoring Message Order", "11-resequencer",
    "Figure 5.11 — Resequencer restores out-of-order messages by sequence number");
  addNotes(s, "The resequencer pattern restores message order when messages arrive out of sequence. Two flavors: the stream resequencer uses a sliding window for continuous flows — it holds messages briefly and releases them in order as the window advances. The batch resequencer collects a fixed number of messages, sorts them, and releases the sorted batch. In our shipping domain, tracking updates from multiple carriers arrive at different speeds, producing out-of-order events. The resequencer ensures the tracking timeline is presented in chronological order.");
}

// Slide 56: Resequencer — code
{
  const s = S();
  addCodeSlide(s, "ROUTING PATTERNS", "Resequencer — Restoring Message Order", "Java", [
    '// Stream Resequencer: reorder out-of-sequence messages',
    '// Uses a sliding window to detect and correct ordering',
    '',
    'from("kafka:eip.shipment.tracking")',
    '    .routeId("tracking-resequencer")',
    '    .resequence(header("sequenceNumber"))',
    '        .stream()',
    '        .timeout(5000)',
    '        .deliveryAttemptInterval(1000)',
    '        .capacity(100)',
    '    .to("direct:process-tracking-update");',
    '',
    '// Batch Resequencer: collect all messages, sort, release',
    'from("kafka:eip.batch.items")',
    '    .routeId("batch-resequencer")',
    '    .resequence(header("sequenceNumber"))',
    '        .batch()',
    '        .size(50)',
    '        .timeout(10000)',
    '    .to("direct:process-sorted-batch");',
  ], "Figure 5.12 — Stream and batch resequencer for restoring message order");
  addNotes(s, "The resequencer restores message order when messages arrive out of sequence. Camel provides two resequencer implementations: stream and batch. The stream resequencer uses a sliding window — it waits for a configurable timeout and releases messages in order as the window advances. This is suitable for continuous streams where messages might arrive slightly out of order. The batch resequencer collects a fixed number of messages, sorts them, and releases the sorted batch. The capacity parameter limits memory usage for the stream resequencer. In our shipping domain, tracking updates from carriers might arrive out of order because different carriers have different processing speeds. The resequencer ensures the tracking timeline is presented in chronological order. The sequenceNumber header must be set by the producer — Camel does not infer sequence from message content.");
}

// Slide 56: Routing patterns comparison table
{
  const s = S();
  addContentTitle(s, "ROUTING PATTERNS", "Routing Patterns — Comparison Table");
  addStatusTable(s, [
    { code: "CBR",       name: "Content-Based Router",    purpose: "choice() — static routing based on message content predicates", codeColor: COLOR.svc },
    { code: "Filter",    name: "Message Filter",          purpose: "filter() — drop messages that don't match a predicate", codeColor: COLOR.svc },
    { code: "Dynamic",   name: "Dynamic Router",          purpose: "dynamicRouter() — runtime-computed single destination", codeColor: COLOR.svc },
    { code: "RecipList",  name: "Recipient List",         purpose: "recipientList() — runtime-computed multiple destinations", codeColor: COLOR.data },
    { code: "Split",     name: "Splitter",                purpose: "split() — decompose composite message into parts", codeColor: COLOR.data },
    { code: "Agg",       name: "Aggregator",              purpose: "aggregate() — combine multiple messages into one", codeColor: COLOR.data },
    { code: "S-G",       name: "Scatter-Gather",          purpose: "multicast() + AggregationStrategy — fan-out and collect", codeColor: COLOR.platform },
    { code: "Slip",      name: "Routing Slip",            purpose: "routingSlip() — header-defined step sequence", codeColor: COLOR.platform },
    { code: "Reseq",     name: "Resequencer",             purpose: "resequence() — restore out-of-order messages", codeColor: COLOR.platform },
  ], { colW: [1.30, 2.80, 7.99], rowH: 0.48 });
  addNotes(s, "This table is your quick reference for choosing the right routing pattern. Content-based router is your go-to for static if-else routing. Message filter is a simpler variant when you just need to drop unwanted messages. Dynamic router handles cases where routing depends on external state or complex computation. Recipient list fans out to multiple destinations computed at runtime. Splitter breaks apart composite messages. Aggregator collects related messages. Scatter-gather combines fan-out with collection — query multiple providers and pick the best response. Routing slip defines the processing pipeline in the message itself. Resequencer fixes ordering issues. In practice, you will combine these patterns — the composed message processor is split + route + aggregate, and scatter-gather is multicast + aggregate. The Camel Java DSL makes these compositions natural with its fluent builder API.");
}

// ============================================================================
// SECTION 06 — Transformation in Code  (12 slides)
// ============================================================================

divider("06", "Transformation\nin Code", "Translators, enrichers, claim checks, normalizers",
  "Section 06 implements the message transformation patterns. These patterns modify messages as they flow through routes — translating between formats, enriching with external data, filtering sensitive content, and normalizing disparate inputs into a canonical model. Transformation is where the impedance mismatch between different systems gets resolved.");

// Slide 57: Why transformation — diagram
{
  const s = S();
  addDiagramSlide(s, "TRANSFORMATION", "Why Transformation — Bridging Format Gaps", "12-transformation-flow",
    "Figure 6.1 — Transformation flow: external formats → canonical model → consumer formats");
  addNotes(s, "Transformation is necessary because different systems speak different data languages. An external partner might send orders in XML with their own field naming conventions. Your internal services expect JSON with your canonical field names. Your analytics pipeline wants Avro for efficient columnar storage. The transformation flow has three layers: inbound translation from external formats to your canonical model, internal processing in the canonical format, and outbound translation from canonical to whatever each downstream consumer expects. The diagram shows this three-layer architecture. Getting transformation right is critical for system maintainability — without a canonical model, you end up with N-squared format translations between N systems. With a canonical model, you need only N inbound translators and N outbound translators.");
}

// Slide 58: Message Translator — code
{
  const s = S();
  addCodeSlide(s, "TRANSFORMATION", "Message Translator — Format Conversion", "Java", [
    '// Message Translator: convert external format to canonical model',
    'from("kafka:eip.orders.external")',
    '    .routeId("order-translator")',
    '    .unmarshal().json(ExternalOrder.class)',
    '    .bean(OrderTranslator.class, "toCanonical")',
    '    .marshal().json()',
    '    .to("kafka:eip.orders.canonical");',
    '',
    '@ApplicationScoped',
    'public class OrderTranslator {',
    '    public Order toCanonical(ExternalOrder ext) {',
    '        return new Order(',
    '            "ORD-" + ext.referenceNumber(),',
    '            ext.buyerId(),',
    '            ext.lineItems().stream()',
    '                .map(li -> new LineItem(li.sku(), li.qty(),',
    '                    li.unitPrice()))',
    '                .toList(),',
    '            mapAddress(ext.deliveryAddress()));',
    '    }',
    '}',
  ], "Figure 6.2 — Message translator converting external order format to canonical Order");
  addNotes(s, "The message translator converts messages from one format to another. This is the most common transformation pattern — every integration boundary requires translation. Here we consume from a topic that receives orders in an external partner's format, unmarshal the JSON into an ExternalOrder record, and then use a translator bean to convert it to our canonical Order record. The translator maps field names (referenceNumber → orderId, buyerId → customerId), transforms nested structures (external line items to canonical LineItems), and converts addresses. The translated Order is marshaled back to JSON and produced to the canonical orders topic. Note that the translator is a pure function — no side effects, easy to unit test. In practice, you will have one translator per external partner, all producing the same canonical output format.");
}

// Slide 59: Envelope Wrapper
{
  const s = S();
  addCodeSlide(s, "TRANSFORMATION", "Envelope Wrapper — Wrapping for Transport", "Java", [
    '// Envelope Wrapper: wrap the business payload in transport metadata',
    'from("direct:wrap-for-transport")',
    '    .routeId("envelope-wrapper")',
    '    .process(exchange -> {',
    '        Object payload = exchange.getIn().getBody();',
    '        Map<String, Object> envelope = new LinkedHashMap<>();',
    '        envelope.put("messageId", UUID.randomUUID().toString());',
    '        envelope.put("timestamp", Instant.now().toString());',
    '        envelope.put("source", "order-service");',
    '        envelope.put("schemaVersion", "2.0");',
    '        envelope.put("contentType", "application/json");',
    '        envelope.put("payload", payload);',
    '        exchange.getIn().setBody(envelope);',
    '    })',
    '    .marshal().json()',
    '    .to("kafka:eip.outbound.messages");',
    '',
    '// Unwrap at the consumer side:',
    '//   .unmarshal().json(Map.class)',
    '//   .transform(simple("${body[payload]}"))',
  ], "Figure 6.3 — Envelope wrapper adding transport metadata around the business payload");
  addNotes(s, "The envelope wrapper pattern adds transport metadata around the actual business payload. The envelope includes fields that the messaging infrastructure needs but the business logic does not care about: a unique message ID for deduplication, a timestamp for expiration checks, the source system for auditing, a schema version for format negotiation, and the content type for deserialization. The consumer unwraps the envelope to extract the payload before processing. This pattern is essential when messages cross organizational boundaries — the envelope carries the metadata that allows the receiving system to validate, route, and process the message correctly without coupling to the business payload structure. In our implementation, we build the envelope as a Map and serialize it to JSON. In a more sophisticated setup, you might use a dedicated Envelope record class.");
}

// Slide 60: Content Enricher — code
{
  const s = S();
  addCodeSlide(s, "TRANSFORMATION", "Content Enricher — Adding External Data", "Java", [
    '// Content Enricher: enrich order with customer details',
    'from("kafka:eip.orders.validated")',
    '    .routeId("order-enricher")',
    '    .enrich("direct:lookup-customer", new CustomerEnrichStrategy())',
    '    .enrich("direct:lookup-inventory", new InventoryEnrichStrategy())',
    '    .to("kafka:eip.orders.enriched");',
    '',
    'public class CustomerEnrichStrategy implements AggregationStrategy {',
    '    public Exchange aggregate(Exchange original, Exchange resource) {',
    '        Order order = original.getIn().getBody(Order.class);',
    '        Customer customer = resource.getIn().getBody(Customer.class);',
    '        EnrichedOrder enriched = new EnrichedOrder(',
    '            order, customer.name(), customer.tier(),',
    '            customer.shippingPreference());',
    '        original.getIn().setBody(enriched);',
    '        return original;',
    '    }',
    '}',
  ], "Figure 6.4 — Content enricher with chained enrichment calls and aggregation strategies");
  addNotes(s, "The content enricher adds data from an external source to the message. Here, we enrich a validated order with customer details and inventory availability. The enrich() DSL method sends the current exchange to a resource endpoint (direct:lookup-customer) and then uses an AggregationStrategy to merge the resource response back into the original message. The CustomerEnrichStrategy takes the original order and the customer lookup result, combines them into an EnrichedOrder, and returns the merged exchange. Notice the chaining — we enrich twice, first with customer data and then with inventory data. Each enrichment call goes to a different service endpoint. The AggregationStrategy is the key design point: it controls exactly how the enrichment data merges with the original. You could add fields, replace values, or build a completely new object. This pattern is used in the Loan Broker to enrich loan requests with credit scores.");
}

// Slide 61: Content Filter — code
{
  const s = S();
  addCodeSlide(s, "TRANSFORMATION", "Content Filter — Removing Sensitive Fields", "Java", [
    '// Content Filter: strip sensitive data before external transmission',
    'from("kafka:eip.orders.enriched")',
    '    .routeId("pii-content-filter")',
    '    .unmarshal().json(EnrichedOrder.class)',
    '    .bean(PiiFilter.class, "removeSensitiveFields")',
    '    .marshal().json()',
    '    .to("kafka:eip.orders.external-safe");',
    '',
    '@ApplicationScoped',
    'public class PiiFilter {',
    '    public FilteredOrder removeSensitiveFields(EnrichedOrder order) {',
    '        return new FilteredOrder(',
    '            order.orderId(),',
    '            order.items(),',
    '            order.total(),',
    '            // Redact PII fields',
    '            maskEmail(order.customerEmail()),',
    '            "***-**-" + order.taxId().substring(7));',
    '    }',
    '}',
  ], "Figure 6.5 — Content filter removing PII before external transmission");
  addNotes(s, "The content filter is the inverse of the content enricher — it removes data from the message. The most common use case is stripping personally identifiable information (PII) before sending messages to external systems or analytics pipelines. Here, we filter enriched orders to remove or mask sensitive fields: customer email is masked and tax ID is redacted to show only the last four digits. The PiiFilter bean transforms the EnrichedOrder into a FilteredOrder that contains only the fields safe for external transmission. This pattern is critical for GDPR compliance and data minimization — you should never send more data than the downstream system needs. In Camel, the content filter is typically implemented as a bean transformation, but you could also use Camel's transform() DSL with JSONPath or XPath to remove specific fields from structured data.");
}

// Slide 62: Claim Check — Redis store/retrieve
{
  const s = S();
  addCodeSlide(s, "TRANSFORMATION", "Claim Check — Redis Store and Retrieve", "Java", [
    '// Claim Check: store large payload in Redis, pass claim key through route',
    '',
    '// Store (check in) — before Kafka transit',
    'from("direct:check-in-payload")',
    '    .routeId("claim-check-store")',
    '    .process(exchange -> {',
    '        String claimKey = "claim:" + UUID.randomUUID();',
    '        String payload = exchange.getIn().getBody(String.class);',
    '        redisTemplate.opsForValue().set(claimKey, payload,',
    '            Duration.ofHours(24));',
    '        exchange.getIn().setBody(claimKey);',
    '    })',
    '    .to("kafka:eip.orders.claims");',
    '',
    '// Retrieve (check out) — at the consumer',
    'from("kafka:eip.orders.claims")',
    '    .routeId("claim-check-retrieve")',
    '    .process(exchange -> {',
    '        String claimKey = exchange.getIn().getBody(String.class);',
    '        String payload = redisTemplate.opsForValue().get(claimKey);',
    '        exchange.getIn().setBody(payload);',
    '    })',
    '    .to("direct:process-full-order");',
  ], "Figure 6.6 — Claim check pattern using Redis for large payload storage");
  addNotes(s, "The claim check pattern solves the large message problem. Kafka has a default maximum message size of 1MB, and even when you increase it, large messages degrade performance across the cluster. The claim check splits the flow: the large payload is stored in Redis with a unique claim key, and only the claim key travels through Kafka. At the consumer side, the claim key is used to retrieve the full payload from Redis. The Redis entry has a 24-hour TTL to prevent unbounded storage growth. This pattern is essential when order documents include base64-encoded attachments, large product catalogs, or binary data. The claim check also improves Kafka throughput — small messages serialize, compress, and replicate much faster than large ones. In production, you would add error handling for Redis unavailability and claim key expiration.");
}

// Slide 63: Normalizer
{
  const s = S();
  addCodeSlide(s, "TRANSFORMATION", "Normalizer — Multiple Formats to One Canonical Model", "Java", [
    '// Normalizer: accept orders from multiple sources, normalize to canonical',
    'from("kafka:eip.orders.partner-a")',
    '    .routeId("partner-a-normalizer")',
    '    .unmarshal().json(PartnerAOrder.class)',
    '    .bean(PartnerATranslator.class, "toCanonical")',
    '    .to("direct:normalized-orders");',
    '',
    'from("kafka:eip.orders.partner-b")',
    '    .routeId("partner-b-normalizer")',
    '    .unmarshal().json(PartnerBOrder.class)',
    '    .bean(PartnerBTranslator.class, "toCanonical")',
    '    .to("direct:normalized-orders");',
    '',
    '// Normalized pipeline — format-agnostic processing',
    'from("direct:normalized-orders")',
    '    .routeId("normalized-pipeline")',
    '    .marshal().json()',
    '    .to("kafka:eip.orders.canonical");',
  ], "Figure 6.7 — Normalizer: multiple partner formats converging to canonical model");
  addNotes(s, "The normalizer pattern is a content-based router combined with a set of message translators. Each input format gets its own translation route that converts to the canonical model, and all translations converge on a single processing pipeline. Here, Partner A and Partner B send orders in their own formats to dedicated Kafka topics. Each partner's normalizer route deserializes the partner-specific format, translates it to the canonical Order record, and sends it to the shared direct:normalized-orders endpoint. From that point forward, all processing is format-agnostic — the downstream routes work exclusively with the canonical model. This is far more maintainable than putting format-detection logic into every processing route. When Partner C comes along, you add one translator — the rest of the pipeline is untouched.");
}

// Slide 64: Canonical Data Model — code
{
  const s = S();
  addCodeSlide(s, "TRANSFORMATION", "Canonical Data Model — The Shared Domain Records", "Java", [
    '// Canonical domain model — shared across all services',
    '// Located in examples/domain-model module',
    '',
    'public record Order(String orderId, String customerId,',
    '    List<LineItem> items, Address shippingAddress,',
    '    BigDecimal total, OrderStatus status, Instant createdAt) {}',
    '',
    'public record LineItem(String productId, int quantity,',
    '    BigDecimal unitPrice) {}',
    '',
    'public record Payment(String paymentId, String orderId,',
    '    BigDecimal amount, PaymentMethod method, Instant paidAt) {}',
    '',
    'public record Shipment(String shipmentId, String orderId,',
    '    String carrier, String trackingId, Instant dispatchedAt) {}',
    '',
    'public record Notification(String notificationId, String orderId,',
    '    String channel, String recipient, String message) {}',
  ], "Figure 6.8 — Five canonical records in the shared domain-model module");
  addNotes(s, "The canonical data model is the shared vocabulary of your integration system. These five Java records — Order, LineItem, Payment, Shipment, and Notification — are used by every service in the shipping domain. They live in a shared domain-model Maven module that each Quarkus service depends on. Using records guarantees immutability and provides automatic equals(), hashCode(), and toString() implementations. The canonical model eliminates format translation between internal services — they all speak the same language. External systems translate to and from the canonical model at the boundary. The model is deliberately kept small and flat — no deep object graphs, no optional fields that are sometimes null. Every field is required and meaningful. This simplicity makes the model easy to serialize, deserialize, and reason about across service boundaries.");
}

// Slide 65: Aggregator implementation — code
{
  const s = S();
  addCodeSlide(s, "TRANSFORMATION", "Aggregator — Custom AggregationStrategy", "Java", [
    '// Custom AggregationStrategy: merge order status updates',
    'public class OrderStatusAggregation implements AggregationStrategy {',
    '',
    '    @Override',
    '    public Exchange aggregate(Exchange oldExchange,',
    '                              Exchange newExchange) {',
    '        if (oldExchange == null) {',
    '            // First message — initialize with a list',
    '            List<StatusUpdate> updates = new ArrayList<>();',
    '            updates.add(newExchange.getIn()',
    '                .getBody(StatusUpdate.class));',
    '            newExchange.getIn().setBody(updates);',
    '            return newExchange;',
    '        }',
    '        // Subsequent messages — add to list',
    '        List<StatusUpdate> updates = oldExchange.getIn()',
    '            .getBody(List.class);',
    '        updates.add(newExchange.getIn()',
    '            .getBody(StatusUpdate.class));',
    '        return oldExchange;',
    '    }',
    '}',
  ], "Figure 6.9 — AggregationStrategy collecting status updates into a list");
  addNotes(s, "This slide shows the AggregationStrategy interface in detail. The aggregate() method is called each time a new message arrives for the same correlation group. The first invocation receives null for oldExchange — this is where you initialize the aggregate. Here we create a new ArrayList and add the first StatusUpdate. On subsequent invocations, we retrieve the list from the old exchange and add the new update. The method always returns the exchange that carries the accumulated state. A common mistake is mutating the newExchange instead of the oldExchange after the first message — this loses the accumulated state. Another gotcha: the List must be mutable because we add to it on each call. Using List.of() would fail on the second message. For production use, consider using a thread-safe collection if parallelProcessing is enabled on the aggregator.");
}

// Slide 66: Resequencer
{
  const s = S();
  addPatternCard(s, "TRANSFORMATION", "Resequencer — Reordering by Sequence Number",
    "resequencer",
    "Messages arrive out of order due to parallel processing, network jitter, or multiple producers. Downstream consumers need messages in their original sequence to maintain causal consistency — tracking event 3 before event 2 breaks the timeline.",
    "Camel offers two resequencer modes: Stream (sliding window, low latency) and Batch (collect N, sort, release). Use .resequence(header('seqNum')) with any comparable expression. Timeout prevents stalls when gaps occur; .capacity(100) bounds memory usage."
  );
  addNotes(s, "The resequencer pattern restores message ordering when messages arrive out of sequence. This is a transformation pattern because it changes the order in which messages appear to downstream consumers. The stream resequencer works like a jitter buffer in audio streaming: it holds messages in a small window and releases them in order as the window advances. If message 3 arrives before message 2, the stream resequencer holds message 3 until message 2 arrives (or the timeout expires). The batch resequencer is simpler: it collects a batch of messages, sorts them by sequence number, and releases the sorted batch. The stream variant is better for continuous flows; the batch variant is better for periodic batch processing. The capacity limit prevents memory exhaustion if a producer sends messages much faster than the resequencer can release them.");
}

// Slide 67: Type conversion — diagram
{
  const s = S();
  addDiagramSlide(s, "TRANSFORMATION", "Type Conversion — Camel's Automatic Type System", "12-type-conversion",
    "Figure 6.8 — Camel chains type converters automatically");
  addNotes(s, "Camel's type conversion system eliminates manual format conversion boilerplate. When you call getBody(Order.class), Camel searches its converter registry for a path from the current type to Order — chaining multiple converters if needed. The chain byte[] → String → JSON → POJO happens automatically. The marshal() and unmarshal() DSL methods handle explicit serialization. Custom @Converter annotations register domain-specific converters discovered at build time by Quarkus.");
}

// Slide 68: Type conversion — details
{
  const s = S();
  addContentTitle(s, "TRANSFORMATION", "Type Conversion — Camel's Automatic Type System");
  addBullets(s, bsub([
    { text: "Implicit conversion", sub: "exchange.getIn().getBody(TargetType.class) triggers automatic converter lookup" },
    { text: "marshal() / unmarshal()", sub: ".marshal().json(), .unmarshal().json(Order.class) — explicit serialization DSL" },
    { text: "Jackson integration", sub: "camel-jackson converts between JSON strings and POJOs — Java records fully supported" },
    { text: "Custom @Converter", sub: "Register domain converters: @Converter public static Order toOrder(String json) { ... }" },
    { text: "Converter chain", sub: "byte[] → String → JSON → POJO — Camel chains multiple converters automatically" },
    { text: "transform() DSL", sub: ".transform(simple('${body.orderId}')) — inline transformation using expressions" },
  ]));
  addNotes(s, "Camel's type conversion system eliminates the boilerplate of manually converting between data formats at every step. When you call getBody(Order.class), Camel checks if the current body is already an Order. If not, it searches the converter registry for a path from the current type to Order. The search considers single-hop conversions and also chained conversions — byte array to String to JSON to POJO. The marshal() and unmarshal() DSL methods handle explicit serialization. With the Jackson extension, JSON serialization of Java records works out of the box. For domain-specific conversions, annotate a static method with @Converter and Quarkus discovers it at build time. The transform() DSL method applies an inline transformation using any Camel expression language — simple, jsonpath, or Java lambda. This saves you from creating a separate bean for trivial transformations.");
}

// Slide 68: Transformation patterns comparison table
{
  const s = S();
  addContentTitle(s, "TRANSFORMATION", "Transformation Patterns — Comparison Table");
  addStatusTable(s, [
    { code: "Translate",  name: "Message Translator",       purpose: "Convert from one format to another — bean-based mapping", codeColor: COLOR.svc },
    { code: "Envelope",   name: "Envelope Wrapper",         purpose: "Add/remove transport metadata around business payload", codeColor: COLOR.svc },
    { code: "Enrich",     name: "Content Enricher",         purpose: "Add data from external source — enrich() + AggregationStrategy", codeColor: COLOR.svc },
    { code: "Filter",     name: "Content Filter",           purpose: "Remove unwanted fields — PII stripping, data minimization", codeColor: COLOR.data },
    { code: "Claim",      name: "Claim Check",              purpose: "Store large payload externally, pass claim key through route", codeColor: COLOR.data },
    { code: "Normalize",  name: "Normalizer",               purpose: "Convert multiple input formats to one canonical model", codeColor: COLOR.platform },
    { code: "Canonical",  name: "Canonical Data Model",     purpose: "Shared domain records used across all services", codeColor: COLOR.platform },
    { code: "Reseq",      name: "Resequencer",              purpose: "Restore out-of-order messages by sequence number", codeColor: COLOR.govern },
  ], { colW: [1.30, 2.80, 7.99], rowH: 0.50 });
  addNotes(s, "This table summarizes the transformation patterns and when to use each one. Message translator is your workhorse for format conversion — one translator per external format. Envelope wrapper adds transport metadata needed by the infrastructure. Content enricher pulls in data from external services to augment the message. Content filter strips data that downstream consumers should not see. Claim check handles messages too large for the messaging system. Normalizer combines translation with routing to funnel multiple input formats into one canonical model. The canonical data model is the shared language that eliminates N-squared format translations. Resequencer restores ordering when messages arrive out of sequence. In practice, most integration routes use at least one transformation pattern — often translator and enricher together.");
}

// ============================================================================
// SECTION 07 — Endpoint Patterns in Code  (10 slides)
// ============================================================================

divider("07", "Endpoint Patterns\nin Code", "Gateways, consumers, idempotent receivers, and more",
  "Section 07 covers endpoint patterns — how applications connect to the messaging system. These patterns address the boundary between your application code and the messaging infrastructure: gateways that hide messaging complexity, consumer strategies for parallel processing, idempotent receivers for exactly-once semantics, and service activators that bridge messaging to plain Java objects.");

// Slide 69: Consumer patterns — diagram
{
  const s = S();
  addDiagramSlide(s, "ENDPOINT PATTERNS", "Connecting to the Messaging System", "14-consumer-patterns",
    "Figure 7.1 — Consumer patterns: polling, event-driven, competing, selective");
  addNotes(s, "The endpoint patterns define how your application code interacts with the messaging system. The consumer patterns are particularly important: how does your application receive messages? A polling consumer periodically checks for new messages — think of a timer-based database query. An event-driven consumer reacts immediately when a message arrives — this is how Kafka consumers work. Competing consumers provide parallel processing by having multiple instances of the same consumer share the workload. A selective consumer filters messages at the endpoint level before they enter the route. The choice between these patterns depends on your requirements for latency, throughput, and resource utilization. Event-driven consumers are the default choice for Kafka-based integrations because they provide the lowest latency and highest throughput.");
}

// Slide 70: Messaging Gateway — diagram
{
  const s = S();
  addDiagramSlide(s, "ENDPOINT PATTERNS", "Messaging Gateway — Hiding Messaging from Business Code", "16-messaging-gateway",
    "Figure 7.2 — Messaging gateway: business code → gateway → messaging system");
  addNotes(s, "The messaging gateway pattern creates a clean API boundary between your business code and the messaging infrastructure. Business services should not know they are using Kafka — they should call a method on a gateway class and let the gateway handle serialization, topic routing, header setting, and error handling. This separation makes your business code testable without a running Kafka broker, and it allows you to swap the underlying messaging technology without changing business logic. The diagram shows the gateway sitting between the application layer and the messaging layer, translating method calls into message sends and message receives into method returns. In Camel, the ProducerTemplate is the building block for gateways — it provides a programmatic API for sending messages to any Camel endpoint.");
}

// Slide 71: Messaging Gateway — code
{
  const s = S();
  addCodeSlide(s, "ENDPOINT PATTERNS", "Messaging Gateway — CDI Bean with ProducerTemplate", "Java", [
    '// Messaging Gateway: business code calls methods, gateway handles messaging',
    '@ApplicationScoped',
    'public class OrderGateway {',
    '',
    '    @Inject ProducerTemplate producer;',
    '',
    '    public void submitOrder(Order order) {',
    '        producer.sendBodyAndHeader("kafka:eip.orders.placed",',
    '            order, "kafka.KEY", order.orderId());',
    '    }',
    '',
    '    public void cancelOrder(String orderId) {',
    '        producer.sendBodyAndHeader("kafka:eip.orders.cancelled",',
    '            new OrderCancelled(orderId, Instant.now()),',
    '            "kafka.KEY", orderId);',
    '    }',
    '',
    '    public OrderStatus getStatus(String orderId) {',
    '        return producer.requestBodyAndHeader(',
    '            "direct:order-status-lookup", orderId,',
    '            "orderId", orderId, OrderStatus.class);',
    '    }',
    '}',
  ], "Figure 7.3 — Messaging gateway hiding Kafka from business services");
  addNotes(s, "This is a production-grade messaging gateway. The OrderGateway is a CDI bean that injects Camel's ProducerTemplate — the programmatic API for sending messages. Business code calls submitOrder() without knowing about Kafka topics, partition keys, or serialization. The gateway sets the Kafka partition key header and sends to the appropriate topic. The cancelOrder method does the same for cancellation events. The getStatus method uses requestBodyAndHeader for a synchronous request-reply call via the direct: component. This gateway pattern has three major benefits: first, business code is clean and testable without messaging infrastructure; second, changing the underlying topic names or adding headers requires changing only the gateway; third, the gateway can add cross-cutting concerns like validation, logging, or metrics without touching business code.");
}

// Slide 72: Transactional Client
{
  const s = S();
  addCodeSlide(s, "ENDPOINT PATTERNS", "Transactional Client — JTA with Camel", "Java", [
    '// Transactional Client: database + Kafka in one transaction',
    'from("kafka:eip.orders.validated")',
    '    .routeId("transactional-order-processor")',
    '    .transacted()  // Begin JTA transaction',
    '    .unmarshal().json(Order.class)',
    '    .bean(OrderRepository.class, "save")',
    '    .bean(PaymentService.class, "initiatePayment")',
    '    .to("kafka:eip.orders.processed")',
    '    .log("Order processed in transaction: ${body.orderId}");',
    '',
    '// If any step fails, the transaction rolls back:',
    '//   - Database changes are reverted',
    '//   - Kafka message is not committed',
    '//   - The original Kafka message is redelivered',
    '',
    '// Requires: camel-quarkus-jta, narayana-jta',
  ], "Figure 7.4 — Transactional client coordinating database and Kafka in one transaction");
  addNotes(s, "The transactional client pattern coordinates multiple resource managers in a single transaction. The .transacted() DSL method tells Camel to wrap the route in a JTA transaction. If all steps succeed — saving to the database, initiating payment, and producing to Kafka — the transaction commits atomically. If any step throws an exception, the transaction rolls back: database changes are reverted, and the Kafka offset is not committed, causing the original message to be redelivered. This requires the Narayana JTA transaction manager that comes with Quarkus. Note that Kafka's transactional producer support (introduced in KIP-98) makes this possible — the Kafka producer enlists in the JTA transaction alongside the JDBC connection. This pattern is essential for the outbox pattern and any scenario where database state and messaging state must be consistent.");
}

// Slide 73: Polling Consumer vs Event-Driven Consumer
{
  const s = S();
  addCodeSlide(s, "ENDPOINT PATTERNS", "Polling vs Event-Driven Consumer", "Java", [
    '// Polling Consumer: check for new orders every 30 seconds',
    'from("timer:order-poll?period=30000")',
    '    .routeId("polling-consumer")',
    '    .to("sql:SELECT * FROM pending_orders ' +
        "WHERE processed = false?dataSource=#dataSource\")",
    '    .split(body())',
    '    .bean(OrderProcessor.class)',
    '    .to("sql:UPDATE pending_orders SET processed = true ' +
        "WHERE id = :#${body.id}?dataSource=#dataSource\");",
    '',
    '// Event-Driven Consumer: react immediately to Kafka messages',
    'from("kafka:eip.orders.placed?groupId=order-processor")',
    '    .routeId("event-driven-consumer")',
    '    .bean(OrderProcessor.class)',
    '    .to("kafka:eip.orders.processed");',
    '',
    '// Event-driven is preferred for Kafka — sub-millisecond latency.',
    '// Polling is for legacy systems without event support.',
  ], "Figure 7.5 — Polling consumer (timer + SQL) vs event-driven consumer (Kafka)");
  addNotes(s, "These two consumer patterns represent fundamentally different approaches to message consumption. The polling consumer uses a timer to periodically check a data source — here it queries a database table every 30 seconds for unprocessed orders. This introduces latency (up to 30 seconds) and database load (constant polling even when there are no new messages). The event-driven consumer reacts immediately when a message arrives on the Kafka topic — sub-millisecond latency with zero wasted resources when idle. Event-driven is always preferred for Kafka-based integrations. Polling is still valuable for legacy systems that do not emit events — databases without CDC, file systems, FTP servers, or APIs that must be polled. In those cases, the polling consumer acts as a bridge from the legacy world into the event-driven world.");
}

// Slide 74: Competing Consumers
{
  const s = S();
  addKeyValueSlide(s, "ENDPOINT PATTERNS", "Competing Consumers — Kafka Consumer Group Parallelism", [
    { key: "Same groupId", value: "Kafka assigns partitions across consumers — each message processed by exactly one" },
    { key: "Horizontal Scaling", value: "Add more consumers (replicas) to increase throughput — up to the partition count" },
    { key: "Auto Rebalancing", value: "Consumer joins or leaves → Kafka reassigns partitions automatically" },
    { key: "Max Parallelism", value: "6 partitions = at most 6 active consumers — design partition count for peak load" },
    { key: "Lag Monitoring", value: "Track how far behind consumers are — critical for capacity planning" },
    { key: "Camel Config", value: "consumersCount=3 in the endpoint URI to run multiple consumer threads in one JVM" },
  ], { rowH: 0.55 });
  addPerfCallout(s, "Rule of thumb: set partition count = 2x to 3x your expected max consumer count. Partitions cannot be reduced later.");
  addNotes(s, "Competing consumers is how you scale message processing horizontally. In Kafka, all consumers with the same groupId share the workload — each partition is assigned to exactly one consumer in the group. When you deploy three replicas of your order-processing service (all with groupId=order-processor), Kafka distributes the partitions across them. If a replica crashes, Kafka reassigns its partitions to the surviving replicas within seconds. The critical design decision is the partition count: if you have 6 partitions, you can run at most 6 consumer instances. More consumers than partitions means some sit idle. Fewer consumers than partitions means each consumer handles multiple partitions. You cannot reduce partition count later without recreating the topic, so plan for peak load at topic creation time. Camel also supports in-JVM parallelism with the consumersCount parameter.");
}

// Slide 75: Idempotent Receiver — code
{
  const s = S();
  addCodeSlide(s, "ENDPOINT PATTERNS", "Idempotent Receiver — Redis-Backed Deduplication", "Java", [
    '// Idempotent Consumer: process each payment exactly once',
    'from("kafka:eip.payments.completed")',
    '    .routeId("idempotent-payment-processor")',
    '    .idempotentConsumer(',
    '        header("paymentId"),',
    '        RedisIdempotentRepository.redisIdempotentRepository(',
    '            redisClient, "payments"))',
    '    .skipDuplicate(true)',
    '    .log("Processing payment: ${header.paymentId}")',
    '    .bean(PaymentProcessor.class)',
    '    .to("kafka:eip.payments.applied");',
    '',
    '// How it works:',
    '//   1. Extract paymentId from message header',
    '//   2. Check Redis: has this paymentId been seen before?',
    '//   3. If yes → skip (duplicate)',
    '//   4. If no → process and store paymentId in Redis',
    '//   5. Redis entry persists across restarts and replicas',
  ], "Figure 7.6 — Idempotent consumer with Redis-backed deduplication");
  addNotes(s, "The idempotent consumer pattern ensures that each message is processed exactly once, even when the messaging system delivers duplicates. Kafka provides at-least-once delivery by default — if a consumer crashes after processing a message but before committing the offset, the message will be redelivered on restart. The idempotent consumer catches these duplicates. The idempotentConsumer() DSL method takes two arguments: a correlation expression (here the paymentId header) and an IdempotentRepository. The Redis-backed repository stores processed message IDs in Redis, which persists across application restarts and is shared across replicas. When a message arrives, Camel checks Redis for the paymentId. If found, the message is a duplicate and is skipped. If not found, the message is processed and the paymentId is stored. This is essential for payment processing where duplicate processing would charge the customer twice.");
}

// Slide 76: Service Activator
{
  const s = S();
  addCodeSlide(s, "ENDPOINT PATTERNS", "Service Activator — The .bean() Component", "Java", [
    '// Service Activator: bridge messaging to plain Java beans',
    'from("kafka:eip.orders.validated")',
    '    .routeId("order-service-activator")',
    '    .bean(OrderService.class, "processOrder")',
    '    .to("kafka:eip.orders.processed");',
    '',
    '// Camel auto-maps the exchange body to the method parameter.',
    '// No messaging API in the service class!',
    '',
    '@ApplicationScoped',
    'public class OrderService {',
    '    @Inject InventoryService inventory;',
    '    @Inject PaymentService payments;',
    '',
    '    public ProcessedOrder processOrder(Order order) {',
    '        inventory.reserve(order.items());',
    '        PaymentResult result = payments.charge(order);',
    '        return new ProcessedOrder(order.orderId(),',
    '            result.transactionId(), Instant.now());',
    '    }',
    '}',
  ], "Figure 7.7 — Service activator: .bean() bridges messaging to plain Java services");
  addNotes(s, "The service activator pattern bridges the messaging world to plain Java objects. The .bean() DSL method invokes a CDI bean's method, with Camel automatically mapping the exchange body to the method parameter and the return value back to the exchange body. The OrderService class has no Camel or Kafka imports — it is a pure business service that accepts an Order and returns a ProcessedOrder. This is the key benefit of the service activator: your business logic is completely decoupled from the messaging infrastructure. You can unit test OrderService without any messaging setup — just call processOrder() directly. The service activator also supports method overloading, parameter binding from headers, and type conversion. In practice, most Camel routes use .bean() for business logic, keeping the route itself focused on integration concerns like routing, transformation, and error handling.");
}

// Slide 77: Durable Subscriber
{
  const s = S();
  addPatternCard(s, "ENDPOINT PATTERNS", "Durable Subscriber — Kafka with Committed Offsets",
    "durable-subscriber",
    "Subscribers disconnect for maintenance, restarts, or failures. Without durable subscriptions, all messages published during the outage are lost forever. The subscriber resumes but has a gap in its message history.",
    "Kafka consumer groups are inherently durable — committed offsets survive restarts and resume from the last position. Set autoCommitEnable=false for reliability (commit after processing), autoOffsetReset=earliest for new subscribers to replay history, or allowManualCommit=true for fine-grained control."
  );
  addNotes(s, "The durable subscriber pattern ensures that a subscriber receives all messages, even those published while the subscriber was disconnected. In Kafka, every consumer group is inherently a durable subscriber — Kafka persists each group's committed offset, and when the consumer reconnects, it resumes from that position. The key configuration is autoCommitEnable: setting it to false means you control exactly when offsets are committed. This prevents the scenario where Kafka commits the offset (marking the message as consumed) before your processing code finishes — which would lose the message if the consumer crashes mid-processing. For new subscribers, autoOffsetReset=earliest starts from the beginning of the topic, giving the subscriber access to the full message history (up to the retention period). This is how event sourcing works — new services can replay the entire event log to build their state from scratch.");
}

// Slide 78: Selective Consumer — diagram
{
  const s = S();
  addDiagramSlide(s, "ENDPOINT PATTERNS", "Selective Consumer — Filtering at the Endpoint", "15-outbox-pattern",
    "Figure 7.8 — Selective consumer and the outbox pattern for reliable event publishing");
  addNotes(s, "The selective consumer pattern filters messages at the endpoint level — before they enter the route processing pipeline. In Kafka, this can be implemented with consumer interceptors that drop unwanted messages before Camel even sees them, or with a filter at the very beginning of the route. The outbox pattern shown in this diagram is closely related: the outbox table in PostgreSQL stores events that need to be published, and a selective consumer reads only the events relevant to its service. The outbox pattern solves the dual-write problem — writing to both the database and Kafka atomically. A polling route or CDC connector reads the outbox table and publishes events to Kafka. The selective consumer on the Kafka side then filters for only the event types it cares about, reducing unnecessary processing.");
}

// ============================================================================
// SECTION 08 — System Management in Code  (8 slides)
// ============================================================================

divider("08", "System Management\nin Code", "Control bus, wire tap, message history, and more",
  "Section 08 covers the system management patterns — the operational toolbox for monitoring, debugging, and controlling your messaging system. These patterns let you observe message flow without disrupting it, track message history for debugging, control routes at runtime, and test your integration in production safely.");

// Slide 79: Managing the messaging system
{
  const s = S();
  addIconGrid(s, "SYSTEM MANAGEMENT", "Managing the Messaging System", [
    { icon: "control-bus", label: "Control Bus", desc: "Start, stop, suspend routes dynamically — respond to load, failures, deployments" },
    { icon: "wire-tap", label: "Wire Tap", desc: "Copy messages to an audit channel without disrupting the main flow" },
    { icon: "message-history", label: "Message History", desc: "Track every route a message has visited — invaluable for debugging complex flows" },
    { icon: "test-message", label: "Test Message", desc: "Inject canary messages into production flows to verify end-to-end health" },
    { icon: "detour", label: "Detour", desc: "Route messages through a debug/monitoring step only when a flag is enabled" },
    { icon: null, label: "Observability", desc: "In production messaging, you need to see every message flow, failure, and bottleneck" },
  ], { cols: 3, cellH: 2.10 });
  addNotes(s, "System management patterns are what separate a prototype from a production system. You need to observe what is happening — which messages are flowing, which are failing, where are the bottlenecks. You need to control the system at runtime — stop a route that is overwhelming a downstream service, suspend processing during a maintenance window. You need to audit — capture a copy of every message for compliance, debugging, or analytics without slowing down the main processing pipeline. And you need to test — inject canary messages into production to verify that the end-to-end flow is healthy. These patterns are often overlooked during initial development and then added in a panic during the first production incident. Build them in from the start.");
}

// Slide 80: Control Bus — diagram + code
{
  const s = S();
  addDiagramSlide(s, "SYSTEM MANAGEMENT", "Control Bus — Runtime Route Management", "17-control-bus",
    "Figure 8.1 — Control bus: administrative commands to start/stop/monitor routes");
  addNotes(s, "The control bus pattern provides a channel for administrative commands that manage the messaging system itself. In Camel, the controlbus: component lets you start, stop, suspend, and resume individual routes at runtime. This is invaluable for operational scenarios: if a downstream service is overwhelmed, you can pause the route that sends to it; if a new route version is deployed, you can stop the old route and start the new one without restarting the application. The control bus can also query route status, statistics, and health. The diagram shows how control messages flow on a separate channel from business messages — the control bus must always be available even when business routes are stopped. In production, you might expose the control bus through a REST endpoint or a management Kafka topic.");
}

// Slide 81: Control Bus — code
{
  const s = S();
  addCodeSlide(s, "SYSTEM MANAGEMENT", "Control Bus — Starting and Stopping Routes", "Java", [
    '// Control Bus: manage routes at runtime via controlbus component',
    '',
    '// REST endpoint to control routes',
    'rest("/admin/routes")',
    '    .post("/{routeId}/stop")',
    '    .to("direct:stop-route")',
    '    .post("/{routeId}/start")',
    '    .to("direct:start-route");',
    '',
    'from("direct:stop-route")',
    '    .routeId("control-bus-stop")',
    '    .toD("controlbus:route?routeId=${header.routeId}" +',
    '         "&action=stop")',
    '    .log("Route ${header.routeId} stopped");',
    '',
    'from("direct:start-route")',
    '    .routeId("control-bus-start")',
    '    .toD("controlbus:route?routeId=${header.routeId}" +',
    '         "&action=start")',
    '    .log("Route ${header.routeId} started");',
  ], "Figure 8.2 — Control bus exposed via REST for runtime route management");
  addNotes(s, "This code exposes route management via a REST API using Camel's controlbus component. The REST endpoint accepts POST requests with a route ID in the path. The direct:stop-route handler uses toD() (dynamic to) to build the control bus URI with the route ID from the request header. The controlbus component then calls CamelContext.stopRoute() internally, gracefully shutting down the specified route — it finishes processing any in-flight exchanges before stopping. The start route handler does the reverse. In production, you would add authentication and authorization to these endpoints — you do not want anyone stopping production routes. You might also add a status endpoint that queries route state using action=status. This pattern is commonly used with health monitoring: if a circuit breaker trips, the control bus can automatically stop the affected route and restart it when the downstream service recovers.");
}

// Slide 82: Wire Tap — diagram + code
{
  const s = S();
  addCodeSlide(s, "SYSTEM MANAGEMENT", "Wire Tap — Non-Intrusive Monitoring", "Java", [
    '// Wire Tap: copy messages to audit channel without disrupting main flow',
    'from("kafka:eip.orders.placed")',
    '    .routeId("order-processing-with-wiretap")',
    '    .wireTap("kafka:eip.audit.orders")',
    '    .bean(OrderProcessor.class)',
    '    .to("kafka:eip.orders.processed");',
    '',
    '// Wire Tap with transformation — log only key fields',
    'from("kafka:eip.payments.completed")',
    '    .routeId("payment-audit-wiretap")',
    '    .wireTap("kafka:eip.audit.payments")',
    '        .newExchangeBody(simple(',
    '            "{\\"paymentId\\":\\"${header.paymentId}\\",' +
    '             \\"amount\\":\\"${body.amount}\\",' +
    '             \\"timestamp\\":\\"${date:now:yyyy-MM-dd HH:mm:ss}\\"}"))',
    '    .end()',
    '    .bean(PaymentApplier.class)',
    '    .to("kafka:eip.payments.applied");',
  ], "Figure 8.3 — Wire tap for auditing with optional message transformation");
  addNotes(s, "The wire tap pattern copies a message to a secondary channel without affecting the primary processing flow. It is like a phone wiretap — the message continues to its destination while a copy is sent to the audit channel. The first example is a simple wire tap: every order that enters the processing pipeline also gets copied to the audit topic. The main route continues immediately — the wire tap is asynchronous and does not slow down processing. The second example shows a wire tap with transformation: instead of copying the entire payment message (which might be large and contain sensitive data), we create a new exchange body with only the audit-relevant fields. The newExchangeBody method creates a shallow copy of the exchange with a different body. Wire taps are essential for compliance auditing, analytics feeds, and debugging — you can tap any point in a route without modifying the processing logic.");
}

// Slide 83: Message History
{
  const s = S();
  addCodeSlide(s, "SYSTEM MANAGEMENT", "Message History — Tracking the Processing Path", "Java", [
    '// Message History: Camel automatically tracks route traversal',
    '// Enable via application.properties:',
    '//   camel.context.message-history=true',
    '',
    'from("kafka:eip.orders.placed")',
    '    .routeId("order-pipeline")',
    '    .to("direct:validate")',
    '    .to("direct:enrich")',
    '    .to("direct:route")',
    '    .process(exchange -> {',
    '        // Read the message history',
    '        List<MessageHistory> history = exchange.getProperty(',
    '            Exchange.MESSAGE_HISTORY, List.class);',
    '        for (MessageHistory h : history) {',
    '            log.info("Visited: {} at {} ({}ms)",',
    '                h.getRouteId(), h.getNode().getId(),',
    '                h.getElapsed());',
    '        }',
    '    })',
    '    .to("kafka:eip.orders.processed");',
  ], "Figure 8.4 — Reading Camel's automatic message history for debugging");
  addNotes(s, "Message history is a built-in Camel feature that tracks every route and processing node a message has visited. When enabled via the message-history property, Camel attaches a list of MessageHistory objects to the exchange. Each entry records the route ID, the node ID (the specific step within the route), and the elapsed time in milliseconds. This is invaluable for debugging complex multi-route flows — when a message fails at step 7 of a 10-step pipeline, the history tells you exactly which routes it visited, in what order, and how long each step took. The history also reveals performance bottlenecks: if one step consistently takes 500ms while others take 5ms, you have found your optimization target. In production, you would typically wire tap the message history to a logging or monitoring system rather than logging it inline as shown here.");
}

// Slide 84: Test Message & Detour — diagram + code
{
  const s = S();
  addCodeSlide(s, "SYSTEM MANAGEMENT", "Test Message and Detour — Safe Production Testing", "Java", [
    '// Test Message: inject canary messages to verify flow health',
    'from("timer:canary?period=60000")',
    '    .routeId("canary-generator")',
    '    .setBody(constant(new Order("CANARY-001", "TEST",',
    '        List.of(), null, BigDecimal.ZERO, OrderStatus.TEST,',
    '        Instant.now())))',
    '    .setHeader("testMessage", constant(true))',
    '    .to("direct:order-pipeline");',
    '',
    '// Detour: conditionally route through a debug step',
    'from("kafka:eip.orders.placed")',
    '    .routeId("order-with-detour")',
    '    .choice()',
    '        .when(simple("{{debug.enabled:false}}"))',
    '            .log(LoggingLevel.DEBUG, "DEBUG: ${body}")',
    '            .to("direct:debug-inspector")',
    '    .end()',
    '    .to("direct:normal-processing");',
  ], "Figure 8.5 — Test messages and feature-flagged detour for production debugging");
  addNotes(s, "The test message pattern injects canary messages into your production flow to verify end-to-end health. A timer route generates a synthetic order every 60 seconds with a testMessage=true header. Downstream routes can check this header and skip side effects (do not actually charge a credit card for a test message). If the canary stops arriving at the end of the pipeline, something is broken. The detour pattern conditionally routes messages through an extra processing step. Here, a Quarkus configuration property debug.enabled controls whether messages go through a debug inspector. In production, this defaults to false — but an operator can set it to true at runtime via a config change to enable verbose debugging without redeploying. The double curly braces use Quarkus property placeholder resolution, and the :false suffix provides a default value.");
}

// Slide 85: Channel Purger and Smart Proxy — diagram
{
  const s = S();
  addDiagramSlide(s, "SYSTEM MANAGEMENT", "Channel Purger and Smart Proxy", "17-purger-proxy",
    "Figure 8.6 — Channel purger clears test data; smart proxy observes without disrupting");
  addNotes(s, "Two system management patterns side by side. The channel purger clears accumulated messages from channels, primarily for testing — in Kafka, reset consumer group offsets or use unique topic names per test run for complete isolation. The smart proxy inserts an intermediary between producer and consumer to observe, log, or modify traffic without either party knowing. Useful for canary deployments: mirror production traffic to a new version, compare output, promote only when outputs match.");
}

// Slide 86: Channel Purger and Smart Proxy — details
{
  const s = S();
  addContentTitle(s, "SYSTEM MANAGEMENT", "Channel Purger and Smart Proxy");
  addBullets(s, bsub([
    { text: "Channel Purger — clearing test data", sub: "Delete all messages from a topic/queue before running integration tests" },
    { text: "Kafka topic reset", sub: "kafka-consumer-groups.sh --reset-offsets --to-earliest — reset consumer group offsets" },
    { text: "Test isolation", sub: "Use unique topic names per test run — eip.orders.placed.test-{uuid} — avoids cross-test contamination" },
    { text: "Smart Proxy — intermediate monitoring", sub: "Insert a monitoring route between producer and consumer to observe traffic" },
    { text: "Smart Proxy implementation", sub: "Consume from original topic → log/measure → produce to shadow topic → consumer reads shadow" },
    { text: "Production use", sub: "Smart proxy for canary deployments — mirror traffic to new version, compare results" },
  ]));
  addNotes(s, "The channel purger clears accumulated messages from channels, primarily for testing. In Kafka, you cannot truly purge a topic — instead, you either reset consumer group offsets to the end of the topic (skipping existing messages) or use unique topic names per test run. The unique-topic-name approach is cleaner: each test creates topics with a UUID suffix, ensuring complete isolation. After the test, the topics can be deleted. The smart proxy pattern inserts an intermediary between the producer and consumer to observe, log, or modify traffic without either party knowing. In our stack, this is useful for canary deployments: mirror production traffic to a new version of a service, compare its output to the old version, and promote the new version only when outputs match. The smart proxy is also useful for traffic replay and performance benchmarking.");
}

// Slide 86: Management patterns comparison table
{
  const s = S();
  addContentTitle(s, "SYSTEM MANAGEMENT", "Management Patterns — Comparison Table");
  addStatusTable(s, [
    { code: "CtlBus",   name: "Control Bus",        purpose: "Start/stop/suspend routes at runtime — operational control", codeColor: COLOR.svc },
    { code: "WireTap",  name: "Wire Tap",            purpose: "Copy messages to audit channel — non-intrusive monitoring", codeColor: COLOR.svc },
    { code: "History",  name: "Message History",      purpose: "Track route traversal path — debugging and performance analysis", codeColor: COLOR.data },
    { code: "Store",    name: "Message Store",        purpose: "Persist exchanges for replay and audit — JPA/JDBC backed", codeColor: COLOR.data },
    { code: "Test",     name: "Test Message",         purpose: "Inject canary messages — verify end-to-end flow health", codeColor: COLOR.platform },
    { code: "Detour",   name: "Detour",               purpose: "Conditional debug step — feature-flagged bypass for inspection", codeColor: COLOR.platform },
    { code: "Purge",    name: "Channel Purger",       purpose: "Clear test data — reset offsets or use unique topic names", codeColor: COLOR.govern },
    { code: "Proxy",    name: "Smart Proxy",          purpose: "Intermediate monitoring — canary deployments, traffic mirroring", codeColor: COLOR.govern },
  ], { colW: [1.20, 2.50, 8.39], rowH: 0.50 });
  addNotes(s, "This table summarizes the management patterns. Control bus gives you runtime control over individual routes. Wire tap lets you observe message flow without disrupting it — essential for compliance auditing. Message history tracks the processing path for debugging. Message store provides durable persistence for replay and audit. Test messages verify end-to-end health in production. Detour enables conditional debugging without redeployment. Channel purger clears test data between test runs. Smart proxy monitors traffic between producers and consumers. In production, you will typically use all of these patterns together — wire taps for auditing, message history for debugging, control bus for operations, and test messages for health monitoring. They form the operational foundation of any serious messaging system.");
}

// ============================================================================
// SECTION 09 — Observability & Production  (10 slides)
// ============================================================================

divider("09", "Observability\n& Production", "OpenTelemetry, metrics, health checks, and the LGTM stack",
  "Section 09 covers the production readiness concerns that transform a working integration into a production-grade system. We cover OpenTelemetry for distributed tracing, Micrometer for metrics, Camel health checks, the LGTM observability stack, feature flags, testing strategies, performance tuning, and a production checklist. These are the patterns that keep you from getting paged at 3am.");

// Slide 87: Why observability matters
{
  const s = S();
  addContentTitle(s, "OBSERVABILITY & PRODUCTION", "Why Observability Matters for Messaging");
  addBullets(s, bsub([
    { text: "Messages are invisible", sub: "Unlike HTTP requests, messages flow asynchronously — you cannot see them in a browser or curl" },
    { text: "Failure is silent", sub: "A dropped message does not return an error to anyone — it just disappears" },
    { text: "Latency is cumulative", sub: "A 10-step pipeline with 100ms per step = 1 second end-to-end — where is the bottleneck?" },
    { text: "Three pillars of observability", sub: "Traces: follow a message across services. Metrics: count, measure, alert. Logs: detailed context" },
    { text: "Camel's built-in support", sub: "OpenTelemetry, Micrometer, and structured logging via Quarkus extensions" },
    { text: "The LGTM stack", sub: "Loki (logs) + Grafana (dashboards) + Tempo (traces) + Mimir (metrics) — all open source" },
  ]));
  addNotes(s, "Messaging systems have a fundamental observability challenge: messages are invisible. When a user submits an HTTP request, you can see the request in your browser, your load balancer logs, your application logs, and the response. When a message flows through Kafka, it is invisible to everyone except the producer and consumer code. If a message is dropped, malformed, or stuck, nobody gets an error — the message simply does not arrive at its destination. This makes observability not optional but essential. You need distributed tracing to follow a message across multiple services, metrics to count successes, failures, and latencies, and logs to understand what happened at each step. Camel Quarkus makes this remarkably easy with its OpenTelemetry and Micrometer extensions — just add the dependency and tracing/metrics are automatic.");
}

// Slide 88: OpenTelemetry integration — code
{
  const s = S();
  addCodeSlide(s, "OBSERVABILITY & PRODUCTION", "OpenTelemetry — Distributed Tracing", "Java", [
    '# application.properties — OpenTelemetry configuration',
    '',
    '# Enable Camel OpenTelemetry integration',
    'quarkus.otel.enabled=true',
    'quarkus.otel.exporter.otlp.endpoint=http://localhost:4317',
    'quarkus.otel.exporter.otlp.protocol=grpc',
    '',
    '# Service identification',
    'quarkus.otel.resource.attributes=service.name=order-service',
    '',
    '# Kafka header propagation — trace context travels with messages',
    'camel.component.kafka.additional-properties[interceptor.classes]=\\',
    '  io.opentelemetry.instrumentation.kafkaclients.\\',
    '  TracingProducerInterceptor',
    '',
    '# Dependencies:',
    '#   camel-quarkus-opentelemetry',
    '#   quarkus-opentelemetry',
    '#   opentelemetry-instrumentation-kafka-clients',
  ], "Figure 9.1 — OpenTelemetry configuration for distributed tracing across Kafka");
  addNotes(s, "OpenTelemetry integration in Camel Quarkus is remarkably simple. Adding the camel-quarkus-opentelemetry extension automatically instruments every route — each route processing creates a span in the trace. The OTLP exporter sends trace data to your collector (in our stack, that is Tempo via the LGTM compose). The critical piece for Kafka is trace context propagation: the TracingProducerInterceptor injects the trace context (trace ID, span ID) into Kafka message headers. When the consumer reads the message, the OpenTelemetry instrumentation extracts the trace context from the headers and continues the same trace. This means you can follow a single order from REST API submission through order validation, payment processing, and shipment dispatch — across multiple Kafka topics and multiple Quarkus services — in a single Grafana Tempo trace view. Without this, debugging a distributed pipeline is like assembling a puzzle in the dark.");
}

// Slide 89: Health checks
{
  const s = S();
  addContentTitle(s, "OBSERVABILITY & PRODUCTION", "Camel Health Checks — Readiness and Liveness");
  addBullets(s, bsub([
    { text: "Automatic health checks", sub: "camel-quarkus-microprofile-health registers readiness/liveness checks for Camel routes" },
    { text: "Readiness: can this instance accept traffic?", sub: "Checks if CamelContext is started and all routes are running — Kubernetes uses for load balancing" },
    { text: "Liveness: is this instance alive?", sub: "Checks if CamelContext is healthy — Kubernetes uses for restart decisions" },
    { text: "Custom health checks", sub: "Extend AbstractHealthCheck to add domain-specific checks — Kafka connectivity, Redis availability" },
    { text: "Consumer lag as health signal", sub: "If consumer lag exceeds threshold, mark instance as degraded — trigger scaling" },
    { text: "Endpoints", sub: "/q/health/ready and /q/health/live — standard MicroProfile Health endpoints" },
  ]));
  addNotes(s, "Health checks are how Kubernetes knows whether your application is ready to receive traffic and whether it is still alive. Camel Quarkus automatically registers health checks that report the status of the CamelContext and its routes. The readiness check tells Kubernetes whether this pod can handle requests — if a route is still starting up or is in an error state, the pod is not ready. The liveness check tells Kubernetes whether the application is fundamentally healthy — if the CamelContext has crashed, Kubernetes should restart the pod. You can add custom health checks for domain-specific concerns: is the Kafka broker reachable? Is Redis responding? Is the consumer lag within acceptable bounds? Consumer lag is a particularly useful health signal — if your consumer is falling behind the producer by more than a threshold (say 10,000 messages), it might indicate a performance issue that requires scaling.");
}

// Slide 90: Metrics with Micrometer
{
  const s = S();
  addContentTitle(s, "OBSERVABILITY & PRODUCTION", "Metrics with Micrometer — Counting What Matters");
  addBullets(s, bsub([
    { text: "Automatic route metrics", sub: "camel-quarkus-micrometer tracks exchange count, success/failure rate, and processing time per route" },
    { text: "Exchange counters", sub: "camel.exchanges.total, camel.exchanges.failed — per route, per exception type" },
    { text: "Processing time", sub: "camel.exchanges.processing.time — histogram with min/max/avg/p95/p99 per route" },
    { text: "Custom business metrics", sub: "MeterRegistry injection — count orders, measure payment amounts, track inventory levels" },
    { text: "Kafka consumer lag", sub: "kafka.consumer.lag — per topic, per partition, per consumer group" },
    { text: "Grafana dashboards", sub: "The LGTM stack ships pre-built Camel dashboards — route throughput, error rate, latency" },
  ]));
  addNotes(s, "Metrics are the quantitative foundation of observability. Camel Quarkus with Micrometer automatically tracks three essential metric families per route: exchange count (how many messages processed), failure count (how many failed), and processing time (how long each took). These are exposed at the /q/metrics Prometheus endpoint. You can add custom business metrics by injecting MeterRegistry — count orders by status, measure payment amounts, track inventory reservation success rate. Kafka consumer lag is a critical operational metric: it tells you how far behind each consumer group is. If lag is growing, your consumers are not keeping up with the producers — you need to scale up or optimize processing. The LGTM stack (Section 02) ships with pre-built Grafana dashboards that visualize these metrics, so you get operational visibility out of the box.");
}

// Slide 91: The LGTM stack — code
{
  const s = S();
  addCodeSlide(s, "OBSERVABILITY & PRODUCTION", "The LGTM Stack — Grafana + Loki + Tempo + Mimir", "Java", [
    '# Start the full stack with observability',
    '$ ./scripts/setup-stack.sh --lgtm',
    '',
    '# Services started:',
    '#   grafana    — dashboards:    http://localhost:3000',
    '#   loki       — log aggregation (receives from Quarkus logging)',
    '#   tempo      — trace storage  (receives from OTLP exporter)',
    '#   mimir      — metrics storage (receives from Prometheus scrape)',
    '',
    '# Grafana data sources are pre-configured:',
    '#   Loki  → query logs by service, route, level',
    '#   Tempo → search traces by trace ID, service, duration',
    '#   Mimir → Prometheus queries: rate, histogram, counter',
    '',
    '# Example Grafana query — orders processed per minute:',
    '#   rate(camel_exchanges_total{routeId="order-processing"}[1m])',
    '',
    '# Trace → Logs correlation:',
    '#   Click a trace span → jump to matching log lines',
  ], "Figure 9.2 — The LGTM observability stack: traces, logs, and metrics in one dashboard");
  addNotes(s, "The LGTM stack gives you complete observability with one command. Grafana provides the visualization layer — dashboards, alerting, and exploration. Loki aggregates logs from all your Quarkus services, searchable by service name, route ID, log level, and any structured field. Tempo stores distributed traces received via the OpenTelemetry OTLP protocol, letting you follow a message across multiple services and Kafka topics. Mimir stores Prometheus-format metrics for long-term retention and alerting. The power of LGTM is the correlation between these three signals: from a trace, you can jump to the exact log lines for that processing step; from a metric spike, you can find the traces that contributed to it; from a log error, you can see the full trace that produced it. This correlation is what makes debugging distributed messaging systems practical rather than a nightmare.");
}

// Slide 92: Feature flags — diagram
{
  const s = S();
  addDiagramSlide(s, "OBSERVABILITY & PRODUCTION", "Feature Flags — Controlling Behavior at Runtime", "26-feature-flags",
    "Figure 9.3 — Feature flags for gradual rollout and A/B testing of integration routes");
  addNotes(s, "Feature flags let you control route behavior at runtime without redeployment. This is critical for integration systems where a bad deployment can affect every message in the pipeline. With feature flags, you can gradually roll out a new routing rule to 5% of traffic, then 25%, then 100% — rolling back instantly if metrics show degradation. The diagram shows how feature flags integrate with the content-based router and detour patterns: a flag evaluation at a routing decision point determines which path the message takes. Feature flags are also useful for A/B testing different processing strategies — does the new aggregation algorithm produce better results than the old one? Route 50% of traffic through each and compare. In our stack, we use the OpenFeature specification for vendor-neutral flag evaluation.");
}

// Slide 93: Feature flags — code
{
  const s = S();
  addCodeSlide(s, "OBSERVABILITY & PRODUCTION", "Feature Flags — OpenFeature in Camel Routes", "Java", [
    '// Feature flag evaluation in a Camel route',
    'from("kafka:eip.orders.placed")',
    '    .routeId("feature-flagged-routing")',
    '    .process(exchange -> {',
    '        boolean useNewAlgorithm = featureClient',
    '            .getBooleanValue("new-routing-algorithm", false);',
    '        exchange.getIn().setHeader("useNewAlgorithm",',
    '            useNewAlgorithm);',
    '    })',
    '    .choice()',
    '        .when(header("useNewAlgorithm").isEqualTo(true))',
    '            .to("direct:new-order-routing")',
    '        .otherwise()',
    '            .to("direct:legacy-order-routing")',
    '    .end();',
    '',
    '// Toggle the flag at runtime → instantly changes routing',
    '// No redeployment, no restart, no downtime',
  ], "Figure 9.4 — Feature flag controlling routing algorithm at runtime");
  addNotes(s, "This code shows a feature flag controlling which routing algorithm is used. The OpenFeature client evaluates the new-routing-algorithm flag — if true, messages go through the new algorithm; if false, they go through the legacy one. The flag can be toggled at runtime through your feature flag service, and the change takes effect immediately on the next message — no redeployment, no restart. The false parameter in getBooleanValue is the default value if the flag service is unavailable, ensuring the route works even if the feature flag infrastructure is down. This pattern is essential for safe production changes in integration systems. A bad routing change can corrupt data or lose messages — with feature flags, you can roll out changes to 1% of traffic, monitor metrics and error rates, and only proceed to 100% when confident. If something goes wrong, flip the flag back instantly.");
}

// Slide 94: Testing Camel routes — code
{
  const s = S();
  addCodeSlide(s, "OBSERVABILITY & PRODUCTION", "Testing Camel Routes — @QuarkusTest", "Java", [
    '@QuarkusTest',
    'class OrderRoutingTest {',
    '',
    '    @Inject ProducerTemplate producer;',
    '    @Inject ConsumerTemplate consumer;',
    '',
    '    @Test',
    '    void highPriorityOrderRoutesToExpress() {',
    '        Order order = new Order("ORD-001", "CUST-001",',
    '            List.of(new LineItem("SKU-A", 1, new BigDecimal("99.95"))),',
    '            null, new BigDecimal("99.95"), OrderStatus.PLACED,',
    '            Instant.now());',
    '        order = order.withPriority("HIGH");',
    '',
    '        producer.sendBody("direct:order-router", order);',
    '',
    '        Exchange result = consumer.receive(',
    '            "mock:express-processing", 5000);',
    '        assertNotNull(result);',
    '        assertEquals("ORD-001",',
    '            result.getIn().getBody(Order.class).orderId());',
    '    }',
    '}',
  ], "Figure 9.5 — Integration test with ProducerTemplate, ConsumerTemplate, and mock endpoints");
  addNotes(s, "Testing Camel routes in Quarkus uses the @QuarkusTest annotation, which starts the full Camel context with all routes. ProducerTemplate lets you inject messages into any route endpoint. ConsumerTemplate lets you consume from endpoints with a timeout — if no message arrives within 5 seconds, the test fails. Mock endpoints are test doubles that capture messages for assertion. In a test profile, you replace real Kafka endpoints with mock: or direct: endpoints using route advice. This test verifies that a high-priority order gets routed to the express processing channel. The assertion checks both that a message arrives at the expected destination and that its content is correct. Quarkus Dev Services automatically starts Kafka and other dependencies in test mode, so your integration tests run against real infrastructure without manual setup.");
}

// Slide 95: Performance tuning
{
  const s = S();
  addContentTitle(s, "OBSERVABILITY & PRODUCTION", "Performance Tuning — Thread Pools and Async Processing");
  addBullets(s, bsub([
    { text: "Thread pool configuration", sub: "camel.threadpool.pool-size=20, max-pool-size=50 — tune for your workload profile" },
    { text: "Parallel processing", sub: ".parallelProcessing() on split(), multicast(), recipientList() — use multiple threads" },
    { text: "SEDA queues for decoupling", sub: "Replace direct: with seda: to decouple producer and consumer threads — buffer bursts" },
    { text: "Kafka consumer tuning", sub: "fetch.min.bytes, max.poll.records, max.poll.interval.ms — balance latency vs throughput" },
    { text: "Batch processing", sub: "Consume batches of messages — reduce per-message overhead for high-throughput scenarios" },
    { text: "Native compilation", sub: "GraalVM native: ~20ms startup, ~50MB RSS — ideal for scale-to-zero and serverless" },
  ]));
  addPerfCallout(s, "Profile before tuning. The default thread pool (10 core, 20 max) handles most workloads. Only tune when metrics show contention.");
  addNotes(s, "Performance tuning should be metrics-driven, not guesswork. Start with Camel's defaults and only tune when Micrometer metrics show bottlenecks. Thread pool sizing depends on whether your routes are CPU-bound (set pool size to CPU count) or IO-bound (set pool size to 2-4x CPU count). The parallelProcessing() modifier on splitter and multicast delegates work to the thread pool, which can dramatically improve throughput when processing independent items. SEDA queues add an in-memory buffer between route segments, decoupling the producer thread from the consumer thread — this smooths out burst traffic. For Kafka, the key tuning parameters are fetch.min.bytes (how much data to accumulate before returning a fetch), max.poll.records (how many messages to process per poll), and max.poll.interval.ms (how long processing can take before Kafka assumes the consumer is dead). Native compilation with GraalVM reduces startup to ~20ms and memory to ~50MB — essential for serverless deployments where cold start latency matters.");
}

// Slide 96: Production checklist
{
  const s = S();
  addContentTitle(s, "OBSERVABILITY & PRODUCTION", "Production Checklist");
  addBullets(s, bsub([
    { text: "Error handling on every route", sub: "Dead letter channel with retry, metadata enrichment, and alerting" },
    { text: "Idempotent consumers where needed", sub: "Payment processing, inventory updates — anywhere duplicate processing causes harm" },
    { text: "Observability: traces, metrics, logs", sub: "OpenTelemetry + Micrometer + structured logging — the three pillars" },
    { text: "Health checks: readiness + liveness", sub: "Kubernetes probes for automated restart and traffic management" },
    { text: "Consumer lag monitoring", sub: "Alert when lag exceeds threshold — indicates scaling or performance issues" },
    { text: "Schema evolution strategy", sub: "Format indicators, backward compatibility, Avro schema registry" },
    { text: "Disaster recovery", sub: "Multi-broker Kafka, offset persistence, message replay capability" },
  ]));
  addNotes(s, "This checklist covers the non-negotiable items for taking a Camel integration to production. Error handling must be on every route — not just the routes you think might fail. Idempotent consumers must protect every operation that cannot be safely repeated — payments, inventory reservations, notifications. Observability must cover all three pillars: traces for following messages, metrics for measuring health, and logs for detailed debugging. Health checks must be configured for Kubernetes to manage your pods correctly. Consumer lag monitoring alerts you before users notice the problem. Schema evolution strategy prevents breaking changes from crashing consumers. And disaster recovery ensures you can survive broker failures, data center outages, and human errors. This checklist is not optional — skip any item and you will regret it during your first production incident.");
}

// Slide 97: Dev Mode power features
{
  const s = S();
  addIconGrid(s, "OBSERVABILITY & PRODUCTION", "Dev Mode Power Features", [
    { icon: null, label: "Live Reload", desc: "Edit a route, save — Quarkus reloads in ~200ms. No JVM restart, no lost state." },
    { icon: null, label: "Dev Services", desc: "Quarkus auto-starts Kafka, Redis, PostgreSQL in containers — zero-config development." },
    { icon: null, label: "Continuous Testing", desc: "Press 'o' in Dev Mode — tests re-run automatically on every save." },
    { icon: null, label: "Dev UI", desc: "localhost:8080/q/dev-ui — browse routes, endpoints, health, and metrics in a web UI." },
    { icon: null, label: "Camel Dev Console", desc: "Inspect running routes, exchanges in flight, and component configuration." },
    { icon: null, label: "Remote Dev Mode", desc: "mvn quarkus:remote-dev — live reload against a remote Kubernetes pod." },
  ], { cols: 3, cellH: 2.10 });
  addNotes(s, "Quarkus Dev Mode transforms the development experience for Camel routes. Live reload means your feedback loop is measured in milliseconds, not minutes. When you save a file, Quarkus detects the change, recompiles the affected classes, re-registers the routes, and resumes processing — typically in under 200ms. Dev Services eliminate the infrastructure setup burden: add the Kafka extension and Quarkus automatically starts a Kafka container using Testcontainers. You do not write a docker-compose file or configure connection URLs — it just works. Continuous testing re-runs your test suite on every save, giving you instant feedback on whether your changes broke anything. The Dev UI provides a web-based view of your running application: browse routes, inspect endpoints, check health, and view metrics. Remote dev mode extends live reload to a Kubernetes cluster — edit locally, see changes immediately on a remote pod.");
}

// ============================================================================
// SECTION 10 — Case Study: Loan Broker  (10 slides)
// ============================================================================

divider("10", "Case Study\nLoan Broker", "13 EIP patterns working together",
  "Section 10 is the first of two case studies. The Loan Broker implements the classic EIP example: a customer requests a loan, the system enriches the request with a credit score, fans it out to multiple banks, collects rate quotes, and selects the best offer. This example demonstrates 13 EIP patterns working together in a single Camel Quarkus application, and it is directly runnable from the examples directory.");

// Slide 98: The Loan Broker problem — diagram
{
  const s = S();
  addDiagramSlide(s, "CASE STUDY: LOAN BROKER", "The Loan Broker Problem", "28-loan-broker",
    "Figure 10.1 — Loan Broker architecture: Gateway → Enricher → Banks → Aggregator");
  addNotes(s, "The Loan Broker is the canonical EIP case study from Hohpe and Woolf. A customer wants a loan and sends a request to the loan broker. The broker does not make loans itself — instead, it gathers competitive quotes from multiple banks and returns the best one. The workflow is: accept the request via a REST gateway, enrich it with the customer's credit score from a credit bureau, fan the enriched request out to multiple banks using a recipient list, collect all bank rate quotes using an aggregator, select the best rate, and return it to the customer. This architecture exercises over a dozen EIP patterns in a realistic scenario. Our implementation runs on Camel Quarkus with Kafka as the messaging backbone, and each bank is a simulated service with its own rate calculation logic.");
}

// Slide 99: Architecture overview
{
  const s = S();
  addFlowSlide(s, "CASE STUDY: LOAN BROKER", "Architecture: Five Routes, 13 Patterns", [
    { label: "Gateway", desc: "REST → Kafka\n\nChannel adapter, messaging gateway" },
    { label: "Enricher", desc: "Credit score lookup\n\nContent enricher, translator" },
    { label: "Recipient List", desc: "Fan out to banks\n\nRecipient list, correlation ID" },
    { label: "Bank Services", desc: "Rate calculation\n\nService activator, filter" },
    { label: "Aggregator", desc: "Collect best rate\n\nScatter-gather, CBR" },
  ]);
  addNotes(s, "The Loan Broker is structured as six route classes, each implementing a stage of the workflow. The GatewayRoute accepts HTTP requests and converts them into Kafka messages — this is the channel adapter and messaging gateway patterns. The EnricherRoute looks up the customer's credit score and adds it to the loan request — the content enricher pattern. The RecipientListRoute fans the enriched request out to multiple banks — the recipient list pattern with correlation identifiers for tracking responses. Each BankRoute is a simulated service that calculates a rate based on the credit score and loan parameters — the service activator pattern. The AggregatorRoute collects all bank responses, selects the best rate, and returns it — the aggregator pattern as part of a scatter-gather. The DemoRoute generates periodic test requests so you can see the system working without a REST client.");
}

// Slide 100: GatewayRoute — code
{
  const s = S();
  addCodeSlide(s, "CASE STUDY: LOAN BROKER", "GatewayRoute — REST to Kafka Gateway", "Java", [
    '@ApplicationScoped',
    'public class GatewayRoute extends RouteBuilder {',
    '    @Override',
    '    public void configure() {',
    '        rest("/api/loans")',
    '            .post()',
    '            .consumes("application/json")',
    '            .type(LoanRequest.class)',
    '            .to("direct:submit-loan");',
    '',
    '        from("direct:submit-loan")',
    '            .routeId("loan-gateway")',
    '            .log("Loan request received: ${body.customerId}")',
    '            .setHeader("correlationId",',
    '                simple("${exchangeId}"))',
    '            .setHeader("kafka.KEY",',
    '                simple("${body.customerId}"))',
    '            .marshal().json()',
    '            .to("kafka:eip.loan.requests");',
    '    }',
    '}',
  ], "Figure 10.2 — GatewayRoute: REST endpoint bridging HTTP to Kafka");
  addNotes(s, "The GatewayRoute is the entry point for the Loan Broker. It exposes a REST POST endpoint at /api/loans that accepts a LoanRequest JSON payload. The REST handler routes to a direct: endpoint where the real work happens. The route sets a correlation ID using the exchange ID — this ID will travel through the entire pipeline and back, allowing the gateway to match the response to the original request. The Kafka partition key is set to the customer ID for ordering. The message is serialized to JSON and produced to the eip.loan.requests topic. This route implements three patterns: channel adapter (HTTP to Kafka), messaging gateway (hiding Kafka from the REST controller), and the beginning of a request-reply flow (the correlation ID enables matching responses later).");
}

// Slide 101: EnricherRoute — code
{
  const s = S();
  addCodeSlide(s, "CASE STUDY: LOAN BROKER", "EnricherRoute — Credit Score Enrichment", "Java", [
    '@ApplicationScoped',
    'public class EnricherRoute extends RouteBuilder {',
    '    @Override',
    '    public void configure() {',
    '        from("kafka:eip.loan.requests?groupId=enricher")',
    '            .routeId("loan-enricher")',
    '            .unmarshal().json(LoanRequest.class)',
    '            .enrich("direct:credit-bureau",',
    '                new CreditScoreEnrichStrategy())',
    '            .marshal().json()',
    '            .to("kafka:eip.loan.enriched");',
    '',
    '        from("direct:credit-bureau")',
    '            .routeId("credit-bureau-lookup")',
    '            .bean(CreditBureauService.class, "getScore");',
    '    }',
    '}',
    '',
    '// CreditScoreEnrichStrategy merges the credit score',
    '// into the LoanRequest → EnrichedLoanRequest',
  ], "Figure 10.3 — EnricherRoute: augmenting loan requests with credit scores");
  addNotes(s, "The EnricherRoute takes the raw loan request and augments it with the customer's credit score. It consumes from the loan.requests topic, deserializes the LoanRequest, and calls the content enricher with a reference to the credit bureau service. The CreditScoreEnrichStrategy merges the credit score into the loan request, producing an EnrichedLoanRequest with the additional creditScore field. The enriched request is serialized and sent to the loan.enriched topic for the next stage. The credit bureau service is a simulated CDI bean that returns a score based on the customer ID — in a real system, this would be an HTTP call to an external credit reporting agency. The enricher pattern cleanly separates the enrichment source from the enrichment logic — you could swap the credit bureau without changing the route.");
}

// Slide 102: RecipientListRoute — code
{
  const s = S();
  addCodeSlide(s, "CASE STUDY: LOAN BROKER", "RecipientListRoute — Fan Out to Banks", "Java", [
    '@ApplicationScoped',
    'public class RecipientListRoute extends RouteBuilder {',
    '    @Override',
    '    public void configure() {',
    '        from("kafka:eip.loan.enriched?groupId=dispatcher")',
    '            .routeId("bank-dispatcher")',
    '            .unmarshal().json(EnrichedLoanRequest.class)',
    '            .recipientList(',
    '                method(BankRegistry.class, "getEligibleBanks"))',
    '            .parallelProcessing();',
    '    }',
    '}',
    '',
    '@ApplicationScoped',
    'public class BankRegistry {',
    '    public String[] getEligibleBanks(',
    '            @Body EnrichedLoanRequest request) {',
    '        // Filter banks by credit score requirements',
    '        return bankConfigs.stream()',
    '            .filter(b -> request.creditScore() >= b.minScore())',
    '            .map(b -> "direct:" + b.routeEndpoint())',
    '            .toArray(String[]::new);',
    '    }',
    '}',
  ], "Figure 10.4 — RecipientListRoute: fanning out to eligible banks in parallel");
  addNotes(s, "The RecipientListRoute is where the scatter phase of scatter-gather happens. It consumes enriched loan requests and fans them out to multiple bank services. The BankRegistry bean determines which banks are eligible based on the customer's credit score — a customer with a 580 score will not be sent to a bank that requires 700 minimum. This is a content-based filtering of the recipient list, combining two patterns in one step. The parallelProcessing() modifier ensures all eligible banks receive the request concurrently, minimizing the total response time. Each bank endpoint is a direct: endpoint that routes to a simulated bank service. The recipient list returns an array of endpoint URIs, and Camel sends a copy of the exchange to each one. The correlation ID set by the GatewayRoute travels with each copy, enabling the aggregator to collect all responses.");
}

// Slide 103: BankRoutes — code
{
  const s = S();
  addCodeSlide(s, "CASE STUDY: LOAN BROKER", "BankRoutes — Simulated Rate Calculation", "Java", [
    '@ApplicationScoped',
    'public class BankRoutes extends RouteBuilder {',
    '    @Override',
    '    public void configure() {',
    '        from("direct:bank-alpha")',
    '            .routeId("bank-alpha")',
    '            .bean(BankAlphaRateCalculator.class)',
    '            .to("kafka:eip.loan.bank-responses");',
    '',
    '        from("direct:bank-beta")',
    '            .routeId("bank-beta")',
    '            .delay(simple("${random(100,500)}"))',
    '            .bean(BankBetaRateCalculator.class)',
    '            .to("kafka:eip.loan.bank-responses");',
    '',
    '        from("direct:bank-gamma")',
    '            .routeId("bank-gamma")',
    '            .delay(simple("${random(200,800)}"))',
    '            .bean(BankGammaRateCalculator.class)',
    '            .to("kafka:eip.loan.bank-responses");',
    '    }',
    '}',
  ], "Figure 10.5 — BankRoutes: three banks with different rates and response times");
  addNotes(s, "The BankRoutes define three simulated bank services, each with its own rate calculation logic and simulated response latency. Bank Alpha responds immediately with its rate. Bank Beta adds a random delay of 100-500ms to simulate real-world network and processing latency. Bank Gamma has an even longer delay of 200-800ms. Each bank's rate calculator is a CDI bean that takes the enriched loan request and returns a BankRate record with the bank name, interest rate, and terms. All bank responses are produced to the same eip.loan.bank-responses Kafka topic, carrying the correlation ID from the original request. The variable delays make the scatter-gather pattern more realistic — the aggregator must handle responses arriving at different times, possibly out of order. The delay() DSL method uses Camel's simple language with the random() function to introduce variability.");
}

// Slide 104: AggregatorRoute — code
{
  const s = S();
  addCodeSlide(s, "CASE STUDY: LOAN BROKER", "AggregatorRoute — Collecting the Best Rate", "Java", [
    '@ApplicationScoped',
    'public class AggregatorRoute extends RouteBuilder {',
    '    @Override',
    '    public void configure() {',
    '        from("kafka:eip.loan.bank-responses?groupId=aggregator")',
    '            .routeId("rate-aggregator")',
    '            .unmarshal().json(BankRate.class)',
    '            .aggregate(header("correlationId"),',
    '                new BestRateStrategy())',
    '                .completionSize(header("expectedBanks"))',
    '                .completionTimeout(10_000)',
    '            .log("Best rate: ${body.bankName} @ ${body.rate}%")',
    '            .marshal().json()',
    '            .to("kafka:eip.loan.results");',
    '    }',
    '}',
    '',
    '// BestRateStrategy: compare rates, keep the lowest.',
    '// completionSize: release when all banks respond.',
    '// completionTimeout: release after 10s if some banks are slow.',
  ], "Figure 10.6 — AggregatorRoute: collecting bank responses and selecting the best rate");
  addNotes(s, "The AggregatorRoute is the gather phase of scatter-gather. It consumes bank responses from the shared bank-responses topic and groups them by correlation ID. The BestRateStrategy compares each incoming bank rate against the current best — the aggregate always contains the lowest rate seen so far. Completion has two triggers: completionSize releases the aggregate when all expected bank responses have arrived (the count was set as a header by the recipient list), and completionTimeout releases after 10 seconds even if some banks have not responded. This timeout is essential — a bank might be down or slow, and you should not make the customer wait indefinitely. The aggregated result — the single best rate — is produced to the loan.results topic. This closes the scatter-gather loop: request scattered to banks, responses gathered and aggregated, best result selected.");
}

// Slide 105: Loan Broker architecture — diagram
{
  const s = S();
  addDiagramSlide(s, "CASE STUDY: LOAN BROKER", "Loan Broker — End-to-End Architecture", "28-loan-broker",
    "Figure 10.7 — Complete Loan Broker scatter-gather architecture with EIP stencils");
  addNotes(s, "This diagram shows the complete Loan Broker architecture using canonical EIP stencils. The customer submits a loan request via REST. The messaging gateway bridges HTTP to Kafka. The content enricher adds the credit score from a simulated credit bureau. The recipient list fans out to eligible banks based on credit score. Each bank calculates a rate independently. The aggregator gathers all bank responses and selects the best rate. This is the scatter-gather pattern in action — 13 EIP patterns working together in a single end-to-end flow.");
}

// Slide 106: DemoRoute
{
  const s = S();
  addContentTitle(s, "CASE STUDY: LOAN BROKER", "DemoRoute — Generating Test Requests");
  addBullets(s, bsub([
    { text: "Timer-based test data generator", sub: "Produces a new loan request every 10 seconds for demo purposes" },
    { text: "Randomized parameters", sub: "Random customer IDs, loan amounts ($10K-$500K), and terms (12-360 months)" },
    { text: "Test Message pattern", sub: "Header marks these as demo data — production routes can filter them out" },
    { text: "Console output", sub: "Logs the full flow: request → credit score → bank rates → best rate" },
    { text: "Disable in production", sub: "Controlled by a Quarkus profile — only active in dev mode" },
  ]));
  addNotes(s, "The DemoRoute generates synthetic loan requests on a timer so you can see the entire Loan Broker flow in action without a REST client. It creates randomized loan parameters — different customer IDs, amounts, and terms — to exercise different code paths. The generated requests are marked with a testMessage header so production routes can distinguish them from real requests. In the console output, you can watch the complete flow: the gateway receives the request, the enricher adds the credit score, the recipient list fans out to eligible banks, each bank calculates a rate, and the aggregator selects the best one. This is the Test Message pattern from the EIP catalog. The DemoRoute is only active in dev mode — a Quarkus profile condition ensures it does not run in production. This pattern of including a demo data generator in every example makes the tutorial self-demonstrating.");
}

// Slide 106: 13 EIP patterns working together — status table
{
  const s = S();
  addContentTitle(s, "CASE STUDY: LOAN BROKER", "13 EIP Patterns in the Loan Broker");
  addStatusTable(s, [
    { code: "1",  name: "Channel Adapter",      purpose: "REST → Kafka bridge", codeColor: COLOR.svc },
    { code: "2",  name: "Messaging Gateway",     purpose: "ProducerTemplate hides Kafka", codeColor: COLOR.svc },
    { code: "3",  name: "Content Enricher",      purpose: "Credit score augmentation", codeColor: COLOR.svc },
    { code: "4",  name: "Recipient List",         purpose: "Fan-out to eligible banks", codeColor: COLOR.data },
    { code: "5",  name: "Scatter-Gather",        purpose: "Broadcast + collect best rate", codeColor: COLOR.data },
    { code: "6",  name: "Aggregator",            purpose: "Best rate selection", codeColor: COLOR.data },
    { code: "7",  name: "Correlation ID",         purpose: "Request → response matching", codeColor: COLOR.platform },
    { code: "8",  name: "Request-Reply",          purpose: "Sync over async via gateway", codeColor: COLOR.platform },
    { code: "9",  name: "Content-Based Router",   purpose: "Bank eligibility filtering", codeColor: COLOR.platform },
    { code: "10", name: "Message Translator",     purpose: "LoanRequest → EnrichedLoanRequest", codeColor: COLOR.govern },
    { code: "11", name: "Service Activator",      purpose: "Bean-based rate calculation", codeColor: COLOR.govern },
    { code: "12", name: "Message Filter",          purpose: "Credit score threshold", codeColor: COLOR.govern },
    { code: "13", name: "Test Message",            purpose: "DemoRoute canary generator", codeColor: COLOR.red },
  ], { colW: [0.80, 2.60, 8.69], rowH: 0.37 });
  addNotes(s, "This table lists all 13 EIP patterns used in the Loan Broker. What makes this case study powerful is not any individual pattern — it is how they compose together into a coherent workflow. The channel adapter bridges REST to Kafka. The messaging gateway hides Kafka from the REST layer. The content enricher augments requests with credit scores. The recipient list fans out to banks. The scatter-gather combines fan-out with aggregation. The correlation ID ties requests to responses across asynchronous boundaries. The content-based router filters banks by eligibility. The message translator converts between record types at each stage. The service activator bridges messaging to business logic. The message filter applies minimum credit score requirements. And the test message pattern enables self-demonstrating operation. This is what real integration architecture looks like — multiple patterns working in concert.");
}

// Slide 107: Running it
{
  const s = S();
  addContentTitle(s, "CASE STUDY: LOAN BROKER", "Running the Loan Broker Example");
  addBullets(s, bsub([
    { text: "Start infrastructure", sub: "./scripts/setup-stack.sh — Kafka, Redis, PostgreSQL" },
    { text: "Launch the example", sub: "cd examples/loan-broker && mvn quarkus:dev" },
    { text: "Watch the console", sub: "DemoRoute generates requests every 10 seconds — watch the full flow" },
    { text: "Send a manual request", sub: 'curl -X POST http://localhost:8080/api/loans -H "Content-Type: application/json" -d \'{"customerId":"C-100","amount":250000,"termMonths":360}\'' },
    { text: "Observe in Grafana", sub: "http://localhost:3000 — trace the request across all five routes" },
    { text: "Experiment", sub: "Add a fourth bank, change the aggregation strategy, adjust timeouts" },
  ]));
  addNotes(s, "Running the Loan Broker is a two-step process: start the infrastructure stack and then launch the Quarkus application. The DemoRoute immediately starts generating test loan requests, so you will see output in the console within 10 seconds. You can also send manual requests with curl to test specific scenarios — different customer IDs will get different credit scores, affecting which banks are eligible. If you started the infrastructure with --lgtm, open Grafana at localhost:3000 and search for traces by the order-service service name. You can follow a single loan request from REST receipt through credit score enrichment, bank fan-out, and rate aggregation — all in a single Tempo trace. The best way to learn is to experiment: add a fourth bank with a different pricing model, change the BestRateStrategy to prefer a different criteria, or adjust the aggregation timeout to see what happens when a bank is too slow.");
}

// ============================================================================
// SECTION 11 — Case Study: Bond Trading  (10 slides)
// ============================================================================

divider("11", "Case Study\nBond Trading", "16 EIP patterns in a financial market data system",
  "Section 11 presents the Bond Trading case study — a financial market data distribution system that normalizes feeds from multiple data providers, aggregates best prices, filters updates for trading desks, and validates trades. This example demonstrates 16 EIP patterns in a more complex, multi-feed scenario. It shows how the same Camel Java DSL patterns scale from simple order processing to sophisticated financial data workflows.");

// Slide 108: The Bond Trading problem — diagram
{
  const s = S();
  addDiagramSlide(s, "CASE STUDY: BOND TRADING", "The Bond Trading Problem", "29-bond-trading",
    "Figure 11.1 — Bond Trading: market data feeds → normalization → desk distribution → trade validation");
  addNotes(s, "The Bond Trading case study models a financial market data distribution system. Multiple data providers — Bloomberg, Reuters, and exchange direct feeds — publish bond price updates in their own proprietary formats. The system must normalize these disparate feeds into a canonical price format, aggregate the best price across providers for each bond, distribute filtered price updates to the relevant trading desks (corporate bonds, government bonds, mortgage-backed securities), validate and deduplicate trade requests, and provide an audit trail. This is a significantly more complex scenario than the Loan Broker because it involves continuous high-frequency data streams rather than discrete request-response cycles. The patterns used here demonstrate how EIP patterns handle real-time data processing and multi-consumer distribution.");
}

// Slide 109: Market data distribution
{
  const s = S();
  addIconGrid(s, "CASE STUDY: BOND TRADING", "Market Data Distribution — Three Feed Sources", [
    { icon: "channel-adapter", label: "Bloomberg Feed", desc: "JSON format\nFields: TICKER, BID_PRICE, ASK_PRICE, LAST_UPDATE" },
    { icon: "channel-adapter", label: "Reuters Feed", desc: "JSON format\nFields: ric, bid, ask, timestamp — different naming" },
    { icon: "channel-adapter", label: "Exchange Direct", desc: "JSON format\nFields: symbol, bidPrice, askPrice, tradeTime" },
    { icon: "normalizer", label: "Normalization", desc: "Three sources, three formats, one canonical BondQuote model" },
    { icon: null, label: "Real-Time", desc: "~100-1000 updates/sec — must process with low latency" },
    { icon: null, label: "Reliability", desc: "Missed or duplicated prices lead to incorrect trading decisions" },
  ], { cols: 3, cellH: 2.10 });
  addNotes(s, "Financial market data is a classic integration challenge. Each data provider uses its own format, naming conventions, and delivery mechanisms. Bloomberg uses all-caps field names. Reuters uses lowercase with its own identifiers (RIC codes). Exchange direct feeds have their own conventions. The downstream trading desks should not care about these differences — they need a single, consistent price format. This is exactly the normalizer pattern at scale. The performance requirements are demanding: market data arrives at high frequency, and each update must be processed with minimal latency because stale prices lead to bad trading decisions. The reliability requirements are equally demanding: duplicate prices could trigger duplicate trades, and missed prices could cause traders to act on outdated information. These requirements make this case study an excellent test of Camel's throughput and reliability patterns.");
}

// Slide 110: ChannelAdapterRoutes — code
{
  const s = S();
  addCodeSlide(s, "CASE STUDY: BOND TRADING", "ChannelAdapterRoutes — Normalizing Raw Feeds", "Java", [
    '@ApplicationScoped',
    'public class ChannelAdapterRoutes extends RouteBuilder {',
    '    @Override',
    '    public void configure() {',
    '        from("kafka:eip.feed.bloomberg?groupId=adapter")',
    '            .routeId("bloomberg-adapter")',
    '            .unmarshal().json(BloombergQuote.class)',
    '            .bean(BloombergNormalizer.class, "normalize")',
    '            .to("direct:normalized-quotes");',
    '',
    '        from("kafka:eip.feed.reuters?groupId=adapter")',
    '            .routeId("reuters-adapter")',
    '            .unmarshal().json(ReutersQuote.class)',
    '            .bean(ReutersNormalizer.class, "normalize")',
    '            .to("direct:normalized-quotes");',
    '',
    '        from("kafka:eip.feed.exchange?groupId=adapter")',
    '            .routeId("exchange-adapter")',
    '            .unmarshal().json(ExchangeQuote.class)',
    '            .bean(ExchangeNormalizer.class, "normalize")',
    '            .to("direct:normalized-quotes");',
    '    }',
    '}',
  ], "Figure 11.2 — Channel adapters: three feeds normalized to canonical BondQuote");
  addNotes(s, "The ChannelAdapterRoutes implement both the channel adapter and normalizer patterns. Each data feed arrives on its own Kafka topic in its own format. Each adapter route deserializes the provider-specific format, runs it through a provider-specific normalizer bean, and produces the result to the shared direct:normalized-quotes endpoint. The Bloomberg normalizer maps TICKER to symbol, BID_PRICE to bid, and ASK_PRICE to ask. The Reuters normalizer maps ric to symbol, bid to bid, and ask to ask. The exchange normalizer maps its own field names. All three produce the same canonical BondQuote record. This is the normalizer pattern in action: three input formats, three translators, one canonical output. Adding a fourth data provider requires only adding one more route and one more normalizer bean — the rest of the pipeline is untouched.");
}

// Slide 111: NormalizerRoute — code
{
  const s = S();
  addCodeSlide(s, "CASE STUDY: BOND TRADING", "NormalizerRoute — Best-Price Aggregation", "Java", [
    '@ApplicationScoped',
    'public class NormalizerRoute extends RouteBuilder {',
    '    @Override',
    '    public void configure() {',
    '        from("direct:normalized-quotes")',
    '            .routeId("best-price-aggregator")',
    '            .aggregate(simple("${body.symbol}"),',
    '                new BestPriceStrategy())',
    '                .completionTimeout(500)',
    '                .completionSize(3)',
    '            .log("Best price for ${body.symbol}: ' +
    '                bid=${body.bid} ask=${body.ask}")',
    '            .marshal().json()',
    '            .to("kafka:eip.quotes.best-price");',
    '    }',
    '}',
    '',
    '// BestPriceStrategy: for each bond symbol, keep the',
    '// tightest spread (lowest ask - bid difference).',
    '// Releases every 500ms or when all 3 providers report.',
  ], "Figure 11.3 — Aggregating quotes from three providers to find best price");
  addNotes(s, "The NormalizerRoute aggregates quotes from all three data providers to determine the best price for each bond. The correlation key is the bond symbol — all quotes for the same bond are grouped together. The BestPriceStrategy selects the quote with the tightest bid-ask spread (the smallest difference between ask and bid prices), which represents the best deal for traders. The completion strategy uses both timeout and size: the aggregate releases after 500ms or when all three providers have reported, whichever comes first. The 500ms timeout handles the case where one provider is slow or has stopped reporting for a particular bond — you should not wait indefinitely. This aggregator pattern is similar to the Loan Broker's BestRateStrategy but operates continuously on a stream rather than on discrete requests.");
}

// Slide 112: DeskDistributorRoute — code
{
  const s = S();
  addCodeSlide(s, "CASE STUDY: BOND TRADING", "DeskDistributorRoute — Content-Based Filtering", "Java", [
    '@ApplicationScoped',
    'public class DeskDistributorRoute extends RouteBuilder {',
    '    @Override',
    '    public void configure() {',
    '        from("kafka:eip.quotes.best-price?groupId=distributor")',
    '            .routeId("desk-distributor")',
    '            .unmarshal().json(BondQuote.class)',
    '            .choice()',
    '                .when(simple("${body.bondType} == \'CORPORATE\'"))',
    '                    .to("kafka:eip.desk.corporate")',
    '                .when(simple("${body.bondType} == \'GOVERNMENT\'"))',
    '                    .to("kafka:eip.desk.government")',
    '                .when(simple("${body.bondType} == \'MBS\'"))',
    '                    .to("kafka:eip.desk.mbs")',
    '                .otherwise()',
    '                    .log(LoggingLevel.WARN,',
    '                        "Unknown bond type: ${body.bondType}")',
    '                    .to("kafka:eip.desk.unclassified")',
    '            .end();',
    '    }',
    '}',
  ], "Figure 11.4 — Content-based routing: distributing quotes to specialized trading desks");
  addNotes(s, "The DeskDistributorRoute implements the content-based router pattern to distribute best-price quotes to the appropriate trading desk. Corporate bonds go to the corporate desk topic, government bonds to the government desk, and mortgage-backed securities to the MBS desk. Each trading desk subscribes only to its own topic, receiving a filtered stream of relevant quotes. The otherwise clause catches bonds that do not match any known type — these go to an unclassified topic for manual review rather than being silently dropped. This is the publish-subscribe pattern in combination with content-based routing: the best-price topic acts as a pub/sub channel, and the content-based router acts as a selective dispatcher. Each trading desk is effectively a selective consumer — it only sees quotes relevant to its bond type.");
}

// Slide 113: TradeValidationRoute — code
{
  const s = S();
  addCodeSlide(s, "CASE STUDY: BOND TRADING", "TradeValidationRoute — Idempotent + Wire Tap", "Java", [
    '@ApplicationScoped',
    'public class TradeValidationRoute extends RouteBuilder {',
    '    @Inject RedissonClient redisClient;',
    '',
    '    @Override',
    '    public void configure() {',
    '        from("kafka:eip.trades.submitted?groupId=validator")',
    '            .routeId("trade-validator")',
    '            // Idempotent consumer — prevent duplicate trades',
    '            .idempotentConsumer(',
    '                header("tradeId"),',
    '                RedisIdempotentRepository',
    '                    .redisIdempotentRepository(',
    '                        redisClient, "trades"))',
    '            // Wire tap — audit every trade',
    '            .wireTap("kafka:eip.audit.trades")',
    '            // Validate trade parameters',
    '            .bean(TradeValidator.class)',
    '            .to("kafka:eip.trades.validated");',
    '    }',
    '}',
  ], "Figure 11.5 — Trade validation: idempotent consumer prevents duplicate trades, wire tap for audit");
  addNotes(s, "The TradeValidationRoute combines two critical patterns: idempotent consumer and wire tap. The idempotent consumer is non-negotiable in financial systems — a duplicate trade execution could cost millions. The Redis-backed repository ensures that each trade ID is processed exactly once, even if Kafka redelivers the message. The wire tap copies every trade to an audit topic for compliance recording — financial regulations require a complete audit trail of all trading activity. The trade validator bean performs business validation: checking that the trade quantity is within limits, the price is within the current market range, and the trader has authorization for this bond type. Only validated trades proceed to the validated trades topic. Note the ordering: deduplication first, then audit, then validation. This ensures the audit captures every unique trade attempt, including those that fail validation.");
}

// Slide 114: Bond Trading architecture — diagram
{
  const s = S();
  addDiagramSlide(s, "CASE STUDY: BOND TRADING", "Bond Trading — Market Data Distribution", "29-bond-trading",
    "Figure 11.6 — Bond trading architecture: normalize, aggregate, distribute, trade, audit");
  addNotes(s, "This diagram shows the complete Bond Trading architecture using canonical EIP stencils. Three market data feeds (Bloomberg, Reuters, Exchange) are normalized into a canonical BondQuote format via channel adapters and normalizer. The aggregator selects the best price per symbol. A content-based router distributes quotes to the appropriate trading desk based on bond type. The trade engine validates and executes trades. A wire tap copies every trade to an audit topic for compliance. This system demonstrates 16 EIP patterns working together for real-time market data distribution.");
}

// Slide 115: DemoDataRoute
{
  const s = S();
  addContentTitle(s, "CASE STUDY: BOND TRADING", "DemoDataRoute — Generating Test Market Data");
  addBullets(s, bsub([
    { text: "Simulated market data generator", sub: "Produces random price updates every 100ms — realistic feed simulation" },
    { text: "Three provider formats", sub: "Generates Bloomberg, Reuters, and Exchange format quotes simultaneously" },
    { text: "Realistic price movements", sub: "Random walk with drift — prices move realistically around a base value" },
    { text: "Multiple bond symbols", sub: "US Treasury, corporate bonds, MBS — exercising all desk distribution paths" },
    { text: "Dev mode only", sub: "Quarkus profile ensures demo data does not run in production" },
  ]));
  addNotes(s, "The DemoDataRoute generates realistic simulated market data so the Bond Trading system can demonstrate its full functionality. It produces price updates at 100ms intervals — 10 updates per second — which is realistic for a mid-tier market data feed. The generator creates quotes in all three provider formats (Bloomberg, Reuters, Exchange) and distributes them to the corresponding feed topics. The price simulation uses a random walk algorithm that makes prices move realistically: small incremental changes with occasional larger moves, bid prices always lower than ask prices, and spreads that widen and tighten over time. Multiple bond symbols are generated to exercise all three desk distribution paths: US Treasury bonds for the government desk, corporate bonds for the corporate desk, and mortgage-backed securities for the MBS desk.");
}

// Slide 115: 16 EIP patterns in Bond Trading — status table
{
  const s = S();
  addContentTitle(s, "CASE STUDY: BOND TRADING", "16 EIP Patterns in Bond Trading");
  addStatusTable(s, [
    { code: "1",  name: "Channel Adapter",        purpose: "Three feed sources → Kafka", codeColor: COLOR.svc },
    { code: "2",  name: "Normalizer",              purpose: "Three formats → canonical BondQuote", codeColor: COLOR.svc },
    { code: "3",  name: "Message Translator",      purpose: "Provider-specific → canonical mapping", codeColor: COLOR.svc },
    { code: "4",  name: "Aggregator",              purpose: "Best-price selection per symbol", codeColor: COLOR.data },
    { code: "5",  name: "Content-Based Router",    purpose: "Desk distribution by bond type", codeColor: COLOR.data },
    { code: "6",  name: "Idempotent Consumer",     purpose: "Prevent duplicate trade execution", codeColor: COLOR.data },
    { code: "7",  name: "Wire Tap",                purpose: "Audit trail for compliance", codeColor: COLOR.platform },
    { code: "8",  name: "Pub/Sub Channel",          purpose: "Best-price topic → multiple desks", codeColor: COLOR.platform },
    { code: "9",  name: "Point-to-Point",           purpose: "Trade validation queue", codeColor: COLOR.platform },
    { code: "10", name: "Dead Letter Channel",      purpose: "Failed quote processing", codeColor: COLOR.govern },
    { code: "11", name: "Service Activator",        purpose: "Bean-based trade validation", codeColor: COLOR.govern },
    { code: "12", name: "Canonical Data Model",     purpose: "Shared BondQuote, Trade records", codeColor: COLOR.govern },
    { code: "13", name: "Message Filter",            purpose: "Desk-level quote filtering", codeColor: COLOR.red },
    { code: "14", name: "Competing Consumers",       purpose: "Parallel feed processing", codeColor: COLOR.red },
    { code: "15", name: "Durable Subscriber",        purpose: "Offset-based Kafka consumption", codeColor: COLOR.red },
    { code: "16", name: "Test Message",              purpose: "Simulated market data generation", codeColor: COLOR.red },
  ], { colW: [0.80, 2.60, 8.69], rowH: 0.30 });
  addNotes(s, "The Bond Trading case study uses 16 EIP patterns — three more than the Loan Broker. The additional patterns reflect the higher complexity of continuous stream processing versus request-response. The normalizer and three message translators handle multi-format input. The aggregator performs continuous best-price computation. The content-based router distributes to specialized trading desks. The idempotent consumer prevents catastrophic duplicate trades. The wire tap provides the compliance audit trail required by financial regulations. Pub/sub and point-to-point channels are used for different messaging needs. Competing consumers provide throughput scaling for high-frequency feeds. The combination of these 16 patterns creates a realistic financial data distribution and trade validation system.");
}

// Slide 116: Running Bond Trading
{
  const s = S();
  addContentTitle(s, "CASE STUDY: BOND TRADING", "Running the Bond Trading Example");
  addBullets(s, bsub([
    { text: "Start infrastructure", sub: "./scripts/setup-stack.sh — Kafka, Redis, PostgreSQL" },
    { text: "Launch the example", sub: "cd examples/bond-trading && mvn quarkus:dev" },
    { text: "Watch the feeds", sub: "Console shows normalized quotes, best prices, and desk distribution" },
    { text: "Observe aggregation", sub: "Best-price updates consolidate three feeds into one per symbol" },
    { text: "Submit a test trade", sub: 'curl -X POST http://localhost:8080/api/trades -d \'{"symbol":"US10Y","qty":100,"price":98.5}\'' },
    { text: "Check the audit trail", sub: "Wire tap captures all trade activity on eip.audit.trades topic" },
  ]));
  addNotes(s, "Running the Bond Trading example follows the same pattern as the Loan Broker: start the infrastructure and launch with mvn quarkus:dev. The console output is more verbose because market data arrives continuously — you will see a steady stream of normalized quotes, best-price aggregations, and desk distribution decisions. The best-price aggregator is particularly interesting to watch: you can see quotes from Bloomberg, Reuters, and the Exchange being combined, with the best spread being selected every 500ms. You can submit test trades via curl and verify that the idempotent consumer prevents duplicates — submit the same trade twice and see the second one rejected. The wire tap captures everything on the audit topic. If you are running with --lgtm, Grafana traces show the full lifecycle of a price update from raw feed through normalization, aggregation, desk distribution, and trade validation.");
}

// Slide 117: Comparing Loan Broker and Bond Trading
{
  const s = S();
  addContentTitle(s, "CASE STUDY: BOND TRADING", "Comparing the Case Studies");
  addStatusTable(s, [
    { code: "Aspect",     name: "Loan Broker",               purpose: "Bond Trading", codeColor: COLOR.ink },
    { code: "Flow",       name: "Request-response",          purpose: "Continuous stream processing", codeColor: COLOR.svc },
    { code: "Patterns",   name: "13 patterns",               purpose: "16 patterns", codeColor: COLOR.svc },
    { code: "Scale",      name: "~10 requests/min",          purpose: "~100-1000 updates/sec", codeColor: COLOR.data },
    { code: "Key EIP",    name: "Scatter-Gather",            purpose: "Normalizer + Aggregator", codeColor: COLOR.data },
    { code: "Challenge",  name: "Timeout management",        purpose: "Throughput + deduplication", codeColor: COLOR.platform },
    { code: "Routes",     name: "6 route classes",           purpose: "5 route classes", codeColor: COLOR.platform },
    { code: "Domain",     name: "Financial lending",         purpose: "Capital markets trading", codeColor: COLOR.govern },
  ], { colW: [1.30, 3.80, 6.99], rowH: 0.50 });
  addNotes(s, "These two case studies demonstrate the same Camel Java DSL patterns but in very different contexts. The Loan Broker is request-response: a customer sends a request, the system processes it through multiple stages, and returns a single response. Bond Trading is continuous stream processing: data flows constantly, aggregation is ongoing, and there is no single request-response cycle. The Loan Broker's key challenge is timeout management — waiting for banks to respond and knowing when to give up. Bond Trading's key challenge is throughput and deduplication — processing hundreds of updates per second while preventing duplicate trades. Both use the same underlying DSL — choice(), aggregate(), bean(), wireTap() — but the composition is different. This demonstrates that EIP patterns are truly universal: the same patterns apply whether you are building a loan origination system or a financial market data platform.");
}

// ============================================================================
// SECTION 12 — Closing + Appendices  (6 slides)
// ============================================================================

divider("12", "Closing\n& Appendices", "Key takeaways, reference catalogs, and resources",
  "Section 12 wraps up the deck with key takeaways, comparison tables, reference catalogs, and resources for continued learning. These slides serve as a quick-reference appendix you can return to when designing your own integrations.");

// Slide 118: Key takeaways
{
  const s = S();
  addContentTitle(s, "CLOSING", "Key Takeaways");
  addBullets(s, bsub([
    { text: "Patterns are reusable, compositions are unique", sub: "The 65 EIP patterns are universal — how you combine them defines your architecture" },
    { text: "Camel Java DSL makes patterns tangible", sub: "choice(), split(), aggregate(), wireTap() — patterns become method calls, not just diagrams" },
    { text: "Quarkus transforms the developer experience", sub: "Sub-second startup, live reload, Dev Services, native builds — production-ready from dev mode" },
    { text: "Infrastructure matters", sub: "Kafka, Pulsar, Redis, PostgreSQL — each solves a specific problem in the integration stack" },
    { text: "Observability is non-negotiable", sub: "Traces, metrics, logs — you cannot debug what you cannot see" },
    { text: "Start with the patterns, not the framework", sub: "Design with patterns first, then implement with Camel — not the other way around" },
  ]));
  addNotes(s, "Let us distill this entire deck into six key takeaways. First, the patterns themselves are universal and reusable — they apply regardless of your technology stack. What makes your architecture unique is how you compose them together, as we saw in the Loan Broker and Bond Trading case studies. Second, Camel's Java DSL makes patterns tangible — you can write choice() instead of describing a content-based router on a whiteboard. Third, Quarkus provides the production-grade runtime that makes Camel viable for cloud-native applications. Fourth, choosing the right infrastructure for each concern — Kafka for event streams, Redis for caching, PostgreSQL for transactions — is as important as choosing the right patterns. Fifth, observability must be built in from day one, not bolted on after the first production incident. And sixth, always start by identifying which patterns your integration needs, then reach for the Camel DSL to implement them.");
}

// Slide 119: Spring Boot vs Quarkus comparison
{
  const s = S();
  addContentTitle(s, "CLOSING", "Spring Boot vs Quarkus for Camel");
  addStatusTable(s, [
    { code: "Aspect",     name: "Spring Boot",                        purpose: "Quarkus", codeColor: COLOR.ink },
    { code: "Startup",    name: "~3-5 seconds (JVM)",                purpose: "~0.3 seconds (JVM), ~0.02s native", codeColor: COLOR.svc },
    { code: "Memory",     name: "~250-400 MB RSS",                   purpose: "~80-150 MB (JVM), ~50 MB native", codeColor: COLOR.svc },
    { code: "DI",         name: "Spring DI (runtime reflection)",    purpose: "CDI (build-time, ArC compiler)", codeColor: COLOR.data },
    { code: "Dev Mode",   name: "Spring Boot DevTools (restart)",    purpose: "Quarkus Dev Mode (hot reload, no restart)", codeColor: COLOR.data },
    { code: "Native",     name: "Spring Native (experimental)",     purpose: "GraalVM native (production-ready)", codeColor: COLOR.platform },
    { code: "Test",       name: "@SpringBootTest",                   purpose: "@QuarkusTest + continuous testing", codeColor: COLOR.platform },
    { code: "Ecosystem",  name: "Largest Java ecosystem",           purpose: "Cloud-native focused, growing fast", codeColor: COLOR.govern },
  ], { colW: [1.20, 3.80, 7.09], rowH: 0.50 });
  addNotes(s, "Both Spring Boot and Quarkus are excellent runtimes for Apache Camel. Spring Boot has the larger ecosystem and more widespread adoption — if your organization is already a Spring shop, camel-spring-boot is a natural fit. Quarkus excels in cloud-native scenarios: dramatically faster startup, lower memory footprint, and production-ready native compilation. The developer experience difference is significant — Quarkus Dev Mode does true hot reload without JVM restart, and Dev Services auto-start dependencies. For this tutorial, we chose Quarkus because its developer experience makes it faster to learn and experiment with Camel patterns. However, every Camel route in this deck works identically on Spring Boot — only the bootstrap and configuration mechanism changes. The patterns and the Java DSL are runtime-agnostic.");
}

// Slide 120: 65-pattern reference catalog
{
  const s = S();
  addContentTitle(s, "CLOSING", "The 65-Pattern Reference Catalog");
  addStatusTable(s, [
    { code: "Ch 03",   name: "Messaging Channels (8)",     purpose: "P2P, Pub/Sub, Dead Letter, Datatype, Invalid, Guaranteed, Adapter, Bridge", codeColor: COLOR.svc },
    { code: "Ch 04",   name: "Message Construction (6)",   purpose: "Command, Document, Event, Request-Reply, Return Address, Correlation ID", codeColor: COLOR.svc },
    { code: "Ch 05",   name: "Message Routing (13)",       purpose: "CBR, Filter, Dynamic, Recipient, Splitter, Aggregator, Scatter-Gather, Slip, ...", codeColor: COLOR.data },
    { code: "Ch 06",   name: "Transformation (8)",         purpose: "Translator, Envelope, Enricher, Content Filter, Claim Check, Normalizer, ...", codeColor: COLOR.data },
    { code: "Ch 07",   name: "Endpoints (10)",             purpose: "Gateway, Transactional, Polling, Event-Driven, Competing, Idempotent, ...", codeColor: COLOR.platform },
    { code: "Ch 08",   name: "System Management (9)",      purpose: "Control Bus, Wire Tap, History, Store, Detour, Test, Purger, Smart Proxy, ...", codeColor: COLOR.platform },
    { code: "Ch 09",   name: "Integration Styles (4)",     purpose: "File Transfer, Shared Database, RPC, Messaging", codeColor: COLOR.govern },
    { code: "Ch 10-11", name: "Compound Patterns (7)",     purpose: "Pipes & Filters, Process Manager, Composed Processor, Message Broker, ...", codeColor: COLOR.govern },
  ], { colW: [1.20, 3.00, 8.00], rowH: 0.50 });
  addNotes(s, "This table provides a bird's-eye view of all 65 Enterprise Integration Patterns organized by category. The tutorial covers every single one — each pattern has a chapter with explanation, diagram, and runnable Camel Java DSL example. Messaging channels define how messages travel between components. Message construction defines the messages themselves. Message routing determines where messages go. Transformation modifies messages in transit. Endpoints connect applications to the messaging system. System management provides operational control. Integration styles describe the four fundamental approaches to system integration. And compound patterns combine multiple patterns into higher-level abstractions. This catalog is your reference guide — when you face an integration problem, scan these categories to identify which patterns apply, then look at the corresponding tutorial chapter for implementation details.");
}

// Slide 121: Runnable examples — status table
{
  const s = S();
  addContentTitle(s, "CLOSING", "The Runnable Examples Catalog");
  addStatusTable(s, [
    { code: "01", name: "04-channel-types",          purpose: "P2P, Pub/Sub, Datatype — Kafka + Pulsar + Redis", codeColor: COLOR.svc },
    { code: "02", name: "05-reliability",             purpose: "Dead letter channel, guaranteed delivery", codeColor: COLOR.svc },
    { code: "03", name: "06-channel-infra",           purpose: "Channel adapter, Kafka↔Pulsar bridge, message bus", codeColor: COLOR.svc },
    { code: "04", name: "07/08-messages",             purpose: "Command/Document/Event, correlation, sequence, expiration", codeColor: COLOR.data },
    { code: "05", name: "09-routing-fundamentals",    purpose: "CBR, filter, splitter, recipient list", codeColor: COLOR.data },
    { code: "06", name: "10/11-composed+advanced",    purpose: "Scatter-gather, routing slip, dynamic router, resequencer", codeColor: COLOR.data },
    { code: "07", name: "12-transformation",          purpose: "Translator, enricher (Redis), content filter", codeColor: COLOR.platform },
    { code: "08", name: "13-aggregator",              purpose: "Aggregator (in-memory + PostgreSQL JDBC), normalizer", codeColor: COLOR.platform },
    { code: "09", name: "14-consumer-patterns",       purpose: "Polling (Kafka + SQL), event-driven (Pulsar), competing", codeColor: COLOR.platform },
    { code: "10", name: "15-endpoints",               purpose: "Idempotent (JDBC), outbox (PostgreSQL), durable sub (Pulsar)", codeColor: COLOR.govern },
    { code: "11", name: "16/17/18-management",        purpose: "Gateway, control bus, message store (PostgreSQL), testing", codeColor: COLOR.govern },
    { code: "12", name: "loan-broker",                purpose: "Case study — 13 patterns composed end-to-end", codeColor: COLOR.govern },
    { code: "13", name: "bond-trading",               purpose: "Case study — 16 patterns for market data processing", codeColor: COLOR.red },
  ], { colW: [0.80, 2.80, 8.49], rowH: 0.38 });
  addNotes(s, "This table catalogs all seventeen runnable example projects in the tutorial repository. Each example is a self-contained Quarkus application that you can start with mvn quarkus:dev. The examples use the full Podman infrastructure stack: Kafka for the messaging backbone, Pulsar for multi-tenant messaging, PostgreSQL for JDBC aggregation, idempotent repositories, and the outbox pattern, and Redis for content enrichment caching and Pub/Sub. The two case studies — Loan Broker and Bond Trading — are the capstone examples that compose many patterns into complete applications. To run any example, start the infrastructure with setup-stack.sh, navigate to the example directory, and run mvn quarkus:dev.");
}

// Slide 122: Resources
{
  const s = S();
  addKeyValueSlide(s, "CLOSING", "Resources for Continued Learning", [
    { key: "Hohpe & Woolf", value: "Enterprise Integration Patterns — the definitive book: 65 patterns for messaging" },
    { key: "Tutorial Site", value: "GitHub Pages site with all chapters, diagrams, and code walkthroughs" },
    { key: "GitHub Repository", value: "All source code, examples, infrastructure, and presentation sources" },
    { key: "Camel Docs", value: "camel.apache.org — component reference, DSL guide, enterprise patterns catalog" },
    { key: "Quarkus Guides", value: "quarkus.io/guides — getting started, Kafka, Redis, PostgreSQL, OpenTelemetry" },
    { key: "Camel Quarkus", value: "camel.apache.org/camel-quarkus — 300+ extensions with Quarkus-specific docs" },
  ]);
  addNotes(s, "For continued learning, start with the tutorial site — it walks through every pattern with explanations, diagrams, and code samples at a depth that slides cannot match. The GitHub repository has all the source code including the runnable examples, infrastructure compose files, and diagram sources. The Hohpe and Woolf book remains the definitive reference for understanding the patterns at a conceptual level. The Apache Camel documentation at camel.apache.org is comprehensive — every component, every DSL method, every pattern has detailed documentation with examples. The Quarkus guides cover the runtime and its extensions. And the Camel Quarkus extensions catalog lists all 300+ available extensions with Quarkus-specific configuration notes. Between these resources and the runnable examples, you have everything you need to build production-grade integrations with Camel on Quarkus.");
}

// Slide 123: Thank You
{
  const s = pres.addSlide();
  s.background = { color: COLOR.ink };
  try {
    s.addImage({ path: `${ASSETS}/section-panel.png`, x: 0, y: 0, w: W, h: H });
  } catch (e) { /* ok */ }
  s.addText("Thank You", {
    x: 6.20, y: 1.80, w: 6.60, h: 1.40,
    fontFace: FONT.title, fontSize: 48, bold: true, color: COLOR.white,
    align: "left", valign: "top",
  });
  s.addText("Enterprise Integration Patterns with Apache Camel", {
    x: 6.20, y: 3.30, w: 6.60, h: 0.60,
    fontFace: FONT.body, fontSize: 17, color: "FFD9D9",
    align: "left", valign: "top",
  });
  s.addText([
    { text: "Tutorial: ", options: { bold: true, color: COLOR.white, fontSize: 15 } },
    { text: "patterncatalyst.github.io/enterprise-integration-patterns-with-camel", options: { color: "FFD9D9", fontSize: 15 } },
  ], {
    x: 6.20, y: 4.40, w: 6.60, h: 0.40,
    fontFace: FONT.body, align: "left", valign: "middle",
  });
  s.addText([
    { text: "GitHub: ", options: { bold: true, color: COLOR.white, fontSize: 15 } },
    { text: "github.com/PatternCatalyst/enterprise-integration-patterns-with-camel", options: { color: "FFD9D9", fontSize: 15 } },
  ], {
    x: 6.20, y: 4.85, w: 6.60, h: 0.40,
    fontFace: FONT.body, align: "left", valign: "middle",
  });
  s.addText("Robert Sedor", {
    x: 6.20, y: 5.70, w: 6.60, h: 0.50,
    fontFace: FONT.body, fontSize: 15, color: COLOR.white,
    align: "left", valign: "middle",
  });
  try {
    s.addImage({ path: `${ASSETS}/redhat-logo-white.png`, x: 11.42, y: 6.88, w: 1.33, h: 0.31 });
  } catch (e) { /* ok */ }
  addNotes(s, "Thank you for attending EIP 201 — the Implementation Deep-Dive. You now have a working understanding of how to implement all 65 Enterprise Integration Patterns in Apache Camel Java DSL on Quarkus. The runnable examples in the GitHub repository give you a foundation to build on — fork the repo, modify the examples, and start building your own integrations. Remember: start with the patterns, design with diagrams, implement with Camel, deploy on Quarkus, and observe with the LGTM stack. The patterns have been proven over decades of enterprise integration — your job is to compose them correctly for your specific problem. Good luck, and happy integrating.");
}

// --- Generate the deck ---
const outPath = "../eip-201.pptx";
pres.writeFile({ fileName: outPath })
  .then(() => console.log(`EIP 201 deck written to ${outPath} (${PAGE} numbered slides + cover/dividers)`))
  .catch((err) => { console.error("Failed to write deck:", err); process.exit(1); });
