#!/usr/bin/env python3
"""Generate clean SVG icons for all 65 Enterprise Integration Patterns.

Colors:
  Fill:   #FFF8F0  (light amber)
  Stroke: #151515  (ink)
  Accent: #EE0000  (red)

ViewBox: 0 0 120 120, stroke-width 2, transparent background.
"""

import os, textwrap

FILL   = "#FFF8F0"
STROKE = "#151515"
ACCENT = "#EE0000"
SW     = 2

SVG_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "eip-stencils", "svg")

def wrap(name: str, body: str) -> str:
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"\n'
        f'     width="120" height="120" fill="none" stroke="{STROKE}" stroke-width="{SW}"\n'
        f'     stroke-linecap="round" stroke-linejoin="round">\n'
        f'  <!-- {name} -->\n'
        f'{body}'
        f'</svg>\n'
    )

def slug(name: str) -> str:
    return name.lower().replace(" ", "-").replace("–", "-").replace("/", "-")

# ---------- helpers for common sub-shapes ----------

def pipe(x1, y1, x2, y2, h=18):
    """Horizontal pipe/cylinder from (x1,y1) to (x2,y2)."""
    # left ellipse, top/bottom lines, right ellipse
    ry = h // 2
    rx = 6
    return (
        f'  <ellipse cx="{x1}" cy="{y1 + ry}" rx="{rx}" ry="{ry}" fill="{FILL}" stroke="{STROKE}"/>\n'
        f'  <line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{STROKE}"/>\n'
        f'  <line x1="{x1}" y1="{y1 + h}" x2="{x2}" y2="{y2 + h}" stroke="{STROKE}"/>\n'
        f'  <ellipse cx="{x2}" cy="{y2 + ry}" rx="{rx}" ry="{ry}" fill="{FILL}" stroke="{STROKE}"/>\n'
    )

def channel(y=51):
    """Standard message channel pipe centered at y."""
    return pipe(20, y, 100, y)

def small_arrow(x1, y1, x2, y2, sz=5):
    """Arrowhead at (x2,y2)."""
    # Simple chevron arrow
    dx = x2 - x1
    dy = y2 - y1
    length = (dx*dx + dy*dy) ** 0.5
    if length == 0:
        return ""
    ux, uy = dx/length, dy/length
    px, py = -uy, ux  # perpendicular
    ax = x2 - ux*sz + px*sz*0.5
    ay = y2 - uy*sz + py*sz*0.5
    bx = x2 - ux*sz - px*sz*0.5
    by = y2 - uy*sz - py*sz*0.5
    return (
        f'  <line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{STROKE}"/>\n'
        f'  <polyline points="{ax:.1f},{ay:.1f} {x2},{y2} {bx:.1f},{by:.1f}" stroke="{STROKE}" fill="none"/>\n'
    )

def envelope(cx, cy, w=24, h=16):
    """Small envelope icon."""
    x = cx - w//2
    y = cy - h//2
    return (
        f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{FILL}" stroke="{STROKE}" rx="1"/>\n'
        f'  <polyline points="{x},{y} {cx},{cy + 2} {x+w},{y}" fill="none" stroke="{STROKE}"/>\n'
    )

def diamond(cx, cy, rx=22, ry=22):
    """Diamond/rhombus shape."""
    return (
        f'  <polygon points="{cx},{cy-ry} {cx+rx},{cy} {cx},{cy+ry} {cx-rx},{cy}" '
        f'fill="{FILL}" stroke="{STROKE}"/>\n'
    )

def box(cx, cy, w=40, h=30):
    """Rounded rectangle."""
    return (
        f'  <rect x="{cx-w//2}" y="{cy-h//2}" width="{w}" height="{h}" '
        f'fill="{FILL}" stroke="{STROKE}" rx="3"/>\n'
    )

def hexagon(cx, cy, r=22):
    """Regular hexagon."""
    import math
    pts = []
    for i in range(6):
        a = math.radians(60 * i - 30)
        pts.append(f"{cx + r*math.cos(a):.1f},{cy + r*math.sin(a):.1f}")
    return f'  <polygon points="{" ".join(pts)}" fill="{FILL}" stroke="{STROKE}"/>\n'

def gear(cx, cy, r=14, teeth=6):
    """Simple gear icon."""
    import math
    pts = []
    for i in range(teeth * 2):
        a = math.radians(360 / (teeth*2) * i - 90)
        ri = r if i % 2 == 0 else r * 0.7
        pts.append(f"{cx + ri*math.cos(a):.1f},{cy + ri*math.sin(a):.1f}")
    return (
        f'  <polygon points="{" ".join(pts)}" fill="{FILL}" stroke="{STROKE}"/>\n'
        f'  <circle cx="{cx}" cy="{cy}" r="{r*0.25:.1f}" fill="{STROKE}"/>\n'
    )


# ============================================================
# Icon definitions — each returns SVG body content
# ============================================================

icons = {}

def icon(name):
    def decorator(fn):
        icons[name] = fn
        return fn
    return decorator

# --- Messaging Systems ---

@icon("Message Channel")
def _():
    return channel(51)

@icon("Message")
def _():
    return envelope(60, 60, 36, 24)

