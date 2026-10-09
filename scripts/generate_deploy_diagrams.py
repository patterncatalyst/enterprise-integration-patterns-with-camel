#!/usr/bin/env python3
"""Diagrams for the deployment appendices: T (minikube) and Z (OpenShift Local).

    python3 scripts/generate_deploy_diagrams.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import generate_diagram as g

g.OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "diagrams")


# ── 38: Appendix T — minikube (docker driver, containerd) ───────────────────
g.emit("38-kubernetes-deploy", 880, 340,
    bands=[
        {'x': 20, 'y': 10, 'w': 840, 'h': 320, 'label': 'minikube profile eip (docker driver, containerd)'},
    ],
    nodes=[
        {'x': 40, 'y': 140, 'w': 130, 'h': 50, 'style': 'muted', 'lines': ['curl', '127.0.0.1:30088']},
        {'x': 220, 'y': 55, 'w': 170, 'h': 55, 'style': 'accent', 'lines': ['eip-k8s-deploy', 'Camel Application']},
        {'x': 230, 'y': 125, 'w': 150, 'h': 35, 'style': 'sub', 'lines': ['OrderApiRoute', 'REST endpoint']},
        {'x': 230, 'y': 175, 'w': 150, 'h': 35, 'style': 'sub', 'lines': ['OrderProcessorRoute', 'Kafka → Redis → Kafka']},
        {'x': 230, 'y': 225, 'w': 150, 'h': 35, 'style': 'sub', 'lines': ['CacheLoaderRoute', 'timer: pre-populate']},
        {'x': 230, 'y': 275, 'w': 150, 'h': 30, 'style': 'muted', 'lines': ['Health probes', '/q/health  /actuator']},
        {'x': 470, 'y': 65, 'w': 160, 'h': 50, 'style': 'info', 'lines': ['Strimzi 1.2 Kafka', 'KRaft, one node pool']},
        {'x': 470, 'y': 260, 'w': 130, 'h': 45, 'style': 'info', 'lines': ['Redis', 'customer cache']},
        {'x': 700, 'y': 80, 'w': 140, 'h': 40, 'style': 'muted', 'lines': ['kubectl scale', '--replicas=3']},
        {'x': 700, 'y': 145, 'w': 130, 'h': 35, 'style': 'muted', 'lines': ['Consumer group', 'rebalancing']},
        {'x': 700, 'y': 220, 'w': 130, 'h': 35, 'style': 'sub', 'lines': ['ConfigMap', 'externalized config']},
        {'x': 700, 'y': 270, 'w': 140, 'h': 35, 'style': 'muted', 'lines': ['docker build', 'minikube image load']},
    ],
    edges=[
        {'x1': 170, 'y1': 165, 'x2': 230, 'y2': 142, 'amber': True, 'label': 'NodePort'},
        {'x1': 380, 'y1': 142, 'x2': 480, 'y2': 152, 'label': 'consume', 'ly': 19},
        {'x1': 480, 'y1': 152, 'x2': 380, 'y2': 192},
        {'x1': 380, 'y1': 192, 'x2': 470, 'y2': 275, 'amber': True, 'label': 'enrich'},
        {'x1': 380, 'y1': 200, 'x2': 480, 'y2': 212, 'label': 'produce'},
        {'x1': 380, 'y1': 242, 'x2': 470, 'y2': 280},
        {'x1': 700, 'y1': 120, 'x2': 630, 'y2': 135},
        {'x1': 700, 'y1': 162, 'x2': 630, 'y2': 165, 'dashed': True},
    ],
    notes=[
        {'x': 545, 'y': 150, 'text': 'eip.orders', 'anchor': 'middle', 'bold': True, 'size': 13},
        {'x': 545, 'y': 167, 'text': '.incoming', 'anchor': 'middle', 'size': 11},
        {'x': 545, 'y': 210, 'text': 'eip.orders', 'anchor': 'middle', 'bold': True, 'size': 13},
        {'x': 545, 'y': 227, 'text': '.enriched', 'anchor': 'middle', 'size': 11},
        {'x': 40, 'y': 215, 'text': 'published at creation:', 'size': 9},
        {'x': 40, 'y': 228, 'text': '--ports=127.0.0.1:30088:30088', 'size': 9},
    ],
)


# ── 44: Appendix Z — OpenShift Local (CRC) ──────────────────────────────────
g.emit("44-openshift-local", 900, 380,
    bands=[
        {'x': 10, 'y': 10, 'w': 200, 'h': 360, 'label': 'Host (Fedora / RHEL)'},
        {'x': 225, 'y': 10, 'w': 665, 'h': 360, 'label': 'OpenShift Local — project eip (restricted-v2)'},
    ],
    nodes=[
        {'x': 30, 'y': 50, 'w': 160, 'h': 50, 'style': 'muted', 'lines': ['mvn package -Popenshift', 'fast-jar upload']},
        {'x': 30, 'y': 160, 'w': 160, 'h': 50, 'style': 'muted', 'lines': ['curl --cacert', 'https://…apps-crc.testing']},
        {'x': 30, 'y': 280, 'w': 160, 'h': 50, 'style': 'muted', 'lines': ['helm upgrade --install', 'openshift/helm/eip']},
        {'x': 250, 'y': 50, 'w': 170, 'h': 50, 'style': 'sub', 'lines': ['Binary S2I build', 'ubi10/openjdk-25']},
        {'x': 470, 'y': 50, 'w': 170, 'h': 50, 'style': 'sub', 'lines': ['ImageStream', 'eip-k8s-deploy:v1']},
        {'x': 250, 'y': 160, 'w': 150, 'h': 50, 'style': 'info', 'lines': ['Route (edge TLS)', 'HTTP → HTTPS']},
        {'x': 450, 'y': 150, 'w': 190, 'h': 70, 'style': 'accent', 'lines': ['eip-k8s-deploy', 'REST → Kafka → enrich', '→ Kafka']},
        {'x': 700, 'y': 50, 'w': 170, 'h': 55, 'style': 'info', 'lines': ['AMQ Streams Kafka', 'KRaft, 1 node (operator)']},
        {'x': 700, 'y': 160, 'w': 170, 'h': 50, 'style': 'info', 'lines': ['Redis', 'customer cache']},
        {'x': 450, 'y': 280, 'w': 190, 'h': 50, 'style': 'ghost', 'lines': ['opt-in: Custom Metrics', 'Autoscaler (Kafka lag)']},
        {'x': 700, 'y': 280, 'w': 170, 'h': 50, 'style': 'ghost', 'lines': ['opt-in: OpenTelemetry', 'agent → otel-lgtm']},
    ],
    edges=[
        {'x1': 190, 'y1': 75, 'x2': 250, 'y2': 75, 'amber': True},
        {'x1': 420, 'y1': 75, 'x2': 470, 'y2': 75},
        {'x1': 555, 'y1': 100, 'x2': 545, 'y2': 150, 'label': 'image'},
        {'x1': 190, 'y1': 185, 'x2': 250, 'y2': 185, 'amber': True},
        {'x1': 400, 'y1': 185, 'x2': 450, 'y2': 185, 'amber': True},
        {'x1': 640, 'y1': 170, 'x2': 700, 'y2': 85, 'label': 'produce / consume'},
        {'x1': 640, 'y1': 190, 'x2': 700, 'y2': 185, 'label': 'enrich'},
        {'x1': 190, 'y1': 305, 'x2': 450, 'y2': 205, 'dashed': True},
        {'x1': 545, 'y1': 280, 'x2': 545, 'y2': 220, 'dashed': True, 'label': 'scale'},
        {'x1': 700, 'y1': 290, 'x2': 640, 'y2': 210, 'dashed': True},
    ],
    notes=[
        {'x': 30, 'y': 360, 'text': 'no host container engine; teardown.sh ends with crc stop', 'size': 9},
    ],
)
