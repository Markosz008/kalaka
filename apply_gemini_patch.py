#!/usr/bin/env python3
"""
Tűrő patch-alkalmazó Gemini diffjeihez.

Használat (a projekt gyökeréből):
  python3 apply_gemini_patch.py ~/Downloads/gemini-code-XXXX.sh          # csak ELLENŐRZÉS, nem ír semmit
  python3 apply_gemini_patch.py ~/Downloads/gemini-code-XXXX.sh --write  # tényleges alkalmazás

Miért jobb a git apply-nál:
- a @@ sorszámokat csak tippnek veszi, a kontextus SZÖVEGÉT keresi a fájlban
- a szóközök/tabok különbségét figyelmen kívül hagyja
- hunkonként megmondja, ha valami nem talál, és megmutatja a legközelebbi találatot
- mindent vagy semmit: ha bármelyik hunk bukik, egy fájlt sem módosít
- a heredoc utáni parancsot (pl. ./ship.sh) NEM futtatja le
"""
import re, sys, os, difflib

def norm(s):
    return re.sub(r"\s+", " ", s.strip())

def extract_patch(text):
    lines = text.splitlines()
    start = None
    for i, l in enumerate(lines):
        if re.search(r"<<\s*['\"]?EOF['\"]?", l):
            start = i + 1
            break
    if start is None:
        return lines
    end = None
    for i in range(len(lines) - 1, start - 1, -1):
        if lines[i].strip() == "EOF":
            end = i
            break
    return lines[start:end if end is not None else len(lines)]

def parse(lines):
    files, cur, hunk = [], None, None
    i = 0
    while i < len(lines):
        l = lines[i]
        if l.startswith("--- ") and i + 1 < len(lines) and lines[i + 1].startswith("+++ "):
            path = lines[i + 1][4:].strip()
            path = re.sub(r"^b/", "", path)
            cur = {"path": path, "hunks": []}
            files.append(cur)
            hunk = None
            i += 2
            continue
        m = re.match(r"@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@", l)
        if m and cur is not None:
            hunk = {"pos": int(m.group(1)), "entries": []}
            cur["hunks"].append(hunk)
        elif hunk is not None:
            if l.startswith("\\"):
                pass
            elif l.startswith("+"):
                hunk["entries"].append(("+", l[1:]))
            elif l.startswith("-"):
                hunk["entries"].append(("-", l[1:]))
            elif l.startswith(" "):
                hunk["entries"].append((" ", l[1:]))
            elif l == "":
                hunk["entries"].append((" ", ""))
        i += 1
    return files

def find_all(file_lines, pattern, start_min):
    n, k = len(file_lines), len(pattern)
    out = []
    if k == 0:
        return out
    fn = [norm(x) for x in file_lines]
    pn = [norm(x) for x in pattern]
    for i in range(start_min, n - k + 1):
        if fn[i:i + k] == pn:
            out.append(i)
    return out

def best_partial(file_lines, pattern):
    fn = [norm(x) for x in file_lines]
    pn = [norm(x) for x in pattern]
    best, bi = -1, 0
    for i in range(0, max(1, len(fn) - len(pn) + 1)):
        score = sum(1 for a, b in zip(fn[i:i + len(pn)], pn) if a == b)
        if score > best:
            best, bi = score, i
    return bi, best

def apply_hunk(file_lines, hunk, delta, min_pos):
    entries = hunk["entries"]
    # már alkalmazva? (előbb ezt nézzük, különben a tisztán hozzáadó hunkok kétszer mennének fel)
    newp = [t for k, t in entries if k in (" ", "+")]
    if any(k in "+-" for k, _ in entries) and find_all(file_lines, newp, 0):
        return file_lines, None, 0, 0, "already"
    for fuzz in (0, 1, 2):
        ents = list(entries)
        # fuzz: a szélső környezeti sorok elhagyása
        for _ in range(fuzz):
            if ents and ents[0][0] == " ":
                ents = ents[1:]
            if ents and ents[-1][0] == " ":
                ents = ents[:-1]
        old = [t for k, t in ents if k in (" ", "-")]
        if not old:
            break
        hint = hunk["pos"] - 1 + delta
        cands = find_all(file_lines, old, min_pos)
        if cands:
            pos = min(cands, key=lambda c: abs(c - hint))
            new_block, fi = [], pos
            for k, t in ents:
                if k == " ":
                    new_block.append(file_lines[fi]); fi += 1
                elif k == "-":
                    fi += 1
                else:
                    new_block.append(t)
            new = file_lines[:pos] + new_block + file_lines[fi:]
            return new, pos, len(new_block) - (fi - pos), fuzz, None
    # hiba: legközelebbi találat
    old = [t for k, t in entries if k in (" ", "-")]
    bi, score = best_partial(file_lines, old)
    exp = [norm(x) for x in old]
    act = [norm(x) for x in file_lines[bi:bi + len(old)]]
    diff = "\n".join(difflib.unified_diff(exp, act, "vart (patch)", "tényleges (fájl)", lineterm="", n=0))
    msg = f"nem található a kontextus (legjobb találat a {bi + 1}. sornál, {score}/{len(old)} sor egyezik)\n{diff}"
    return None, None, 0, 0, msg

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    write = "--write" in sys.argv
    if not args:
        print(__doc__); sys.exit(1)
    text = open(os.path.expanduser(args[0]), encoding="utf-8").read()
    files = parse(extract_patch(text))
    if not files:
        print("Nem találtam diffet a fájlban."); sys.exit(1)

    results, failed = {}, 0
    for f in files:
        path = f["path"]
        if not os.path.exists(path):
            print(f"✗ {path}: a fájl nem létezik (jó mappában vagy?)"); failed += 1; continue
        raw = open(path, encoding="utf-8", newline="").read()
        crlf = "\r\n" in raw
        ends_nl = raw.endswith("\n")
        lines = raw.replace("\r\n", "\n").split("\n")
        if ends_nl:
            lines = lines[:-1]
        delta, min_pos, changed = 0, 0, False
        print(f"\n== {path}  ({len(f['hunks'])} hunk)")
        for n, h in enumerate(f["hunks"], 1):
            new, pos, d, fuzz, err = apply_hunk(lines, h, delta, min_pos)
            if err == "already":
                print(f"  hunk {n}: ✓ már alkalmazva, kihagyom"); continue
            if err:
                print(f"  hunk {n}: ✗ {err}"); failed += 1; continue
            lines, delta = new, delta + d
            min_pos = pos
            changed = True
            note = f" (fuzz={fuzz})" if fuzz else ""
            print(f"  hunk {n}: ✓ {pos + 1}. sornál{note}")
        if changed:
            results[path] = (lines, crlf, ends_nl)

    if failed:
        print(f"\n✗ {failed} hunk bukott, EZÉRT SEMMIT NEM ÍRTAM ki. Küldd el ezt a kimenetet.")
        sys.exit(2)
    if not write:
        print("\n✓ Minden hunk rendben. Ellenőrzés kész, semmi nem módosult. Írás: add hozzá a --write kapcsolót.")
        return
    for path, (lines, crlf, ends_nl) in results.items():
        out = "\n".join(lines) + ("\n" if ends_nl else "")
        if crlf:
            out = out.replace("\n", "\r\n")
        open(path, "w", encoding="utf-8", newline="").write(out)
    print(f"\n✓ Kész: {len(results)} fájl módosítva. Nézd meg: git diff --stat")

if __name__ == "__main__":
    main()
