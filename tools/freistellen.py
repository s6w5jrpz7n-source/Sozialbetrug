#!/usr/bin/env python3
"""Stellt Gebaeude-Grafiken frei: weisser/hellgrauer Hintergrund + Schatten
werden transparent. Per Flood-Fill von den Bildraendern, damit helle
GEBAEUDE-Innenflaechen (Bank, Arbeitsamt) erhalten bleiben.
"""
import sys
from collections import deque
from PIL import Image

def freistellen(src, dst, lum_thresh=140, sat_thresh=16, white_thresh=205,
                feather=True):
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    px = img.load()

    def is_bg(r, g, b):
        # neutral-hell (weiss ODER grauer Schatten) -> Hintergrund
        mx, mn = max(r, g, b), min(r, g, b)
        return mx >= lum_thresh and (mx - mn) <= sat_thresh

    bg = bytearray(w * h)          # 1 = Hintergrund
    seen = bytearray(w * h)
    dq = deque()

    # Startpunkte: alle Randpixel, die als Hintergrund gelten
    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if not seen[i]:
                seen[i] = 1
                r, g, b, _ = px[x, y]
                if is_bg(r, g, b):
                    bg[i] = 1; dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if not seen[i]:
                seen[i] = 1
                r, g, b, _ = px[x, y]
                if is_bg(r, g, b):
                    bg[i] = 1; dq.append((x, y))

    while dq:
        x, y = dq.popleft()
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x+dx, y+dy
            if 0 <= nx < w and 0 <= ny < h:
                ni = ny*w + nx
                if not seen[ni]:
                    seen[ni] = 1
                    r, g, b, _ = px[nx, ny]
                    if is_bg(r, g, b):
                        bg[ni] = 1; dq.append((nx, ny))

    # Hintergrund verarbeiten:
    #  - sehr hell (weiss)  -> voll transparent
    #  - grauer Schatten    -> halbtransparentes Schwarz (echter Schatten)
    for y in range(h):
        for x in range(w):
            if bg[y*w + x]:
                r, g, b, _ = px[x, y]
                mx = max(r, g, b)
                if mx >= white_thresh:
                    px[x, y] = (0, 0, 0, 0)
                else:
                    # je dunkler der Schatten, desto deckender (max ~110)
                    a = int(min(110, (white_thresh - mx) * 1.4))
                    px[x, y] = (0, 0, 0, a)

    # Weiche Kante: Vordergrund-Pixel, die an Hintergrund grenzen,
    # bekommen je nach Helligkeit etwas Teiltransparenz (Anti-Aliasing).
    if feather:
        for y in range(h):
            for x in range(w):
                i = y*w + x
                if bg[i]:
                    continue
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                rand = any(0 <= x+dx < w and 0 <= y+dy < h and bg[(y+dy)*w + (x+dx)]
                           for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)))
                if rand:
                    mx = max(r, g, b)
                    if mx >= lum_thresh - 20:
                        px[x, y] = (r, g, b, 150)

    # Auf den tatsaechlichen Inhalt zuschneiden (transparenter Rand weg)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.save(dst)
    print(f"OK  {src} -> {dst}  ({img.size[0]}x{img.size[1]})")

if __name__ == "__main__":
    freistellen(sys.argv[1], sys.argv[2])
