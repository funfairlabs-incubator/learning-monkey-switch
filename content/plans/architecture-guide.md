# Architecture & System Design

> Last reviewed: March 2026 · Maintained by Claude

A practical guide to thinking about and designing software systems — from individual services to large distributed architectures. Useful whether you're a developer making design decisions, or a non-technical reader who wants to understand how software systems are structured.

---

## What is software architecture?

Architecture is the set of significant decisions that shape a software system — how it's divided into parts, how those parts communicate, where data lives, and how the system handles failure. Good architecture makes a system easier to change, scale, and understand. Poor architecture makes every change expensive and every incident chaotic.

The key insight: **architecture isn't about diagrams, it's about tradeoffs**. Every choice (monolith vs microservices, SQL vs NoSQL, synchronous vs async) trades one thing for another. Understanding those tradeoffs is the job.

---

## Part 1 — Foundational concepts

### The monolith vs microservices question

Most systems start as a **monolith** — a single deployable unit where all the code lives together. This is often the right call early on: it's simpler to develop, test, and deploy.

**Microservices** split the system into independently deployable services, each responsible for one domain. The benefits are real — independent scaling, independent deployments, team autonomy — but so are the costs: distributed systems are harder to debug, network calls fail, data consistency becomes your problem.

The pragmatic view: start with a monolith. Split things out when a specific piece genuinely needs to scale independently, or when team size makes a shared codebase painful.

### Synchronous vs asynchronous communication

**Synchronous**: Service A calls Service B and waits for a response. Simple, easy to reason about. Problem: if B is slow or down, A is stuck.

**Asynchronous**: Service A puts a message on a queue. Service B picks it up when it's ready. Decoupled, resilient. Problem: harder to reason about, eventual consistency becomes a concern.

In practice most systems use both — synchronous for user-facing requests where you need an immediate response, async (queues, pub/sub) for background work, notifications, and event-driven processing.

### The database question

**Relational (SQL)**: Structured data, relationships between entities, ACID transactions. Postgres is usually the right default. Predictable, battle-tested, powerful.

**Document (NoSQL)**: Flexible schema, good for hierarchical data. MongoDB, Firestore. Can be fast for reads, but joins are your problem.

**Key-value stores**: Redis. Blazingly fast. Good for caching, sessions, rate limiting — not for primary data storage.

The common mistake: reaching for a fancy datastore before you've outgrown Postgres. Postgres can handle more than most teams will ever need.

---

## Part 2 — Patterns worth knowing

### The 12-Factor App

A set of principles for building cloud-native applications — config in environment variables, stateless processes, logs as streams, explicit dependencies. Understanding these explains why modern cloud infrastructure works the way it does.

[Read the original: 12factor.net](https://12factor.net)

### Event-driven architecture

Instead of services calling each other directly, they emit events ("order placed", "payment received") that other services consume. Decouples producers from consumers, makes it easy to add new consumers without changing existing code.

Tradeoff: eventual consistency. The system will get there, but not instantly. For user-facing flows that need immediate confirmation (did my payment go through?) you still need a synchronous confirmation step.

### CQRS — Command Query Responsibility Segregation

Split the write path (commands that change state) from the read path (queries that return data). The read side can be optimised for queries independently of the write side. Useful for complex domains; overkill for simple CRUD.

### The strangler fig pattern

How to migrate a legacy monolith to a new architecture without a big-bang rewrite. New functionality is built outside the old system; old functionality is gradually moved across. The old system is "strangled" over time. Named after a tree that grows around a host and eventually replaces it.

---

## Part 3 — Distributed systems realities

### The things that always fail

- The network is not reliable
- Latency is not zero
- Bandwidth is not infinite
- The network is not secure
- Topology changes
- There is more than one administrator
- Transport cost is not zero
- The network is not homogeneous

(These are the "fallacies of distributed computing" — worth knowing by name.)

### Idempotency

If an operation might be retried (network failure, timeout), it should be safe to run it twice without bad effects. Design operations to be idempotent — "process payment for order 123" should check if it's already been processed before charging the card.

### Circuit breakers

If Service B is failing, stop hammering it. A circuit breaker detects repeated failures and "opens" — subsequent calls fail fast without actually hitting B. After a timeout it lets a test call through. If that succeeds, it closes again. Prevents cascading failures.

---

## Further reading

- [Designing Data-Intensive Applications](https://dataintensive.net) — Martin Kleppmann's book. The definitive resource on how real systems handle data at scale. Dense but worth it.
- [Architecture Patterns with Python](https://www.cosmicpython.com) — free online. Practical patterns: repository, unit of work, event-driven architecture.
- [The Architecture of Open Source Applications](https://aosabook.org) — free. Real engineers describe how real systems were designed and why.
- [ByteByteGo Newsletter](https://blog.bytebytego.com) — accessible system design explanations, good diagrams.