@icon("Pipes and Filters")
def _():
    s = ""
    # Three vertical bars (pipes)
    for x in [25, 60, 95]:
        s += f'  <line x1="{x}" y1="35" x2="{x}" y2="85" stroke="{STROKE}"/>\n'
    # Two circles (filters) between pipes
    for x in [42, 77]:
        s += f'  <circle cx="{x}" cy="60" r="10" fill="{FILL}" stroke="{STROKE}"/>\n'
    # Connecting lines
    s += f'  <line x1="25" y1="60" x2="32" y2="60" stroke="{STROKE}"/>\n'
    s += f'  <line x1="52" y1="60" x2="67" y2="60" stroke="{STROKE}"/>\n'
    s += f'  <line x1="87" y1="60" x2="95" y2="60" stroke="{STROKE}"/>\n'
    return s

@icon("Message Router")
def _():
    s = diamond(60, 55)
    # Input arrow
    s += small_arrow(10, 55, 38, 55)
    # Output arrows
    s += small_arrow(82, 55, 110, 35)
    s += small_arrow(82, 55, 110, 55)
    s += small_arrow(82, 55, 110, 75)
    return s

@icon("Message Translator")
def _():
    return hexagon(60, 60, 28)

@icon("Message Endpoint")
def _():
    s = ""
    s += f'  <rect x="40" y="40" width="30" height="30" fill="{FILL}" stroke="{STROKE}" rx="2"/>\n'
    s += small_arrow(70, 55, 100, 55)
    s += f'  <line x1="20" y1="55" x2="40" y2="55" stroke="{STROKE}"/>\n'
    return s

# --- Messaging Channels ---

@icon("Point-to-Point Channel")
def _():
    s = pipe(20, 45, 100, 45)
    # Single arrowhead at right
    s += f'  <polyline points="90,48 100,54 90,60" fill="none" stroke="{ACCENT}"/>\n'
    return s

@icon("Publish-Subscribe Channel")
def _():
    s = pipe(15, 45, 70, 45)
    # Multiple output arrows
    s += small_arrow(76, 48, 105, 30)
    s += small_arrow(76, 54, 105, 54)
    s += small_arrow(76, 60, 105, 78)
    return s

@icon("Datatype Channel")
def _():
    s = pipe(20, 45, 100, 45)
    # "T" label inside
    s += f'  <text x="60" y="59" text-anchor="middle" font-size="12" font-family="monospace" fill="{ACCENT}" stroke="none" font-weight="bold">T</text>\n'
    return s

@icon("Invalid Message Channel")
def _():
    s = pipe(20, 45, 100, 45)
    # Exclamation mark
    s += f'  <text x="60" y="59" text-anchor="middle" font-size="14" font-family="sans-serif" fill="{ACCENT}" stroke="none" font-weight="bold">!</text>\n'
    return s

@icon("Dead Letter Channel")
def _():
    s = pipe(20, 45, 100, 45)
    # X mark inside
    s += f'  <line x1="52" y1="48" x2="68" y2="62" stroke="{ACCENT}" stroke-width="2.5"/>\n'
    s += f'  <line x1="68" y1="48" x2="52" y2="62" stroke="{ACCENT}" stroke-width="2.5"/>\n'
    return s

@icon("Guaranteed Delivery")
def _():
    s = pipe(20, 45, 100, 45)
    # Checkmark inside
    s += f'  <polyline points="50,55 57,62 70,47" fill="none" stroke="{ACCENT}" stroke-width="2.5"/>\n'
    return s

@icon("Channel Adapter")
def _():
    s = pipe(15, 48, 60, 48)
    # Adapter block
    s += f'  <rect x="66" y="40" width="35" height="30" fill="{FILL}" stroke="{STROKE}" rx="3"/>\n'
    # Zigzag connector
    s += f'  <polyline points="74,48 78,42 82,54 86,42 90,54 94,48" fill="none" stroke="{ACCENT}"/>\n'
    return s

@icon("Messaging Bridge")
def _():
    s = pipe(10, 48, 45, 48)
    s += pipe(75, 48, 110, 48)
    # Bridge connector
    s += f'  <line x1="51" y1="57" x2="69" y2="57" stroke="{ACCENT}" stroke-width="2"/>\n'
    s += f'  <line x1="51" y1="53" x2="51" y2="61" stroke="{ACCENT}"/>\n'
    s += f'  <line x1="69" y1="53" x2="69" y2="61" stroke="{ACCENT}"/>\n'
    return s

@icon("Message Bus")
def _():
    # Horizontal bus bar
    s = f'  <rect x="15" y="50" width="90" height="10" fill="{FILL}" stroke="{STROKE}" rx="5"/>\n'
    # Vertical connections
    for x in [30, 50, 70, 90]:
        s += f'  <line x1="{x}" y1="38" x2="{x}" y2="50" stroke="{STROKE}"/>\n'
        s += f'  <rect x="{x-6}" y="25" width="12" height="13" fill="{FILL}" stroke="{STROKE}" rx="1"/>\n'
    return s

# --- Message Construction ---

@icon("Command Message")
def _():
    s = envelope(60, 52, 40, 28)
    # Exclamation mark for command
    s += f'  <text x="60" y="58" text-anchor="middle" font-size="16" font-family="sans-serif" fill="{ACCENT}" stroke="none" font-weight="bold">!</text>\n'
    return s

@icon("Document Message")
def _():
    s = envelope(60, 52, 40, 28)
    # Document lines
    s += f'  <line x1="48" y1="52" x2="72" y2="52" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <line x1="48" y1="57" x2="68" y2="57" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    return s

@icon("Event Message")
def _():
    s = envelope(60, 52, 40, 28)
    # Lightning bolt for event
    s += f'  <polyline points="58,42 55,52 62,52 59,62" fill="none" stroke="{ACCENT}" stroke-width="2"/>\n'
    return s

