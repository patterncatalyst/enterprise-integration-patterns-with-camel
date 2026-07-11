#!/usr/bin/env node
// eip-101.js — EIP 101: The Conceptual Guide (~85 slides)
// Enterprise Integration Patterns — A Visual Guide to the 65 Patterns
// ────────────────────────────────────────────────────────────────────
"use strict";

const {
  COLOR, FONT, W, H, PNG, ASSETS,
  newDeck,
  addFooter, addContentTitle, addBullets, addTwoColBullets, addStatusTable,
  addCaption, addPerfCallout,
  addDiagramSlide, addCodeSlide, addLangChip, addSectionDivider, addNotes,
  addPatternCard, addComparisonSlide, addIconGrid, addFlowSlide, addKeyValueSlide,
} = require("./deck-helpers");

// ── counters & shortcuts ────────────────────────────────────────────
let PAGE = 0;
function S(pres) {
  const s = pres.addSlide();
  PAGE += 1;
  addFooter(s, PAGE);
  return s;
}
function divider(pres, code, title, subtitle, notes) {
  const s = pres.addSlide();
  PAGE += 1;
  addSectionDivider(s, code, title, subtitle);
  addNotes(s, notes);
  return s;
}

// ── bsub helper — headline + detail sub-bullet ──────────────────────
function bsub(items) {
  const out = [];
  for (const ln of items) {
    if (typeof ln === "string" || !ln.sub) { out.push(ln); continue; }
    out.push({ text: ln.text, options: { bullet: { code: "25CF" }, bold: true, paraSpaceAfter: 2, breakLine: true, ...(ln.options || {}) } });
    out.push({ text: ln.sub, options: { bullet: false, color: COLOR.caption, fontSize: 13, indentLevel: 1, paraSpaceAfter: 12, breakLine: true } });
  }
  return out;
}

// =====================================================================
//  BUILD DECK
// =====================================================================
const pres = newDeck();
pres.title  = "Enterprise Integration Patterns — A Visual Guide";
pres.author = "Robert Sedor";

// ─────────────────────────────────────────────────────────────────────
//  SECTION 00 — COVER + AGENDA (3 slides)
// ─────────────────────────────────────────────────────────────────────

// --- Slide 1: Custom cover ---
{
  const s = pres.addSlide();
  PAGE += 1;
  s.background = { color: COLOR.ink };
  try {
    s.addImage({ path: `${ASSETS}/section-panel.png`, x: 0, y: 0, w: W, h: H });
  } catch (e) { /* ok */ }

  s.addText("Enterprise Integration Patterns", {
    x: 6.20, y: 1.60, w: 6.60, h: 2.00,
    fontFace: FONT.title, fontSize: 42, bold: true, color: COLOR.white,
    align: "left", valign: "top",
  });
  s.addText("A Visual Guide to the 65 Patterns from Hohpe & Woolf\nImplemented with Apache Camel on Quarkus", {
    x: 6.20, y: 3.65, w: 6.60, h: 1.10,
    fontFace: FONT.body, fontSize: 17, color: "FFD9D9",
    align: "left", valign: "top", lineSpacingMultiple: 1.30,
  });
  s.addText("Robert Sedor", {
    x: 6.20, y: 5.30, w: 6.60, h: 0.50,
    fontFace: FONT.body, fontSize: 15, color: COLOR.white,
    align: "left", valign: "middle",
  });
  try {
    s.addImage({ path: `${ASSETS}/redhat-logo-white.png`, x: 11.42, y: 6.88, w: 1.33, h: 0.31 });
  } catch (e) { /* ok */ }

  addNotes(s,
    "Welcome, everyone. This presentation is a visual walkthrough of all 65 Enterprise Integration " +
    "Patterns described in the seminal book by Gregor Hohpe and Bobby Woolf. " +
    "We will cover every pattern category, show where each pattern fits in a real system, and " +
    "demonstrate how Apache Camel on Quarkus makes them practical today. " +
    "Whether you are building a greenfield event-driven architecture or maintaining a sprawling " +
    "enterprise integration layer, the vocabulary we build here will serve you for years. " +
    "Let us get started."
  );
}

// --- Slide 2: Agenda ---
{
  const s = S(pres);
  addContentTitle(s, "AGENDA", "What We Will Cover Today");
  addTwoColBullets(s,
    [
      "Why Integration Patterns?",
      "Messaging Systems Fundamentals",
      "Messaging Channels",
      "Message Construction",
      "Message Routing",
    ],
    [
      "Message Transformation",
      "Messaging Endpoints",
      "System Management",
      "Case Studies & Running Examples",
      "Key Takeaways & Resources",
    ],
  );
  addNotes(s,
    "Here is our roadmap for today. We will begin with the motivation behind integration patterns — " +
    "why they were created and why they still matter more than twenty years later. " +
    "Then we will walk through each of the major pattern categories: channels, construction, routing, " +
    "transformation, endpoints, and system management. " +
    "We will tie everything together with two real-world case studies — a Loan Broker and a Bond " +
    "Trading system — that show how patterns compose into complete architectures. " +
    "Finally, we will close with a full catalog reference and pointers to the runnable code examples " +
    "you can take home."
  );
}

// --- Slide 3: What you'll learn ---
{
  const s = S(pres);
  addContentTitle(s, "LEARNING OBJECTIVES", "What You Will Take Away");
  addBullets(s, bsub([
    { text: "A shared vocabulary for integration", sub: "The 65 patterns give your team precise words for common integration problems." },
    { text: "Pattern categories and their relationships", sub: "Understand how channels, messages, routing, transformation, and endpoints fit together." },
    { text: "When to apply each pattern", sub: "Learn the forces and trade-offs that make each pattern the right — or wrong — choice." },
    { text: "Modern implementations with Apache Camel", sub: "See how Camel's Java DSL maps directly to the pattern language with minimal ceremony." },
    { text: "Composing patterns into complete systems", sub: "Walk through real architectures where 10-16 patterns collaborate to solve a business problem." },
  ]));
  addNotes(s,
    "By the end of this session you should be able to do five things. " +
    "First, name and describe any of the 65 patterns when you encounter them in code or architecture diagrams. " +
    "Second, understand how the pattern categories relate to each other — channels carry messages, routers " +
    "direct them, transformers reshape them, and endpoints connect them to your business logic. " +
    "Third, evaluate trade-offs: when is a Content-Based Router better than a Recipient List? When does " +
    "an Aggregator help versus hurt? " +
    "Fourth, translate patterns directly into Apache Camel Java DSL — every pattern maps to a Camel EIP " +
    "component or processor. " +
    "And fifth, see patterns working together in realistic case studies, not isolated toy examples."
  );
}

// ─────────────────────────────────────────────────────────────────────
//  SECTION 01 — WHY INTEGRATION PATTERNS? (8 slides)
// ─────────────────────────────────────────────────────────────────────
divider(pres, "01", "Why Integration\nPatterns?",
  "The problem space that gave rise to a pattern language",
  "Let us start at the very beginning — the problem. Every enterprise of any size has dozens, " +
  "sometimes hundreds, of applications that need to talk to each other. These applications were " +
  "built at different times, by different teams, using different technologies. Integration is the " +
  "glue that holds the enterprise together, and without patterns, every team reinvents it differently. " +
  "This section explains why integration patterns emerged and why they remain indispensable."
);

// Slide 5: The integration problem
{
  const s = S(pres);
  addContentTitle(s, "THE PROBLEM", "Enterprises Run on Integration");
  addBullets(s, bsub([
    { text: "Dozens of applications, built over decades", sub: "ERP, CRM, HR, billing, logistics — each with its own data model, language, and API." },
    { text: "No single team owns everything", sub: "Different departments, vendors, and partners contribute systems that must cooperate." },
    { text: "Change is constant", sub: "New applications arrive, old ones retire, business rules shift — the integration layer must adapt." },
    { text: "Failures cascade without guard rails", sub: "A downstream outage should not bring down the whole enterprise — yet it often does." },
  ]));
  addNotes(s,
    "Think about a typical enterprise. You have an ERP system that is ten years old, a CRM bought " +
    "from a SaaS vendor last year, a home-grown billing application, and a logistics system from " +
    "a third-party partner. Each speaks a different protocol, stores data in a different format, and " +
    "is maintained by a different team. " +
    "Now the business asks you to make the CRM automatically update inventory when a large order is " +
    "placed, send a notification to the warehouse, and trigger an invoice. That single business " +
    "requirement touches four systems and three teams. " +
    "Without a common approach, every integration becomes bespoke point-to-point code that is " +
    "fragile, hard to test, and impossible to monitor. This is the problem integration patterns solve."
  );
}

// Slide 6: The EIP book
{
  const s = S(pres);
  addKeyValueSlide(s, "THE BOOK", "Enterprise Integration Patterns (2003)", [
    { key: "Authors", value: "Gregor Hohpe & Bobby Woolf — 65 messaging patterns from decades of real-world enterprise integration." },
    { key: "Structure", value: "Gang of Four tradition — each pattern has a name, icon, problem, solution, consequences, and known uses." },
    { key: "Tech-neutral", value: "Patterns apply to JMS, AMQP, Kafka, Pulsar, gRPC streaming, or any messaging system." },
    { key: "Still definitive", value: "Apache Camel, Spring Integration, and MuleSoft implement these patterns by name — 20+ years later." },
  ]);
  addNotes(s,
    "In 2003, Gregor Hohpe and Bobby Woolf published 'Enterprise Integration Patterns,' which did " +
    "for messaging what the Gang of Four did for object-oriented design. They studied real integration " +
    "systems — message brokers, ESBs, custom middleware — and extracted 65 recurring patterns. " +
    "What makes the book special is that the patterns are technology-neutral. They describe a " +
    "Content-Based Router without tying it to JMS or MQ or any specific product. This means the " +
    "patterns have outlived the technologies they were first observed in. " +
    "Today, Apache Camel implements every one of these patterns in its Java DSL. When you write " +
    "'.choice().when(...)' in Camel, you are literally instantiating the Content-Based Router pattern. " +
    "The pattern language bridges the gap between architecture diagrams and running code."
  );
}

// Slide 7: Pattern language
{
  const s = S(pres);
  addKeyValueSlide(s, "PATTERN LANGUAGE", "A Shared Vocabulary for Integration", [
    { key: "Names → precision", value: "'Content-Based Router' is unambiguous; 'that if-else thing' is not." },
    { key: "Icons → visual clarity", value: "Each pattern has a distinctive icon used in architecture diagrams worldwide." },
    { key: "Composition", value: "Scatter-Gather = Recipient List + Aggregator. Complex designs decompose into familiar blocks." },
    { key: "Trade-offs", value: "Every pattern documents forces — performance, coupling, reliability — so you choose with eyes open." },
  ]);
  addNotes(s,
    "A pattern language does something no API documentation can do: it gives your entire team " +
    "a shared vocabulary. When an architect says 'we need a Recipient List here,' every developer " +
    "knows what that means — a component that calculates a list of destinations at runtime and " +
    "sends a copy of the message to each one. " +
    "The pattern icons are equally powerful. In architecture diagrams, a small router icon is " +
    "instantly recognizable. You do not need a paragraph of explanation. " +
    "And patterns compose beautifully. A Scatter-Gather is not a mysterious monolith — it is " +
    "just a Recipient List feeding into an Aggregator. Once you know the building blocks, you " +
    "can understand and construct arbitrarily complex integration flows."
  );
}

// Slide 8: 65 patterns in 8 categories (status table)
{
  const s = S(pres);
  addContentTitle(s, "THE CATALOG", "65 Patterns in 8 Categories");
  addStatusTable(s, [
    { code: "1", name: "Integration Styles",        purpose: "4 patterns — File Transfer, Shared DB, RPC, Messaging", codeColor: COLOR.red },
    { code: "2", name: "Messaging Systems",          purpose: "6 patterns — Channel, Message, Pipe & Filter, Router, Translator, Endpoint", codeColor: COLOR.red },
    { code: "3", name: "Messaging Channels",         purpose: "8 patterns — P2P, Pub-Sub, Dead Letter, Guaranteed Delivery, and more", codeColor: COLOR.red },
    { code: "4", name: "Message Construction",       purpose: "6 patterns — Command, Document, Event, Request-Reply, Correlation ID, and more", codeColor: COLOR.red },
    { code: "5", name: "Message Routing",            purpose: "13 patterns — CBR, Filter, Splitter, Aggregator, Scatter-Gather, and more", codeColor: COLOR.red },
    { code: "6", name: "Message Transformation",     purpose: "7 patterns — Translator, Envelope Wrapper, Enricher, Claim Check, and more", codeColor: COLOR.red },
    { code: "7", name: "Messaging Endpoints",        purpose: "11 patterns — Gateway, Transactional Client, Competing Consumers, and more", codeColor: COLOR.red },
    { code: "8", name: "System Management",          purpose: "10 patterns — Control Bus, Wire Tap, Message History, Detour, and more", codeColor: COLOR.red },
  ], { colW: [0.60, 2.60, 8.89], rowH: 0.50 });
  addNotes(s,
    "Here are all eight categories at a glance, with the number of patterns in each. " +
    "Integration Styles provides the four fundamental approaches — we will compare them in a moment. " +
    "Messaging Systems gives us the six building blocks that every messaging solution shares. " +
    "Messaging Channels defines how messages travel — point-to-point, publish-subscribe, guaranteed " +
    "delivery, and dead letter handling. " +
    "Message Construction tells us how to structure the messages themselves — commands, documents, " +
    "events, and the request-reply conversation pattern. " +
    "Message Routing is the largest category with thirteen patterns for directing messages to the " +
    "right destination. Message Transformation has seven patterns for reshaping message content. " +
    "Messaging Endpoints covers eleven patterns for connecting applications to the messaging system. " +
    "And System Management rounds it out with ten patterns for monitoring, testing, and controlling " +
    "the integration infrastructure itself."
  );
}

// Slide 9: Four integration styles (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "INTEGRATION STYLES", "The Four Ways Applications Connect",
    "02-integration-styles",
    "Figure 1.1 — File Transfer, Shared Database, Remote Procedure Invocation, Messaging");
  addNotes(s,
    "Before we dive into messaging patterns, let us acknowledge that messaging is not the only " +
    "integration style. Hohpe and Woolf describe four fundamental approaches. " +
    "File Transfer is the oldest — applications write files to a shared directory and others pick " +
    "them up. It is simple but introduces latency and requires coordination on format and timing. " +
    "Shared Database puts all applications against one database. It eliminates the latency problem " +
    "but creates tight coupling — schema changes break everyone. " +
    "Remote Procedure Invocation — REST, gRPC, SOAP — gives real-time synchronous communication but " +
    "couples the caller to the callee's availability. " +
    "Messaging decouples sender from receiver in both time and space. The sender drops a message " +
    "onto a channel and moves on. The receiver processes it when ready. This is the style the " +
    "remaining 61 patterns elaborate on."
  );
}

// Slide 10: File Transfer
{
  const s = S(pres);
  addPatternCard(s, "INTEGRATION STYLE 1", "File Transfer", "file-transfer",
    "Applications need to share data, but they are built on different platforms with different data models. The simplest approach is to write files to a shared location.",
    "One application writes a file (CSV, XML, JSON) to a shared directory or SFTP server; another polls and reads it. Simple and universal, but high latency (minutes, not milliseconds) and no built-in error handling. Still common in batch-oriented domains: financial reconciliation, regulatory reporting, data warehouse ETL."
  );
  addNotes(s,
    "File Transfer is the simplest integration style — and often the first one teams reach for. " +
    "Application A writes an XML or CSV file to a shared directory or SFTP server. Application B " +
    "polls that directory and processes new files. " +
    "The appeal is obvious: no middleware, no message broker, no complex infrastructure. Every " +
    "language can read and write files. But the trade-offs are significant. " +
    "First, latency. Even with short polling intervals, you are talking minutes, not milliseconds. " +
    "Second, error handling is manual. If B crashes halfway through processing a file, you need " +
    "to figure out what was already processed and what was not. " +
    "Third, format coupling. A and B must agree on the file format, and changes to that format " +
    "require coordinated releases. " +
    "Despite these drawbacks, file transfer is alive and well in domains where batch processing " +
    "is natural — bank reconciliation, regulatory filings, data warehouse ETL."
  );
}

// Slide 11: Shared Database
{
  const s = S(pres);
  addPatternCard(s, "INTEGRATION STYLE 2", "Shared Database", "shared-database",
    "Applications need instant data visibility across system boundaries. File transfer is too slow — can multiple applications just share one database?",
    "All applications read and write to a common database. Instant visibility (no polling), but tight schema coupling — changing a column breaks everyone. Performance contention as apps compete for connections and locks. Microservice practitioners call this the 'integration database anti-pattern.'"
  );
  addNotes(s,
    "Shared Database solves the latency problem of File Transfer — data is available instantly. " +
    "But it introduces a different kind of coupling: schema coupling. " +
    "If Application A owns the 'orders' table and Application B reads from it, B has a compile-time " +
    "dependency on A's schema. When A needs to split the 'address' column into 'street', 'city', " +
    "and 'zip', B breaks. " +
    "Performance is another concern. When ten applications share one PostgreSQL instance, they " +
    "compete for connections, and a poorly written query from one application can lock tables " +
    "that another application needs. " +
    "In the microservices world, the shared database is considered an anti-pattern precisely because " +
    "it couples services at the data layer. Each service should own its data and expose it through " +
    "well-defined interfaces — which brings us to RPC and messaging."
  );
}

