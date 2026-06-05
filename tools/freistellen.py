#!/usr/bin/env python3
"""Stellt Gebaeude-Grafiken frei (Hintergrund -> transparent).

Zwei Modi:
  neutral  : Hintergrund ist weiss; grauer Schatten wird halbtransparent.
             Gut fuer die meisten Gebaeude.
  colorkey : Hintergrund wird anhand der ECKFARBE bestimmt und entfernt.
             Gut fuer graue Hintergruende (Supermarkt) und helle Gebaeude
             mit hellem Dach (Arbeitsamt-Turm), die 'neutral' beschaedigen wuerde.

Per Flood-Fill von den Bildraendern, damit Innenflaechen des Gebaeudes
erhalten bleiben.
"""
import sys
from collections import deque
from PIL import Image


def _flood(img, is_bg):
    w, h = img.size
    px = img.load()
    bg = bytearray(w * h)
    seen = bytearray(w * h)
    dq = deque()

    def push(x, y):
        i = y * w + x
        if not seen[i]:
            seen[i] = 1
            r, g, b, _ = px[x, y]
            if is_bg(r, g, b):
                bg[i] = 1
                dq.append((x, y))

    for x in range(w):
        push(x, 0); push(x, h - 1)
    for y in range(h):
        push(0, y); push(w - 1, y)

    while dq:
        x, y = dq.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                push(nx, ny)
    return bg, px, w, h


def freistellen(src, dst, mode="neutral",
                lum_thresh=140, sat_thresh=16, white_thresh=205,
                tol=55, feather=True):
    img = Image.open(src).convert("RGBA")

    if mode == "colorkey":
        # Hintergrundfarbe aus den vier Ecken mitteln
        w, h = img.size
        px0 = img.load()
        corners = [px0[0, 0], px0[w - 1, 0], px0[0, h - 1], px0[w - 1, h - 1]]
        br = sum(c[0] for c in corners) / 4
        bgc = sum(c[1] for c in corners) / 4
        bb = sum(c[2] for c in corners) / 4

        def is_bg(r, g, b):
            return abs(r - br) + abs(g - bgc) + abs(b - bb) <= tol
    else:
        def is_bg(r, g, b):
            mx, mn = max(r, g, b), min(r, g, b)
            return mx >= lum_thresh and (mx - mn) <= sat_thresh

    bg, px, w, h = _flood(img, is_bg)

    for y in range(h):
        for x in range(w):
            if bg[y * w + x]:
                r, g, b, _ = px[x, y]
                mx = max(r, g, b)
                if mode == "colorkey" or mx >= white_thresh:
                    px[x, y] = (0, 0, 0, 0)            # voll transparent
                else:
                    a = int(min(110, (white_thresh - mx) * 1.4))
                    px[x, y] = (0, 0, 0, a)            # weicher Schatten

    if feather:
        for y in range(h):
            for x in range(w):
                i = y * w + x
                if bg[i]:
                    continue
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                rand = any(0 <= x + dx < w and 0 <= y + dy < h and bg[(y + dy) * w + (x + dx)]
                           for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if rand and max(r, g, b) >= lum_thresh - 20:
                    px[x, y] = (r, g, b, 150)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.save(dst)
    print(f"OK [{mode:8s}] {src.split('/')[-1]:22s} -> {img.size[0]}x{img.size[1]}")


def deshadow(path, top_guard=0.42, sat=18, lo=150, hi=225):
    """Entfernt einen grauen Schlagschatten, der nach 'colorkey' bei hellen
    Gebaeuden (z.B. Bank) uebrig bleibt. Schaelt den Schatten NUR von unten
    her ab (obere top_guard% = Dach bleiben tabu), damit helle Daecher
    unangetastet bleiben."""
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()
    guard = int(h * top_guard)

    def shadowish(r, g, b):
        mx, mn = max(r, g, b), min(r, g, b)
        return (mx - mn) <= sat and lo <= mx <= hi

    seen = bytearray(w * h)
    dq = deque()
    for y in range(guard, h):
        for x in (0, w - 1):
            if px[x, y][3] == 0 and not seen[y*w+x]:
                seen[y*w+x] = 1; dq.append((x, y))
    for x in range(w):
        if px[x, h-1][3] == 0 and not seen[(h-1)*w+x]:
            seen[(h-1)*w+x] = 1; dq.append((x, h-1))

    while dq:
        x, y = dq.popleft()
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x+dx, y+dy
            if 0 <= nx < w and guard <= ny < h and not seen[ny*w+nx]:
                r, g, b, a = px[nx, ny]
                if a == 0:
                    seen[ny*w+nx] = 1; dq.append((nx, ny))
                elif shadowish(r, g, b):
                    seen[ny*w+nx] = 1; px[nx, ny] = (r, g, b, 0); dq.append((nx, ny))

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.save(path)
    print(f"   deshadow {path.split('/')[-1]} -> {img.size[0]}x{img.size[1]}")


def loecher(path, thresh=235):
    """Entfernt EINGESCHLOSSENE reinweisse Flaechen, die der randbasierte
    Flood-Fill nicht erreicht (z.B. Himmel zwischen den Kran-Streben).
    Hoher Schwellwert -> helle Gebaeudeteile bleiben erhalten."""
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()
    rem = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and min(r, g, b) >= thresh:
                px[x, y] = (r, g, b, 0); rem += 1
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.save(path)
    print(f"   loecher {path.split('/')[-1]}: {rem} px -> {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    mode = sys.argv[3] if len(sys.argv) > 3 else "neutral"
    freistellen(sys.argv[1], sys.argv[2], mode=mode)
    # Weitere Argumente (Reihenfolge egal): 'deshadow', 'loecher'
    flags = sys.argv[4:]
    if "loecher" in flags:
        loecher(sys.argv[2])
    if "deshadow" in flags:
        deshadow(sys.argv[2])
