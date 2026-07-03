#!/usr/bin/env python3
"""
Convierte el Catálogo PE 2022 (xlsx) de la Facultad de Ingeniería UANDES
en server/data/catalog.json, la fuente de verdad que siembra la base de datos.

Uso:
    python3 scripts/parse-catalog.py "/ruta/Catálogo PE 2022 Versión 2023.xlsx"

Fuentes:
- Hoja "Cursos": metadata de cada ramo (código, horas, SCT, requisitos en texto,
  habilidades transversales, semestres en que se dicta).
- Hojas "<ESP> Malla": la malla oficial de cada especialidad, con requisitos
  referenciados por número de curso dentro de la malla.
- El plan "ICC Ajuste 2025" se construye aplicando los cambios documentados en
  "Presentación Ajustes Plan de Estudios ICC - INFO FACULTAD.pdf" (oct. 2024).
"""

import json
import re
import sys
import unicodedata
from difflib import get_close_matches
from pathlib import Path

import pandas as pd

SRC = sys.argv[1] if len(sys.argv) > 1 else "/Users/joaquincuevasmunoz/Downloads/Catálogo PE 2022 Versión 2023.xlsx"
OUT = Path(__file__).resolve().parent.parent / "server" / "data" / "catalog.json"

SPECIALTIES = [
    {"id": "ici", "sheet": "ICI Malla", "name": "Industrial",
     "fullName": "Ingeniería Civil Industrial", "emoji": "⚙️",
     "tagline": "Optimiza procesos, gestiona recursos y lidera organizaciones."},
    {"id": "ioc", "sheet": "IOC Malla", "name": "Obras Civiles",
     "fullName": "Ingeniería Civil en Obras Civiles", "emoji": "🏗️",
     "tagline": "Diseña y construye la infraestructura que sostiene al país."},
    {"id": "ice", "sheet": "ICE Malla", "name": "Eléctrica",
     "fullName": "Ingeniería Civil Eléctrica", "emoji": "⚡",
     "tagline": "Energía, electrónica y automatización para un mundo conectado."},
    {"id": "icc", "sheet": "ICC Malla", "name": "Computación",
     "fullName": "Ingeniería Civil en Ciencias de la Computación", "emoji": "💻",
     "tagline": "Software, datos e inteligencia artificial para resolver problemas reales."},
    {"id": "ica", "sheet": "ICA Malla", "name": "Ambiental",
     "fullName": "Ingeniería Civil en Medio Ambiente", "emoji": "🌱",
     "tagline": "Procesos sustentables para el cuidado del medio ambiente."},
]

# Slots de la malla que no son cursos del catálogo (formación general / electivos).
SLOT_PATTERNS = [
    (r"^teolog[ií]a i$",   "TEO1", "Teología I", "Formación General"),
    (r"^teolog[ií]a ii$",  "TEO2", "Teología II", "Formación General"),
    (r"^teolog[ií]a iii$", "TEO3", "Teología III", "Formación General"),
    (r"^minor",            "MINOR", "Minor", "Minor"),
    (r"^optativo",         "OPT", "Optativo Arte y Literatura / Historia / P. Contemporáneo", "Formación General"),
    (r"^concentraci[oó]n tecnol[oó]gica", "CT", "Concentración Tecnológica", "Concentración Tecnológica"),
    (r"^electivo",         "ELE", "Electivo de Especialidad", "Electivo"),
    (r"^menci[oó]n",       "MEN", "Curso de Mención", "Mención"),
]


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().lower()


def parse_cursos(xl) -> dict:
    df = pd.read_excel(xl, sheet_name="Cursos", header=1).iloc[:, :24]
    df.columns = ["CODIGO", "MATERIA", "CURSO", "TITULO", "PC", "ICI", "IOC", "ICE", "ICC", "ICA",
                  "CONC", "H_CLASES", "H_AYUD", "H_LAB", "H_TRAB", "H_PRES", "H_LECT", "H_EST",
                  "H_TOT", "SCT", "REQ", "HABIL", "SEM10", "SEM20"]
    df = df[df["CODIGO"].notna()]
    cursos = {}
    for _, r in df.iterrows():
        def h(col):
            return int(r[col]) if pd.notna(r[col]) else 0
        cursos[norm(r["TITULO"])] = {
            "id": str(r["CODIGO"]).strip(),
            "name": str(r["TITULO"]).strip(),
            "credits": int(r["SCT"]) if pd.notna(r["SCT"]) else 0,
            "hours": {
                "clases": h("H_CLASES"), "ayudantias": h("H_AYUD"), "laboratorio": h("H_LAB"),
                "trabajos": h("H_TRAB"), "presentaciones": h("H_PRES"), "lecturas": h("H_LECT"),
                "estudio": h("H_EST"), "total": h("H_TOT"),
            },
            "reqText": str(r["REQ"]).strip() if pd.notna(r["REQ"]) else None,
            "skills": str(r["HABIL"]).strip() if pd.notna(r["HABIL"]) else None,
            "offered": [s for s, col in [(1, "SEM10"), (2, "SEM20")] if pd.notna(r[col])],
        }
    return cursos