// Slide 12: Remote Procedure Invocation
{
  const s = S(pres);
  addPatternCard(s, "INTEGRATION STYLE 3", "Remote Procedure Invocation", "remote-procedure",
    "Applications need real-time interaction — a user places an order and expects an immediate response. File drops and database polling are too slow for interactive use cases.",
    "Applications expose procedures (REST, gRPC, GraphQL, SOAP) that others call synchronously. Familiar programming model but temporal coupling — if the callee is down, the call fails. Cascading failures can bring down entire service meshes. Best for queries and commands that genuinely need immediate feedback."
  );
  addNotes(s,
    "Remote Procedure Invocation is the dominant style for user-facing APIs. REST over HTTP is " +
    "the most common flavor, but gRPC, GraphQL, and even legacy SOAP fall into this category. " +
    "The programmer model is appealing: you call a method, you get a response, you handle errors. " +
    "It maps naturally to how developers think about function calls. " +
    "But RPC introduces temporal coupling. If the Payment Service is down when the Order Service " +
    "tries to charge a credit card, the order fails. Circuit breakers and retries mitigate this, " +
    "but they add complexity. " +
    "Worse, cascading failures can bring down entire service meshes. Service A calls Service B, " +
    "which calls Service C. If C is slow, B's threads pile up waiting, and A's threads pile up " +
    "waiting for B. Before you know it, everything is down. " +
    "RPC is the right choice when the caller genuinely needs an immediate response. For everything " +
    "else, messaging offers superior decoupling."
  );
}

// Slide 13: Messaging
{
  const s = S(pres);
  addPatternCard(s, "INTEGRATION STYLE 4", "Messaging — Where EIP Focuses", "messaging",
    "How can applications communicate without being coupled to each other's availability, location, or technology stack? RPC requires both sides to be up simultaneously.",
    "Applications exchange messages through a messaging system — decoupled in time and space. Asynchronous, resilient (messages queue when receivers are down), and scalable through partitioning. This is where the remaining 61 EIP patterns live: channels, routing, transformation, endpoints, and management."
  );
  addNotes(s,
    "Messaging is the integration style that the remaining sixty-one patterns elaborate on. " +
    "The core idea is simple: instead of calling another application directly, you put a message " +
    "on a channel. The messaging system — Kafka, Pulsar, RabbitMQ, whatever — takes responsibility " +
    "for delivering that message to the right receiver at the right time. " +
    "This decouples sender and receiver along three axes. Temporal decoupling: the sender does not " +
    "wait for the receiver. Spatial decoupling: the sender does not need to know the receiver's " +
    "address. Platform decoupling: the sender and receiver can be written in different languages. " +
    "The trade-off is complexity. You now have a messaging system to operate, messages to monitor, " +
    "and eventual consistency to reason about. The patterns we are about to learn make that " +
    "complexity manageable."
  );
}

// ─────────────────────────────────────────────────────────────────────
//  SECTION 02 — MESSAGING SYSTEMS FUNDAMENTALS (10 slides)
// ─────────────────────────────────────────────────────────────────────
divider(pres, "02", "Messaging Systems\nFundamentals",
  "The six building blocks every messaging solution shares",
  "Now that we have established why messaging is the integration style of choice, let us look at " +
  "the six fundamental concepts that every messaging system is built from. These are the atoms of " +
  "the pattern language — channels, messages, pipes and filters, routers, translators, and endpoints. " +
  "Once you understand these six, every other pattern is a specialization or composition of them."
);

// Slide 15: Six fundamental concepts overview
{
  const s = S(pres);
  addIconGrid(s, "THE FUNDAMENTALS", "Six Concepts That Underpin Everything", [
    { icon: "message-channel", label: "Message Channel", desc: "The virtual pipe that connects sender to receiver — the highway for messages." },
    { icon: "message", label: "Message", desc: "The data packet that travels through the system — header plus body." },
    { icon: "pipes-and-filters", label: "Pipes and Filters", desc: "Chained processing steps that each do one thing well." },
    { icon: "message-router", label: "Message Router", desc: "A filter that examines the message and decides where to send it." },
    { icon: "message-translator", label: "Message Translator", desc: "A filter that converts the message from one format to another." },
    { icon: "message-endpoint", label: "Message Endpoint", desc: "The connection point where your application code meets the messaging system." },
  ]);
  addNotes(s,
    "Think of these six concepts as the periodic table of messaging. Every integration solution " +
    "you will ever build uses some combination of them. " +
    "A Message Channel is the conduit — like a pipe carrying water. A Message is the water itself. " +
    "Pipes and Filters is the architecture style — you chain small processing steps together, " +
    "each reading from one channel and writing to another. " +
    "A Message Router is a special filter that does not transform the message but decides which " +
    "output channel to send it to. A Message Translator is a filter that changes the message's " +
    "format — say, from XML to JSON. " +
    "And a Message Endpoint is where your application code connects to the messaging system. " +
    "Your order service does not speak Kafka protocol directly; it uses an endpoint that " +
    "abstracts the connection details."
  );
}

// Slide 16: Message Channel
{
  const s = S(pres);
  addContentTitle(s, "FUNDAMENTAL 1", "Message Channel — The Virtual Pipe");
  addBullets(s, bsub([
    { text: "Connects sender to receiver", sub: "A named destination (topic or queue) that the messaging system manages." },
    { text: "Decouples who from where", sub: "The sender puts a message on the channel; it does not know or care who reads it." },
    { text: "Many flavors", sub: "Point-to-point (queue), publish-subscribe (topic), dead letter, datatype-specific." },
    { text: "Kafka topic, Pulsar topic, JMS queue", sub: "Every messaging product implements channels — the names differ, the concept is identical." },
    { text: "Think of channels as the plumbing of your system", sub: "Good plumbing is invisible; bad plumbing floods the building." },
  ]));
  addNotes(s,
    "The Message Channel is the most fundamental concept in messaging. It is a logical connection " +
    "between a sender and a receiver. In Kafka, a channel is a topic. In JMS, it is a queue or " +
    "topic. In Pulsar, it is a topic within a namespace. " +
    "What makes channels powerful is that they decouple the sender from the receiver. When the " +
    "Order Service publishes an order event to the 'orders' topic, it has no idea who is listening. " +
    "The Inventory Service, the Notification Service, and the Analytics Service might all be " +
    "subscribed — but the Order Service does not know and does not need to know. " +
    "We will explore the different channel types — point-to-point, publish-subscribe, dead letter, " +
    "and more — in the Messaging Channels section."
  );
}

// Slide 17: Message
{
  const s = S(pres);
  addContentTitle(s, "FUNDAMENTAL 2", "Message — Header + Body");
  addBullets(s, bsub([
    { text: "The atomic unit of communication", sub: "A self-contained data packet that travels through channels." },
    { text: "Header — metadata about the message", sub: "Routing keys, correlation IDs, timestamps, content type, reply-to address." },
    { text: "Body — the payload", sub: "The actual business data: an order, a payment confirmation, an inventory update." },
    { text: "Headers enable routing without inspecting the body", sub: "Routers can make decisions based on headers alone — faster and less coupled." },
    { text: "Immutable in transit", sub: "Once published, a message should not be modified — new messages replace old ones." },
  ]));
  addNotes(s,
    "A Message is the data packet that flows through channels. Every message has two parts: " +
    "a header and a body. " +
    "The header contains metadata — the message ID, a timestamp, a correlation ID for tracking " +
    "request-reply conversations, the content type so the receiver knows how to deserialize the " +
    "body, and optional routing hints. " +
    "The body is the payload — the actual business data. An order with line items, a payment " +
    "confirmation, an inventory count update. " +
    "This separation matters because many patterns operate only on headers. A Content-Based Router " +
    "might inspect a header called 'orderType' rather than parsing the entire JSON body. This is " +
    "faster and creates less coupling between the router and the message schema. " +
    "In Kafka, headers are first-class citizens. In Camel, the Exchange carries both headers and " +
    "a body, making it trivially easy to work with both."
  );
}

// Slide 18: Pipes and Filters (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "FUNDAMENTAL 3", "Pipes and Filters — Chained Processing",
    "03-pipes-and-filters",
    "Figure 2.1 — Each filter reads from an input channel and writes to an output channel");
  addNotes(s,
    "Pipes and Filters is the architectural style that underpins Camel routes. The idea is simple: " +
    "break your processing into a sequence of small, independent steps — filters — connected by " +
    "channels — pipes. " +
    "Each filter takes a message from its input pipe, does one thing — validate, enrich, transform, " +
    "route — and writes the result to its output pipe. The next filter picks it up. " +
    "This style has three major benefits. First, each filter is small and testable in isolation. " +
    "Second, you can rearrange, add, or remove filters without affecting the others. Third, " +
    "filters can run on different threads or even different machines, enabling parallel processing. " +
    "When you write a Camel route — from('kafka:orders').unmarshal().process().to('kafka:validated') — " +
    "you are literally constructing a pipes-and-filters pipeline."
  );
}

// Slide 19: Message Router
{
  const s = S(pres);
  addContentTitle(s, "FUNDAMENTAL 4", "Message Router — Directing Traffic");
  addBullets(s, bsub([
    { text: "A special filter that routes, not transforms", sub: "Inspects the message and sends it to one of several output channels." },
    { text: "Keeps routing logic in one place", sub: "Without a router, every sender must know every receiver — routing becomes scattered." },
    { text: "Many specialized forms", sub: "Content-Based Router, Message Filter, Dynamic Router, Recipient List — all are routers." },
    { text: "Camel's choice() is the canonical implementation", sub: ".choice().when(header(\"type\").isEqualTo(\"priority\")).to(\"kafka:fast\").otherwise().to(\"kafka:normal\")" },
  ]));
  addNotes(s,
    "A Message Router is a filter that does not change the message — it decides where the message " +
    "goes next. Think of it as a traffic cop at an intersection. " +
    "Without routers, routing logic would be scattered across senders. The Order Service would need " +
    "to know that priority orders go to the fast lane and normal orders go to the standard lane. " +
    "With a router, the Order Service just sends to 'orders,' and the router handles the rest. " +
    "We will see many specialized routers in the Routing section — Content-Based Router, which " +
    "inspects message content; Message Filter, which discards unwanted messages; Dynamic Router, " +
    "which consults an external source for routing rules; and Recipient List, which sends copies " +
    "to multiple destinations. All are variations on this fundamental concept."
  );
}

// Slide 20: Message Translator
{
  const s = S(pres);
  addContentTitle(s, "FUNDAMENTAL 5", "Message Translator — Format Conversion");
  addBullets(s, bsub([
    { text: "Converts messages from one format to another", sub: "XML to JSON, internal domain model to external API schema, v1 to v2." },
    { text: "Keeps senders and receivers independent", sub: "Without translators, every application pair needs a custom format agreement." },
    { text: "Can normalize or denormalize", sub: "Normalize many formats into one canonical model, or denormalize to match specific receivers." },
    { text: "Camel supports dozens of data formats", sub: "Jackson, JAXB, Avro, Protobuf, CSV — marshal and unmarshal with a single DSL call." },
  ]));
  addNotes(s,
    "The Message Translator is the other type of specialized filter. Where a router changes " +
    "the destination, a translator changes the message content. " +
    "In any enterprise with more than a few applications, format mismatches are the norm. The " +
    "Order Service produces JSON, the legacy ERP expects XML, and the analytics platform wants " +
    "Avro. Without translators, you would need custom conversion code at every integration point. " +
    "A Message Translator centralizes that conversion. It sits in the pipeline, reads the input " +
    "format, and produces the output format. In Camel, you write '.marshal().json()' or " +
    "'.unmarshal().avro()' — a single method call in the route. " +
    "We will explore more sophisticated transformation patterns — Envelope Wrapper, Content " +
    "Enricher, Content Filter, Claim Check — in the Transformation section."
  );
}

// Slide 21: Message Endpoint
{
  const s = S(pres);
  addContentTitle(s, "FUNDAMENTAL 6", "Message Endpoint — The Connection Point");
  addBullets(s, bsub([
    { text: "Where application code meets the messaging system", sub: "Your business logic should not contain Kafka producer/consumer boilerplate." },
    { text: "Encapsulates channel-specific protocol", sub: "The endpoint handles serialization, connection management, error recovery." },
    { text: "Inbound endpoints consume messages", sub: "Polling Consumer, Event-Driven Consumer — two ways to receive messages." },
    { text: "Outbound endpoints produce messages", sub: "The application calls the endpoint; the endpoint puts the message on the channel." },
    { text: "Camel components are endpoints", sub: "from('kafka:orders') and to('kafka:shipped') are inbound and outbound endpoints." },
  ]));
  addNotes(s,
    "The Message Endpoint is the bridge between your application code and the messaging system. " +
    "It encapsulates all the messy protocol details — how to connect to Kafka, how to serialize " +
    "messages, how to handle acknowledgments, how to reconnect after a failure. " +
    "Your business logic should never contain raw Kafka producer code. Instead, it should talk " +
    "to an endpoint that abstracts those details. This is exactly what Camel components do. " +
    "When you write 'from(\"kafka:orders\")', Camel creates an inbound endpoint that manages a " +
    "Kafka consumer, handles partition assignment, and delivers messages to your route. " +
    "When you write 'to(\"kafka:shipped\")', Camel creates an outbound endpoint that manages a " +
    "Kafka producer and sends messages with proper serialization and error handling. " +
    "We will explore eleven endpoint patterns in detail later in the deck."
  );
}

// Slide 22: Messaging system components together (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "THE BIG PICTURE", "Messaging System Components Working Together",
    "03-messaging-system-components",
    "Figure 2.2 — Channels, Messages, Routers, Translators, and Endpoints in a complete system");
  addNotes(s,
    "This diagram shows all six concepts working together in a real messaging system. " +
    "On the left, an application publishes messages through an outbound endpoint to a channel. " +
    "In the middle, filters process the messages — a router directs them, a translator converts " +
    "their format. Between each filter is a channel — a pipe in the pipes-and-filters architecture. " +
    "On the right, another application receives messages through an inbound endpoint. " +
    "This is the fundamental architecture that every integration system follows, whether it is " +
    "built on Kafka, Pulsar, RabbitMQ, or any other messaging platform. The names change, " +
    "the concepts remain the same. " +
    "Every pattern we discuss from here on is a specialization of one of these six concepts."
  );
}

// Slide 23: Why these six matter
{
  const s = S(pres);
  addKeyValueSlide(s, "BUILDING BLOCKS", "Why These Six Concepts Matter", [
    { key: "Specialization", value: "Every pattern is a specialization — Dead Letter Channel is a channel, Content-Based Router is a router." },
    { key: "Architecture", value: "Channels for transport, messages for data, pipes and filters for structure, endpoints for connection." },
    { key: "Technology-neutral", value: "Kafka, Pulsar, AMQP, JMS — different products, same six concepts." },
    { key: "Camel mapping", value: "from() = endpoint, to() = endpoint, choice() = router, marshal() = translator." },
  ]);
  addNotes(s,
    "Let me emphasize why we spent time on these six concepts before diving into the specialized " +
    "patterns. Every single one of the remaining patterns is either a specialization or a " +
    "composition of these six building blocks. " +
    "When we discuss a Dead Letter Channel, that is a specialized Message Channel. When we discuss " +
    "a Content-Based Router, that is a specialized Message Router. When we discuss a Claim Check, " +
    "that is a specialized Message Translator. " +
    "Understanding the building blocks means you can reason about any pattern, even ones you have " +
    "not seen before, because you can decompose it into these fundamentals. " +
    "And in Camel, these six concepts map directly to the Java DSL: from() and to() are endpoints, " +
    "choice() is a router, marshal() is a translator, and the route itself is a pipes-and-filters pipeline."
  );
}