@icon("Request-Reply")
def _():
    # Two envelopes with arrows
    s = envelope(35, 45, 28, 18)
    s += envelope(85, 65, 28, 18)
    s += small_arrow(52, 42, 68, 58)
    # Return arrow
    s += f'  <line x1="68" y1="72" x2="52" y2="58" stroke="{STROKE}"/>\n'
    s += f'  <polyline points="56,63 52,58 58,57" fill="none" stroke="{STROKE}"/>\n'
    return s

@icon("Return Address")
def _():
    s = envelope(60, 55, 40, 28)
    # Return arrow in corner
    s += f'  <polyline points="50,48 42,48 42,55 50,55" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <polyline points="47,52 50,55 47,58" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    return s

@icon("Correlation Identifier")
def _():
    s = envelope(35, 50, 30, 20)
    s = envelope(85, 50, 30, 20)
    # Correlation link
    s += f'  <line x1="50" y1="50" x2="70" y2="50" stroke="{ACCENT}" stroke-dasharray="4,2"/>\n'
    # ID labels
    s += f'  <text x="35" y="54" text-anchor="middle" font-size="9" font-family="monospace" fill="{ACCENT}" stroke="none">ID</text>\n'
    s += f'  <text x="85" y="54" text-anchor="middle" font-size="9" font-family="monospace" fill="{ACCENT}" stroke="none">ID</text>\n'
    return s

@icon("Message Sequence")
def _():
    # Stacked envelopes with numbers
    s = envelope(50, 45, 30, 20)
    s += envelope(60, 55, 30, 20)
    s += envelope(70, 65, 30, 20)
    s += f'  <text x="50" y="49" text-anchor="middle" font-size="8" font-family="monospace" fill="{ACCENT}" stroke="none">1</text>\n'
    s += f'  <text x="60" y="59" text-anchor="middle" font-size="8" font-family="monospace" fill="{ACCENT}" stroke="none">2</text>\n'
    s += f'  <text x="70" y="69" text-anchor="middle" font-size="8" font-family="monospace" fill="{ACCENT}" stroke="none">3</text>\n'
    return s

@icon("Message Expiration")
def _():
    s = envelope(60, 52, 40, 28)
    # Clock icon
    s += f'  <circle cx="78" cy="40" r="10" fill="{FILL}" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <line x1="78" y1="40" x2="78" y2="34" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <line x1="78" y1="40" x2="83" y2="40" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    return s

@icon("Format Indicator")
def _():
    s = envelope(60, 55, 40, 28)
    # Format tag
    s += f'  <text x="60" y="60" text-anchor="middle" font-size="10" font-family="monospace" fill="{ACCENT}" stroke="none">&lt;/&gt;</text>\n'
    return s

# --- Message Routing ---

@icon("Content-Based Router")
def _():
    s = diamond(60, 55, 25, 25)
    # Input
    s += small_arrow(8, 55, 35, 55)
    # Multiple outputs with labels
    s += small_arrow(85, 55, 112, 35)
    s += small_arrow(85, 55, 112, 55)
    s += small_arrow(85, 55, 112, 75)
    # Small "?" inside
    s += f'  <text x="60" y="60" text-anchor="middle" font-size="14" font-family="sans-serif" fill="{ACCENT}" stroke="none">?</text>\n'
    return s

@icon("Message Filter")
def _():
    # Funnel shape
    s = f'  <polygon points="30,35 90,35 70,65 50,65" fill="{FILL}" stroke="{STROKE}"/>\n'
    s += f'  <rect x="50" y="65" width="20" height="18" fill="{FILL}" stroke="{STROKE}"/>\n'
    # Arrow out bottom
    s += small_arrow(60, 83, 60, 98)
    # Arrow in top
    s += f'  <line x1="60" y1="22" x2="60" y2="35" stroke="{STROKE}"/>\n'
    s += f'  <polyline points="56,30 60,35 64,30" fill="none" stroke="{STROKE}"/>\n'
    return s

@icon("Dynamic Router")
def _():
    s = diamond(60, 50, 22, 22)
    # Gear inside
    s += f'  <circle cx="60" cy="50" r="8" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <circle cx="60" cy="50" r="3" fill="{ACCENT}" stroke="none"/>\n'
    # Input/output arrows
    s += small_arrow(10, 50, 38, 50)
    s += small_arrow(82, 50, 110, 50)
    # Control channel from below
    s += f'  <line x1="60" y1="72" x2="60" y2="100" stroke="{ACCENT}" stroke-dasharray="4,2"/>\n'
    return s

@icon("Recipient List")
def _():
    s = diamond(45, 55, 20, 20)
    # Multiple output arrows with boxes
    s += small_arrow(65, 45, 95, 30)
    s += small_arrow(65, 55, 95, 55)
    s += small_arrow(65, 65, 95, 80)
    # List icon inside diamond
    s += f'  <line x1="38" y1="50" x2="52" y2="50" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <line x1="38" y1="55" x2="52" y2="55" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <line x1="38" y1="60" x2="52" y2="60" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    # Input
    s += small_arrow(5, 55, 25, 55)
    return s

@icon("Splitter")
def _():
    # One-to-many fork
    s = f'  <circle cx="35" cy="60" r="12" fill="{FILL}" stroke="{STROKE}"/>\n'
    # Input arrow
    s += small_arrow(5, 60, 23, 60)
    # Multiple output arrows
    s += small_arrow(47, 52, 100, 30)
    s += small_arrow(47, 60, 100, 60)
    s += small_arrow(47, 68, 100, 90)
    # Split lines inside circle
    s += f'  <line x1="32" y1="52" x2="32" y2="68" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <line x1="38" y1="52" x2="38" y2="68" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    return s

