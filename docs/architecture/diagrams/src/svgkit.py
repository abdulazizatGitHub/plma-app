"""Tiny SVG diagram toolkit for the Life v2 docs.

No network or npm needed: diagrams are plain SVG, rasterized to PNG with the
locally installed Chrome/Edge (see render()). Colors are the v2 tokens sampled
from `UI Images/` (docs/design/DESIGN_SYSTEM_V2.md).
"""

from __future__ import annotations

import math
import os
import shutil
import subprocess
import tempfile
from html import escape

FONT = "'Segoe UI', Poppins, Arial, sans-serif"

# Sampled from UI Images/ (see DESIGN_SYSTEM_V2.md). Tints are mixes with white.
BASE = {
    "blue": "#7293F1",
    "mauve": "#AA8B9A",
    "peach": "#EBAC80",
    "sage": "#97BB7D",
    "coral": "#E66473",
    "teal": "#2E9499",
    "yellow": "#FDC703",
    "navy": "#39455B",
    "grey": "#9A9BA6",
}
INK = "#1B1A22"
INK2 = "#64656C"
BORDER = "#DBDCE3"
PANEL = "#F4F4F9"


def _mix(hex_color: str, t: float) -> str:
    r, g, b = (int(hex_color[i : i + 2], 16) for i in (1, 3, 5))
    r, g, b = (round(c + (255 - c) * t) for c in (r, g, b))
    return f"#{r:02X}{g:02X}{b:02X}"


def tint(name: str, t: float = 0.84) -> str:
    return _mix(BASE[name], t)


def stroke(name: str) -> str:
    # Slightly darker than the base so outlines read on white.
    r, g, b = (int(BASE[name][i : i + 2], 16) for i in (1, 3, 5))
    return f"#{round(r * .82):02X}{round(g * .82):02X}{round(b * .82):02X}"


def tw(text: str, size: float, bold: bool = False) -> float:
    """Approximate rendered width of text in Segoe UI."""
    w = 0.0
    for ch in text:
        if ch in "il.,:;|!'()[]{} ":
            w += 0.30
        elif ch in "mwMW@":
            w += 0.85
        elif ch.isupper() or ch.isdigit():
            w += 0.62
        else:
            w += 0.52
    return w * size * (1.06 if bold else 1.0)


def wrap(text: str, width: float, size: float) -> list[str]:
    out: list[str] = []
    for para in text.split("\n"):
        line = ""
        for word in para.split(" "):
            trial = f"{line} {word}".strip()
            if tw(trial, size) <= width or not line:
                line = trial
            else:
                out.append(line)
                line = word
        out.append(line)
    return out


class Node:
    def __init__(self, x, y, w, h):
        self.x, self.y, self.w, self.h = x, y, w, h

    @property
    def cx(self):
        return self.x + self.w / 2

    @property
    def cy(self):
        return self.y + self.h / 2

    def side(self, s: str, f: float = 0.5):
        return {
            "l": (self.x, self.y + self.h * f),
            "r": (self.x + self.w, self.y + self.h * f),
            "t": (self.x + self.w * f, self.y),
            "b": (self.x + self.w * f, self.y + self.h),
        }[s]

    def clip(self, tx, ty):
        """Point where the segment center->(tx,ty) leaves the rectangle."""
        dx, dy = tx - self.cx, ty - self.cy
        if dx == 0 and dy == 0:
            return self.cx, self.cy
        sx = (self.w / 2) / abs(dx) if dx else math.inf
        sy = (self.h / 2) / abs(dy) if dy else math.inf
        s = min(sx, sy)
        return self.cx + dx * s, self.cy + dy * s