// Slide 24: Modern implementations
{
  const s = S(pres);
  addIconGrid(s, "MODERN PLATFORMS", "Kafka, Pulsar, Redis — Same Patterns, New Tech", [
    { label: "Apache Kafka", desc: "Distributed log with topics, partitions, consumer groups — P2P and Pub-Sub in one system." },
    { label: "Apache Pulsar", desc: "Multi-tenant messaging with topics, subscriptions, and built-in tiered storage." },
    { label: "Redis Streams", desc: "Lightweight message streaming with consumer groups — great for moderate-throughput scenarios." },
  ], { cols: 3, cellH: 2.60 });
  addCaption(s, "The patterns remain the same — Camel abstracts the differences: swap from('kafka:orders') to from('pulsar:orders')");
  addNotes(s,
    "The original EIP book was written when JMS and TIBCO were the dominant messaging platforms. " +
    "Today, Apache Kafka and Apache Pulsar have taken over much of the messaging landscape — " +
    "but the patterns are exactly the same. " +
    "Kafka implements channels as topics, uses partitions for parallel processing, and consumer " +
    "groups for point-to-point semantics. Pulsar adds multi-tenancy, built-in tiered storage, " +
    "and multiple subscription types. Redis Streams offers lightweight messaging for use cases " +
    "that do not need Kafka's durability guarantees. " +
    "What is remarkable is that the pattern vocabulary applies unchanged. A Content-Based Router " +
    "works the same whether it reads from a Kafka topic or a Pulsar subscription. " +
    "Apache Camel makes this concrete: change the endpoint URI from 'kafka:' to 'pulsar:', and " +
    "the rest of your route — the routing logic, the transformations, the error handling — " +
    "stays exactly the same."
  );
}

// ─────────────────────────────────────────────────────────────────────
//  SECTION 03 — MESSAGING CHANNELS (8 slides)
// ─────────────────────────────────────────────────────────────────────
divider(pres, "03", "Messaging\nChannels",
  "Point-to-Point, Pub-Sub, Dead Letter, and more",
  "Now we move into the Messaging Channels category — eight patterns that define how messages " +
  "travel between applications. We will cover the two fundamental channel types, reliability " +
  "patterns like Dead Letter and Guaranteed Delivery, and bridging patterns that connect " +
  "different messaging systems together."
);

// Slide 26: Channel types (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "CHANNEL TYPES", "How Messages Travel Between Applications",
    "04-channel-types",
    "Figure 3.1 — Point-to-Point channels vs. Publish-Subscribe channels");
  addNotes(s,
    "There are two fundamental channel types, and choosing between them is one of the first " +
    "decisions you make in any integration design. " +
    "A Point-to-Point Channel — a queue — ensures that exactly one consumer receives each message. " +
    "If multiple consumers are listening, the messaging system delivers each message to only one " +
    "of them. This is the Competing Consumers pattern, and it is how you scale processing. " +
    "A Publish-Subscribe Channel — a topic — delivers each message to every subscriber. When the " +
    "Order Service publishes an order event, the Inventory Service, the Notification Service, " +
    "and the Analytics Service each get their own copy. " +
    "Kafka blurs the line between these two with consumer groups: within a consumer group, messages " +
    "are point-to-point (only one instance processes each partition); across consumer groups, " +
    "messages are publish-subscribe (every group gets every message)."
  );
}

// Slide 27: Point-to-Point
{
  const s = S(pres);
  addPatternCard(s, "POINT-TO-POINT CHANNEL", "One Sender, One Receiver", "point-to-point-channel",
    "A message represents work that should be done exactly once — placing an order, processing a payment. How do we ensure only one consumer handles each message?",
    "The messaging system delivers each message to exactly one consumer. Enables Competing Consumers — add more instances to increase throughput. Kafka: same consumer group = P2P. Camel: from('kafka:orders?groupId=order-processors')."
  );
  addNotes(s,
    "A Point-to-Point Channel is the right choice when a message represents work that should be " +
    "done exactly once. Think of it as a work queue — a pool of workers pulls tasks from the queue, " +
    "and each task is handled by exactly one worker. " +
    "In JMS, this is a Queue. In Kafka, this is achieved through consumer groups — all consumers " +
    "in the same group divide the partitions among themselves, so each message is processed by " +
    "exactly one consumer. " +
    "The key benefit is scalability. If your order processing cannot keep up, add more consumers " +
    "to the group. The channel handles the distribution automatically. " +
    "The key trade-off is ordering. JMS queues can guarantee strict ordering, but Kafka only " +
    "guarantees ordering within a partition. If you need global ordering, you need a single " +
    "partition — which limits parallelism."
  );
}

// Slide 28: Publish-Subscribe
{
  const s = S(pres);
  addPatternCard(s, "PUBLISH-SUBSCRIBE CHANNEL", "One Sender, Many Receivers", "publish-subscribe-channel",
    "When an order is placed, inventory, billing, shipping, and analytics all need to know. How do we deliver one event to multiple independent consumers?",
    "Each message is delivered to every subscriber — fan-out. Subscribers are independent; adding a new one requires no changes to the publisher. Foundation of event-driven architecture. In Kafka: different consumer groups per service. Camel: from('kafka:order-events') in each consumer."
  );
  addNotes(s,
    "Publish-Subscribe is the foundation of event-driven architecture. When the Order Service " +
    "publishes an order-placed event, it does not address it to the Inventory Service or the " +
    "Notification Service. It simply publishes to the 'order-events' topic. " +
    "Any service that cares about order events subscribes to that topic. Today, three services " +
    "subscribe. Tomorrow, you add an analytics service — you configure it to subscribe, and it " +
    "starts receiving events immediately. No changes to the publisher, no deployment of the " +
    "Order Service, no coordination. " +
    "In Kafka, each subscriber service uses a different consumer group. Within each group, the " +
    "messages are distributed among instances for load balancing. Across groups, every message " +
    "is delivered to every group. " +
    "This pattern is so fundamental that if you are not using Pub-Sub in your event-driven " +
    "architecture, you are probably not doing event-driven architecture."
  );
}

// Slide 29: Dead Letter Channel (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "RELIABILITY", "Dead Letter Channel & Guaranteed Delivery",
    "05-reliability-patterns",
    "Figure 3.2 — Dead Letter Channel captures messages that cannot be delivered or processed");
  addNotes(s,
    "What happens when a message cannot be processed? Maybe the payload is malformed. Maybe the " +
    "downstream service is permanently unavailable. Maybe the message violates a business rule. " +
    "The Dead Letter Channel is a special channel where the messaging system places messages that " +
    "have failed processing after exhausting all retries. It is the hospital for sick messages. " +
    "Alongside the Dead Letter Channel, Guaranteed Delivery ensures that messages survive system " +
    "failures. The messaging system persists messages to disk so that a broker restart does not " +
    "lose unprocessed messages. In Kafka, this is automatic — every message is written to the " +
    "commit log on disk. In JMS, you must configure persistent delivery mode. " +
    "Together, Dead Letter Channels and Guaranteed Delivery form the reliability backbone of any " +
    "serious messaging system. In Camel, you configure an error handler with a dead letter endpoint " +
    "and retries: errorHandler(deadLetterChannel(\"kafka:dead-letters\").maximumRedeliveries(3))."
  );
}

// Slide 30: Guaranteed Delivery
{
  const s = S(pres);
  addContentTitle(s, "GUARANTEED DELIVERY", "Messages Survive System Failures");
  addBullets(s, bsub([
    { text: "Messages are persisted before acknowledgment", sub: "The messaging system writes the message to durable storage before confirming receipt." },
    { text: "Broker restarts do not lose messages", sub: "After recovery, the broker re-delivers unacknowledged messages to consumers." },
    { text: "Kafka: replication factor ensures durability", sub: "With replication factor 3, a message survives the loss of two brokers." },
    { text: "Performance trade-off", sub: "Durable writes are slower than in-memory delivery — choose based on your tolerance for data loss." },
    { text: "Not the same as exactly-once delivery", sub: "Guaranteed Delivery means at-least-once. Idempotent receivers handle the duplicates." },
  ]));
  addNotes(s,
    "Guaranteed Delivery is the pattern that makes messaging reliable enough for critical business " +
    "processes. The core idea is simple: the messaging system persists every message to durable " +
    "storage before acknowledging receipt to the sender. " +
    "In Kafka, messages are written to the commit log on disk and replicated across brokers. With " +
    "a replication factor of three and acks=all, a message survives the loss of two out of three " +
    "brokers. That is serious durability. " +
    "But there is a subtlety: Guaranteed Delivery provides at-least-once semantics, not exactly-once. " +
    "If a consumer crashes after processing a message but before committing its offset, the message " +
    "will be re-delivered when the consumer restarts. That is where the Idempotent Receiver pattern " +
    "comes in — we will cover it in the Endpoints section. " +
    "The performance trade-off is real. Writing to disk and waiting for replication acknowledgments " +
    "adds latency. For high-frequency, low-value events where occasional loss is acceptable, you " +
    "might relax these guarantees."
  );
}

// Slide 31: Channel Adapter
{
  const s = S(pres);
  addContentTitle(s, "CHANNEL ADAPTER", "Connecting Non-Messaging Systems");
  addBullets(s, bsub([
    { text: "Bridges a non-messaging application to the messaging system", sub: "A database, a file system, an HTTP API — anything that does not natively speak messaging." },
    { text: "Inbound adapter: reads external data, publishes to a channel", sub: "Poll a database table, watch a directory, receive HTTP webhooks — and produce messages." },
    { text: "Outbound adapter: consumes messages, writes to external system", sub: "Insert into a database, write a file, call an HTTP endpoint — triggered by messages." },
    { text: "Camel has 300+ components — each is a channel adapter", sub: "camel-jdbc, camel-file, camel-http — every component adapts a technology to messaging." },
  ]));
  addNotes(s,
    "Not every application speaks messaging natively. Your legacy ERP might expose a database " +
    "table. Your partner's system might accept files via SFTP. Your SaaS vendor provides a " +
    "REST API. The Channel Adapter pattern bridges these non-messaging systems to your " +
    "messaging infrastructure. " +
    "An inbound adapter reads from the external system and publishes messages. For example, " +
    "a JDBC adapter polls a database table for new rows and publishes each row as a message " +
    "to a Kafka topic. " +
    "An outbound adapter does the reverse — it consumes messages from a channel and writes to " +
    "the external system. For example, an HTTP adapter consumes messages and posts them to a " +
    "REST endpoint. " +
    "Apache Camel's massive library of 300+ components is essentially a catalog of channel " +
    "adapters. Every from() and to() URI in a Camel route is a channel adapter connecting " +
    "your integration to a specific technology."
  );
}

// Slide 32: Messaging Bridge (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "MESSAGING BRIDGE", "Connecting Two Messaging Systems",
    "06-messaging-bridge",
    "Figure 3.3 — A bridge connects Kafka to Pulsar, JMS to Kafka, or any two messaging systems");
  addNotes(s,
    "A Messaging Bridge connects two separate messaging systems. Unlike a Channel Adapter, which " +
    "connects a non-messaging system to messaging, a Messaging Bridge connects messaging to " +
    "messaging — for example, Kafka to Pulsar, or an on-premises JMS broker to a cloud Kafka cluster. " +
    "Bridges are essential during migration scenarios. If you are moving from RabbitMQ to Kafka, " +
    "you do not cut over everything at once. You set up a bridge that mirrors messages between " +
    "the two systems, migrate consumers one by one, and eventually decommission the old broker. " +
    "In Camel, a bridge is just a route: from('jms:queue:orders').to('kafka:orders'). The route " +
    "consumes from one messaging system and produces to another. Camel handles the protocol " +
    "translation, serialization differences, and acknowledgment semantics transparently."
  );
}

// Slide 33: Datatype Channel
{
  const s = S(pres);
  addContentTitle(s, "DATATYPE CHANNEL", "Channels for Specific Message Types");
  addBullets(s, bsub([
    { text: "Each channel carries one type of message", sub: "The 'orders' channel carries order messages; the 'payments' channel carries payment messages." },
    { text: "Eliminates type inspection at the consumer", sub: "If you subscribe to 'priority-orders', every message is guaranteed to be a priority order." },
    { text: "Simplifies consumer logic", sub: "No need for a Content-Based Router at the consumer — the routing is done by channel selection." },
    { text: "Trade-off: more channels to manage", sub: "Fine-grained channels improve clarity but increase operational overhead." },
    { text: "Kafka topic naming conventions enforce this", sub: "domain.entity.event — e.g., shipping.order.placed, shipping.order.shipped." },
  ]));
  addNotes(s,
    "A Datatype Channel dedicates each channel to a specific message type. Instead of having one " +
    "big 'events' channel that carries orders, payments, and shipping notifications all mixed " +
    "together, you create separate channels for each type. " +
    "The benefit is that consumers know exactly what to expect. If the Inventory Service subscribes " +
    "to 'order-events', every message on that channel is an order event — no type-checking, no " +
    "filtering, no surprises. " +
    "The trade-off is proliferation. In a large system, you might end up with hundreds of channels. " +
    "Good naming conventions help — 'domain.entity.event' is a common Kafka topic naming scheme: " +
    "'shipping.order.placed', 'shipping.order.shipped', 'payments.invoice.paid'. " +
    "This pattern often works hand-in-hand with the Canonical Data Model — each datatype channel " +
    "has a well-defined schema (often enforced by a schema registry) that all producers and " +
    "consumers agree on."
  );
}

// ─────────────────────────────────────────────────────────────────────
//  SECTION 04 — MESSAGE CONSTRUCTION (8 slides)
// ─────────────────────────────────────────────────────────────────────
divider(pres, "04", "Message\nConstruction",
  "Command, Document, Event, Request-Reply",
  "How you structure a message determines how it will be used. In this section we look at the " +
  "three message intentions — Command, Document, and Event — and the Request-Reply conversation " +
  "pattern with its supporting concepts: Correlation Identifier, Return Address, Message " +
  "Expiration, and Format Indicator."
);

// Slide 35: Three message intentions (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "MESSAGE INTENTIONS", "Three Kinds of Messages",
    "07-message-types",
    "Figure 4.1 — Command Messages, Document Messages, and Event Messages");
  addNotes(s,
    "Every message sent through a messaging system expresses one of three intentions. " +
    "A Command Message says 'do something' — process this order, charge this credit card, ship " +
    "this package. The sender is making a request and typically expects the work to be done. " +
    "A Document Message says 'here is data' — here is the current state of order #12345, here " +
    "is the customer profile for account ABC. The sender is sharing information without expecting " +
    "any specific action. " +
    "An Event Message says 'something happened' — order #12345 was placed, payment was received, " +
    "the item was shipped. The sender is notifying subscribers of a state change. " +
    "Understanding which type you are sending matters because it affects your channel choice, " +
    "your error handling, and your idempotency strategy."
  );
}

// Slide 36: Command Message
{
  const s = S(pres);
  addPatternCard(s, "COMMAND MESSAGE", "\"Do Something\"", "command-message",
    "The Order Service needs the Payment Service to charge a credit card. This is an instruction — imperative, action-oriented. Only one consumer should execute it.",
    "Commands tell the receiver to perform an action: ProcessOrder, ChargePayment, ReserveInventory. Sent to P2P channels (one consumer executes). Must be idempotent when retries are possible. Often paired with Request-Reply for confirmation."
  );
  addNotes(s,
    "A Command Message is an instruction: do this thing. When the Order Service sends a " +
    "'ChargePayment' command to the Payment Service, it is saying 'I need you to charge " +
    "this customer's credit card for this amount.' " +
    "Commands should go to Point-to-Point Channels because you want exactly one consumer " +
    "to execute the command. Two consumers processing the same ChargePayment command would " +
    "result in a double charge — a very bad day for your customer. " +
    "Commands must be designed for idempotency. In a distributed system, the sender might " +
    "time out and retry. If the payment was already processed but the acknowledgment was lost, " +
    "the receiver must recognize the duplicate and return the existing result instead of " +
    "processing the payment again. " +
    "A common approach is to include a unique command ID and have the receiver check an " +
    "idempotency store before processing."
  );
}

// Slide 37: Document Message
{
  const s = S(pres);
  addContentTitle(s, "DOCUMENT MESSAGE", "\"Here Is Data\"");
  addBullets(s, bsub([
    { text: "Carries data without prescribing action", sub: "A snapshot of a customer, a product catalog update, a pricing schedule." },
    { text: "The receiver decides what to do with it", sub: "One receiver might cache it, another might analyze it, a third might ignore it." },
    { text: "Often used for state synchronization", sub: "Replicate a source system's state to downstream consumers." },
    { text: "Can be large — consider the Claim Check pattern", sub: "If the document is too big for the channel, store it externally and send a reference." },
  ]));
  addNotes(s,
    "A Document Message shares data without telling the receiver what to do with it. When " +
    "the Product Service publishes a product catalog update, it is not commanding anyone to " +
    "do anything. It is saying 'here is the current state of the catalog — do with it what " +
    "you will.' " +
    "The Inventory Service might use it to update its local stock-keeping units. The Search " +
    "Service might re-index the products. The Analytics Service might run a trend analysis. " +
    "Each receiver interprets the document in its own way. " +
    "Document Messages are natural for state replication and data synchronization. When the " +
    "source of truth changes, it publishes a document message, and all interested parties " +
    "update their local views. " +
    "One practical concern is size. If the document is a complete product catalog with images " +
    "and specifications, it might be too large for the messaging channel. The Claim Check " +
    "pattern solves this by storing the full document in external storage and sending only " +
    "a reference through the channel."
  );
}