@icon("Aggregator")
def _():
    # Many-to-one merge
    s = f'  <circle cx="75" cy="60" r="12" fill="{FILL}" stroke="{STROKE}"/>\n'
    # Multiple input arrows
    s += small_arrow(10, 30, 63, 52)
    s += small_arrow(10, 60, 63, 60)
    s += small_arrow(10, 90, 63, 68)
    # Output arrow
    s += small_arrow(87, 60, 112, 60)
    # Merge symbol inside
    s += f'  <text x="75" y="65" text-anchor="middle" font-size="14" font-family="sans-serif" fill="{ACCENT}" stroke="none">&#x03A3;</text>\n'
    return s

@icon("Resequencer")
def _():
    s = box(60, 55, 50, 35)
    # Numbers being reordered
    s += f'  <text x="45" y="50" font-size="9" font-family="monospace" fill="{ACCENT}" stroke="none">3,1,2</text>\n'
    s += f'  <text x="45" y="63" font-size="9" font-family="monospace" fill="{ACCENT}" stroke="none">1,2,3</text>\n'
    s += f'  <line x1="42" y1="53" x2="78" y2="53" stroke="{ACCENT}" stroke-width="0.75"/>\n'
    # Input/output
    s += small_arrow(5, 55, 35, 55)
    s += small_arrow(85, 55, 115, 55)
    return s

@icon("Composed Message Processor")
def _():
    # Splitter + Router + Aggregator combined
    s = f'  <circle cx="25" cy="60" r="10" fill="{FILL}" stroke="{STROKE}"/>\n'  # splitter
    s += diamond(60, 60, 14, 14)  # router
    s += f'  <circle cx="95" cy="60" r="10" fill="{FILL}" stroke="{STROKE}"/>\n'  # aggregator
    # Connections
    s += f'  <line x1="35" y1="53" x2="46" y2="53" stroke="{STROKE}"/>\n'
    s += f'  <line x1="35" y1="60" x2="46" y2="60" stroke="{STROKE}"/>\n'
    s += f'  <line x1="35" y1="67" x2="46" y2="67" stroke="{STROKE}"/>\n'
    s += f'  <line x1="74" y1="53" x2="85" y2="53" stroke="{STROKE}"/>\n'
    s += f'  <line x1="74" y1="60" x2="85" y2="60" stroke="{STROKE}"/>\n'
    s += f'  <line x1="74" y1="67" x2="85" y2="67" stroke="{STROKE}"/>\n'
    return s

@icon("Scatter-Gather")
def _():
    # Diamond with fan-out and merge
    s = diamond(35, 60, 16, 16)
    s += diamond(85, 60, 16, 16)
    # Fan out from first
    s += f'  <line x1="51" y1="52" x2="69" y2="44" stroke="{STROKE}"/>\n'
    s += f'  <line x1="51" y1="60" x2="69" y2="60" stroke="{STROKE}"/>\n'
    s += f'  <line x1="51" y1="68" x2="69" y2="76" stroke="{STROKE}"/>\n'
    # Input/output
    s += small_arrow(3, 60, 19, 60)
    s += small_arrow(101, 60, 117, 60)
    return s

@icon("Routing Slip")
def _():
    # Document with list
    s = f'  <path d="M 40,30 L 80,30 L 80,90 L 40,90 Z" fill="{FILL}" stroke="{STROKE}"/>\n'
    # Dog-ear
    s += f'  <path d="M 70,30 L 80,40" fill="none" stroke="{STROKE}"/>\n'
    s += f'  <path d="M 70,30 L 70,40 L 80,40" fill="{FILL}" stroke="{STROKE}"/>\n'
    # List items with checkmarks
    for i, y in enumerate([50, 60, 70, 80]):
        if i < 2:
            s += f'  <polyline points="{46},{y-2} {49},{y+1} {54},{y-4}" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
        else:
            s += f'  <circle cx="50" cy="{y-1}" r="2" fill="none" stroke="{STROKE}" stroke-width="1"/>\n'
        s += f'  <line x1="58" y1="{y}" x2="74" y2="{y}" stroke="{STROKE}" stroke-width="1"/>\n'
    return s

@icon("Process Manager")
def _():
    s = box(60, 55, 60, 40)
    # Internal flow
    s += f'  <circle cx="42" cy="55" r="5" fill="{ACCENT}" stroke="none"/>\n'
    s += f'  <line x1="47" y1="55" x2="55" y2="55" stroke="{STROKE}"/>\n'
    s += f'  <rect x="55" y="49" width="12" height="12" fill="{FILL}" stroke="{STROKE}" rx="1"/>\n'
    s += f'  <line x1="67" y1="55" x2="72" y2="55" stroke="{STROKE}"/>\n'
    s += f'  <circle cx="76" cy="55" r="4" fill="none" stroke="{STROKE}" stroke-width="2.5"/>\n'
    return s

