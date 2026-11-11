---
title: "Bibliography"
layout: plan
permalink: /bibliography/
description: "The book and primary documentation this site's coverage and rigor draw on: nothing here is reproduced from them."
---

This site implements the 65 patterns of Hohpe and Woolf's *Enterprise Integration
Patterns* on Apache Camel, so that book is the canonical reference throughout; each
chapter cites the matching EIP chapter. The Camel and runtime documentation below
is the authority for the components and DSLs the examples use. These are reference
works, not sources: no text or code from any of them is reproduced here.

## Books

<table class="bib bib--books">
  <colgroup><col style="width:62%"><col style="width:24%"><col style="width:14%"></colgroup>
  <thead><tr><th>Title</th><th>Author(s)</th><th>Year</th></tr></thead>
  <tbody>
    <tr><td><a href="https://www.enterpriseintegrationpatterns.com/" rel="noopener"><em>Enterprise Integration Patterns: Designing, Building, and Deploying Messaging Solutions</em></a><br><small>Addison-Wesley. The 65 messaging patterns, their intent, and the pattern language this site implements</small></td><td>Gregor Hohpe, Bobby Woolf</td><td>2003</td></tr>
  </tbody>
</table>

## Primary documentation

<table class="bib">
  <colgroup><col style="width:38%"><col style="width:62%"></colgroup>
  <thead><tr><th>Source</th><th>Used for</th></tr></thead>
  <tbody>
    <tr><td><a href="https://camel.apache.org/docs/" rel="noopener">Apache Camel</a></td><td>The EIP DSL, components, and the routing/transformation engine</td></tr>
    <tr><td><a href="https://camel.apache.org/camel-quarkus/" rel="noopener">Camel Quarkus</a></td><td>The Quarkus (Java DSL) runtime</td></tr>
    <tr><td><a href="https://camel.apache.org/camel-spring-boot/" rel="noopener">Camel on Spring Boot</a></td><td>The Spring Boot (Java DSL) runtime</td></tr>
    <tr><td><a href="https://camel.apache.org/components/latest/others/yaml-dsl.html" rel="noopener">Camel YAML DSL</a></td><td>The YAML DSL runtime and <code>camel</code> CLI</td></tr>
    <tr><td><a href="https://www.enterpriseintegrationpatterns.com/" rel="noopener">Enterprise Integration Patterns site</a></td><td>Hohpe and Woolf's per-pattern reference pages</td></tr>
    <tr><td><a href="https://kafka.apache.org/documentation/" rel="noopener">Apache Kafka</a></td><td>The primary message broker (KRaft)</td></tr>
    <tr><td><a href="https://pulsar.apache.org/docs/" rel="noopener">Apache Pulsar</a></td><td>The alternate broker in the Pulsar appendix</td></tr>
    <tr><td><a href="https://quarkus.io/guides/" rel="noopener">Quarkus</a></td><td>The Quarkus runtime, Dev Services, and native build</td></tr>
  </tbody>
</table>

These titles inform this site's coverage and rigor only. Nothing in these chapters
or the runnable examples copies text or code from them.