// Slide 38: Event Message
{
  const s = S(pres);
  addPatternCard(s, "EVENT MESSAGE", "\"Something Happened\"", "event-message",
    "When an order is placed, multiple systems need to react — inventory, billing, shipping, analytics. No single receiver should own the reaction.",
    "Events notify subscribers of a state change: OrderPlaced, PaymentReceived, ItemShipped. Past tense, factual, immutable. Sent to Pub-Sub channels. Should contain enough context to be useful — don't force receivers to call back. Foundation of event sourcing and EDA."
  );
  addNotes(s,
    "An Event Message is a notification that something happened in the past. OrderPlaced, " +
    "PaymentReceived, ItemShipped — notice the past tense. Events are facts — they cannot " +
    "be un-happened. " +
    "Events naturally flow through Publish-Subscribe Channels because multiple systems need " +
    "to react. When an order is placed, the Inventory Service reserves stock, the Notification " +
    "Service sends a confirmation email, and the Analytics Service records the sale. Each " +
    "subscriber reacts independently, and the publisher does not know or care about any of them. " +
    "A key design question is how much data to include in the event. A 'thin' event with just " +
    "an order ID forces receivers to call back to the Order Service for details — creating " +
    "temporal coupling. A 'fat' event with the full order data makes the receiver self-sufficient " +
    "but increases message size and raises data freshness concerns. " +
    "The sweet spot is usually including enough data for the most common consumer use cases."
  );
}

// Slide 39: Request-Reply (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "REQUEST-REPLY", "Two-Way Conversations Over Messaging",
    "08-request-reply",
    "Figure 4.2 — Request Channel, Reply Channel, Correlation Identifier, and Return Address");
  addNotes(s,
    "Sometimes fire-and-forget is not enough. The Order Service sends a ChargePayment command " +
    "and needs to know whether the charge succeeded. The Request-Reply pattern enables two-way " +
    "conversations over messaging. " +
    "The requestor sends a message on the request channel and includes a Return Address header " +
    "that tells the replier where to send the response. The requestor also includes a Correlation " +
    "Identifier — a unique ID that the replier copies into the reply message so the requestor " +
    "can match replies to requests. " +
    "This pattern gives you the semantics of a synchronous call — request, wait, get response — " +
    "while preserving the decoupling benefits of messaging. The sender and receiver are still " +
    "temporally decoupled; the messaging system buffers the request and the reply. " +
    "In Camel, the Request-Reply pattern is built into the ExchangePattern. When you use " +
    "InOut exchange, Camel automatically manages the reply channel and correlation."
  );
}

// Slide 40: Correlation Identifier
{
  const s = S(pres);
  addContentTitle(s, "CORRELATION IDENTIFIER", "Matching Replies to Requests");
  addBullets(s, bsub([
    { text: "A unique ID embedded in the request message", sub: "The replier copies it into the reply so the requestor knows which request was answered." },
    { text: "Essential when multiple requests are in flight", sub: "Without correlation, the requestor cannot tell which reply belongs to which request." },
    { text: "Often a UUID or the message's own ID", sub: "Camel uses the Exchange ID as a natural correlation identifier." },
    { text: "Enables asynchronous request-reply", sub: "Send ten requests, process replies as they arrive, match each reply to its request." },
  ]));
  addNotes(s,
    "The Correlation Identifier is a simple but critical pattern. When you have multiple " +
    "requests in flight simultaneously — which is the whole point of asynchronous messaging — " +
    "you need a way to match each reply to its corresponding request. " +
    "The mechanism is straightforward. The requestor generates a unique identifier — typically " +
    "a UUID — and includes it in the request message header. When the replier processes the " +
    "request and generates a reply, it copies the correlation identifier from the request into " +
    "the reply header. The requestor receives the reply, reads the correlation identifier, and " +
    "looks up the original request. " +
    "In Kafka, you might use a custom header. In JMS, there is a dedicated JMSCorrelationID " +
    "header field. In Camel, the Exchange ID serves as a natural correlation identifier, and " +
    "Camel handles the matching automatically when you use InOut exchange patterns."
  );
}

// Slide 41: Return Address
{
  const s = S(pres);
  addContentTitle(s, "RETURN ADDRESS", "Where to Send the Reply");
  addBullets(s, bsub([
    { text: "A header that specifies the reply channel", sub: "The requestor tells the replier which channel to use for the response." },
    { text: "Enables dynamic reply destinations", sub: "Different requestors can specify different reply channels — no hard-coding." },
    { text: "JMS: JMSReplyTo header", sub: "The standard JMS header that specifies the reply destination." },
    { text: "Kafka: custom reply-topic header + correlation", sub: "No built-in support — you implement return address with custom headers." },
  ]));
  addNotes(s,
    "Return Address complements the Correlation Identifier. While correlation tells the requestor " +
    "which request was answered, the return address tells the replier where to send the answer. " +
    "Without a return address, the replier would need to hard-code the reply destination, which " +
    "couples it to a specific requestor. With a return address, any requestor can specify its " +
    "own reply channel, and the replier simply sends the response wherever it is told. " +
    "In JMS, this is built into the specification as the JMSReplyTo header. You set the reply " +
    "destination on the request message, and the replier reads it. " +
    "In Kafka, there is no built-in support, so you implement it with a custom header — " +
    "typically 'reply-topic' — and the replier reads that header to determine where to send " +
    "the response. Camel handles both cases transparently."
  );
}

// Slide 42: Message Expiration
{
  const s = S(pres);
  addContentTitle(s, "MESSAGE EXPIRATION & FORMAT INDICATOR", "Time-Limited Messages and Versioning");
  addBullets(s, bsub([
    { text: "Message Expiration — time-to-live for messages", sub: "If a message is not consumed within its TTL, the messaging system discards it." },
    { text: "Prevents processing stale data", sub: "A price quote from yesterday should not be processed today — it may no longer be valid." },
    { text: "Kafka: retention policies serve a similar purpose", sub: "Topic-level retention.ms controls how long messages are kept." },
    { text: "Format Indicator — version your message schemas", sub: "Include a version header (v1, v2) so consumers know how to deserialize the payload." },
    { text: "Schema registries enforce format indicators", sub: "Confluent Schema Registry, Apicurio — validate schemas at produce and consume time." },
  ]));
  addNotes(s,
    "Message Expiration attaches a time-to-live to a message. If the message has not been consumed " +
    "within that window, the messaging system discards it — or moves it to a dead letter channel. " +
    "This is critical for time-sensitive data. A stock price quote that is ten minutes old is " +
    "worse than no quote at all — it could trigger a bad trade. A promotion offer that expired " +
    "yesterday should not be sent to a customer today. " +
    "In Kafka, expiration is typically handled through topic-level retention policies rather than " +
    "per-message TTLs. You can also check timestamps in consumer logic and discard stale messages. " +
    "Format Indicator is a related pattern for schema versioning. By including a version number " +
    "in the message header, consumers can determine how to deserialize the payload. Schema " +
    "registries like Confluent Schema Registry or Apicurio automate this by tracking schema " +
    "evolution and enforcing compatibility rules."
  );
}

// ─────────────────────────────────────────────────────────────────────
//  SECTION 05 — MESSAGE ROUTING (12 slides)
// ─────────────────────────────────────────────────────────────────────
divider(pres, "05", "Message\nRouting",
  "Thirteen patterns for getting messages to the right place",
  "Message Routing is the largest pattern category with thirteen patterns. These patterns solve " +
  "the fundamental question: how does a message get from where it is to where it needs to be? " +
  "We will cover simple routers, dynamic routers, splitters, aggregators, and the powerful " +
  "Scatter-Gather composition."
);

// Slide 44: The routing problem
{
  const s = S(pres);
  addContentTitle(s, "THE ROUTING PROBLEM", "Getting Messages to the Right Destination");
  addBullets(s, bsub([
    { text: "Multiple consumers, multiple criteria", sub: "Different messages need to go to different places based on content, type, or context." },
    { text: "Static routing is fragile", sub: "Hard-coding destinations in the sender couples it to the receiver topology." },
    { text: "Routing logic should live in the middleware", sub: "Centralize routing decisions in the integration layer, not in business applications." },
    { text: "Thirteen patterns for every routing scenario", sub: "From simple if-else routing to complex stateful process management." },
  ]));
  addNotes(s,
    "Routing is the art of getting messages to the right destination. In a simple system with " +
    "one sender and one receiver, there is no routing problem. But in a real enterprise with " +
    "dozens of services, routing becomes complex. " +
    "Priority orders need to go to the fast-track processing queue. International orders need " +
    "customs validation. Bulk orders need batch processing. Refund requests need to go to the " +
    "returns department. " +
    "If you put this routing logic in the Order Service, you couple it to every downstream " +
    "consumer. Add a new consumer? Change the Order Service. Change routing rules? Change the " +
    "Order Service. That does not scale. " +
    "The routing patterns solve this by moving routing decisions into the integration layer — " +
    "the Camel routes — where they can be changed, tested, and monitored independently of " +
    "the business applications."
  );
}

// Slide 45: Content-Based Router (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "CONTENT-BASED ROUTER", "Route by Message Content",
    "09-routing-patterns",
    "Figure 5.1 — Content-Based Router inspects the message and sends it to the matching output channel");
  addNotes(s,
    "The Content-Based Router is the most common routing pattern. It inspects the message — " +
    "usually a header or a field in the body — and sends it to one of several output channels " +
    "based on the result. " +
    "Think of a mail sorting machine that reads the zip code on a letter and drops it into the " +
    "correct bin. The Content-Based Router reads a field like 'orderType' and routes priority " +
    "orders to the fast lane, standard orders to the normal lane, and bulk orders to the batch " +
    "processing lane. " +
    "In Camel, this is the choice() EIP: .choice().when(header(\"orderType\").isEqualTo(\"PRIORITY\"))" +
    ".to(\"kafka:priority-orders\").when(header(\"orderType\").isEqualTo(\"BULK\")).to(\"kafka:batch\")" +
    ".otherwise().to(\"kafka:standard-orders\"). " +
    "A word of caution: as routing rules multiply, the Content-Based Router can become a " +
    "maintenance burden. When you find yourself with dozens of when() clauses, consider the " +
    "Dynamic Router or a rules engine."
  );
}

// Slide 46: Message Filter
{
  const s = S(pres);
  addPatternCard(s, "MESSAGE FILTER", "Dropping Unwanted Messages", "message-filter",
    "A topic carries 100,000 messages but a consumer only cares about 1,000 of them. Processing all 100,000 wastes resources and slows the pipeline.",
    "Routes wanted messages to the output; discards the rest — like a Content-Based Router with only one output. Predicate-based: only messages matching a condition pass through. Camel: .filter(simple(\"${header.amount} > 1000\")).to(\"kafka:large-orders\")."
  );
  addNotes(s,
    "The Message Filter is a simplified router with only two outputs: keep or discard. It " +
    "evaluates a predicate against each message and only forwards messages that pass the test. " +
    "This pattern is incredibly common in event-driven systems where a broad event stream " +
    "carries events for many consumers, but each consumer only cares about a subset. The " +
    "Analytics Service might only care about orders over a certain dollar amount. The Fraud " +
    "Service might only care about international transactions. Each applies a filter to the " +
    "same event stream. " +
    "In Camel, the filter() EIP takes a predicate: .filter(simple(\"${header.amount} > 1000\")). " +
    "Messages that pass the predicate continue through the route; messages that fail are " +
    "silently dropped. " +
    "If you need to do something with the dropped messages — log them, count them, send them " +
    "somewhere — consider using a Content-Based Router instead, which gives you explicit " +
    "control over both the match and no-match paths."
  );
}

// Slide 47: Dynamic Router
{
  const s = S(pres);
  addContentTitle(s, "DYNAMIC ROUTER", "Route Based on Dynamic Rules");
  addBullets(s, bsub([
    { text: "Routing destinations are determined at runtime", sub: "Consult a database, a configuration service, or the message itself for routing rules." },
    { text: "Avoids hard-coded routing tables", sub: "Add new destinations without redeploying the router — update the rules source." },
    { text: "Can use a control channel for rule updates", sub: "Publish new routing rules on a management channel; the router picks them up live." },
    { text: "Camel: dynamicRouter(method(bean, 'route'))", sub: "A bean method returns the next destination — null means routing is complete." },
  ]));
  addNotes(s,
    "The Dynamic Router takes the Content-Based Router concept and makes it flexible. Instead " +
    "of hard-coding routing rules in the route definition, the Dynamic Router consults an " +
    "external source — a database, a configuration service, or even the message itself — to " +
    "determine where to send each message. " +
    "This is powerful for systems where routing rules change frequently. A promotion engine " +
    "might route different product categories to different discount calculators based on the " +
    "current marketing campaign. A deployment pipeline might route builds to different " +
    "environments based on the current release schedule. " +
    "In Camel, the dynamicRouter() EIP calls a method on a bean that returns the next " +
    "destination. The method is called repeatedly until it returns null, allowing the router " +
    "to send the message to multiple destinations in sequence. " +
    "The key advantage is operational: business users can change routing rules without " +
    "requiring a code deployment."
  );
}

// Slide 48: Recipient List
{
  const s = S(pres);
  addContentTitle(s, "RECIPIENT LIST", "Send to Multiple Calculated Destinations");
  addBullets(s, bsub([
    { text: "Calculates a list of recipients at runtime", sub: "Unlike Pub-Sub (all subscribers), the Recipient List chooses a specific subset." },
    { text: "Each recipient gets a copy of the message", sub: "The message is cloned and sent independently to each destination." },
    { text: "Destinations can be static or dynamic", sub: "Read from a header, look up in a database, compute from message content." },
    { text: "Camel: recipientList(header('destinations'))", sub: "The header contains a comma-separated list of endpoint URIs." },
    { text: "Key component in the Scatter-Gather pattern", sub: "Broadcast to recipients, then aggregate their responses." },
  ]));
  addNotes(s,
    "The Recipient List pattern sends a copy of each message to a dynamically computed set of " +
    "recipients. This is different from Publish-Subscribe, where every subscriber gets every " +
    "message. With a Recipient List, the set of recipients is calculated per message. " +
    "For example, when a new order arrives, the router might determine that this order requires " +
    "fraud checking, inventory reservation, and payment processing — but not shipping label " +
    "generation (because the items are digital). The Recipient List sends the order to exactly " +
    "those three services. " +
    "In Camel, the recipientList() EIP reads the destination list from a header, a method call, " +
    "or an expression. Each recipient gets an independent copy of the message and processes it " +
    "independently. " +
    "The Recipient List is a critical building block of the Scatter-Gather pattern, which we " +
    "will see shortly: broadcast to multiple recipients, wait for all responses, then aggregate " +
    "them into a single result."
  );
}

// Slide 49: Splitter
{
  const s = S(pres);
  addContentTitle(s, "SPLITTER", "Break Compound Messages Into Parts");
  addBullets(s, bsub([
    { text: "Splits a single message into multiple individual messages", sub: "An order with 5 line items becomes 5 separate messages — one per item." },
    { text: "Each part is processed independently", sub: "Different items might route to different warehouses or different processing pipelines." },
    { text: "Must handle partial failures", sub: "If 4 of 5 parts succeed and 1 fails, what is the overall status?" },
    { text: "Often paired with an Aggregator", sub: "Split a message, process the parts, then combine the results back into one." },
    { text: "Camel: split(body().tokenizeXML('item'))", sub: "Split on XML elements, JSON arrays, line breaks — any expression that yields an iterable." },
  ]));
  addNotes(s,
    "The Splitter takes a single compound message and breaks it into individual parts. The " +
    "classic example is an order with multiple line items. The Splitter produces one message " +
    "per line item, and each item can be processed independently. " +
    "Why split? Because different items might need different processing. An order for electronics " +
    "and groceries might need to route the electronics to a fulfillment warehouse in Ohio and " +
    "the groceries to a cold storage facility in the local market. You cannot do that with a " +
    "single compound message. " +
    "The challenge with splitting is partial failures. If you split an order into five item " +
    "messages and one fails, what do you report to the customer? You need a strategy: fail the " +
    "entire order, succeed with partial fulfillment, or retry the failed item. " +
    "The Splitter is almost always paired with an Aggregator. You split the message, process " +
    "each part, and then aggregate the results back into a single response."
  );
}

// Slide 50: Aggregator (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "AGGREGATOR", "Combine Multiple Messages Into One",
    "13-aggregator",
    "Figure 5.2 — The Aggregator collects correlated messages and combines them when complete");
  addNotes(s,
    "The Aggregator is the complement of the Splitter. Where the Splitter breaks one message " +
    "into many, the Aggregator combines many messages into one. " +
    "An Aggregator needs three things. First, a correlation expression that determines which " +
    "messages belong together — typically a shared order ID or correlation key. Second, an " +
    "aggregation strategy that defines how to combine messages — append to a list, sum values, " +
    "merge fields. Third, a completion condition that determines when all parts have been " +
    "collected — a count, a timeout, or a predicate. " +
    "The completion condition is the trickiest part. If you expect five parts and only four " +
    "arrive, you need a timeout to avoid waiting forever. If parts arrive out of order, " +
    "the aggregator must handle that gracefully. " +
    "In Camel, the aggregate() EIP takes a correlation expression, an AggregationStrategy " +
    "implementation, and completion conditions. The framework handles the state management, " +
    "timeout tracking, and completion detection."
  );
}

