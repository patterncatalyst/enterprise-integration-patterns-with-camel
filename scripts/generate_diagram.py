#!/usr/bin/env python3
"""Tiny diagram compiler for a chaptered tutorial site.

Each diagram is a spec of bands (background lanes), nodes (rounded boxes with a
bold title line + smaller grey detail lines), edges (arrows with optional
labels), and free notes. emit() writes a clean themed SVG (what the site embeds)
and a valid Excalidraw source (editable companion) into assets/diagrams/.
"""
import json, random, html, os, base64, re

OUT = "."  # output dir; callers set: generate_diagram.OUT = "assets/diagrams"
STENCIL_SVG = os.path.join(os.path.dirname(__file__), "..", "assets", "eip-stencils", "svg")
STENCIL_PNG = os.path.join(os.path.dirname(__file__), "..", "presentations", "src", "png", "eip-icons")

# ---- palette --------------------------------------------------------------
STYLES = {
    "box":    ("#ffffff", "#111111"),
    "sub":    ("#ffffff", "#999999"),
    "accent": ("#fff8ef", "#e8870c"),
    "muted":  ("#f4f4f4", "#666666"),  # de-emphasized / background role
    "info":   ("#eef4fb", "#2f6db5"),  # secondary (blue) role
    "ghost":  ("#ffffff", "#999999"),  # dashed
    "ink":    ("#111111", "#111111"),  # filled dark, white text
    "channel": ("#f4f4f4", "#555555"),  # message channel cylinder
    "endpoint": ("#555555", "#555555"),  # message endpoint circle
    "pattern": ("#fff8ef", "#e8870c"),  # EIP pattern with stencil icon
}
INK = "#111111"; GREY = "#555555"; AMBER = "#b8650a"; LABEL = "#555555"
RED = "#EE0000"

def _seed(): return random.randint(1, 2_000_000_000)
def esc(s): return html.escape(str(s), quote=True)

def _load_stencil_svg(icon):
    """Load an EIP stencil SVG and return inner elements (without the outer <svg> wrapper)."""
    path = os.path.join(STENCIL_SVG, f"{icon}.svg")
    if not os.path.exists(path): return None
    content = open(path).read()
    content = re.sub(r'<\?xml[^?]*\?>', '', content)
    content = re.sub(r'<svg[^>]*>', '', content, count=1)
    content = re.sub(r'</svg>\s*$', '', content)
    return content.strip()

def _load_stencil_png_b64(icon):
    """Load an EIP stencil PNG and return base64-encoded data URL."""
    path = os.path.join(STENCIL_PNG, f"{icon}.png")
    if not os.path.exists(path): return None
    data = open(path, "rb").read()
    return f"data:image/png;base64,{base64.b64encode(data).decode()}"