class Diagram:
    def __init__(self, w: int, h: int, title: str | None = None, subtitle: str | None = None):
        self.w, self.h = w, h
        self.back: list[str] = []
        self.mid: list[str] = []
        self.front: list[str] = []
        self.nodes: dict[str, Node] = {}
        if title:
            self.front.append(self._text(32, 40, title, 20, INK, bold=True, anchor="start"))
        if subtitle:
            self.front.append(self._text(32, 62, subtitle, 13, INK2, anchor="start"))

    # ---------- primitives
    @staticmethod
    def _text(x, y, s, size=13, fill=INK, bold=False, anchor="middle", italic=False):
        weight = "600" if bold else "400"
        style = ' font-style="italic"' if italic else ""
        return (
            f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" '
            f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{style}>{escape(s)}</text>'
        )

    def text(self, x, y, s, size=13, fill=INK, bold=False, anchor="middle", italic=False):
        self.front.append(self._text(x, y, s, size, fill, bold, anchor, italic))

    def _lines(self, cx, cy, lines, size=13, first_bold=True, fill=INK, gap=1.35, anchor="middle", x=None):
        lh = size * gap
        top = cy - (len(lines) - 1) * lh / 2 + size * 0.35
        out = []
        for i, ln in enumerate(lines):
            b = first_bold and i == 0
            f = fill if (i == 0 or not first_bold) else INK2
            sz = size if (i == 0 or not first_bold) else size - 1.5
            out.append(self._text(x if x is not None else cx, top + i * lh, ln, sz, f, b, anchor))
        return "".join(out)

    # ---------- shapes
    def node(self, nid, x, y, w, h, label, kind="box", color="blue", size=13, first_bold=True, dashed=False):
        n = Node(x, y, w, h)
        self.nodes[nid] = n
        lines = label if isinstance(label, list) else label.split("\n")
        dash = ' stroke-dasharray="6 4"' if dashed else ""
        fill, st = tint(color), stroke(color)
        if kind == "box":
            self.mid.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{fill}" stroke="{st}" stroke-width="1.4"{dash}/>')
        elif kind == "plain":
            self.mid.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#FFFFFF" stroke="{BORDER}" stroke-width="1.4"{dash}/>')
        elif kind == "ext":  # DFD external entity / context external system
            self.mid.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" fill="#FFFFFF" stroke="{INK}" stroke-width="1.6"{dash}/>')
        elif kind == "process":  # DFD process: stadium
            self.mid.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{min(h, w) / 2}" fill="{fill}" stroke="{st}" stroke-width="1.6"{dash}/>')
        elif kind == "store":  # DFD data store: open-ended with id cell
            self.mid.append(
                f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}"/>'
                f'<path d="M{x + w} {y} H{x} V{y + h} H{x + w}" fill="none" stroke="{st}" stroke-width="1.6"/>'
                f'<line x1="{x + 44}" y1="{y}" x2="{x + 44}" y2="{y + h}" stroke="{st}" stroke-width="1.2"/>'
            )
            sid, rest = lines[0], lines[1:]
            self.mid.append(self._text(x + 22, y + h / 2 + 4.5, sid, 12, st, True))
            self.mid.append(self._lines(x + 44 + (w - 44) / 2, y + h / 2, rest, size, first_bold, INK))
            return n
        elif kind == "db":
            e = 10
            self.mid.append(
                f'<path d="M{x} {y + e} A{w / 2} {e} 0 0 1 {x + w} {y + e} V{y + h - e} A{w / 2} {e} 0 0 1 {x} {y + h - e} Z" fill="{fill}" stroke="{st}" stroke-width="1.4"/>'
                f'<path d="M{x} {y + e} A{w / 2} {e} 0 0 0 {x + w} {y + e}" fill="none" stroke="{st}" stroke-width="1.4"/>'
            )
            self.mid.append(self._lines(x + w / 2, y + h / 2 + e / 2, lines, size, first_bold))
            return n
        elif kind == "actor":
            hx = x + w / 2
            self.mid.append(
                f'<circle cx="{hx}" cy="{y + 14}" r="11" fill="{fill}" stroke="{st}" stroke-width="1.6"/>'
                f'<path d="M{hx - 22} {y + 52} Q{hx - 22} {y + 28} {hx} {y + 28} Q{hx + 22} {y + 28} {hx + 22} {y + 52} Z" fill="{fill}" stroke="{st}" stroke-width="1.6"/>'
            )
            self.mid.append(self._lines(hx, y + 52 + (h - 52) / 2, lines, size, first_bold))
            return n
        self.mid.append(self._lines(x + w / 2, y + h / 2, lines, size, first_bold))
        return n

    def group(self, x, y, w, h, label, color="grey", dashed=True, sub=None):
        dash = ' stroke-dasharray="7 5"' if dashed else ""
        self.back.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{_mix(BASE[color], 0.94)}" stroke="{stroke(color)}" stroke-width="1.3"{dash}/>'
        )
        self.back.append(self._text(x + 18, y + 26, label, 14, stroke(color), True, "start"))
        if sub:
            self.back.append(self._text(x + 18, y + 44, sub, 11.5, INK2, False, "start"))

    def chip(self, x, y, label, color="blue", size=11.5):
        w = tw(label, size) + 18
        self.front.append(
            f'<rect x="{x}" y="{y}" width="{w:.1f}" height="22" rx="11" fill="{tint(color, .7)}"/>'
            + self._text(x + w / 2, y + 15, label, size, INK, False)
        )
        return w

    # ---------- edges
    def _anchor(self, n: Node, side, other_pt):
        if side is None:
            return n.clip(*other_pt)
        if isinstance(side, tuple):
            return n.side(*side)
        return n.side(side)

    def edge(self, a, b, label=None, via=None, sa=None, sb=None, dashed=False, both=False,
             lpos=0.5, ldx=0, ldy=0, color=INK2, start=None, end="arrow", lsize=11.5, width=1.4):
        na, nb = self.nodes[a], self.nodes[b]
        via = via or []
        first_target = via[0] if via else (nb.cx, nb.cy)
        last_source = via[-1] if via else (na.cx, na.cy)
        p0 = self._anchor(na, sa, first_target)
        p1 = self._anchor(nb, sb, last_source)
        pts = [p0, *via, p1]
        self.path(pts, label, dashed, both, lpos, ldx, ldy, color, start, end, lsize, width)

    def path(self, pts, label=None, dashed=False, both=False, lpos=0.5, ldx=0, ldy=0,
             color=INK2, start=None, end="arrow", lsize=11.5, width=1.4):
        d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
        dash = ' stroke-dasharray="6 4"' if dashed else ""
        ms = f' marker-start="url(#{start or "arrow"})"' if (both or start) else ""
        me = f' marker-end="url(#{end})"' if end else ""
        self.mid.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}"{dash}{ms}{me}/>')
        if label:
            lx, ly = self._along(pts, lpos)
            self.label(lx + ldx, ly + ldy, label, lsize)

    def label(self, x, y, s, size=11.5, fill=INK2, bg="#FFFFFF"):
        lines = s.split("\n")
        w = max(tw(ln, size) for ln in lines) + 10
        h = len(lines) * size * 1.3 + 4
        self.front.append(f'<rect x="{x - w / 2:.1f}" y="{y - h / 2:.1f}" width="{w:.1f}" height="{h:.1f}" rx="5" fill="{bg}" fill-opacity="0.94"/>')
        self.front.append(self._lines(x, y, lines, size, False, fill, 1.3))

    @staticmethod
    def _along(pts, f):
        segs = [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
        lens = [math.dist(p, q) for p, q in segs]
        target = sum(lens) * f
        for (p, q), ln in zip(segs, lens):
            if target <= ln and ln > 0:
                t = target / ln
                return p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t
            target -= ln
        return pts[-1]

    # ---------- output
    def svg(self) -> str:
        defs = f"""<defs>
<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="{INK2}"/></marker>
<marker id="open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="none" stroke="{INK2}" stroke-width="1.4"/></marker>
<marker id="tri" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="13" markerHeight="13" orient="auto-start-reverse"><path d="M0 0 L12 6 L0 12 z" fill="#FFFFFF" stroke="{INK2}" stroke-width="1.2"/></marker>
<marker id="diamond" viewBox="0 0 16 10" refX="15" refY="5" markerWidth="16" markerHeight="10" orient="auto-start-reverse"><path d="M1 5 L8 1 L15 5 L8 9 z" fill="{INK2}"/></marker>
<marker id="odiamond" viewBox="0 0 16 10" refX="15" refY="5" markerWidth="16" markerHeight="10" orient="auto-start-reverse"><path d="M1 5 L8 1 L15 5 L8 9 z" fill="#FFFFFF" stroke="{INK2}" stroke-width="1.2"/></marker>
<marker id="crow" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M13 0 L1 7 L13 14 M1 0 V14" fill="none" stroke="{INK2}" stroke-width="1.3"/></marker>
<marker id="one" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M6 0 V14 M10 0 V14" fill="none" stroke="{INK2}" stroke-width="1.3"/></marker>
</defs>"""
        body = "".join(self.back + self.mid + self.front)
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
            f'{defs}<rect width="{self.w}" height="{self.h}" fill="#FFFFFF"/>{body}</svg>'
        )