// Slide 51: Scatter-Gather (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "SCATTER-GATHER", "Broadcast, Collect, Choose Best",
    "10-scatter-gather",
    "Figure 5.3 — Scatter-Gather: Recipient List broadcasts, Aggregator collects, best response wins");
  addNotes(s,
    "The Scatter-Gather pattern composes two other patterns — Recipient List and Aggregator — " +
    "into a powerful combination. " +
    "First, the Scatter phase: the Recipient List broadcasts the message to multiple recipients. " +
    "For example, send a loan request to five banks. " +
    "Then, the Gather phase: the Aggregator collects the responses from all recipients and " +
    "combines them — typically by selecting the best response. For example, choose the bank " +
    "with the lowest interest rate. " +
    "This pattern is the heart of the Loan Broker case study we will see later. The broker " +
    "receives a loan request, scatters it to multiple banks, gathers their quotes, and returns " +
    "the best quote to the customer. " +
    "The key design decisions are: how long to wait for responses (timeout), how many responses " +
    "are enough (completion size), and what to do if some recipients fail (partial results vs. " +
    "total failure). Camel's aggregate() EIP handles all of these concerns."
  );
}

// Slide 52: Routing Slip
{
  const s = S(pres);
  addContentTitle(s, "ROUTING SLIP", "Dynamic Multi-Step Routing");
  addBullets(s, bsub([
    { text: "The message carries its own itinerary", sub: "A header contains a list of processing steps; each step removes itself and forwards." },
    { text: "Steps are determined at message creation time", sub: "Different orders might need different processing pipelines — the routing slip encodes this." },
    { text: "Each step processes and forwards to the next", sub: "Step A validates, removes itself from the slip, sends to Step B. Step B enriches, sends to Step C." },
    { text: "Camel: routingSlip(header('steps'))", sub: "The header contains comma-separated endpoint URIs; Camel processes them in sequence." },
  ]));
  addNotes(s,
    "A Routing Slip is like a doctor's referral chain. When you visit your GP, they might write " +
    "a referral slip: see the cardiologist, then the lab for bloodwork, then the pharmacist. " +
    "Each specialist processes you and sends you to the next one on the slip. " +
    "In messaging, the Routing Slip is a message header containing a list of processing steps. " +
    "When a message arrives at a step, the step processes it, removes itself from the slip, and " +
    "forwards the message to the next step. " +
    "This is different from a static pipeline because different messages can have different " +
    "routing slips. An order for a new customer might go through credit check, fraud detection, " +
    "and inventory reservation. An order from a trusted customer might skip credit check and " +
    "fraud detection. " +
    "In Camel, the routingSlip() EIP reads the itinerary from a header and processes each " +
    "endpoint in sequence. Each endpoint can modify the message and even modify the remaining " +
    "slip entries."
  );
}

// Slide 53: Process Manager
{
  const s = S(pres);
  addContentTitle(s, "PROCESS MANAGER", "Complex Routing with State");
  addBullets(s, bsub([
    { text: "A central coordinator that manages a multi-step process", sub: "Unlike a Routing Slip (carried by the message), the Process Manager is a stateful component." },
    { text: "Maintains process state", sub: "Knows which steps have been completed, which are pending, and what to do on failure." },
    { text: "Handles compensation and rollback", sub: "If step 3 of 5 fails, the Process Manager can undo steps 1 and 2 (saga pattern)." },
    { text: "Often implemented as a state machine", sub: "States: Created → Validated → Paid → Shipped → Delivered, with transitions for each event." },
    { text: "Camel: saga() EIP or custom stateful processor", sub: "The saga EIP coordinates compensating actions across distributed services." },
  ]));
  addNotes(s,
    "The Process Manager is the most sophisticated routing pattern. While a Routing Slip carries " +
    "its itinerary in the message, a Process Manager is a stateful component that coordinates " +
    "the entire process from a central location. " +
    "Think of an order fulfillment process: validate the order, check inventory, charge the " +
    "credit card, reserve shipping, generate a label, notify the customer. The Process Manager " +
    "keeps track of which steps have completed, which are in progress, and what to do if a " +
    "step fails. " +
    "The key advantage over a Routing Slip is compensation. If the payment step succeeds but " +
    "the shipping step fails, the Process Manager can trigger a compensation action to refund " +
    "the payment. This is the saga pattern for distributed transactions. " +
    "In Camel, you can implement a Process Manager as a saga with compensating actions, or " +
    "as a custom stateful bean that tracks process state and emits the appropriate messages."
  );
}

// Slide 54: Composed Message Processor
{
  const s = S(pres);
  addContentTitle(s, "COMPOSED MESSAGE PROCESSOR", "Split, Route, Aggregate");
  addBullets(s, bsub([
    { text: "Combines Splitter, Router, and Aggregator", sub: "Split a message into parts, route each part to a specific processor, aggregate the results." },
    { text: "Each part follows its own path", sub: "Item A goes to warehouse processing; Item B goes to digital fulfillment; both results are merged." },
    { text: "The most common compound pattern", sub: "If you find yourself splitting, routing, and aggregating, you are using this pattern." },
    { text: "Camel: split() + choice() + aggregate()", sub: "Chain the three EIPs in a single route to build the composed processor." },
  ]));
  addNotes(s,
    "The Composed Message Processor is not a new pattern but a recipe that combines three " +
    "existing patterns: Splitter, Router, and Aggregator. " +
    "Here is the scenario. An order arrives with multiple line items. You need to split it " +
    "into individual items, route each item to the appropriate processor — physical items to " +
    "the warehouse, digital items to the download service, subscription items to the billing " +
    "system — and then aggregate all the results back into a single order confirmation. " +
    "In Camel, you chain the three EIPs: split(body()).choice().when(simple(\"${body.type} == " +
    "'PHYSICAL'\")).to(\"direct:warehouse\").otherwise().to(\"direct:digital\").end()" +
    ".aggregate(header(\"orderId\"), new OrderAggregation()).completionSize(size). " +
    "This compound pattern appears so frequently in enterprise integration that it deserves " +
    "its own name, even though it is built from simpler patterns."
  );
}

// Slide 55: Message Broker
{
  const s = S(pres);
  addContentTitle(s, "MESSAGE BROKER", "Centralized Routing Hub");
  addBullets(s, bsub([
    { text: "A centralized component that routes all messages", sub: "Applications connect to the broker, not to each other — star topology." },
    { text: "Decouples senders from receivers completely", sub: "The broker knows about all channels and all routing rules." },
    { text: "Can apply transformations, validations, and security", sub: "The broker becomes a policy enforcement point for all integration traffic." },
    { text: "Kafka and Pulsar are modern message brokers", sub: "They provide the centralized hub with topics, consumer groups, and access control." },
    { text: "Risk: the broker becomes a bottleneck and single point of failure", sub: "Clustering and replication mitigate this but add operational complexity." },
  ]));
  addNotes(s,
    "The Message Broker pattern describes a centralized component through which all messages " +
    "flow. Instead of applications connecting directly to each other — a mesh topology — they " +
    "connect to the broker — a star topology. " +
    "The benefits are significant. You have a single place to manage routing rules, apply " +
    "security policies, monitor traffic, and enforce data governance. When a new application " +
    "joins the enterprise, you connect it to the broker, not to every other application. " +
    "Kafka and Pulsar are modern incarnations of the Message Broker pattern. They provide the " +
    "centralized hub with topics for channels, consumer groups for load balancing, and ACLs " +
    "for access control. " +
    "The risk is that the broker becomes a single point of failure and a performance bottleneck. " +
    "Modern brokers mitigate this with clustering and replication — a Kafka cluster with three " +
    "brokers and replication factor three can survive the loss of any single node — but the " +
    "operational complexity is real."
  );
}

// ─────────────────────────────────────────────────────────────────────
//  SECTION 06 — MESSAGE TRANSFORMATION (8 slides)
// ─────────────────────────────────────────────────────────────────────
divider(pres, "06", "Message\nTransformation",
  "Seven patterns for reshaping message content",
  "Integration rarely works when every application uses the same data format — and they never " +
  "do. The transformation patterns solve the format mismatch problem. We will cover the " +
  "Message Translator, Envelope Wrapper, Content Enricher, Content Filter, Claim Check, " +
  "Normalizer, and Canonical Data Model."
);

// Slide 57: Why transformation matters
{
  const s = S(pres);
  addContentTitle(s, "THE TRANSFORMATION PROBLEM", "Why Format Mismatches Are the Norm");
  addBullets(s, bsub([
    { text: "Every application has its own data model", sub: "The CRM uses 'customerName'; the ERP uses 'CUST_NM'; the billing system uses 'client.name'." },
    { text: "Formats evolve independently", sub: "The Order Service moves to v2 of its schema while the Notification Service still expects v1." },
    { text: "External partners have fixed formats", sub: "Your EDI partner sends X12 documents. Your API partner sends JSON. Your legacy system sends CSV." },
    { text: "Transformation is the glue between different data models", sub: "Without it, every application pair needs custom format negotiation." },
  ]));
  addNotes(s,
    "If every application in your enterprise used the same data format, you would not need " +
    "transformation patterns. But they never do. " +
    "The CRM stores customer names as 'firstName' and 'lastName'. The ERP stores them as " +
    "'CUST_FIRST_NM' and 'CUST_LAST_NM'. The billing system stores them as a single " +
    "'client.fullName' field. And your EDI partner sends them in fixed-width X12 segments. " +
    "When these systems need to exchange data, someone has to translate between formats. " +
    "Without transformation patterns, you end up with N-squared translation logic — every " +
    "application pair needs its own custom converter. With N applications, that is N times " +
    "(N minus one) divided by two converters to maintain. " +
    "Transformation patterns reduce this to N converters by introducing a canonical model or " +
    "a normalizer that converts all formats to a common representation."
  );
}

// Slide 58: Message Translator (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "MESSAGE TRANSLATOR", "Convert Between Formats",
    "12-transformation-flow",
    "Figure 6.1 — The Message Translator sits between applications and converts formats");
  addNotes(s,
    "The Message Translator is the fundamental transformation pattern. It sits in the pipeline " +
    "between a sender and a receiver and converts the message from the sender's format to the " +
    "receiver's format. " +
    "In Camel, translators come in many forms. The marshal() and unmarshal() methods handle " +
    "serialization format changes — JSON to XML, Avro to JSON, CSV to POJO. The transform() " +
    "method applies arbitrary transformations. And the bean() method delegates to a Java class " +
    "for complex business transformations. " +
    "The key principle is that the sender and receiver should not know about each other's " +
    "formats. The sender publishes in its own format; the translator converts; the receiver " +
    "consumes in its own format. If either format changes, only the translator needs updating."
  );
}

// Slide 59: Envelope Wrapper
{
  const s = S(pres);
  addContentTitle(s, "ENVELOPE WRAPPER", "Wrap and Unwrap for Transport");
  addBullets(s, bsub([
    { text: "Wraps a message in a transport-specific envelope", sub: "Add SOAP headers, JMS properties, Kafka record metadata — without modifying the payload." },
    { text: "Unwraps at the destination", sub: "Remove the transport envelope and deliver the clean payload to the consumer." },
    { text: "Separates transport concerns from business data", sub: "Security tokens, routing hints, and trace IDs live in the envelope, not the payload." },
    { text: "Camel: headers and properties are the envelope", sub: "Business data in the body; transport metadata in headers — Camel manages both naturally." },
  ]));
  addNotes(s,
    "The Envelope Wrapper pattern separates transport concerns from business data. Think of " +
    "it like a physical letter: the envelope carries the address, the return address, and the " +
    "stamps, while the letter inside carries the actual message. " +
    "In messaging, the envelope might contain SOAP headers, JMS properties, Kafka record " +
    "metadata, authentication tokens, or distributed trace IDs. The payload — the business " +
    "data — is wrapped inside and delivered cleanly to the consumer. " +
    "At the destination, the envelope is unwrapped. The consumer receives the clean payload " +
    "without needing to know about the transport details. " +
    "In Camel, this pattern is so natural that you might not even notice it. The Exchange " +
    "carries headers (the envelope) and a body (the payload). When you set a JMS header or " +
    "a Kafka key, you are adding to the envelope. When you read the body, you are reading " +
    "the unwrapped payload."
  );
}

// Slide 60: Content Enricher
{
  const s = S(pres);
  addPatternCard(s, "CONTENT ENRICHER", "Add Data from External Sources", "content-enricher",
    "An order message arrives with only a customer ID, but the notification service needs the customer's name and email to send a confirmation.",
    "Augments a message with data from an external source — databases, REST APIs, caches. The message drives the lookup. Camel: enrich('direct:lookupCustomer', strategy). Watch for latency — cache aggressively and enrich only what you need."
  );
  addNotes(s,
    "The Content Enricher adds data to a message by consulting an external source. The most " +
    "common scenario: a message arrives with a customer ID, and the enricher looks up the " +
    "customer's full profile from a database or API and adds it to the message. " +
    "In Camel, the enrich() EIP calls a sub-route that performs the lookup and then merges " +
    "the result into the original message using an AggregationStrategy. You have full control " +
    "over how the enrichment data is combined with the original message. " +
    "A practical concern is performance. Every enrichment call adds latency. If you are " +
    "enriching with a REST API, that might add 50-100 milliseconds per message. At high " +
    "throughput, that adds up fast. " +
    "Strategies to mitigate: cache the enrichment data locally and refresh periodically, " +
    "batch enrichment calls where possible, and only enrich when the downstream consumer " +
    "actually needs the additional data."
  );
}

// Slide 61: Content Filter
{
  const s = S(pres);
  addContentTitle(s, "CONTENT FILTER", "Remove Unnecessary Data");
  addBullets(s, bsub([
    { text: "Strips fields or sections the receiver does not need", sub: "Remove sensitive data (SSN, credit card) before sending to analytics." },
    { text: "The complement of Content Enricher", sub: "Where the enricher adds data, the filter removes it." },
    { text: "Reduces message size", sub: "Smaller messages mean faster transmission, less storage, and lower costs." },
    { text: "Security and compliance use case", sub: "GDPR requires that personal data not be sent to systems that do not need it." },
    { text: "Camel: transform with JsonPath, XPath, or custom bean", sub: "Select only the fields you want; discard the rest." },
  ]));
  addNotes(s,
    "The Content Filter is the inverse of the Content Enricher. Instead of adding data, it " +
    "removes data that the downstream consumer does not need — or should not have. " +
    "There are two main motivations. First, efficiency: if the analytics service only needs " +
    "order total and category, why send the full order with fifty fields? Smaller messages " +
    "travel faster and cost less to store. " +
    "Second, security and compliance. Under GDPR, personal data should only be shared with " +
    "systems that have a legitimate need. A Content Filter can strip social security numbers, " +
    "credit card numbers, and email addresses before sending a message to the analytics system. " +
    "In Camel, you implement a Content Filter with a transform that selects only the fields " +
    "you want. JsonPath expressions for JSON, XPath for XML, or a custom bean method for " +
    "complex filtering logic."
  );
}

// Slide 62: Claim Check
{
  const s = S(pres);
  addContentTitle(s, "CLAIM CHECK", "Store Data Externally, Carry a Reference");
  addBullets(s, bsub([
    { text: "Stores the full message in external storage", sub: "Write the large payload to a database, S3 bucket, or distributed cache." },
    { text: "Replaces the body with a claim check (reference)", sub: "The message carries just a key or URL pointing to the stored data." },
    { text: "The receiver retrieves the data using the claim check", sub: "Look up the full payload from storage when you need it — not before." },
    { text: "Essential for large messages", sub: "Kafka has a default 1 MB message size limit; Claim Check lets you handle 100 MB payloads." },
    { text: "Camel: claimCheck() EIP with In/Out operations", sub: "Push to store, set the check on the message, pop to retrieve at the destination." },
  ]));
  addNotes(s,
    "The Claim Check pattern solves the large message problem. Messaging systems have message " +
    "size limits — Kafka defaults to 1 MB, and while you can increase it, sending very large " +
    "messages through a messaging system is inefficient and can cause backpressure. " +
    "The Claim Check pattern works like a coat check at a restaurant. You hand over your coat " +
    "(the large payload), receive a ticket (the claim check), and carry the ticket through " +
    "the evening. When you leave, you present the ticket and get your coat back. " +
    "In messaging, you store the large payload in external storage — S3, a database, Redis — " +
    "and replace the message body with a reference to the stored data. The reference travels " +
    "through the messaging system lightweight and fast. When the consumer needs the full data, " +
    "it uses the reference to retrieve it from storage. " +
    "This pattern is particularly useful for messages that include binary attachments, large " +
    "documents, or images."
  );
}