@icon("Message Broker")
def _():
    # Central hub
    s = f'  <circle cx="60" cy="60" r="18" fill="{FILL}" stroke="{STROKE}"/>\n'
    # Spokes
    import math
    for i in range(5):
        a = math.radians(72 * i - 90)
        x2 = 60 + 35 * math.cos(a)
        y2 = 60 + 35 * math.sin(a)
        x1 = 60 + 18 * math.cos(a)
        y1 = 60 + 18 * math.sin(a)
        s += f'  <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{STROKE}"/>\n'
        s += f'  <rect x="{x2-5:.1f}" y="{y2-5:.1f}" width="10" height="10" fill="{FILL}" stroke="{STROKE}" rx="1"/>\n'
    # Label
    s += f'  <text x="60" y="64" text-anchor="middle" font-size="9" font-family="sans-serif" fill="{ACCENT}" stroke="none">B</text>\n'
    return s

# --- Message Transformation ---

@icon("Envelope Wrapper")
def _():
    # Outer envelope
    s = envelope(60, 55, 48, 34)
    # Inner envelope (smaller)
    s += envelope(60, 60, 28, 18)
    return s

@icon("Content Enricher")
def _():
    s = box(60, 55, 44, 34)
    # Plus sign
    s += f'  <line x1="52" y1="55" x2="68" y2="55" stroke="{ACCENT}" stroke-width="2.5"/>\n'
    s += f'  <line x1="60" y1="47" x2="60" y2="63" stroke="{ACCENT}" stroke-width="2.5"/>\n'
    # Input/output
    s += small_arrow(5, 55, 38, 55)
    s += small_arrow(82, 55, 115, 55)
    return s

@icon("Content Filter")
def _():
    s = box(60, 55, 44, 34)
    # Minus sign (filter/remove)
    s += f'  <line x1="50" y1="55" x2="70" y2="55" stroke="{ACCENT}" stroke-width="2.5"/>\n'
    # Input/output
    s += small_arrow(5, 55, 38, 55)
    s += small_arrow(82, 55, 115, 55)
    return s

@icon("Claim Check")
def _():
    # Ticket/claim check
    s = f'  <rect x="35" y="35" width="50" height="30" fill="{FILL}" stroke="{STROKE}" rx="2"/>\n'
    # Perforation
    s += f'  <line x1="65" y1="35" x2="65" y2="65" stroke="{STROKE}" stroke-dasharray="3,2"/>\n'
    # Ticket stub
    s += f'  <text x="50" y="54" text-anchor="middle" font-size="9" font-family="monospace" fill="{ACCENT}" stroke="none">#42</text>\n'
    # Database below
    s += f'  <ellipse cx="60" cy="82" rx="18" ry="5" fill="{FILL}" stroke="{STROKE}"/>\n'
    s += f'  <line x1="42" y1="82" x2="42" y2="95" stroke="{STROKE}"/>\n'
    s += f'  <line x1="78" y1="82" x2="78" y2="95" stroke="{STROKE}"/>\n'
    s += f'  <ellipse cx="60" cy="95" rx="18" ry="5" fill="{FILL}" stroke="{STROKE}"/>\n'
    return s

@icon("Normalizer")
def _():
    # Converging arrows into box
    s = box(70, 55, 30, 25)
    # Different-shaped inputs converging
    s += f'  <polygon points="15,35 25,30 25,40" fill="{FILL}" stroke="{STROKE}"/>\n'  # triangle
    s += f'  <rect x="12" y="50" width="12" height="12" fill="{FILL}" stroke="{STROKE}"/>\n'  # square
    s += f'  <circle cx="18" cy="80" r="6" fill="{FILL}" stroke="{STROKE}"/>\n'  # circle
    # Arrows converging
    s += small_arrow(27, 35, 55, 48)
    s += small_arrow(24, 56, 55, 55)
    s += small_arrow(24, 80, 55, 62)
    # Output
    s += small_arrow(85, 55, 112, 55)
    return s

@icon("Canonical Data Model")
def _():
    # Standard document template
    s = f'  <rect x="35" y="25" width="50" height="65" fill="{FILL}" stroke="{STROKE}" rx="2"/>\n'
    # Header bar
    s += f'  <rect x="35" y="25" width="50" height="12" fill="{ACCENT}" stroke="{STROKE}" rx="2"/>\n'
    s += f'  <rect x="35" y="35" width="50" height="2" fill="{STROKE}" stroke="none"/>\n'
    # Schema lines
    for y in [48, 56, 64, 72]:
        s += f'  <line x1="42" y1="{y}" x2="78" y2="{y}" stroke="{STROKE}" stroke-width="1"/>\n'
    return s

# --- Messaging Endpoints ---

@icon("Messaging Gateway")
def _():
    s = box(60, 55, 50, 35)
    # Gateway arch
    s += f'  <path d="M 43,65 L 43,48 Q 60,38 77,48 L 77,65" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    # Door opening
    s += f'  <line x1="60" y1="48" x2="60" y2="65" stroke="{ACCENT}" stroke-dasharray="3,2"/>\n'
    return s

@icon("Messaging Mapper")
def _():
    s = box(60, 55, 50, 35)
    # Mapping arrows
    s += f'  <circle cx="47" cy="47" r="3" fill="{ACCENT}" stroke="none"/>\n'
    s += f'  <circle cx="47" cy="57" r="3" fill="{ACCENT}" stroke="none"/>\n'
    s += f'  <circle cx="47" cy="67" r="3" fill="{ACCENT}" stroke="none"/>\n'
    s += f'  <circle cx="73" cy="47" r="3" fill="{ACCENT}" stroke="none"/>\n'
    s += f'  <circle cx="73" cy="62" r="3" fill="{ACCENT}" stroke="none"/>\n'
    # Crossing lines
    s += f'  <line x1="50" y1="47" x2="70" y2="62" stroke="{STROKE}" stroke-width="1"/>\n'
    s += f'  <line x1="50" y1="57" x2="70" y2="47" stroke="{STROKE}" stroke-width="1"/>\n'
    s += f'  <line x1="50" y1="67" x2="70" y2="62" stroke="{STROKE}" stroke-width="1"/>\n'
    return s