def match_curso(cursos: dict, name: str):
    n = norm(name)
    if n in cursos:
        return cursos[n]
    close = get_close_matches(n, cursos.keys(), n=1, cutoff=0.82)
    return cursos[close[0]] if close else None


def parse_malla(xl, sheet: str, cursos: dict):
    """Devuelve entradas {num, name, credits, semester, reqNums, creditReq, slot}."""
    df = pd.read_excel(xl, sheet_name=sheet, header=None)
    # Columnas de semestre: celdas de la fila 2 con valor 1 o 2 (encabezado sem).
    sem_cols = [c for c in range(df.shape[1])
                if pd.notna(df.iat[2, c]) and str(df.iat[2, c]).strip() in ("1", "2", "1.0", "2.0")]
    entries = []
    slot_counters = {}
    for r in range(3, min(df.shape[0] - 1, 20)):
        for sem_idx, c in enumerate(sem_cols):
            v = df.iat[r, c]
            name = df.iat[r + 1, c] if r + 1 < df.shape[0] else None
            if pd.isna(v) or pd.isna(name):
                continue
            try:
                num = int(float(v))
            except (TypeError, ValueError):
                continue
            name = str(name).strip()
            if not name or norm(name) in ("nombre curso", "apr", "ingles alte 3"):
                continue
            sct = df.iat[r, c + 1]
            req_raw = df.iat[r, c + 3] if c + 3 < df.shape[1] else None
            req_nums, credit_req = [], None
            if pd.notna(req_raw):
                txt = str(req_raw).strip()
                m = re.search(r"(\d+)\s*(?:cr|sct)", txt, re.I)
                if m:
                    credit_req = int(m.group(1))
                else:
                    for tok in re.split(r"[,;]", txt):
                        tok = tok.strip()
                        if re.fullmatch(r"\d+(\.0)?", tok):
                            req_nums.append(int(float(tok)))
            # ¿Es un slot (Teología, Minor, Electivo, CT...)?
            slot = None
            for pat, prefix, label, category in SLOT_PATTERNS:
                if re.match(pat, norm(name)):
                    # La numeración definitiva se asigna después, ordenada por semestre.
                    slot = {"prefix": prefix, "label": label, "category": category}
                    break
            entries.append({
                "num": num,
                "name": name,
                "credits": int(sct) if pd.notna(sct) else 0,
                "semester": sem_idx + 1,
                "reqNums": req_nums,
                "creditReq": credit_req,
                "slot": slot,
            })

    # Numeración de slots ordenada por semestre (Minor 1 en s3, Minor 2 en s4...).
    # Los TEO* ya traen numeración romana en el patrón; el resto se numera aquí,
    # omitiendo el sufijo cuando hay una sola instancia en el plan.
    by_prefix: dict = {}
    for e in entries:
        if e["slot"] and not e["slot"]["prefix"].startswith("TEO"):
            by_prefix.setdefault(e["slot"]["prefix"], []).append(e)
    for prefix, group in by_prefix.items():
        group.sort(key=lambda e: (e["semester"], e["num"]))
        for k, e in enumerate(group, start=1):
            suffix = "" if len(group) == 1 else f" {k}"
            e["slot"]["id"] = f"{prefix}{k}"
            e["slot"]["label"] = f"{e['slot']['label']}{suffix}"
    for e in entries:
        if e["slot"] and e["slot"]["prefix"].startswith("TEO"):
            e["slot"]["id"] = e["slot"]["prefix"]
    return entries


def concurrent_flag(course_meta, prereq_name: str) -> bool:
    """True si el texto de requisitos marca el prerrequisito como paralelo/(p)."""
    if not course_meta or not course_meta.get("reqText"):
        return False
    txt = norm(course_meta["reqText"])
    pos = txt.find(norm(prereq_name))
    if pos < 0:
        return False
    tail = txt[pos + len(norm(prereq_name)): pos + len(norm(prereq_name)) + 18]
    return "(p)" in tail or "concurrente" in tail or "paralelo" in tail