// Slide 63: Normalizer
{
  const s = S(pres);
  addContentTitle(s, "NORMALIZER", "Handle Multiple Input Formats");
  addBullets(s, bsub([
    { text: "Routes each format to its own translator, then merges into one", sub: "Combines a Content-Based Router with per-format Message Translators." },
    { text: "Produces a single canonical format from many inputs", sub: "JSON, XML, CSV, EDI — all normalized to one internal representation." },
    { text: "Simplifies downstream processing", sub: "Downstream consumers deal with one format, regardless of how many sources feed the channel." },
    { text: "Camel: choice() routing to format-specific unmarshal() calls", sub: "Route by content type, unmarshal each format, transform to canonical POJO." },
  ]));
  addNotes(s,
    "The Normalizer pattern addresses the common scenario where messages arrive in multiple " +
    "formats. Your API accepts JSON, your legacy partner sends XML, your batch system generates " +
    "CSV, and your EDI partner sends X12 documents. All represent the same business entity — " +
    "an order — but in different formats. " +
    "The Normalizer uses a Content-Based Router to detect the format of each incoming message " +
    "and routes it to a format-specific Message Translator. The JSON translator, the XML " +
    "translator, and the CSV translator each convert their format to a single canonical " +
    "representation — typically a Java POJO or a standard JSON schema. " +
    "The result is that downstream consumers only need to understand one format. Add a new " +
    "input format? Add a new translator and a routing rule. No changes to any downstream " +
    "consumer. " +
    "This pattern is the gateway to the Canonical Data Model, which we will discuss next."
  );
}

// Slide 64: Canonical Data Model
{
  const s = S(pres);
  addContentTitle(s, "CANONICAL DATA MODEL", "One Format to Rule Them All");
  addBullets(s, bsub([
    { text: "A shared, enterprise-wide data format", sub: "All applications translate to and from the canonical model at their boundaries." },
    { text: "Reduces N-squared translations to N", sub: "With 10 applications, you need 10 translators instead of 45 point-to-point converters." },
    { text: "The canonical model must be carefully designed", sub: "Too broad and it becomes bloated; too narrow and it cannot represent edge cases." },
    { text: "Schema registries enforce the canonical model", sub: "Avro, Protobuf, or JSON Schema in a registry — versioned, validated, discoverable." },
    { text: "Trade-off: governance overhead", sub: "Someone must own and evolve the canonical model — it does not maintain itself." },
  ]));
  addNotes(s,
    "The Canonical Data Model is the enterprise-level answer to format mismatches. Instead of " +
    "translating between every pair of applications — which requires N-squared translators — " +
    "you define one canonical format and have each application translate to and from it. " +
    "With ten applications, the point-to-point approach requires forty-five translators. The " +
    "canonical model approach requires ten — one per application. At twenty applications, " +
    "point-to-point needs 190 translators; canonical needs 20. The math is compelling. " +
    "But the canonical model has its own challenges. It must be broad enough to represent " +
    "data from all applications, which can lead to bloat. It must be versioned carefully — " +
    "breaking changes to the canonical model affect everyone. And it requires governance: " +
    "someone must own the model, review change requests, and manage evolution. " +
    "In practice, schema registries like Confluent Schema Registry or Apicurio handle " +
    "versioning and compatibility checking. You define the canonical model as Avro or " +
    "Protobuf schemas and enforce compatibility rules automatically."
  );
}

// ─────────────────────────────────────────────────────────────────────
//  SECTION 07 — MESSAGING ENDPOINTS (8 slides)
// ─────────────────────────────────────────────────────────────────────
divider(pres, "07", "Messaging\nEndpoints",
  "Eleven patterns for connecting applications to messaging",
  "Endpoints are where your business logic meets the messaging system. This section covers " +
  "how to design clean boundaries between application code and messaging infrastructure — " +
  "gateways, consumers, dispatchers, and the critical idempotent receiver pattern."
);

// Slide 66: Connecting applications
{
  const s = S(pres);
  addContentTitle(s, "THE ENDPOINT PROBLEM", "Connecting Applications to Messaging");
  addBullets(s, bsub([
    { text: "Business logic should not contain messaging boilerplate", sub: "Your order processing code should not manage Kafka consumers, offsets, or serialization." },
    { text: "Endpoints encapsulate the connection", sub: "They handle protocol, serialization, error recovery, and acknowledgment — your code sees POJOs." },
    { text: "Inbound endpoints: how to receive messages", sub: "Polling vs. event-driven, competing consumers, dispatching to handlers." },
    { text: "Outbound endpoints: how to send messages", sub: "Transactional sending, batching, partitioning, and compression." },
    { text: "Eleven patterns cover every endpoint scenario", sub: "From simple gateways to sophisticated idempotent receivers." },
  ]));
  addNotes(s,
    "The endpoint patterns are about keeping your business logic clean. When the Payment " +
    "Service processes a charge, its code should say 'charge this credit card and return " +
    "the result.' It should not say 'poll the Kafka consumer, deserialize the Avro payload, " +
    "charge the card, serialize the result as JSON, produce to the reply topic, and commit " +
    "the consumer offset.' " +
    "That messaging boilerplate belongs in the endpoint — a layer that abstracts the " +
    "connection between your code and the messaging system. " +
    "In Camel, endpoints are the from() and to() components. When you write " +
    "from('kafka:payment-commands'), Camel handles consumer creation, partition assignment, " +
    "deserialization, offset management, and error recovery. Your route code sees a clean " +
    "Exchange with a body and headers."
  );
}

// Slide 67: Messaging Gateway (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "MESSAGING GATEWAY", "Hide Messaging from the Application",
    "16-messaging-gateway",
    "Figure 7.1 — The Gateway presents a domain-specific interface; messaging details are hidden");
  addNotes(s,
    "The Messaging Gateway pattern wraps the messaging system behind a domain-specific " +
    "interface. Instead of your business code knowing about Kafka topics and message headers, " +
    "it calls a gateway method like 'orderGateway.submitOrder(order).' " +
    "The gateway implementation handles all the messaging details: serializing the order, " +
    "setting appropriate headers, producing to the right topic, and handling errors. The " +
    "business code is completely unaware that messaging is involved. " +
    "This has two major benefits. First, testability — you can mock the gateway in unit tests " +
    "without standing up a Kafka cluster. Second, flexibility — you can swap the messaging " +
    "system without changing business code. Move from Kafka to Pulsar? Change the gateway " +
    "implementation; every caller is untouched. " +
    "In Camel with Quarkus, producer templates and CDI injection create natural gateways. " +
    "The business service injects a ProducerTemplate, and the gateway is just a thin wrapper " +
    "around it."
  );
}

// Slide 68: Transactional Client
{
  const s = S(pres);
  addPatternCard(s, "TRANSACTIONAL CLIENT", "Coordinate with Transactions", "transactional-client",
    "A service updates its database and sends a message. If the DB commits but the message send fails, data is updated but nobody knows. How do we keep both in sync?",
    "Messaging operations participate in transactions — both succeed or both fail. Kafka 0.11+ supports exactly-once semantics. The Outbox pattern is a common alternative: write to an outbox table in the same DB transaction, poll and send later. Camel: transacted() DSL."
  );
  addNotes(s,
    "The Transactional Client pattern ensures that messaging operations are coordinated with " +
    "other resources — typically a database. The classic problem: your service processes an " +
    "order, updates the database, and sends a confirmation message. If the database update " +
    "succeeds but the message send fails, you have an inconsistency — the order is recorded " +
    "but nobody downstream knows about it. " +
    "The Transactional Client solves this by enlisting the message send in the same transaction " +
    "as the database update. Either both succeed or both are rolled back. " +
    "Kafka supports this natively with transactional producers since version 0.11. You can " +
    "atomically consume from one topic, process, update a database, and produce to another " +
    "topic — all within a single transaction. " +
    "An alternative is the Transactional Outbox pattern: instead of sending the message directly, " +
    "you write it to an outbox table in the same database transaction. A separate poller reads " +
    "the outbox and sends the messages. This avoids the need for distributed transactions."
  );
}

// Slide 69: Polling vs Event-Driven Consumer (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "CONSUMER PATTERNS", "Polling Consumer vs. Event-Driven Consumer",
    "14-consumer-patterns",
    "Figure 7.2 — Polling Consumers pull messages on a schedule; Event-Driven Consumers react immediately");
  addNotes(s,
    "There are two fundamental ways to consume messages: polling and event-driven. " +
    "A Polling Consumer checks the channel at regular intervals — every second, every minute, " +
    "or on a cron schedule. It pulls a batch of messages, processes them, and waits for the " +
    "next poll cycle. This is common for batch processing, scheduled jobs, and integration " +
    "with systems that do not support push notifications. " +
    "An Event-Driven Consumer registers a callback and is notified immediately when a new " +
    "message arrives. There is no polling interval — the consumer reacts as soon as the " +
    "message is available. This is the standard model for real-time processing. " +
    "Kafka consumers are a hybrid: they use a polling loop internally (consumer.poll()) but " +
    "the high-level API can be used in an event-driven style where a handler is called for " +
    "each message. Camel's Kafka component abstracts this — from('kafka:topic') sets up an " +
    "event-driven consumer that processes messages as they arrive."
  );
}

// Slide 70: Competing Consumers
{
  const s = S(pres);
  addContentTitle(s, "COMPETING CONSUMERS", "Parallel Processing at Scale");
  addBullets(s, bsub([
    { text: "Multiple consumers process messages from the same channel", sub: "The messaging system distributes messages among consumers — each message goes to exactly one." },
    { text: "Scale out by adding consumers", sub: "Processing cannot keep up? Add more instances. The channel balances the load automatically." },
    { text: "Kafka: consumers in the same consumer group", sub: "Partitions are divided among group members — each partition is processed by exactly one consumer." },
    { text: "Ordering trade-off", sub: "With multiple consumers, global ordering is lost. Kafka preserves order within partitions only." },
    { text: "Camel: deploy multiple instances with the same groupId", sub: "Kubernetes replicas with the same consumer group create competing consumers automatically." },
  ]));
  addNotes(s,
    "Competing Consumers is the horizontal scaling pattern for message processing. When a " +
    "single consumer cannot keep up with the message rate, you add more consumers to the " +
    "same consumer group. The messaging system distributes messages among them. " +
    "In Kafka, this works through partition assignment. If a topic has twelve partitions and " +
    "you have four consumer instances in the same group, each instance processes three " +
    "partitions. If you scale to twelve instances, each processes one partition. " +
    "The key trade-off is ordering. With multiple consumers, you lose global message ordering. " +
    "Kafka guarantees ordering only within a partition, not across partitions. If your " +
    "processing requires strict ordering for a given entity (like all events for order #12345), " +
    "you must ensure those events land in the same partition — typically by using the order ID " +
    "as the partition key. " +
    "In a Kubernetes deployment, competing consumers happen naturally: increase the replica " +
    "count, and Kafka rebalances partitions among the new instances."
  );
}

// Slide 71: Message Dispatcher
{
  const s = S(pres);
  addContentTitle(s, "MESSAGE DISPATCHER", "Distribute to Handlers");
  addBullets(s, bsub([
    { text: "A single endpoint receives messages and dispatches to specialized handlers", sub: "One consumer, multiple handler methods — each handling a specific message type." },
    { text: "Decouples consumption from processing", sub: "The dispatcher manages the channel connection; handlers focus on business logic." },
    { text: "Type-based dispatching", sub: "OrderMessage goes to handleOrder(), PaymentMessage goes to handlePayment()." },
    { text: "Camel: bean binding with @Handler annotations", sub: "Camel inspects method signatures and dispatches based on body type or header values." },
  ]));
  addNotes(s,
    "The Message Dispatcher pattern is about internal organization within a consumer. Instead " +
    "of one monolithic message handler that uses a switch statement to process different " +
    "message types, you have a dispatcher that routes messages to specialized handler methods. " +
    "The dispatcher reads a message, determines its type (from a header or the body class), " +
    "and invokes the appropriate handler. This is the messaging equivalent of the Strategy " +
    "pattern from object-oriented design. " +
    "In Camel, bean binding provides natural dispatching. When you route to a bean, Camel " +
    "inspects the bean's methods and chooses the one whose parameter type matches the message " +
    "body type. An OrderMessage is dispatched to a method that takes an OrderMessage parameter; " +
    "a PaymentMessage is dispatched to a method that takes a PaymentMessage parameter. " +
    "This keeps your handler classes small, focused, and independently testable."
  );
}

// Slide 72: Idempotent Receiver
{
  const s = S(pres);
  addContentTitle(s, "IDEMPOTENT RECEIVER", "Handle Duplicates Safely");
  addBullets(s, bsub([
    { text: "Detects and discards duplicate messages", sub: "At-least-once delivery means duplicates will happen — the receiver must handle them." },
    { text: "Uses a message ID store to track processed messages", sub: "Check the store before processing; if the ID exists, skip; otherwise process and store." },
    { text: "Store options: in-memory, database, Redis, Kafka itself", sub: "Choose based on durability requirements and consumer restart behavior." },
    { text: "Camel: idempotentConsumer(header('messageId'), store)", sub: "One line in the route definition — Camel handles the check-and-store logic." },
    { text: "Critical for financial operations", sub: "Double-charging a credit card or double-shipping an order has real business consequences." },
  ]));
  addNotes(s,
    "In any at-least-once delivery system — which includes Kafka, Pulsar, and most messaging " +
    "platforms — duplicate messages are not a bug, they are a feature. The system guarantees " +
    "that your message will be delivered at least once, which means it might be delivered " +
    "twice or more. " +
    "The Idempotent Receiver pattern handles duplicates by maintaining a store of processed " +
    "message IDs. When a message arrives, the receiver checks the store. If the message ID " +
    "is already there, the message is a duplicate and is discarded. If not, the message is " +
    "processed and the ID is added to the store. " +
    "In Camel, this is a single line: .idempotentConsumer(header(\"messageId\"), " +
    "MemoryIdempotentRepository.memoryIdempotentRepository(1000)). You can swap the in-memory " +
    "store for a Redis store or a JDBC store for durability across restarts. " +
    "This pattern is non-negotiable for financial operations. Double-charging a credit card " +
    "or double-shipping an order creates real business problems. Idempotent receivers are " +
    "your safety net."
  );
}

// Slide 73: Service Activator (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "SERVICE ACTIVATOR", "Invoke a Service from a Message",
    "15-outbox-pattern",
    "Figure 7.3 — The Service Activator connects messaging to service invocation via the Outbox pattern");
  addNotes(s,
    "The Service Activator pattern bridges the gap between messaging and service invocation. " +
    "It consumes a message from a channel, extracts the relevant data, invokes a service " +
    "method, and optionally sends the result as a reply message. " +
    "Think of it as the inverse of the Messaging Gateway. Where the gateway hides messaging " +
    "behind a service interface, the Service Activator exposes a service through messaging. " +
    "Your existing PaymentService with its chargeCard() method can be invoked via messaging " +
    "without any changes to the service itself. " +
    "The Service Activator handles the deserialization, method invocation, error handling, " +
    "and reply construction. If the service throws an exception, the activator can route the " +
    "message to a Dead Letter Channel. " +
    "This diagram also shows the Outbox pattern — a transactional approach where the service " +
    "writes to an outbox table within the database transaction, and a separate process polls " +
    "the outbox and publishes messages to the messaging system."
  );
}

// ─────────────────────────────────────────────────────────────────────
//  SECTION 08 — SYSTEM MANAGEMENT (6 slides)
// ─────────────────────────────────────────────────────────────────────
divider(pres, "08", "System\nManagement",
  "Monitoring, testing, and controlling the messaging system",
  "The last pattern category addresses operations. How do you monitor a messaging system? How " +
  "do you test it without disrupting production? How do you control routing and processing " +
  "dynamically? These ten patterns provide the answers."
);

// Slide 75: Monitoring and managing
{
  const s = S(pres);
  addIconGrid(s, "OBSERVABILITY", "Monitoring and Managing Messaging Systems", [
    { icon: "wire-tap", label: "Wire Tap", desc: "Copy messages for monitoring without disrupting the main flow." },
    { icon: "message-history", label: "Message History", desc: "Record the path a message takes through the system for tracing." },
    { icon: "control-bus", label: "Control Bus", desc: "Programmatic access to manage, start/stop, and configure routes." },
    { label: "Modern Tooling", desc: "OpenTelemetry + Camel + Kafka = end-to-end distributed tracing and metrics." },
  ], { cols: 2, cellH: 2.40 });
  addNotes(s,
    "One of the challenges of messaging systems is observability. In a synchronous REST " +
    "architecture, you can put a reverse proxy in front of your services and see every request " +
    "and response. In a messaging architecture, messages flow through channels that are not " +
    "directly observable from outside. " +
    "Where is the message right now? Who processed it? How long did it take? Why is it stuck? " +
    "Without dedicated management patterns, answering these questions requires digging through " +
    "logs across multiple services — tedious at best, impossible at worst. " +
    "The system management patterns provide structured solutions. Wire Tap copies messages " +
    "for monitoring without disrupting the flow. Message History records the path a message " +
    "takes through the system. Control Bus provides programmatic access to manage the system. " +
    "Combined with modern observability tools — OpenTelemetry for distributed tracing, " +
    "Prometheus for metrics, structured logging — these patterns make messaging systems " +
    "as observable as any REST API."
  );
}

