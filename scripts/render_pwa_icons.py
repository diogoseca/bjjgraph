#!/usr/bin/env python3
"""Maintainer-only: render checked-in install PNGs from branding/icon.svg.

Requires rsvg-convert (librsvg); normal builds just copy the committed PNGs. Keep
the original graph geometry/colours. Replace the rounded transparent background
with the app's full-bleed background. The maskable variant scales the mark about
the centre; even the node glows fit inside the spec's radius-40% safe circle.
https://w3c.github.io/manifest/#icon-masks
"""
import copy
import math
import subprocess
import tempfile
import xml.etree.ElementTree as ET

from _pwa import INPUT, ROOT, manifest

SVG = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG)
source = ET.parse(ROOT / "branding/icon.svg").getroot()
for size, scale, name in [(192, 1, "icon-192.png"), (512, 1, "icon-512.png"), (512, 0.82, "icon-maskable-512.png")]:
    svg = copy.deepcopy(source)
    background = svg.find(f"{{{SVG}}}rect")
    background.set("fill", manifest()["background_color"])
    background.attrib.pop("rx", None)
    mark = ET.SubElement(svg, f"{{{SVG}}}g", {"transform": f"translate({100*(1-scale)} {100*(1-scale)}) scale({scale})"})
    for group in list(svg.findall(f"{{{SVG}}}g")):
        if group is not mark:
            svg.remove(group)
            mark.append(group)
    if scale < 1:
        for node in mark.iter(f"{{{SVG}}}circle"):
            extent = math.hypot(float(node.get("cx"))-100, float(node.get("cy"))-100) + float(node.get("r")) + 6
            if extent * scale >= 80:
                raise ValueError("Essential mark exceeds the maskable safe circle")
    destination = INPUT / "icons" / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".svg") as temporary:
        ET.ElementTree(svg).write(temporary, encoding="utf-8")
        temporary.flush()
        subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(destination), temporary.name], check=True)
    print(destination.relative_to(ROOT))