def build_plan(plan_id: str, plan_name: str, entries: list, cursos: dict, warnings: list):
    by_num = {}
    courses = []
    for e in entries:
        if e["slot"]:
            course = {
                "id": e["slot"]["id"],
                "name": e["slot"]["label"],
                "credits": e["credits"],
                "isSlot": True,
                "slotCategory": e["slot"]["category"],
                "hours": None, "reqText": None, "skills": None, "offered": [1, 2],
            }
        else:
            meta = match_curso(cursos, e["name"])
            if not meta:
                warnings.append(f"[{plan_id}] sin match en catálogo: '{e['name']}'")
                continue
            course = {**meta, "isSlot": False, "slotCategory": None}
        by_num[e["num"]] = {"entry": e, "course": course}
        courses.append({"entry": e, "course": course})

    plan_courses = []
    for item in courses:
        e, c = item["entry"], item["course"]
        prereqs = []
        for n in e["reqNums"]:
            target = by_num.get(n)
            if not target:
                warnings.append(f"[{plan_id}] {c['name']}: requisito nº{n} no existe en la malla")
                continue
            prereqs.append({
                "id": target["course"]["id"],
                "concurrent": concurrent_flag(c if not e["slot"] else None, target["course"]["name"]),
            })
        plan_courses.append({
            **c,
            "semester": e["semester"],
            "prerequisites": prereqs,
            "creditReq": e["creditReq"],
        })
    return {"id": plan_id, "name": plan_name, "courses": plan_courses}


def build_icc_ajuste(base_plan: dict, cursos: dict) -> dict:
    """Aplica los ajustes 2025 de ICC documentados en la presentación de la Facultad."""
    remove = {"ICC3103", "ICC5130"}          # Autómatas, Diseño de Software Verificable
    moves = {"ICC3204": 5, "ICC4130": 6, "ICE5204": 7, "ICC5140": 8, "ICC4200": 9}
    req_overrides = {
        "ICC4130": [("ICC3100", False), ("ICC3204", True)],    # Web Tech: Paradigmas + BD en paralelo
        "ICC4201": [("ICC4101", False), ("ICC4130", False), ("ICE5204", False)],
        "ICC5140": [("ICC4130", False), ("ICE5204", False)],
        "ICC4200": [("ICC3202", False), ("ICE5204", False)],
        "ICC5105": [("ICC4204", False)],
        "ICC5150": [("ICC4204", False)],
        "ICC5202": [("ICC5105", False), ("ICC-FCS", False), ("ICC5140", False)],
        "ICC6101": [("ICC5150", False), ("ICC4201", False)],
    }
    new_courses = [
        {
            # Código provisorio: la presentación (oct. 2024) aún no publica códigos Banner.
            "id": "ICC-FCS", "name": "Fundamentos de Ciberseguridad", "credits": 6,
            "hours": {"clases": 4, "ayudantias": 0, "laboratorio": 0, "trabajos": 4,
                      "presentaciones": 0, "lecturas": 0, "estudio": 2, "total": 10},
            "reqText": "Sistemas Operativos y Redes, Web Technologies", "skills": None,
            "offered": [1, 2], "isSlot": False, "slotCategory": None, "semester": 7,
            "prerequisites": [{"id": "ICC3201", "concurrent": False},
                              {"id": "ICC4130", "concurrent": False}],
            "creditReq": None,
        },
        {
            "id": "ICC-IAA", "name": "Inteligencia Artificial Aplicada", "credits": 6,
            "hours": {"clases": 2, "ayudantias": 0, "laboratorio": 2, "trabajos": 6,
                      "presentaciones": 0, "lecturas": 0, "estudio": 0, "total": 10},
            "reqText": "Artificial Intelligence", "skills": None,
            "offered": [1], "isSlot": False, "slotCategory": None, "semester": 9,
            "prerequisites": [{"id": "ICE5204", "concurrent": False}],
            "creditReq": None,
        },
    ]
    courses = []
    for c in base_plan["courses"]:
        if c["id"] in remove:
            continue
        c = json.loads(json.dumps(c))  # deep copy
        if c["id"] in moves:
            c["semester"] = moves[c["id"]]
        if c["id"] in req_overrides:
            c["prerequisites"] = [{"id": pid, "concurrent": con} for pid, con in req_overrides[c["id"]]]
        courses.append(c)
    courses.extend(new_courses)
    return {"id": "icc-pe2022-a2025", "name": "PE 2022 · Ajuste 2025", "courses": courses}


def main():
    xl = pd.ExcelFile(SRC)
    cursos = parse_cursos(xl)
    warnings: list = []
    out = {"source": Path(SRC).name, "specialties": []}

    for spec in SPECIALTIES:
        entries = parse_malla(xl, spec["sheet"], cursos)
        plan = build_plan(f"{spec['id']}-pe2022", "Plan de Estudios 2022 (rev. 2023)", entries, cursos, warnings)
        plans = [plan]
        if spec["id"] == "icc":
            plans.append(build_icc_ajuste(plan, cursos))
        out["specialties"].append({
            "id": spec["id"], "name": spec["name"], "fullName": spec["fullName"],
            "emoji": spec["emoji"], "tagline": spec["tagline"], "plans": plans,
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"OK -> {OUT}")
    for s in out["specialties"]:
        for p in s["plans"]:
            total_sct = sum(c["credits"] for c in p["courses"])
            print(f"  {s['name']:14} {p['name']:32} {len(p['courses']):3} ramos, {total_sct} SCT")
    if warnings:
        print("\nADVERTENCIAS:")
        for w in warnings:
            print("  -", w)


if __name__ == "__main__":
    main()