// Slide 76: Control Bus (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "CONTROL BUS", "Manage the System Programmatically",
    "17-control-bus",
    "Figure 8.1 — The Control Bus uses the same messaging infrastructure for management commands");
  addNotes(s,
    "The Control Bus pattern uses the messaging system itself to manage the messaging system. " +
    "Instead of SSH-ing into servers to start, stop, or reconfigure components, you send " +
    "management commands through a dedicated control channel. " +
    "Start a route, stop a route, change a configuration, query statistics — all through " +
    "messages. This means you can automate operations using the same tools and patterns " +
    "you use for business messages. " +
    "In Camel, the ControlBus component provides programmatic access to route management. " +
    "You can start and stop routes, query route status, and even modify route definitions " +
    "at runtime — all through the same messaging infrastructure. " +
    "This is powerful for self-healing systems. A monitoring component detects that a consumer " +
    "is lagging, sends a control message to scale up the consumer group, and sends another " +
    "control message to alert the operations team — all through messaging."
  );
}

// Slide 77: Wire Tap (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "WIRE TAP", "Non-Intrusive Monitoring",
    "11-wire-tap",
    "Figure 8.2 — The Wire Tap copies messages to a monitoring channel without affecting the main flow");
  addNotes(s,
    "The Wire Tap pattern copies messages to a secondary channel for monitoring, logging, or " +
    "auditing — without affecting the primary message flow. The original message continues " +
    "through the pipeline unmodified and undelayed. " +
    "Think of it as a network packet sniffer for messaging. You tap into the flow at any " +
    "point, copy the messages to a monitoring system, and the production flow is unaware. " +
    "Common uses include sending copies of all order messages to an analytics topic, logging " +
    "all payment transactions to an audit trail, or forwarding samples to a testing environment. " +
    "In Camel, the wireTap() EIP is a single method call: .wireTap(\"kafka:audit-trail\"). " +
    "By default, the tap sends a copy of the full message. You can also apply a transformation " +
    "to the tapped copy — for example, stripping sensitive data before sending to the " +
    "monitoring channel. " +
    "The key property of Wire Tap is that it must not affect the performance or reliability " +
    "of the main flow. In Camel, the wire tap runs on a separate thread to avoid blocking."
  );
}

// Slide 78: Message History
{
  const s = S(pres);
  addContentTitle(s, "MESSAGE HISTORY", "Track a Message's Path");
  addBullets(s, bsub([
    { text: "Records every step a message passes through", sub: "Like a passport with stamps — each processing step adds its name and timestamp." },
    { text: "Stored as a list in the message headers", sub: "Each processor appends to the history: 'validated at 10:01, enriched at 10:02, routed at 10:03.'" },
    { text: "Invaluable for debugging", sub: "When a message arrives corrupted, the history shows exactly which step introduced the problem." },
    { text: "Foundation for distributed tracing", sub: "OpenTelemetry traces are the modern implementation of Message History." },
    { text: "Camel: messageHistory() is enabled by default", sub: "Every Exchange records its route history — inspect it in logs or through JMX." },
  ]));
  addNotes(s,
    "Message History is the messaging equivalent of distributed tracing. As a message flows " +
    "through the system — validated by one component, enriched by another, routed by a third — " +
    "each step appends its identity and a timestamp to a history list in the message headers. " +
    "When something goes wrong, you can inspect the history to see exactly where the message " +
    "has been. If a message arrives at the Payment Service with corrupted data, you can trace " +
    "it back: it was fine when it entered the enrichment step, so the problem was introduced " +
    "by the enricher. " +
    "In Camel, message history is enabled by default. Every Exchange records the route ID, " +
    "processor ID, and timestamp of every step it passes through. You can view this history " +
    "in logs, through JMX, or through the Camel management API. " +
    "Modern distributed tracing with OpenTelemetry extends this concept across service " +
    "boundaries. Camel integrates with OpenTelemetry to create traces that span multiple " +
    "routes, multiple services, and multiple messaging systems."
  );
}

// Slide 79: Message Store
{
  const s = S(pres);
  addContentTitle(s, "MESSAGE STORE", "Persist Messages for Auditing");
  addBullets(s, bsub([
    { text: "Stores messages persistently for later retrieval", sub: "Audit trails, compliance records, replay capability — all require persistent storage." },
    { text: "Often combined with Wire Tap", sub: "Tap messages from the flow and write them to a database or object store." },
    { text: "Enables message replay", sub: "If a consumer fails, replay the stored messages instead of re-triggering the source." },
    { text: "Kafka's commit log is a built-in Message Store", sub: "With long retention (days, weeks, infinite), Kafka itself serves as the message store." },
    { text: "Regulatory compliance often mandates message storage", sub: "Financial services must retain transaction messages for 7+ years." },
  ]));
  addNotes(s,
    "The Message Store pattern persists messages for later retrieval. While the messaging " +
    "system holds messages temporarily for delivery, a Message Store keeps them permanently " +
    "for auditing, compliance, replay, and debugging. " +
    "In regulated industries, message storage is mandatory. Financial services firms must " +
    "retain records of all transactions for seven or more years. Healthcare organizations " +
    "must retain patient data exchanges for compliance with HIPAA. " +
    "Kafka has a unique advantage here: its commit log is already a persistent message store. " +
    "With retention set to weeks, months, or even infinite, Kafka can serve as both the " +
    "messaging system and the message store. Combined with tiered storage, you can keep " +
    "years of messages at low cost. " +
    "For systems that need more sophisticated querying of stored messages, combining Wire Tap " +
    "with a database or data lake provides full SQL access to historical messages."
  );
}

// Slide 80: Test Message & Detour (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "TESTING PATTERNS", "Test Message, Detour, and Channel Purger",
    "18-testing-patterns",
    "Figure 8.3 — Test Messages verify the system is alive; Detours reroute traffic for testing");
  addNotes(s,
    "The last management patterns are about testing and verification. " +
    "A Test Message is a synthetic message injected into the system to verify it is working. " +
    "Like a network ping, it travels through the pipeline and confirms that channels are " +
    "connected, consumers are running, and processing steps are functional. If the test " +
    "message does not arrive at the expected destination within the expected time, something " +
    "is wrong. " +
    "A Detour is a conditional bypass that routes messages through an alternative path for " +
    "testing or debugging. You can enable a detour to send production messages through a " +
    "validation step, then disable it when testing is complete. " +
    "A Channel Purger removes all messages from a channel — useful in testing environments " +
    "to start with a clean slate, but dangerous in production. " +
    "Together, these patterns let you verify system health, test changes safely, and " +
    "maintain clean testing environments."
  );
}

// ─────────────────────────────────────────────────────────────────────
//  SECTION 09 — THE RUNNING EXAMPLE & CASE STUDIES (12 slides)
// ─────────────────────────────────────────────────────────────────────
divider(pres, "09", "Case Studies &\nRunning Examples",
  "Patterns working together in real systems",
  "Now let us see how patterns compose in real systems. We will walk through a shipping domain " +
  "with five microservices, examine the technology stack, and dive into two full case studies: " +
  "the Loan Broker and the Bond Trading system."
);

// Slide 82: Shipping domain (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "THE SHIPPING DOMAIN", "Five Microservices, Dozens of Patterns",
    "01-order-flow",
    "Figure 9.1 — Order, Inventory, Payment, Shipping, and Notification connected through messaging");
  addNotes(s,
    "Throughout this tutorial, we use a shipping domain as our running example. Five microservices " +
    "collaborate to fulfill customer orders. " +
    "The Order Service receives orders via REST, validates them, and publishes order events. " +
    "The Inventory Service reserves stock and updates availability. The Payment Service charges " +
    "the customer's payment method. The Shipping Service generates labels and coordinates " +
    "delivery. And the Notification Service sends confirmations, updates, and alerts. " +
    "These five services communicate through messaging — Kafka topics, event channels, command " +
    "queues — and use dozens of integration patterns. Content-Based Routing directs orders " +
    "based on type. Splitters break multi-item orders into individual fulfillment tasks. " +
    "Aggregators collect results from parallel processing. Dead Letter Channels handle failures. " +
    "Wire Taps provide monitoring. " +
    "This is not a toy example — it represents the core of any e-commerce platform."
  );
}

// Slide 83: Order flow
{
  const s = S(pres);
  addFlowSlide(s, "THE ORDER FLOW", "Order → Inventory → Payment → Shipping → Notification", [
    { label: "Order\nPlaced", desc: "Event Message on order-events topic (Pub-Sub)" },
    { label: "Inventory\nReserved", desc: "Command Message to Payment Service (P2P)" },
    { label: "Payment\nCharged", desc: "Event on payment-events triggers shipping" },
    { label: "Shipping\nArranged", desc: "ShipmentCreated event with tracking number" },
    { label: "Notification\nSent", desc: "Customer receives confirmation email" },
  ]);
  addNotes(s,
    "Let us trace a single order through the system. A customer places an order via the REST " +
    "API. The Order Service validates it and publishes an OrderPlaced event to the order-events " +
    "topic. This is an Event Message on a Publish-Subscribe Channel. " +
    "The Inventory Service consumes the event, checks stock, and reserves the items. If stock " +
    "is available, it sends a ChargePayment command to the Payment Service. This is a Command " +
    "Message on a Point-to-Point Channel — only one consumer should process the charge. " +
    "The Payment Service charges the credit card and publishes a PaymentCompleted event. The " +
    "Shipping Service consumes this event, generates a shipping label, and publishes a " +
    "ShipmentCreated event with the tracking number. " +
    "Finally, the Notification Service consumes the ShipmentCreated event and sends the " +
    "customer a confirmation email with tracking details. " +
    "This simple flow uses Event Messages, Command Messages, Pub-Sub Channels, P2P Channels, " +
    "and a process that looks like a saga — all in five steps."
  );
}

// Slide 84: Patterns in the system
{
  const s = S(pres);
  addIconGrid(s, "PATTERNS IN CONTEXT", "How Patterns Compose in a Real System", [
    { icon: "content-based-router", label: "Content-Based Router", desc: "Route by order type: standard, priority, international — different pipelines." },
    { icon: "splitter", label: "Splitter + Aggregator", desc: "Break multi-item orders, process each, recombine results." },
    { icon: "dead-letter-channel", label: "Dead Letter Channel", desc: "Capture failed messages for investigation and retry." },
    { icon: "wire-tap", label: "Wire Tap", desc: "Copy all events to analytics without affecting processing." },
    { icon: "idempotent-receiver", label: "Idempotent Receiver", desc: "Prevent duplicate payment charges on retry." },
  ], { cols: 3, cellH: 2.20 });
  addNotes(s,
    "When you look at a real system through the lens of integration patterns, you start to see " +
    "patterns everywhere. The shipping domain uses at least fifteen distinct patterns. " +
    "The Content-Based Router sits at the entry point, examining each order and routing it to " +
    "the appropriate processing pipeline. Standard orders go through normal fulfillment. " +
    "Priority orders skip to the front of the queue. International orders go through customs " +
    "validation. " +
    "The Splitter breaks multi-item orders into individual items that can be routed to different " +
    "warehouses. The Aggregator collects the fulfillment results and combines them into a " +
    "single order status update. " +
    "The Dead Letter Channel catches messages that cannot be processed — payment declines, " +
    "out-of-stock items, serialization errors. Operations monitors the dead letter topics " +
    "and handles failures. " +
    "And the Idempotent Receiver on the Payment Service ensures that a retried ChargePayment " +
    "command does not result in a double charge."
  );
}

// Slide 85: Technology stack (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "TECHNOLOGY STACK", "Camel + Quarkus + Kafka + Pulsar + Redis + PostgreSQL",
    "01-stack-architecture",
    "Figure 9.2 — The technology stack powering the running example");
  addNotes(s,
    "Our running example uses a modern cloud-native stack. Apache Camel provides the " +
    "integration framework — every pattern maps to a Camel EIP in the Java DSL. Quarkus " +
    "is the runtime — it provides fast startup, low memory footprint, and CDI for dependency " +
    "injection. " +
    "Kafka serves as the primary messaging backbone — topics for event channels, consumer " +
    "groups for competing consumers, and the commit log for message persistence. We use " +
    "KRaft mode (no ZooKeeper) for simpler operations. " +
    "Pulsar demonstrates multi-tenant messaging scenarios — namespace isolation, tiered " +
    "storage, and Pulsar Functions for lightweight stream processing. " +
    "Redis provides caching for enrichment data, idempotency stores for duplicate detection, " +
    "and lightweight streaming for moderate-throughput scenarios. " +
    "PostgreSQL stores application state — orders, payments, inventory — and the outbox table " +
    "for the Transactional Outbox pattern. " +
    "Everything runs on Podman containers, orchestrated by a simple compose file."
  );
}

// Slide 86: Kafka architecture (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "KAFKA AS THE BACKBONE", "Topics, Partitions, Consumer Groups",
    "20-kafka-architecture",
    "Figure 9.3 — Kafka architecture: brokers, topics, partitions, and consumer groups");
  addNotes(s,
    "Kafka is the messaging backbone of our running example, and it maps beautifully to the " +
    "EIP vocabulary. " +
    "A Kafka topic is a Message Channel — the named conduit through which messages flow. " +
    "A Kafka partition is the unit of parallelism — messages within a partition are strictly " +
    "ordered, and each partition is consumed by exactly one consumer in a group. " +
    "A Kafka consumer group implements the Competing Consumers pattern — add more consumers " +
    "to the group, and Kafka redistributes partitions among them. " +
    "Multiple consumer groups on the same topic implement the Publish-Subscribe pattern — " +
    "each group gets every message independently. " +
    "Kafka's commit log with configurable retention implements the Message Store pattern — " +
    "messages are retained for days, weeks, or indefinitely. " +
    "And Kafka's replication across brokers implements Guaranteed Delivery — a message " +
    "survives the loss of any single broker."
  );
}

// Slide 87: Pulsar architecture (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "PULSAR FOR MULTI-TENANCY", "Topics, Subscriptions, Tiered Storage",
    "21-pulsar-architecture",
    "Figure 9.4 — Pulsar architecture: tenants, namespaces, topics, and subscription types");
  addNotes(s,
    "Apache Pulsar offers a different approach to messaging that shines in multi-tenant " +
    "scenarios. Where Kafka organizes everything into a flat topic namespace, Pulsar uses " +
    "a hierarchical model: tenant / namespace / topic. " +
    "This hierarchy enables strong isolation between tenants. Each tenant can have its own " +
    "authentication, authorization, storage quota, and retention policy. In a SaaS platform, " +
    "each customer can be a Pulsar tenant with complete isolation from other customers. " +
    "Pulsar's subscription types map directly to EIP patterns. An Exclusive subscription is " +
    "a Point-to-Point Channel. A Shared subscription creates Competing Consumers. A Failover " +
    "subscription provides active-passive consumer redundancy. " +
    "Tiered storage is Pulsar's answer to long-term message retention. Recent data lives on " +
    "fast local storage; older data is automatically offloaded to cheap object storage like S3. " +
    "This gives you the Message Store pattern at a fraction of the cost of keeping everything " +
    "on broker disks."
  );
}

// Slide 88: Loan Broker (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "CASE STUDY: LOAN BROKER", "13 Patterns Working Together",
    "28-loan-broker",
    "Figure 9.5 — The Loan Broker architecture: Gateway, Enricher, Recipient List, Aggregator");
  addNotes(s,
    "The Loan Broker is one of the most famous case studies in the EIP book, and it demonstrates " +
    "how patterns compose into a complete system. " +
    "A customer requests a loan. The Loan Broker receives the request through a Messaging " +
    "Gateway, enriches it with the customer's credit score using a Content Enricher, determines " +
    "which banks to contact using a Recipient List, sends the request to each bank, and " +
    "aggregates the quotes using an Aggregator. The best quote is returned to the customer. " +
    "This system uses thirteen distinct patterns: Messaging Gateway, Message Channel, " +
    "Content Enricher, Content-Based Router, Recipient List, Scatter-Gather, Aggregator, " +
    "Request-Reply, Correlation Identifier, Return Address, Message Translator, " +
    "Guaranteed Delivery, and Dead Letter Channel. " +
    "What is remarkable is that each pattern is small and focused, but together they create " +
    "a sophisticated loan comparison system."
  );
}