# ---------------------------------------------------------------- sequence
def sequence(title, subtitle, participants, steps, col_min=150, row=40, width_pad=40):
    """participants: [(id, label, color)], steps: tuples
    ('m', a, b, text[, 'r'])  message ('r' = dashed return)
    ('note', a, b, text)      note spanning lifelines a..b
    ('alt'|'opt'|'loop', label) / ('else', label) / ('end',)
    """
    cols = []
    x = 50
    widths = []
    for _, label, _c in participants:
        lw = max(tw(ln, 13, True) for ln in label.split("\n")) + 28
        widths.append(max(col_min, lw))
    # widen columns so messages fit between neighbours
    idx = {p[0]: i for i, p in enumerate(participants)}
    gaps = [0.0] * len(participants)
    for s in steps:
        if s[0] == "m" and s[1] != s[2]:
            i, j = sorted((idx[s[1]], idx[s[2]]))
            need = max(tw(ln, 11.5) for ln in s[3].split("\n")) + 30
            span = j - i
            for k in range(i, j):
                gaps[k] = max(gaps[k], need / span)
    centers = []
    for i, w in enumerate(widths):
        if i == 0:
            cx = x + w / 2
        else:
            cx = max(centers[-1] + widths[i - 1] / 2 + w / 2 + 24, centers[-1] + gaps[i - 1])
        centers.append(cx)
    total_w = int(centers[-1] + widths[-1] / 2 + 50)

    # rows
    y = 110
    head_h = 52
    ops = []
    y += head_h + 26
    frames = []
    for s in steps:
        k = s[0]
        if k == "m":
            n_lines = len(s[3].split("\n"))
            extra = (n_lines - 1) * 15
            if s[1] == s[2]:
                ops.append(("self", y + extra, s))
                y += row + 22 + extra
            else:
                ops.append(("m", y + extra, s))
                y += row + extra
        elif k == "note":
            i, j = sorted((idx[s[1]], idx[s[2]]))
            w = max(centers[j] - centers[i] + 120, 220)
            lines = wrap(s[3], w - 24, 12)
            h = len(lines) * 16 + 14
            ops.append(("note", y - 14, s, lines, h, w))
            y += h + 14
        elif k in ("alt", "opt", "loop", "par"):
            frames.append([k, s[1], y - 22, []])
            y += 26
        elif k == "else":
            frames[-1][3].append((y - 16, s[1]))
            y += 26
        elif k == "end":
            f = frames.pop()
            ops.append(("frame", f, y - 8, len(frames)))
            y += 18
    height = int(y + 40)
    d = Diagram(total_w, height, title, subtitle)
    for (pid, label, color), cx, w in zip(participants, centers, widths):
        d.node(pid, cx - w / 2, 92, w, head_h, label, "box", color, 13)
        d.back.append(f'<line x1="{cx}" y1="{92 + head_h}" x2="{cx}" y2="{height - 24}" stroke="{BORDER}" stroke-width="1.5" stroke-dasharray="5 5"/>')
    for op in ops:
        if op[0] == "m":
            _, yy, s = op
            a, b = centers[idx[s[1]]], centers[idx[s[2]]]
            ret = len(s) > 4 and s[4] == "r"
            dash = ' stroke-dasharray="6 4"' if ret else ""
            mk = "open" if ret else "arrow"
            d.mid.append(f'<line x1="{a}" y1="{yy}" x2="{b - (6 if b > a else -6)}" y2="{yy}" stroke="{INK2}" stroke-width="1.4"{dash} marker-end="url(#{mk})"/>')
            lines = s[3].split("\n")
            for i, ln in enumerate(lines):
                d.text((a + b) / 2, yy - 7 - (len(lines) - 1 - i) * 15, ln, 11.5, INK if not ret else INK2)
        elif op[0] == "self":
            _, yy, s = op
            a = centers[idx[s[1]]]
            d.mid.append(f'<path d="M{a} {yy - 8} H{a + 34} V{yy + 14} H{a + 6}" fill="none" stroke="{INK2}" stroke-width="1.4" marker-end="url(#arrow)"/>')
            lines = s[3].split("\n")
            for i, ln in enumerate(lines):
                d.text(a + 42, yy - 4 + i * 15 - (len(lines) - 1) * 15 + 6, ln, 11.5, INK, anchor="start")
        elif op[0] == "note":
            _, yy, s, lines, h, w = op
            i, j = sorted((idx[s[1]], idx[s[2]]))
            cx = (centers[i] + centers[j]) / 2
            d.front.append(f'<rect x="{cx - w / 2}" y="{yy}" width="{w}" height="{h}" rx="8" fill="{tint("yellow", .82)}" stroke="{stroke("yellow")}" stroke-width="1"/>')
            for k2, ln in enumerate(lines):
                d.front.append(Diagram._text(cx, yy + 19 + k2 * 16, ln, 12, INK))
        elif op[0] == "frame":
            (kind, label, y0, elses), y1, depth = op[1], op[2], op[3]
            x0 = 24 + depth * 10
            x1 = total_w - 24 - depth * 10
            d.back.append(f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" rx="8" fill="none" stroke="{stroke("mauve")}" stroke-width="1.2"/>')
            tag = f"{kind} [{label}]"
            tw_ = tw(tag, 11.5, True) + 16
            d.back.append(f'<path d="M{x0} {y0} H{x0 + tw_} V{y0 + 14} L{x0 + tw_ - 8} {y0 + 22} H{x0} Z" fill="{tint("mauve", .75)}"/>')
            d.back.append(Diagram._text(x0 + 8, y0 + 15, tag, 11.5, INK, True, "start"))
            for ey, el in elses:
                d.back.append(f'<line x1="{x0}" y1="{ey}" x2="{x1}" y2="{ey}" stroke="{stroke("mauve")}" stroke-dasharray="6 4"/>')
                d.back.append(Diagram._text(x0 + 10, ey + 15, f"[{el}]", 11.5, INK2, True, "start"))
    return d


# ---------------------------------------------------------------- UML class / ERD boxes
def class_box(d: Diagram, cid, x, y, name, attrs, methods=(), stereo=None, color="blue", w=None, size=12):
    lh = size * 1.45
    head_lines = ([f"«{stereo}»"] if stereo else []) + [name]
    widths = [tw(name, 14, True)] + [tw(a, size) for a in [*attrs, *methods]]
    if stereo:
        widths.append(tw(f"«{stereo}»", 11))
    w = w or int(max(widths) + 26)
    head_h = 14 + len(head_lines) * 18
    attr_h = max(1, len(attrs)) * lh + 10
    meth_h = (len(methods) * lh + 10) if methods else 0
    h = head_h + attr_h + meth_h
    n = Node(x, y, w, h)
    d.nodes[cid] = n
    st = stroke(color)
    d.mid.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#FFFFFF" stroke="{st}" stroke-width="1.4"/>')
    d.mid.append(f'<path d="M{x} {y + head_h} V{y + 10} Q{x} {y} {x + 10} {y} H{x + w - 10} Q{x + w} {y} {x + w} {y + 10} V{y + head_h} Z" fill="{tint(color, .78)}" stroke="{st}" stroke-width="1.4"/>')
    ty = y + 24
    if stereo:
        d.mid.append(Diagram._text(x + w / 2, ty - 2, f"«{stereo}»", 11, INK2, False, italic=True))
        ty += 18
    d.mid.append(Diagram._text(x + w / 2, ty, name, 14, INK, True))
    yy = y + head_h + 6 + size
    for a in attrs:
        d.mid.append(Diagram._text(x + 12, yy, a, size, INK, False, "start"))
        yy += lh
    if methods:
        sep = y + head_h + attr_h
        d.mid.append(f'<line x1="{x}" y1="{sep}" x2="{x + w}" y2="{sep}" stroke="{st}" stroke-width="1"/>')
        yy = sep + 6 + size
        for m in methods:
            d.mid.append(Diagram._text(x + 12, yy, m, size, INK2, False, "start"))
            yy += lh
    return n


def table_box(d: Diagram, tid, x, y, name, cols, color="blue", w=None, size=11.5):
    """cols: list of (name, type, flag) flag in {'PK','FK','UK',''}"""
    lh = size * 1.5
    w = w or int(max([tw(name, 13.5, True) + 30] + [tw(c[0], size) + tw(c[1], size) + 62 for c in cols]))
    head_h = 30
    h = head_h + len(cols) * lh + 10
    n = Node(x, y, w, h)
    d.nodes[tid] = n
    st = stroke(color)
    d.mid.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="#FFFFFF" stroke="{st}" stroke-width="1.3"/>')
    d.mid.append(f'<path d="M{x} {y + head_h} V{y + 9} Q{x} {y} {x + 9} {y} H{x + w - 9} Q{x + w} {y} {x + w} {y + 9} V{y + head_h} Z" fill="{tint(color, .75)}" stroke="{st}" stroke-width="1.3"/>')
    d.mid.append(Diagram._text(x + w / 2, y + 20, name, 13.5, INK, True))
    yy = y + head_h + 4 + size
    for cname, ctype, flag in cols:
        if flag:
            fc = {"PK": stroke("yellow"), "FK": stroke("blue"), "UK": stroke("sage")}.get(flag, INK2)
            d.mid.append(Diagram._text(x + 10, yy, flag, 9.5, fc, True, "start"))
        d.mid.append(Diagram._text(x + 34, yy, cname, size, INK, flag == "PK", "start"))
        d.mid.append(Diagram._text(x + w - 10, yy, ctype, size - 1, INK2, False, "end"))
        yy += lh
    return n


# ---------------------------------------------------------------- render
def find_browser() -> str | None:
    for p in (
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        shutil.which("chrome") or "",
        shutil.which("google-chrome") or "",
        shutil.which("chromium") or "",
    ):
        if p and os.path.exists(p):
            return p
    return None


def render(d: Diagram, out_dir: str, name: str, png: bool = True):
    os.makedirs(out_dir, exist_ok=True)
    svg_path = os.path.join(out_dir, f"{name}.svg")
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(d.svg())
    if not png:
        return
    browser = find_browser()
    if not browser:
        print("  (no Chrome/Edge found; SVG only)")
        return
    with tempfile.TemporaryDirectory() as tmp:
        html = os.path.join(tmp, "d.html")
        with open(html, "w", encoding="utf-8") as f:
            f.write(f'<html><body style="margin:0;background:#fff">{d.svg()}</body></html>')
        subprocess.run(
            [browser, "--headless=new", "--disable-gpu", "--hide-scrollbars",
             f"--user-data-dir={os.path.join(tmp, 'prof')}", "--force-device-scale-factor=2",
             f"--window-size={d.w},{d.h}", f"--screenshot={os.path.join(out_dir, name + '.png')}",
             "file:///" + html.replace(os.sep, "/")],
            check=True, capture_output=True, timeout=120,
        )