@icon("Transactional Client")
def _():
    s = box(60, 55, 50, 35)
    # TX label
    s += f'  <text x="60" y="60" text-anchor="middle" font-size="14" font-family="monospace" fill="{ACCENT}" stroke="none" font-weight="bold">TX</text>\n'
    return s

@icon("Polling Consumer")
def _():
    s = box(60, 55, 40, 30)
    # Clock/timer icon
    s += f'  <circle cx="60" cy="55" r="10" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <line x1="60" y1="55" x2="60" y2="48" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <line x1="60" y1="55" x2="66" y2="55" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    # Pull arrow from channel
    s += f'  <line x1="60" y1="85" x2="60" y2="70" stroke="{STROKE}"/>\n'
    s += f'  <polyline points="56,75 60,70 64,75" fill="none" stroke="{STROKE}"/>\n'
    return s

@icon("Event-Driven Consumer")
def _():
    s = box(60, 55, 40, 30)
    # Lightning bolt
    s += f'  <polyline points="56,44 53,55 62,55 58,66" fill="none" stroke="{ACCENT}" stroke-width="2"/>\n'
    # Push arrow from channel
    s += f'  <line x1="60" y1="85" x2="60" y2="70" stroke="{STROKE}"/>\n'
    s += f'  <polyline points="56,75 60,70 64,75" fill="none" stroke="{STROKE}"/>\n'
    return s

@icon("Competing Consumers")
def _():
    # Multiple consumers (stacked, back to front)
    s = f'  <rect x="55" y="30" width="30" height="20" fill="{FILL}" stroke="{STROKE}" rx="2"/>\n'
    s += f'  <rect x="60" y="35" width="30" height="20" fill="{FILL}" stroke="{STROKE}" rx="2"/>\n'
    s += f'  <rect x="65" y="40" width="30" height="20" fill="{FILL}" stroke="{STROKE}" rx="2"/>\n'
    # Channel below
    s += pipe(15, 72, 80, 72, 14)
    # Arrows up
    s += f'  <line x1="50" y1="72" x2="50" y2="60" stroke="{STROKE}"/>\n'
    s += f'  <polyline points="47,64 50,60 53,64" fill="none" stroke="{STROKE}"/>\n'
    return s

@icon("Selective Consumer")
def _():
    s = box(60, 50, 40, 30)
    # Filter icon inside
    s += f'  <polygon points="48,40 72,40 65,52 55,52" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    # Channel below
    s += f'  <line x1="60" y1="80" x2="60" y2="65" stroke="{STROKE}"/>\n'
    s += f'  <polyline points="56,70 60,65 64,70" fill="none" stroke="{STROKE}"/>\n'
    return s

@icon("Durable Subscriber")
def _():
    s = box(60, 45, 40, 28)
    # Database symbol below (persistence)
    s += f'  <ellipse cx="60" cy="78" rx="15" ry="5" fill="{FILL}" stroke="{STROKE}"/>\n'
    s += f'  <line x1="45" y1="78" x2="45" y2="90" stroke="{STROKE}"/>\n'
    s += f'  <line x1="75" y1="78" x2="75" y2="90" stroke="{STROKE}"/>\n'
    s += f'  <ellipse cx="60" cy="90" rx="15" ry="5" fill="{FILL}" stroke="{STROKE}"/>\n'
    # Connect
    s += f'  <line x1="60" y1="59" x2="60" y2="73" stroke="{STROKE}"/>\n'
    return s

@icon("Idempotent Consumer")
def _():
    s = box(60, 55, 46, 34)
    # Equals sign (idempotent: same result)
    s += f'  <line x1="50" y1="51" x2="70" y2="51" stroke="{ACCENT}" stroke-width="2.5"/>\n'
    s += f'  <line x1="50" y1="59" x2="70" y2="59" stroke="{ACCENT}" stroke-width="2.5"/>\n'
    return s

@icon("Service Activator")
def _():
    s = box(60, 55, 44, 34)
    # Gear
    s += gear(60, 55, 12, 6)
    # Input/output
    s += small_arrow(5, 55, 38, 55)
    s += small_arrow(82, 55, 115, 55)
    return s

# --- System Management ---

@icon("Wire Tap")
def _():
    # Main channel
    s = pipe(15, 45, 100, 45)
    # T-branch down
    s += f'  <line x1="60" y1="63" x2="60" y2="95" stroke="{STROKE}"/>\n'
    s += f'  <polyline points="56,90 60,95 64,90" fill="none" stroke="{STROKE}"/>\n'
    # Small copy envelope
    s += envelope(60, 100, 16, 10)
    return s

@icon("Detour")
def _():
    # Straight-through channel
    s = f'  <line x1="15" y1="60" x2="40" y2="60" stroke="{STROKE}"/>\n'
    # Detour path (curved bypass)
    s += f'  <path d="M 40,60 Q 40,30 60,30 Q 80,30 80,60" fill="none" stroke="{ACCENT}" stroke-dasharray="4,2"/>\n'
    # Switch at branch point
    s += f'  <circle cx="40" cy="60" r="4" fill="{FILL}" stroke="{STROKE}"/>\n'
    s += f'  <circle cx="80" cy="60" r="4" fill="{FILL}" stroke="{STROKE}"/>\n'
    # Continue
    s += f'  <line x1="84" y1="60" x2="105" y2="60" stroke="{STROKE}"/>\n'
    # Detour box
    s += box(60, 30, 24, 16)
    return s