// Slide 89: Loan Broker architecture detail
{
  const s = S(pres);
  addFlowSlide(s, "LOAN BROKER ARCHITECTURE", "Gateway → Enricher → Recipient List → Aggregator", [
    { label: "Messaging\nGateway", desc: "Receives loan request — hides messaging from the web app" },
    { label: "Content\nEnricher", desc: "Calls credit bureau API, adds credit score" },
    { label: "Recipient\nList", desc: "Calculates eligible banks by amount and score" },
    { label: "Scatter-\nGather", desc: "Broadcasts to banks, collects quotes" },
    { label: "Aggregator", desc: "Waits for all responses, selects best rate" },
  ]);
  addNotes(s,
    "Let us walk through the Loan Broker step by step. " +
    "Step one: the web application calls the Messaging Gateway with a loan request — " +
    "customer SSN, loan amount, and loan term. The gateway is a clean API; the caller does " +
    "not know that messaging is involved behind the scenes. " +
    "Step two: the Content Enricher takes the SSN, calls the credit bureau API, and adds " +
    "the credit score and credit history to the message. Now the message has everything the " +
    "banks need to generate a quote. " +
    "Step three: the Recipient List examines the enriched message — loan amount, credit score — " +
    "and determines which banks are eligible. A customer with a 750 credit score gets sent to " +
    "premium banks; a customer with a 620 goes to subprime lenders. " +
    "Step four: the Scatter-Gather broadcasts the request to all eligible banks and waits for " +
    "quotes. Each bank calculates an interest rate and term. " +
    "Step five: the Aggregator collects all quotes, selects the best one (lowest rate), and " +
    "returns it to the customer through the gateway."
  );
}

// Slide 90: 13 EIP patterns together
{
  const s = S(pres);
  addContentTitle(s, "13 PATTERNS IN ONE SYSTEM", "The Loan Broker Pattern Inventory");
  addStatusTable(s, [
    { code: "1", name: "Messaging Gateway",       purpose: "Hides messaging from the web application", codeColor: COLOR.svc },
    { code: "2", name: "Message Channel",          purpose: "Connects each component to the next", codeColor: COLOR.svc },
    { code: "3", name: "Content Enricher",         purpose: "Adds credit score from external bureau", codeColor: COLOR.data },
    { code: "4", name: "Content-Based Router",     purpose: "Routes by credit tier to eligible banks", codeColor: COLOR.data },
    { code: "5", name: "Recipient List",           purpose: "Sends request to multiple banks", codeColor: COLOR.data },
    { code: "6", name: "Scatter-Gather",           purpose: "Broadcasts request, collects quotes", codeColor: COLOR.red },
    { code: "7", name: "Aggregator",               purpose: "Combines quotes, selects best offer", codeColor: COLOR.red },
    { code: "8", name: "Request-Reply",            purpose: "Bank interaction is request-response", codeColor: COLOR.platform },
    { code: "9", name: "Correlation Identifier",   purpose: "Matches bank quotes to the original request", codeColor: COLOR.platform },
    { code: "10", name: "Return Address",          purpose: "Banks know where to send their quotes", codeColor: COLOR.platform },
    { code: "11", name: "Message Translator",      purpose: "Normalizes bank quote formats", codeColor: COLOR.govern },
    { code: "12", name: "Guaranteed Delivery",     purpose: "Loan requests are not lost", codeColor: COLOR.govern },
    { code: "13", name: "Dead Letter Channel",     purpose: "Banks that fail to respond are tracked", codeColor: COLOR.govern },
  ], { colW: [0.55, 2.60, 8.94], rowH: 0.36 });
  addNotes(s,
    "Here is the complete pattern inventory for the Loan Broker. Thirteen patterns, each with " +
    "a clear role, working together to create a system that is more than the sum of its parts. " +
    "Notice how the patterns form layers. The infrastructure patterns — Message Channel, " +
    "Guaranteed Delivery, Dead Letter Channel — provide the reliable transport layer. The " +
    "conversation patterns — Request-Reply, Correlation Identifier, Return Address — enable " +
    "two-way communication with the banks. The processing patterns — Content Enricher, " +
    "Content-Based Router, Recipient List, Scatter-Gather, Aggregator — implement the " +
    "business logic. And the boundary patterns — Messaging Gateway, Message Translator — " +
    "connect the system to the outside world. " +
    "This layered composition is what makes the pattern language powerful. You can reason about " +
    "each layer independently and understand how they fit together."
  );
}

// Slide 91: Bond Trading (diagram)
{
  const s = S(pres);
  addDiagramSlide(s, "CASE STUDY: BOND TRADING", "16 Patterns for Market Data Distribution",
    "29-bond-trading",
    "Figure 9.6 — Bond Trading architecture: Channel Adapters, Normalizer, Desk Distribution");
  addNotes(s,
    "Our second case study is a Bond Trading system from the financial services domain. This " +
    "system receives market data from multiple external feeds — Bloomberg, Reuters, Tradeweb — " +
    "normalizes the data into a canonical format, and distributes it to trading desks. " +
    "The challenge is that each market data feed uses a different protocol and data format. " +
    "Bloomberg sends FIX messages, Reuters sends proprietary binary, and Tradeweb sends JSON " +
    "over REST. The trading desks, meanwhile, need a consistent format regardless of source. " +
    "This system uses sixteen distinct patterns — three more than the Loan Broker. The " +
    "additional patterns include Channel Adapters for each market data feed, a Normalizer " +
    "to convert multiple formats to a canonical model, a Publish-Subscribe Channel for desk " +
    "distribution, and Content Filters to customize data for each desk's needs."
  );
}

// Slide 92: Bond Trading architecture
{
  const s = S(pres);
  addFlowSlide(s, "BOND TRADING ARCHITECTURE", "Channel Adapters → Normalizer → Desk Distribution", [
    { label: "Channel\nAdapters", desc: "Connect to Bloomberg, Reuters, Tradeweb — each protocol" },
    { label: "Normalizer", desc: "Convert FIX, binary, JSON to canonical BondPrice" },
    { label: "Content-Based\nRouter", desc: "Route by bond type to the right desk" },
    { label: "Pub-Sub\nChannel", desc: "Fan-out to all desks simultaneously" },
    { label: "Wire Tap +\nCompliance", desc: "Copy all prices to audit trail" },
  ]);
  addNotes(s,
    "The Bond Trading system demonstrates patterns working together at scale. Let us walk " +
    "through the flow. " +
    "Three Channel Adapters connect to the external market data feeds. The Bloomberg adapter " +
    "speaks FIX protocol, the Reuters adapter handles proprietary binary, and the Tradeweb " +
    "adapter consumes JSON over WebSocket. Each adapter produces messages to a common channel. " +
    "The Normalizer sits behind the adapters and converts all three formats to a canonical " +
    "BondPrice record. Downstream consumers never need to know which feed a price came from. " +
    "The Content-Based Router examines the bond type and routes government bonds to the " +
    "government desk, corporate bonds to the credit desk, and municipal bonds to the muni desk. " +
    "Each desk receives a stream of prices customized by a Content Filter that removes " +
    "irrelevant fields. " +
    "A Wire Tap copies every price update to the compliance system for regulatory audit. " +
    "This is a real-world architecture used by financial institutions worldwide."
  );
}

// Slide 93: 16 patterns for market data
{
  const s = S(pres);
  addIconGrid(s, "16 PATTERNS FOR MARKET DATA", "The Bond Trading Pattern Inventory", [
    { icon: "channel-adapter", label: "Channel Adapter (3x)", desc: "Bloomberg, Reuters, Tradeweb — each protocol" },
    { icon: "normalizer", label: "Normalizer", desc: "Three formats → one canonical BondPrice model" },
    { icon: "content-based-router", label: "Router + Filter", desc: "Route by bond type; filter per desk view" },
    { icon: "publish-subscribe-channel", label: "Pub-Sub", desc: "Fan-out to all trading desks simultaneously" },
    { icon: "wire-tap", label: "Wire Tap + Store", desc: "Compliance audit trail for all price updates" },
    { icon: "control-bus", label: "Control Bus", desc: "Manage feeds, desks, and filtering rules live" },
  ], { cols: 3, cellH: 2.10 });
  addNotes(s,
    "The Bond Trading system uses sixteen patterns, demonstrating how even complex real-world " +
    "systems decompose into familiar building blocks. " +
    "What makes this case study instructive is the pattern layering. At the boundary, Channel " +
    "Adapters handle the messy protocol details of each external feed. In the middle, the " +
    "Normalizer and Content-Based Router transform and direct the data. At the edges, Content " +
    "Filters and Pub-Sub Channels deliver customized views to each trading desk. And across " +
    "the entire system, Wire Taps, Message Stores, and the Control Bus provide observability " +
    "and management. " +
    "The lesson is that you do not need to invent new solutions for each integration challenge. " +
    "The 65 patterns provide a toolkit that covers virtually every scenario. The art is in " +
    "choosing the right patterns and composing them effectively."
  );
}

// ─────────────────────────────────────────────────────────────────────
//  SECTION 10 — CLOSING (4 slides)
// ─────────────────────────────────────────────────────────────────────
divider(pres, "10", "Closing",
  "The pattern catalog, key takeaways, and where to go next",
  "Let us bring it all together. We have covered all eight categories and all 65 patterns. Now " +
  "let us review the complete catalog, distill the key takeaways, and point you to resources " +
  "for continuing your integration patterns journey."
);

// Slide 95: 65-pattern catalog reference (status table)
{
  const s = S(pres);
  addContentTitle(s, "THE COMPLETE CATALOG", "65 Patterns Across 8 Categories");
  addStatusTable(s, [
    { code: "4",  name: "Integration Styles",    purpose: "File Transfer, Shared DB, RPC, Messaging", codeColor: COLOR.red },
    { code: "6",  name: "Messaging Systems",     purpose: "Channel, Message, Pipe & Filter, Router, Translator, Endpoint", codeColor: COLOR.red },
    { code: "8",  name: "Messaging Channels",    purpose: "P2P, Pub-Sub, Datatype, Dead Letter, Guaranteed Delivery, Bridge, Adapter, Invalid Msg", codeColor: COLOR.red },
    { code: "6",  name: "Message Construction",  purpose: "Command, Document, Event, Request-Reply, Return Address, Correlation ID", codeColor: COLOR.red },
    { code: "13", name: "Message Routing",        purpose: "CBR, Filter, Dynamic Router, Recipient List, Splitter, Aggregator, Scatter-Gather, more", codeColor: COLOR.red },
    { code: "7",  name: "Message Transformation", purpose: "Translator, Envelope Wrapper, Enricher, Filter, Claim Check, Normalizer, Canonical Model", codeColor: COLOR.red },
    { code: "11", name: "Messaging Endpoints",    purpose: "Gateway, Transactional Client, Polling/Event-Driven Consumer, Competing, Idempotent, more", codeColor: COLOR.red },
    { code: "10", name: "System Management",      purpose: "Control Bus, Wire Tap, Detour, Message History, Message Store, Test Message, more", codeColor: COLOR.red },
  ], { colW: [0.55, 2.60, 8.94], rowH: 0.50 });
  addCaption(s, "65 patterns — one vocabulary — universal applicability");
  addNotes(s,
    "Here is the complete 65-pattern catalog at a glance. Four Integration Styles. Six " +
    "Messaging System fundamentals. Eight Messaging Channel patterns. Six Message Construction " +
    "patterns. Thirteen Message Routing patterns. Seven Message Transformation patterns. " +
    "Eleven Messaging Endpoint patterns. And ten System Management patterns. " +
    "What is remarkable about this catalog is its completeness. In more than twenty years since " +
    "publication, no new fundamental messaging pattern has been identified that does not fit " +
    "into one of these categories. The implementations have changed dramatically — from JMS " +
    "and TIBCO to Kafka and Pulsar — but the patterns remain the same. " +
    "That is the power of a good pattern language: it captures the essential structure of " +
    "solutions at a level of abstraction that transcends any particular technology."
  );
}

// Slide 96: Key takeaways
{
  const s = S(pres);
  addContentTitle(s, "KEY TAKEAWAYS", "What to Remember");
  addBullets(s, bsub([
    { text: "Patterns are timeless, implementations evolve", sub: "The 65 patterns from 2003 are just as relevant with Kafka and Pulsar as they were with JMS." },
    { text: "The pattern vocabulary accelerates design", sub: "Naming patterns lets your team communicate precisely and avoid reinventing solutions." },
    { text: "Patterns compose — that is their superpower", sub: "A Scatter-Gather is a Recipient List + Aggregator. Complex systems are just pattern compositions." },
    { text: "Every pattern has trade-offs", sub: "There are no silver bullets. Each pattern solves one problem and introduces others." },
    { text: "Apache Camel maps 1:1 to the pattern language", sub: "Every pattern has a direct Camel EIP implementation — from concept to code in one step." },
    { text: "Start simple, add patterns as complexity demands", sub: "You do not need all 65 patterns on day one. Let the problem guide your pattern selection." },
  ]));
  addNotes(s,
    "Let me leave you with six key takeaways. " +
    "First, patterns are timeless. The technology landscape has transformed since 2003 — " +
    "from monoliths to microservices, from JMS to Kafka, from on-premises to cloud — but " +
    "the patterns have not changed. That tells you something about the quality of the " +
    "abstraction. " +
    "Second, the pattern vocabulary is itself valuable. When your architect says 'we need a " +
    "Scatter-Gather here,' every developer on the team immediately understands the design. " +
    "Third, composition is the superpower. You do not need to invent new patterns for complex " +
    "problems. You compose existing patterns — and the result is understandable because the " +
    "building blocks are familiar. " +
    "Fourth, every pattern has trade-offs. A Content-Based Router adds latency. An Aggregator " +
    "adds state. A Wire Tap adds load. Choose patterns with eyes open. " +
    "Fifth, Apache Camel is the most complete implementation of the pattern language. Every " +
    "pattern has a direct DSL counterpart. " +
    "And sixth, start simple. Add patterns as your system's complexity demands them — not before."
  );
}

// Slide 97: Resources
{
  const s = S(pres);
  addContentTitle(s, "RESOURCES", "Continue Your Integration Patterns Journey");
  addBullets(s, bsub([
    { text: "\"Enterprise Integration Patterns\" — Hohpe & Woolf", sub: "The definitive reference. Available in print and as a free online pattern catalog at enterpriseintegrationpatterns.com." },
    { text: "The tutorial site — all 65 patterns with runnable examples", sub: "Chapter-by-chapter walkthroughs with Apache Camel on Quarkus, complete with diagrams." },
    { text: "GitHub repository — runnable Camel Quarkus projects", sub: "Clone, build, and run every example locally with Podman containers for infrastructure." },
    { text: "Apache Camel documentation — camel.apache.org", sub: "Comprehensive documentation for every component, EIP, and data format." },
    { text: "Camel in Action (2nd Edition) — Ibsen & Anstey", sub: "The practitioner's guide to building integration solutions with Apache Camel." },
  ]));
  addNotes(s,
    "Here are the resources to continue your integration patterns journey. " +
    "The Hohpe and Woolf book is the definitive reference. If you buy one integration book, " +
    "make it this one. The patterns are also available online at enterpriseintegrationpatterns.com " +
    "with the iconic pattern icons. " +
    "Our tutorial site walks through all 65 patterns with detailed explanations, architecture " +
    "diagrams, and runnable code examples. Each chapter covers a pattern category and builds " +
    "on the shipping domain running example. " +
    "The GitHub repository contains all the runnable examples. Clone it, run the Podman " +
    "compose stack to start Kafka, Pulsar, Redis, and PostgreSQL, and then run any example " +
    "with 'mvn quarkus:dev'. You can see every pattern in action. " +
    "The Apache Camel documentation is excellent and comprehensive. And 'Camel in Action' by " +
    "Claus Ibsen and Jonathan Anstey is the best practical guide to building with Camel."
  );
}

// Slide 98: Thank You
{
  const s = pres.addSlide();
  PAGE += 1;
  s.background = { color: COLOR.ink };
  try {
    s.addImage({ path: `${ASSETS}/section-panel.png`, x: 0, y: 0, w: W, h: H });
  } catch (e) { /* ok */ }

  s.addText("Thank You", {
    x: 6.20, y: 1.80, w: 6.60, h: 1.40,
    fontFace: FONT.title, fontSize: 48, bold: true, color: COLOR.white,
    align: "left", valign: "top",
  });
  s.addText("Enterprise Integration Patterns — A Visual Guide", {
    x: 6.20, y: 3.30, w: 6.60, h: 0.60,
    fontFace: FONT.body, fontSize: 17, color: "FFD9D9",
    align: "left", valign: "top",
  });

  // Links
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

  addNotes(s,
    "Thank you for joining this walkthrough of the 65 Enterprise Integration Patterns. " +
    "I hope the pattern vocabulary we built today helps you design, discuss, and implement " +
    "integration solutions with confidence. " +
    "The tutorial site has detailed chapter-by-chapter coverage of every pattern, and the " +
    "GitHub repository has runnable examples you can clone and experiment with today. " +
    "If you remember one thing from this session, let it be this: integration patterns are " +
    "the shared vocabulary that lets your team talk about complex systems simply. Learn the " +
    "patterns, use the vocabulary, and your integration designs will be clearer, more " +
    "maintainable, and more robust. " +
    "I welcome your questions. Thank you."
  );
}

// =====================================================================
//  WRITE THE FILE
// =====================================================================
console.log(`EIP 101 deck — ${PAGE} slides`);
pres.writeFile({ fileName: "../eip-101.pptx" })
  .then(() => console.log("✓  ../eip-101.pptx written"))
  .catch((err) => { console.error(err); process.exit(1); });