# ---- SVG ------------------------------------------------------------------
def _svg(width, height, bands, nodes, edges, notes):
    o = []
    o.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
             f'font-family="\'Red Hat Text\', system-ui, sans-serif" role="img">')
    o.append('<defs>'
             '<marker id="a" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#555"/></marker>'
             '<marker id="am" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#b8650a"/></marker>'
             '</defs>')
    for b in bands:
        x,y,w,h,label,fill = b["x"],b["y"],b["w"],b["h"],b.get("label",""),b.get("fill","#fafafa")
        o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="#ddd"/>')
        if label:
            o.append(f'<text x="{x+12}" y="{y+20}" font-size="12" font-weight="700" fill="{LABEL}">{esc(label)}</text>')
    # Nodes are drawn BEFORE edges so arrowheads render on top of the boxes
    # (otherwise a box painted afterwards hides the head and the arrow looks
    # like it stops short or disappears behind the box).
    for n in nodes:
        style = n.get("style","box")
        fill, stroke = STYLES.get(style, STYLES["box"])
        x,y,w,h = n["x"],n["y"],n["w"],n["h"]

        if style == "channel":
            # Cylinder / pipe shape for message channels
            ry = min(8, h*0.2)
            o.append(f'<rect x="{x}" y="{y+ry}" width="{w}" height="{h-2*ry}" fill="{fill}" stroke="none"/>')
            o.append(f'<ellipse cx="{x+w/2}" cy="{y+ry}" rx="{w/2}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
            o.append(f'<ellipse cx="{x+w/2}" cy="{y+h-ry}" rx="{w/2}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
            o.append(f'<line x1="{x}" y1="{y+ry}" x2="{x}" y2="{y+h-ry}" stroke="{stroke}" stroke-width="1.5"/>')
            o.append(f'<line x1="{x+w}" y1="{y+ry}" x2="{x+w}" y2="{y+h-ry}" stroke="{stroke}" stroke-width="1.5"/>')
        elif style == "endpoint":
            # Small filled circle for message endpoints
            r = min(w,h)/2
            cx, cy = x+w/2, y+h/2
            o.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
        else:
            # Standard rectangle
            dash = ' stroke-dasharray="6 4"' if style=="ghost" else ""
            sw = 2 if style in ("box","accent","info","ink","pattern") else 1.5
            o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{dash}/>')

        # Embed EIP stencil icon if specified
        icon = n.get("icon")
        if icon:
            icon_svg = _load_stencil_svg(icon)
            if icon_svg:
                icon_size = min(w*0.5, h*0.6, 40)
                ix = x + (w - icon_size)/2
                iy = y + 4
                scale = icon_size / 120
                o.append(f'<g transform="translate({ix},{iy}) scale({scale})">{icon_svg}</g>')

        lines = n.get("lines", [])
        if not lines: continue
        cx = x+w/2
        tcol = "#ffffff" if style=="ink" else INK
        scol = "#dddddd" if style=="ink" else GREY
        if style == "endpoint":
            # Label below circle
            o.append(f'<text x="{cx}" y="{y+h+14}" font-size="11" font-weight="700" fill="{INK}" text-anchor="middle">{esc(lines[0])}</text>')
            continue
        # Offset text down if icon is present
        text_y_offset = (min(w*0.5, h*0.6, 40) + 6) if icon and _load_stencil_svg(icon) else 0
        n_extra = len(lines)-1
        block_h = 17 + n_extra*15
        ty = y + text_y_offset + (h - text_y_offset - block_h)/2 + 14
        o.append(f'<text x="{cx}" y="{ty}" font-size="13.5" font-weight="700" fill="{tcol}" text-anchor="middle">{esc(lines[0])}</text>')
        for i,ln in enumerate(lines[1:]):
            o.append(f'<text x="{cx}" y="{ty+17+i*15}" font-size="11.5" fill="{scol}" text-anchor="middle">{esc(ln)}</text>')
    for e in edges:
        col = "#b8650a" if e.get("amber") else "#555"
        mk = "am" if e.get("amber") else "a"
        dash = ' stroke-dasharray="5 4"' if e.get("dashed") else ""
        ms = f' marker-start="url(#{mk})"' if e.get("bidir") else ""
        o.append(f'<path d="M{e["x1"]},{e["y1"]} L{e["x2"]},{e["y2"]}" fill="none" stroke="{col}" stroke-width="2"{dash}{ms} marker-end="url(#{mk})"/>')
        if e.get("label"):
            mx,my = (e["x1"]+e["x2"])/2, (e["y1"]+e["y2"])/2
            lx,ly = mx+e.get("lx",6), my+e.get("ly",-6)
            # white halo under the label so it stays legible over a line/box
            o.append(f'<text x="{lx}" y="{ly}" font-size="11" fill="#ffffff" stroke="#ffffff" stroke-width="3" paint-order="stroke" text-anchor="middle">{esc(e["label"])}</text>')
            o.append(f'<text x="{lx}" y="{ly}" font-size="11" fill="{col}" text-anchor="middle">{esc(e["label"])}</text>')
    for t in notes:
        anchor = t.get("anchor","start")
        bold = ' font-weight="700"' if t.get("bold") else ''
        o.append(f'<text x="{t["x"]}" y="{t["y"]}" font-size="{t.get("size",11)}" fill="{t.get("color",LABEL)}" text-anchor="{anchor}"{bold}>{esc(t["text"])}</text>')
    o.append('</svg>')
    return "\n".join(o)

# ---- Excalidraw -----------------------------------------------------------
def _exc(bands, nodes, edges, notes):
    els = []
    def rect(x,y,w,h,stroke,bg,dashed=False):
        els.append({"id":f"r{_seed()}","type":"rectangle","x":x,"y":y,"width":w,"height":h,"angle":0,
            "strokeColor":stroke,"backgroundColor":bg,"fillStyle":"solid","strokeWidth":2,
            "strokeStyle":"dashed" if dashed else "solid","roughness":1,"opacity":100,"groupIds":[],
            "frameId":None,"roundness":{"type":3},"seed":_seed(),"versionNonce":_seed(),"isDeleted":False,
            "boundElements":[],"updated":1,"link":None,"locked":False})
    def text(x,y,s,size=14,color="#111111"):
        els.append({"id":f"t{_seed()}","type":"text","x":x,"y":y,"width":max(40,len(s)*size*0.55),
            "height":size*1.25,"angle":0,"strokeColor":color,"backgroundColor":"transparent","fillStyle":"solid",
            "strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"groupIds":[],"frameId":None,
            "roundness":None,"seed":_seed(),"versionNonce":_seed(),"isDeleted":False,"boundElements":[],
            "updated":1,"link":None,"locked":False,"text":s,"fontSize":size,"fontFamily":1,"textAlign":"left",
            "verticalAlign":"top","containerId":None,"originalText":s,"lineHeight":1.25,"baseline":size})
    def arrow(x1,y1,x2,y2,color="#555555",dashed=False):
        els.append({"id":f"a{_seed()}","type":"arrow","x":x1,"y":y1,"width":abs(x2-x1),"height":abs(y2-y1),
            "angle":0,"strokeColor":color,"backgroundColor":"transparent","fillStyle":"solid","strokeWidth":2,
            "strokeStyle":"dashed" if dashed else "solid","roughness":1,"opacity":100,"groupIds":[],"frameId":None,
            "roundness":{"type":2},"seed":_seed(),"versionNonce":_seed(),"isDeleted":False,"boundElements":[],
            "updated":1,"link":None,"locked":False,"points":[[0,0],[x2-x1,y2-y1]],"lastCommittedPoint":None,
            "startBinding":None,"endBinding":None,"startArrowhead":None,"endArrowhead":"arrow"})
    for b in bands:
        rect(b["x"],b["y"],b["w"],b["h"],"#dddddd",b.get("fill","#fafafa"))
        if b.get("label"): text(b["x"]+12,b["y"]+6,b["label"],12,"#555555")
    def ellipse(x,y,w,h,stroke,bg):
        els.append({"id":f"e{_seed()}","type":"ellipse","x":x,"y":y,"width":w,"height":h,"angle":0,
            "strokeColor":stroke,"backgroundColor":bg,"fillStyle":"solid","strokeWidth":2,
            "strokeStyle":"solid","roughness":1,"opacity":100,"groupIds":[],"frameId":None,
            "roundness":{"type":2},"seed":_seed(),"versionNonce":_seed(),"isDeleted":False,
            "boundElements":[],"updated":1,"link":None,"locked":False})
    def image(x,y,w,h,file_id):
        els.append({"id":f"i{_seed()}","type":"image","x":x,"y":y,"width":w,"height":h,"angle":0,
            "strokeColor":"transparent","backgroundColor":"transparent","fillStyle":"solid","strokeWidth":0,
            "strokeStyle":"solid","roughness":0,"opacity":100,"groupIds":[],"frameId":None,
            "roundness":None,"seed":_seed(),"versionNonce":_seed(),"isDeleted":False,
            "boundElements":[],"updated":1,"link":None,"locked":False,"fileId":file_id,
            "status":"saved","scale":[1,1]})
    files = {}
    for n in nodes:
        style = n.get("style","box")
        fill,stroke = STYLES.get(style, STYLES["box"])
        if style == "channel":
            rect(n["x"],n["y"],n["w"],n["h"],stroke,fill)
        elif style == "endpoint":
            ellipse(n["x"],n["y"],n["w"],n["h"],stroke,fill)
        else:
            rect(n["x"],n["y"],n["w"],n["h"],stroke,fill,dashed=(style=="ghost"))
        icon = n.get("icon")
        if icon:
            b64 = _load_stencil_png_b64(icon)
            if b64:
                file_id = f"eip_{icon}"
                files[file_id] = {"mimeType":"image/png","id":file_id,"dataURL":b64,"created":1}
                isize = min(n["w"]*0.5, n["h"]*0.6, 40)
                image(n["x"]+(n["w"]-isize)/2, n["y"]+4, isize, isize, file_id)
        lines = n.get("lines", [])
        if not lines: continue
        if style == "endpoint":
            text(n["x"],n["y"]+n["h"]+4,lines[0],11,INK)
        else:
            y_off = 8 + ((min(n["w"]*0.5,n["h"]*0.6,40)+6) if icon else 0)
            text(n["x"]+10,n["y"]+y_off,lines[0],14,"#ffffff" if style=="ink" else "#111111")
            for i,ln in enumerate(lines[1:]):
                text(n["x"]+10,n["y"]+y_off+20+i*15,ln,11,"#555555")
    for e in edges:
        col = "#b8650a" if e.get("amber") else "#555555"
        arrow(e["x1"],e["y1"],e["x2"],e["y2"],col,dashed=e.get("dashed",False))
        if e.get("label"):
            text((e["x1"]+e["x2"])/2,(e["y1"]+e["y2"])/2-14,e["label"],11,col)
    for t in notes:
        text(t["x"],t["y"]-10,t["text"],t.get("size",11),t.get("color","#555555"))
    return {"type":"excalidraw","version":2,"source":"https://excalidraw.com","elements":els,
            "appState":{"viewBackgroundColor":"#ffffff","gridSize":None},"files":files}

def emit(name, width, height, bands=None, nodes=None, edges=None, notes=None):
    bands=bands or []; nodes=nodes or []; edges=edges or []; notes=notes or []
    open(f"{OUT}/{name}.svg","w").write(_svg(width,height,bands,nodes,edges,notes))
    json.dump(_exc(bands,nodes,edges,notes), open(f"{OUT}/{name}.excalidraw","w"), indent=1)
    # validate
    import xml.dom.minidom as m; m.parseString(open(f"{OUT}/{name}.svg").read())
    json.load(open(f"{OUT}/{name}.excalidraw"))
    print("emit", name)