@icon("Control Bus")
def _():
    # Horizontal bus
    s = f'  <rect x="15" y="55" width="90" height="8" fill="{ACCENT}" stroke="{STROKE}" rx="4"/>\n'
    # Control connections to components
    for x in [30, 55, 80]:
        s += f'  <line x1="{x}" y1="55" x2="{x}" y2="40" stroke="{STROKE}" stroke-dasharray="3,2"/>\n'
        s += gear(x, 32, 8, 5)
    return s

@icon("Channel Purger")
def _():
    s = pipe(20, 45, 100, 45)
    # Trash/purge icon - broom sweeping
    s += f'  <line x1="55" y1="48" x2="65" y2="62" stroke="{ACCENT}" stroke-width="2"/>\n'
    s += f'  <polyline points="50,58 58,62 65,62 72,58" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    return s

@icon("Test Message")
def _():
    s = envelope(60, 50, 36, 24)
    # Checkmark overlay
    s += f'  <polyline points="48,52 56,60 74,42" fill="none" stroke="{ACCENT}" stroke-width="2.5"/>\n'
    return s

@icon("Message History")
def _():
    # Stack of entries / log
    s = f'  <rect x="30" y="25" width="60" height="70" fill="{FILL}" stroke="{STROKE}" rx="2"/>\n'
    # Log lines with timestamps
    for i, y in enumerate([38, 50, 62, 74]):
        alpha = 1.0 - i * 0.2
        s += f'  <line x1="37" y1="{y}" x2="83" y2="{y}" stroke="{STROKE}" stroke-width="1" opacity="{alpha}"/>\n'
        s += f'  <circle cx="40" cy="{y}" r="2" fill="{ACCENT}" stroke="none" opacity="{alpha}"/>\n'
    return s

@icon("Message Store")
def _():
    # Database cylinder
    s = f'  <ellipse cx="60" cy="38" rx="25" ry="10" fill="{FILL}" stroke="{STROKE}"/>\n'
    s += f'  <line x1="35" y1="38" x2="35" y2="75" stroke="{STROKE}"/>\n'
    s += f'  <line x1="85" y1="38" x2="85" y2="75" stroke="{STROKE}"/>\n'
    s += f'  <ellipse cx="60" cy="75" rx="25" ry="10" fill="{FILL}" stroke="{STROKE}"/>\n'
    # Envelope going in
    s += envelope(60, 30, 16, 10)
    return s

@icon("Smart Proxy")
def _():
    s = box(60, 55, 50, 35)
    # Proxy arrows (in and out with redirect)
    s += small_arrow(5, 55, 35, 55)
    s += small_arrow(85, 55, 115, 55)
    # Internal redirect
    s += f'  <path d="M 45,50 Q 60,40 75,50" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <path d="M 45,60 Q 60,70 75,60" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    return s

# --- Additional patterns to reach full coverage ---

@icon("Message Dispatcher")
def _():
    s = box(60, 55, 40, 30)
    # Dispatch arrows out
    s += small_arrow(80, 48, 108, 35)
    s += small_arrow(80, 55, 108, 55)
    s += small_arrow(80, 62, 108, 75)
    # Input
    s += small_arrow(10, 55, 40, 55)
    # Label
    s += f'  <text x="60" y="58" text-anchor="middle" font-size="8" font-family="sans-serif" fill="{ACCENT}" stroke="none">D</text>\n'
    return s

@icon("Saga")
def _():
    # Chain of steps with compensations
    s = ""
    for i, x in enumerate([25, 55, 85]):
        s += f'  <rect x="{x-10}" y="40" width="20" height="16" fill="{FILL}" stroke="{STROKE}" rx="2"/>\n'
        s += f'  <text x="{x}" y="51" text-anchor="middle" font-size="7" font-family="monospace" fill="{ACCENT}" stroke="none">S{i+1}</text>\n'
        # Compensation below
        s += f'  <rect x="{x-10}" y="68" width="20" height="12" fill="{FILL}" stroke="{ACCENT}" rx="1" stroke-dasharray="3,2"/>\n'
        s += f'  <line x1="{x}" y1="56" x2="{x}" y2="68" stroke="{STROKE}" stroke-dasharray="2,2"/>\n'
    # Arrows between steps
    s += f'  <line x1="35" y1="48" x2="45" y2="48" stroke="{STROKE}"/>\n'
    s += f'  <line x1="65" y1="48" x2="75" y2="48" stroke="{STROKE}"/>\n'
    return s

@icon("Throttler")
def _():
    s = box(60, 55, 44, 34)
    # Speed gauge
    s += f'  <path d="M 48,62 A 15,15 0 0,1 72,62" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <line x1="60" y1="62" x2="66" y2="50" stroke="{ACCENT}" stroke-width="2"/>\n'
    # Input/output
    s += small_arrow(5, 55, 38, 55)
    s += small_arrow(82, 55, 115, 55)
    return s

@icon("Delayer")
def _():
    s = box(60, 55, 44, 34)
    # Hourglass
    s += f'  <polygon points="52,44 68,44 60,55 68,66 52,66 60,55" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    # Input/output
    s += small_arrow(5, 55, 38, 55)
    s += small_arrow(82, 55, 115, 55)
    return s

