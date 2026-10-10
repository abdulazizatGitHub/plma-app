"""Compile the v2 docs + diagrams into docs/Life-v2-Design-Pack.pdf.

Run: python docs/build_pack.py   (needs Python 3 with `markdown`, and Chrome or Edge)
Regenerate diagrams first if they changed: python docs/architecture/diagrams/src/diagrams.py
"""

from __future__ import annotations

import datetime as dt
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import markdown

DOCS = Path(__file__).resolve().parent
sys.path.insert(0, str(DOCS / "architecture" / "diagrams" / "src"))
from svgkit import find_browser  # noqa: E402

ORDER = [
    ("requirements/REQUIREMENTS_V2.md", "Requirements reconciliation"),
    ("product/PRD.md", "Product requirements (PRD)"),
    ("architecture/SYSTEM_DESIGN.md", "System design"),
    ("design/DESIGN_SYSTEM_V2.md", "Design system v2"),
    ("plan/DEVELOPMENT_PLAN.md", "Development plan"),
] + [(f"phases/v2/{p}", None) for p in sorted(os.listdir(DOCS / "phases" / "v2")) if p.startswith("phase-")]

DIAGRAMS = [
    ("system-context", "System context"),
    ("system-architecture", "System architecture"),
    ("dfd-level0", "Data flow — level 0"),
    ("dfd-level1", "Data flow — level 1"),
    ("seq-open-today", "Sequence — building Today"),
    ("seq-prayer-offline", "Sequence — one-tap prayer, offline first"),
    ("seq-move-skip", "Sequence — move, skip, pending"),
    ("seq-reminder-escalation", "Sequence — reminder escalation"),
    ("seq-group-goal", "Sequence — group goal and leaderboard"),
    ("class-core", "Class diagram — core"),
    ("class-engagement", "Class diagram — rewards and social"),
    ("erd-core", "ERD — core"),
    ("erd-engagement", "ERD — rewards and social"),
    ("screen-map", "Screen map"),
    ("roadmap", "Roadmap"),
    ("palette", "Palette"),
]

CSS = """
@page { size: A4; margin: 16mm 14mm; }
@page landscape { size: A4 landscape; margin: 10mm; }
body { font-family: 'Segoe UI', Poppins, Arial, sans-serif; color: #1B1A22; font-size: 10.5pt; line-height: 1.5; }
h1 { font-size: 20pt; margin: 0 0 6pt; } h2 { font-size: 14pt; margin: 16pt 0 6pt; border-bottom: 1px solid #DBDCE3; padding-bottom: 3pt; }
h3 { font-size: 12pt; margin: 12pt 0 4pt; } p, li { margin: 3pt 0; }
a { color: #4766D0; text-decoration: none; }
code { font-family: Consolas, monospace; font-size: 9pt; background: #F4F4F9; padding: 0 3px; border-radius: 3px; }
pre { background: #F4F4F9; padding: 8pt; border-radius: 8px; font-size: 8.5pt; white-space: pre-wrap; page-break-inside: avoid; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0; font-size: 9pt; page-break-inside: auto; }
th, td { border: 1px solid #DBDCE3; padding: 3pt 5pt; vertical-align: top; text-align: left; }
th { background: #F4F4F9; } tr { page-break-inside: avoid; }
img { max-width: 100%; display: block; margin: 8pt auto; page-break-inside: avoid; }
blockquote { margin: 6pt 0; padding: 4pt 10pt; border-left: 3px solid #D7CCEA; color: #64656C; }
.doc { page-break-before: always; }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; }
.cover h1 { font-size: 34pt; } .cover p { color: #64656C; font-size: 12pt; }
.toc li { font-size: 11pt; margin: 4pt 0; }
.diagram { page: landscape; page-break-before: always; text-align: center; }
.diagram h2 { border: none; text-align: left; }
.diagram img { max-height: 170mm; width: auto; }
"""


def render_doc(rel: str) -> str:
    path = DOCS / rel
    text = path.read_text(encoding="utf-8")
    html = markdown.markdown(text, extensions=["tables", "fenced_code", "sane_lists"])

    def fix_src(m: re.Match) -> str:
        src = m.group(1)
        if src.startswith(("http:", "https:", "file:")):
            return m.group(0)
        target = (path.parent / src).resolve()
        if target.suffix == ".png" and target.with_suffix(".svg").exists():
            target = target.with_suffix(".svg")  # vector in print
        return f'src="{target.as_uri()}"'

    return re.sub(r'src="([^"]+)"', fix_src, html)


def main():
    today = dt.date.today().isoformat()
    def title_of(rel: str, t: str | None) -> str:
        if t:
            return t
        first = (DOCS / rel).read_text(encoding="utf-8").splitlines()[0]
        return first.lstrip("# ").strip()

    toc = "".join(f"<li>{title_of(rel, t)}</li>" for rel, t in ORDER)
    parts = [f"""<section class="cover"><h1>Life v2 — Design pack</h1>
<p>Requirements reconciliation · PRD · System design · Diagrams · Design system · Development plan</p>
<p>Generated {today} from <code>docs/</code> on branch <code>v2</code>.</p>
<h2>Contents</h2><ol class="toc">{toc}<li>Appendix — all diagrams (landscape)</li></ol></section>"""]
    for rel, _ in ORDER:
        parts.append(f'<section class="doc">{render_doc(rel)}</section>')
    for name, title in DIAGRAMS:
        svg = DOCS / "architecture" / "diagrams" / f"{name}.svg"
        parts.append(f'<section class="diagram"><h2>{title}</h2><img src="{svg.as_uri()}"></section>')
    html = f'<!doctype html><html><head><meta charset="utf-8"><title>Life v2 — Design pack</title><style>{CSS}</style></head><body>{"".join(parts)}</body></html>'

    browser = find_browser()
    if not browser:
        sys.exit("Chrome or Edge not found")
    out = DOCS / "Life-v2-Design-Pack.pdf"
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "pack.html"
        page.write_text(html, encoding="utf-8")
        subprocess.run(
            [browser, "--headless=new", "--disable-gpu", f"--user-data-dir={Path(tmp) / 'prof'}",
             "--no-pdf-header-footer", "--allow-file-access-from-files",
             f"--print-to-pdf={out}", page.as_uri()],
            check=True, capture_output=True, timeout=180,
        )
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