@icon("Load Balancer")
def _():
    s = diamond(40, 55, 18, 18)
    # Equal distribution arrows
    s += small_arrow(58, 48, 95, 35)
    s += small_arrow(58, 55, 95, 55)
    s += small_arrow(58, 62, 95, 75)
    # Balance symbol
    s += f'  <line x1="35" y1="50" x2="45" y2="50" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <line x1="35" y1="55" x2="45" y2="55" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <line x1="35" y1="60" x2="45" y2="60" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    # Input
    s += small_arrow(5, 55, 22, 55)
    return s

@icon("Multicast")
def _():
    # Circle with broadcast waves
    s = f'  <circle cx="40" cy="60" r="14" fill="{FILL}" stroke="{STROKE}"/>\n'
    # Broadcast waves
    s += f'  <path d="M 58,48 A 22,22 0 0,1 58,72" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    s += f'  <path d="M 68,40 A 32,32 0 0,1 68,80" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    # Input
    s += small_arrow(5, 60, 26, 60)
    # Output arrows
    s += small_arrow(78, 42, 105, 30)
    s += small_arrow(78, 60, 105, 60)
    s += small_arrow(78, 78, 105, 90)
    return s

@icon("Loop")
def _():
    s = box(60, 55, 44, 34)
    # Circular arrow
    s += f'  <path d="M 50,50 A 12,12 0 1,1 55,62" fill="none" stroke="{ACCENT}" stroke-width="2"/>\n'
    s += f'  <polyline points="52,58 55,62 59,58" fill="none" stroke="{ACCENT}" stroke-width="1.5"/>\n'
    return s

@icon("Sampling")
def _():
    s = box(60, 55, 44, 34)
    # Sampling dots (every Nth)
    for i, x in enumerate([44, 52, 60, 68, 76]):
        fill = ACCENT if i % 2 == 0 else "none"
        sw = STROKE if i % 2 != 0 else ACCENT
        s += f'  <circle cx="{x}" cy="55" r="3" fill="{fill}" stroke="{sw}" stroke-width="1"/>\n'
    return s

@icon("Circuit Breaker")
def _():
    s = box(60, 55, 50, 36)
    # Open circuit
    s += f'  <line x1="40" y1="55" x2="52" y2="55" stroke="{ACCENT}" stroke-width="2"/>\n'
    s += f'  <line x1="68" y1="55" x2="80" y2="55" stroke="{ACCENT}" stroke-width="2"/>\n'
    # Break gap
    s += f'  <line x1="52" y1="55" x2="60" y2="45" stroke="{ACCENT}" stroke-width="2"/>\n'
    s += f'  <circle cx="68" cy="55" r="2" fill="{ACCENT}" stroke="none"/>\n'
    return s

# ---------- More EIP patterns to reach full set ----------

@icon("Messaging")
def _():
    """The generic "messaging" concept icon."""
    s = envelope(60, 45, 40, 28)
    # Arrow underneath
    s += small_arrow(30, 80, 90, 80)
    return s

@icon("Remote Procedure Invocation")
def _():
    s = box(30, 55, 30, 25)
    s += box(90, 55, 30, 25)
    # RPC arrow
    s += small_arrow(45, 50, 75, 50)
    # Return arrow
    s += f'  <line x1="75" y1="60" x2="45" y2="60" stroke="{STROKE}" stroke-dasharray="4,2"/>\n'
    s += f'  <polyline points="50,57 45,60 50,63" fill="none" stroke="{STROKE}"/>\n'
    return s

@icon("File Transfer")
def _():
    # Two systems with file between
    s = box(25, 55, 24, 20)
    s += box(95, 55, 24, 20)
    # File icon
    s += f'  <path d="M 52,45 L 62,45 L 68,51 L 68,70 L 52,70 Z" fill="{FILL}" stroke="{STROKE}"/>\n'
    s += f'  <path d="M 62,45 L 62,51 L 68,51" fill="none" stroke="{STROKE}"/>\n'
    # Arrows
    s += small_arrow(37, 52, 50, 52)
    s += small_arrow(70, 58, 83, 58)
    return s

@icon("Shared Database")
def _():
    # Database cylinder
    s = f'  <ellipse cx="60" cy="40" rx="28" ry="10" fill="{FILL}" stroke="{STROKE}"/>\n'
    s += f'  <line x1="32" y1="40" x2="32" y2="70" stroke="{STROKE}"/>\n'
    s += f'  <line x1="88" y1="40" x2="88" y2="70" stroke="{STROKE}"/>\n'
    s += f'  <ellipse cx="60" cy="70" rx="28" ry="10" fill="{FILL}" stroke="{STROKE}"/>\n'
    # Multiple accessor arrows
    s += small_arrow(20, 90, 40, 78)
    s += small_arrow(100, 90, 80, 78)
    return s

# ============================================================
# Generate all SVGs
# ============================================================

def main():
    os.makedirs(SVG_DIR, exist_ok=True)

    # Remove old generated file
    old = os.path.join(SVG_DIR, "Hohpe EIP.svg")
    if os.path.exists(old):
        os.remove(old)

    generated = []
    for name, fn in icons.items():
        body = fn()
        svg = wrap(name, body)
        filename = slug(name) + ".svg"
        path = os.path.join(SVG_DIR, filename)
        with open(path, "w") as f:
            f.write(svg)
        generated.append(filename)
        print(f"  {filename}")

    print(f"\nGenerated {len(generated)} SVG icons in {SVG_DIR}")
    return generated

if __name__ == "__main__":
    main()
