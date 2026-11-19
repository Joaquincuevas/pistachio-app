#!/usr/bin/env python3
"""
Convierte los catálogos (xlsx) de la Facultad de Ingeniería UANDES en
server/data/catalog.json, la fuente de verdad que siembra la base de datos.

Uso:
    # Genera el catálogo desde cero con los planes PE 2022
    python3 scripts/parse-catalog.py "/ruta/Catálogo PE 2022 Versión 2023.xlsx"

    # Agrega (o reemplaza) los planes PE 2025 sobre el catalog.json existente
    python3 scripts/parse-catalog.py \
        "/ruta/Catálogo PE 2022 y PE 2025 Versión 2025-3.xlsx" --plan pe2025

    # Agrega los planes PE 2026 (opcional: 2.º libro con la malla propia de Química)
    python3 scripts/parse-catalog.py "/ruta/Catálogo PE 2026.xlsx" --plan pe2026

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

# Argumentos posicionales (libros): se descarta el valor que sigue a --plan.
ARGS = [a for i, a in enumerate(sys.argv[1:], 1)
        if not a.startswith("--") and sys.argv[i - 1] != "--plan"]
SRC = ARGS[0] if ARGS else "/Users/joaquincuevasmunoz/Downloads/Catálogo PE 2022 Versión 2023.xlsx"
OUT = Path(__file__).resolve().parent.parent / "server" / "data" / "catalog.json"

# Versiones del plan de estudios. "merge": se agrega al catalog.json existente
# en vez de regenerarlo (el xlsx 2025-3 ya no trae la malla PE 2022 original).
PLAN_VERSIONS = {
    "pe2022": {"name": "Plan de Estudios 2022 (rev. 2023)", "icc_ajuste": True, "merge": False},
    # La malla ICC del catálogo 2025-3 ya incorpora el ajuste 2025 con códigos Banner.
    "pe2025": {"name": "Plan de Estudios 2025", "icc_ajuste": False, "merge": True},
    # PE 2026: otro formato de hoja (bloques por semestre) y una especialidad nueva (ICQ).
    "pe2026": {"name": "Plan de Estudios 2026", "icc_ajuste": False, "merge": True},
}
PLAN_KEY = sys.argv[sys.argv.index("--plan") + 1] if "--plan" in sys.argv else "pe2022"
# Segundo libro (sólo PE 2026): catálogo propio de Ingeniería Civil Química.
SRC_ICQ = ARGS[1] if len(ARGS) > 1 else None

# Nombre de la especialidad en versiones antiguas del plan (por especialidad y versión).
# ICA pasó de "Ambiental" (PE 2022) a "Química" (PE 2025).
# La especialidad base es "Ambiental"; el PE 2025 se publicó como "Química".
SPECIALTY_NAME_BY_VERSION = {
    ("ica", "pe2025"): {"specialtyName": "Química",
                        "specialtyFullName": "Ingeniería Civil Química"},
}

# Erratas de la hoja "Cursos" (título tal como viene → título corregido).
NAME_FIXES = {
    "Inteligencia Artificicial Aplicada": "Inteligencia Artificial Aplicada",
}

SPECIALTIES = [
    {"id": "ici", "sheet": "ICI Malla", "tit": "ICI Tit", "name": "Industrial",
     "fullName": "Ingeniería Civil Industrial", "icon": "factory",
     "tagline": "Optimiza procesos, gestiona recursos y lidera organizaciones."},
    {"id": "ioc", "sheet": "IOC Malla", "tit": "IOC Tit", "name": "Obras Civiles",
     "fullName": "Ingeniería Civil en Obras Civiles", "icon": "building",
     "tagline": "Diseña y construye la infraestructura que sostiene al país."},
    {"id": "ice", "sheet": "ICE Malla", "name": "Eléctrica",
     "fullName": "Ingeniería Civil Eléctrica", "icon": "zap",
     "tagline": "Energía, electrónica y automatización para un mundo conectado."},
    {"id": "icc", "sheet": "ICC Malla", "name": "Computación",
     "fullName": "Ingeniería Civil en Ciencias de la Computación", "icon": "cpu",
     "tagline": "Software, datos e inteligencia artificial para resolver problemas reales."},
    {"id": "ica", "sheet": "ICA Malla", "name": "Ambiental",
     "fullName": "Ingeniería Civil Ambiental", "icon": "leaf",
     "tagline": "Procesos sustentables para el cuidado del medio ambiente."},
    # Nueva en el PE 2026: sólo existe en ese plan (sin hoja en los catálogos anteriores).
    {"id": "icq", "name": "Química",
     "fullName": "Ingeniería Civil Química", "icon": "flask",
     "tagline": "Procesos químicos y sustentables para la industria y el medio ambiente."},
]

# Hojas de cada especialidad en el catálogo PE 2026. "src": "icq" = segundo libro.
SHEETS_2026 = {
    "ici": {"sheet": "ICI Malla", "tit": "ICI Tit"},
    "ioc": {"sheet": "IOC Malla", "tit": "IOC Tit"},
    "ice": {"sheet": "ICE Malla"},
    "icc": {"sheet": "ICC Malla"},
    "ica": {"sheet": "ICA Malla"},
    # Química usa la misma malla que Ambiental 2026 ("like" = especialidad de la que copia
    # cursos y requisitos). Para volver a la malla propia de Química Mención Ambiental:
    #   "icq": {"sheet": "Malla Curricular", "src": "icq"}   (+ pasar el segundo libro)
    "icq": {"sheet": "ICA Malla", "like": "ica"},
}
PLAN_NAME_2026: dict = {}

# Slots de la malla que no son cursos del catálogo (formación general / electivos).
SLOT_PATTERNS = [
    (r"^teolog[ií]a i$",   "TEO1", "Teología I", "Formación General"),
    (r"^teolog[ií]a ii$",  "TEO2", "Teología II", "Formación General"),
    (r"^teolog[ií]a iii$", "TEO3", "Teología III", "Formación General"),
    (r"^minor",            "MINOR", "Minor", "Minor"),
    (r"^optativo teol",    "OPTTEO", "Optativo Teológico", "Formación General"),
    (r"^optativo",         "OPT", "Optativo Arte y Literatura / Historia / P. Contemporáneo", "Formación General"),
    (r"^herramientas interdisciplinares", "HIG", "Herramienta Interdisciplinar", "Herramientas Interdisciplinares"),
    (r"^concentraci[oó]n tecnol[oó]gica", "CT", "Concentración Tecnológica", "Concentración Tecnológica"),
    (r"^electivo",         "ELE", "Electivo de Especialidad", "Electivo"),
    (r"^menci[oó]n",       "MEN", "Curso de Mención", "Mención"),
]


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().lower()


# Columna de especialidad en la hoja de cursos → id interno ("pc" = plan común).
SPEC_COLUMNS = {"plan comun": "pc", "ici": "ici", "ioc": "ioc", "ice": "ice",
                "icc": "icc", "ica": "ica", "icq": "icq"}


def parse_cursos(xl, sheet: str = "Cursos", header: int = 1) -> dict:
    """Hoja de cursos → {título normalizado: [fichas]}.

    Un mismo título puede tener varias fichas (p. ej. "Transferencia de Calor" existe
    como ICA3220 y como ICQ3202); cada ficha lleva las especialidades en que se dicta.
    Las columnas se leen por su encabezado, así sirve para los catálogos 2022 a 2026.
    """
    df = pd.read_excel(xl, sheet_name=sheet, header=header)
    cols = {norm(c): c for c in df.columns if not str(c).startswith("Unnamed")}

    def col(*names):
        for n in names:
            for key, orig in cols.items():
                if key == n or key.startswith(n):
                    return orig
        return None

    c_code, c_title = col("codigo"), col("titulo")
    c_sct, c_req, c_skill = col("sct"), col("requisitos"), col("habilidades")
    c_hours = {k: col(n) for k, n in [
        ("clases", "clases"), ("ayudantias", "ayudantias"), ("laboratorio", "laboratorios"),
        ("trabajos", "trabajos"), ("presentaciones", "presentaciones"), ("lecturas", "lecturas"),
        ("estudio", "estudio"), ("total", "horas semanales")]}
    c_sem = [(1, col("secciones sem 10")), (2, col("secciones sem 20"))]
    spec_cols = {SPEC_COLUMNS[k]: orig for k, orig in cols.items() if k in SPEC_COLUMNS}

    df = df[df[c_code].notna()]
    cursos: dict = {}
    for _, r in df.iterrows():
        def h(key):
            c = c_hours[key]
            return sct_value(r[c]) if c is not None else 0  # tolera celdas con espacios raros
        title = str(r[c_title]).strip()
        ficha = {
            "id": str(r[c_code]).strip(),
            "name": NAME_FIXES.get(title, title),
            "credits": sct_value(r[c_sct]) if c_sct else 0,
            "hours": {k: h(k) for k in c_hours},
            "reqText": str(r[c_req]).strip() if c_req and pd.notna(r[c_req]) else None,
            "skills": str(r[c_skill]).strip() if c_skill and pd.notna(r[c_skill]) else None,
            "offered": [s_ for s_, c in c_sem if c is not None and pd.notna(r[c])],
            "specs": {sid for sid, c in spec_cols.items() if pd.notna(r[c])},
        }
        cursos.setdefault(norm(title), []).append(ficha)
    return cursos


def merge_cursos(*catalogs: dict) -> dict:
    """Une catálogos; ante dos fichas igualmente válidas gana la del último."""
    out: dict = {}
    for cat in catalogs:
        for key, fichas in cat.items():
            out.setdefault(key, []).extend(fichas)
    return out


def all_fichas(cursos: dict) -> list:
    return [f for fichas in cursos.values() for f in fichas]


def public_course(ficha: dict) -> dict:
    """La ficha sin los campos internos (lo que se guarda en catalog.json)."""
    return {k: v for k, v in ficha.items() if k != "specs"}


def sct_value(v) -> int:
    """SCT de la hoja Cursos; 0 si la celda está vacía o rota (#REF!)."""
    try:
        return int(float(v)) if pd.notna(v) else 0
    except (TypeError, ValueError):
        return 0


def match_curso(cursos: dict, name: str, spec=None):
    n = norm(name)
    fichas = cursos.get(n)
    if fichas is None:
        close = get_close_matches(n, cursos.keys(), n=1, cutoff=0.82)
        fichas = cursos[close[0]] if close else None
    if not fichas:
        return None
    if len(fichas) > 1 and spec:
        # Preferimos la ficha de la propia especialidad; luego la del plan común.
        exact = [f for f in fichas if spec in f["specs"]]
        common = [f for f in fichas if "pc" in f["specs"]]
        fichas = exact or common or fichas
    return public_course(fichas[-1])


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
                "slot": detect_slot(name),
            })
    return entries


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", norm(text)).strip("-")


def detect_slot(name: str):
    """¿El nombre corresponde a un slot genérico (Teología, Minor, Electivo...)?"""
    # "HI: Métodos Estadísticos": herramienta interdisciplinar con tema sugerido. El id
    # lleva el tema, porque ese texto cambia según la especialidad.
    m = re.match(r"^hi:\s*(.+)$", name.strip(), re.I)
    if m:
        return {"prefix": "HI", "label": name.strip(), "category": "Herramientas Interdisciplinares",
                "fixedId": f"HI-{slugify(m.group(1))}"}
    for pat, prefix, label, category in SLOT_PATTERNS:
        if re.match(pat, norm(name)):
            # La numeración definitiva se asigna después (assign_slot_ids).
            return {"prefix": prefix, "label": label, "category": category}
    return None


def assign_slot_ids(entries: list) -> None:
    """Numera los slots ordenados por semestre (Minor 1 en s3, Minor 2 en s4...).

    Los TEO* ya traen numeración romana en el patrón; el resto se numera aquí,
    omitiendo el sufijo cuando hay una sola instancia en el plan. Se ejecuta sobre
    el conjunto final de entradas del plan (base o de una mención concreta).
    """
    by_prefix: dict = {}
    for e in entries:
        if e["slot"] and e["slot"].get("fixedId"):
            e["slot"]["id"] = e["slot"]["fixedId"]
        elif e["slot"] and not e["slot"]["prefix"].startswith("TEO"):
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


def parse_reqs(raw):
    """Texto de requisitos de la malla → (nºs de curso, créditos exigidos o None).

    Acepta "2,4,5", "276 SCT", "228 cr" y los pares que Excel convirtió en decimal
    ("44.45" = cursos 44 y 45; "44.0" = el 44).
    """
    if raw is None or (not isinstance(raw, str) and pd.isna(raw)):
        return [], None
    txt = str(raw).strip()
    m = re.search(r"(\d+)\s*(?:cr|sct)", txt, re.I)
    if m:
        return [], int(m.group(1))
    nums: list = []
    for tok in re.split(r"[,;]", txt):
        tok = tok.strip()
        if re.fullmatch(r"\d+(\.0)?", tok):
            nums.append(int(float(tok)))
        elif re.fullmatch(r"\d+\.\d+", tok):
            nums.extend(int(x) for x in tok.split("."))
    return nums, None


def parse_malla_blocks(xl, sheet: str):
    """Malla del PE 2026: bloques de 4 columnas (nº, SCT, habilidad, requisitos) por semestre.

    La fila siguiente a la de "Año N" trae el nº de semestre de cada bloque; el semestre
    real es la posición del bloque (1 a 11). Cada curso ocupa dos filas: datos y nombre.
    """
    df = pd.read_excel(xl, sheet_name=sheet, header=None)
    hdr = next((r for r in range(df.shape[0])
                if sum(str(v).startswith("Año") for v in df.iloc[r].tolist() if pd.notna(v)) >= 3),
               None)
    if hdr is None:
        raise ValueError(f"No encontré la fila 'Año N' en la hoja {sheet!r}")
    sem_cols = [c for c in range(df.shape[1])
                if pd.notna(df.iat[hdr + 1, c])
                and re.fullmatch(r"\d+(\.0)?", str(df.iat[hdr + 1, c]).strip())]
    entries = []
    for r in range(hdr + 2, df.shape[0] - 1):
        for sem_idx, c in enumerate(sem_cols):
            v, name = df.iat[r, c], df.iat[r + 1, c]
            if pd.isna(v) or pd.isna(name):
                continue
            try:
                num = int(float(v))
            except (TypeError, ValueError):
                continue
            name = str(name).strip()
            if not name or re.fullmatch(r"\d+(\.0)?", name):
                continue
            req = df.iat[r, c + 3] if c + 3 < df.shape[1] else None
            req_nums, credit_req = parse_reqs(req)
            entries.append({
                "num": num, "name": name, "credits": sct_value(df.iat[r, c + 1]),
                "semester": sem_idx + 1, "reqNums": req_nums, "creditReq": credit_req,
                "slot": detect_slot(name),
            })
    return entries


def parse_tit_blocks(xl, sheet: str, base_entries: list):
    """Menciones del PE 2026 (hojas "<ESP> Tit").

    Cada mención lista los cursos 49-63 en filas de bloques de 3 columnas (nº, SCT,
    requisitos) con el nombre en la fila de abajo. El semestre sale de la malla base.
    """
    df = pd.read_excel(xl, sheet_name=sheet, header=None)
    base_sem = {e["num"]: e["semester"] for e in base_entries}
    headers = [r for r in range(df.shape[0])
               if pd.notna(df.iat[r, 1]) and norm(df.iat[r, 1]).startswith("mencion")]
    menciones = []
    for hi, h in enumerate(headers):
        end = headers[hi + 1] if hi + 1 < len(headers) else df.shape[0]
        conc = re.sub(r"^menci[oó]n\s+", "", str(df.iat[h, 1]).strip(), flags=re.I).strip()
        mid = MENCION_IDS.get(norm(conc))
        if not mid:
            # Nombre truncado o nuevo: se acepta si es prefijo de una mención conocida.
            mid = next((v for k, v in MENCION_IDS.items() if k.startswith(norm(conc))), None)
        if not mid:
            continue
        entries = []
        for r in range(h + 1, end - 1):
            for c in range(2, df.shape[1] - 1):
                v, name_cell = df.iat[r, c], df.iat[r + 1, c]
                if pd.isna(v) or not _is_name_cell(name_cell):
                    continue
                try:
                    num = int(float(v))
                except (TypeError, ValueError):
                    continue
                name = str(name_cell).strip()
                if "practice" in norm(name):
                    continue
                req = df.iat[r, c + 2] if c + 2 < df.shape[1] else None
                req_nums, credit_req = parse_reqs(req)
                semester = base_sem.get(num) or (9 if num <= 53 else 10 if num <= 59 else 11)
                entries.append({
                    "num": num, "name": name, "credits": sct_value(df.iat[r, c + 1]),
                    "semester": semester, "reqNums": req_nums, "creditReq": credit_req,
                    "slot": detect_slot(name),
                })
        # Nombre completo de la mención (la hoja lo trae cortado en algunas celdas).
        menciones.append({"name": conc, "id": mid, "entries": entries})
    return menciones


def concurrent_flag(course_meta, prereq_name: str) -> bool:
    """True si el texto de requisitos marca el prerrequisito como paralelo/(p)."""
    if not course_meta or not course_meta.get("reqText"):
        return False
    txt = norm(course_meta["reqText"])
    pos = txt.find(norm(prereq_name))
    if pos < 0:
        return False
    tail = txt[pos + len(norm(prereq_name)): pos + len(norm(prereq_name)) + 18]
    # "(p)" en los catálogos 2022-2025; "(PEND ó CÓDIGO)" en el 2026 = puede estar pendiente.
    return "(p)" in tail or "(pend" in tail or "concurrente" in tail or "paralelo" in tail


# Slots que forman una secuencia (I → II → III): se encadenan como prerrequisitos.
SLOT_CHAINS = [["MINOR1", "MINOR2", "MINOR3"], ["TEO1", "TEO2", "TEO3"]]

# Prácticas del plan común (existen en la hoja Cursos pero fuera de la grilla).
PRACTICES = [
    {"code": "ING4106", "semester": 7, "creditReq": 170},   # Pre-Professional Practice
    {"code": "ING6104", "semester": 11, "creditReq": 282},  # Professional Practice
]

# Prerrequisitos que el catálogo trae pero no corresponden en la malla real
# (correcciones manuales confirmadas por un alumno de la carrera).
PREREQ_REMOVALS = {
    # Proyecto Desarrollo de Software no requiere Algorithms and Competitive
    # Programming: son ramos independientes pese a lo que dice el catálogo.
    "ICC4201": {"ICC4101"},
}


def enrich_plan(plan_courses: list, cursos: dict) -> list:
    """Encadena los slots secuenciales y agrega las prácticas a un plan."""
    by_id = {c["id"]: c for c in plan_courses}

    # Quita prerrequisitos incorrectos del catálogo (ver PREREQ_REMOVALS).
    for course_id, drop in PREREQ_REMOVALS.items():
        course = by_id.get(course_id)
        if course:
            course["prerequisites"] = [p for p in course["prerequisites"] if p["id"] not in drop]

    # Encadena minors y teologías: cada uno requiere el anterior.
    for chain in SLOT_CHAINS:
        present = [cid for cid in chain if cid in by_id]
        for prev, cur in zip(present, present[1:]):
            reqs = by_id[cur]["prerequisites"]
            if not any(p["id"] == prev for p in reqs):
                reqs.append({"id": prev, "concurrent": False})

    # Agrega Práctica Pre-Profesional y Profesional (gatilladas por créditos).
    cursos_by_code = {f["id"]: public_course(f) for f in all_fichas(cursos)}
    for prac in PRACTICES:
        if prac["code"] in by_id:
            continue
        meta = cursos_by_code.get(prac["code"])
        if not meta:
            continue
        plan_courses.append({
            **meta,
            "isSlot": False,
            # Marca (oculta en la UI salvo para el layout) que va al pie de la malla.
            "slotCategory": "Práctica",
            "semester": prac["semester"],
            "prerequisites": [],
            "creditReq": prac["creditReq"],
        })
    return plan_courses


def build_plan(plan_id: str, plan_name: str, entries: list, cursos: dict, warnings: list,
               mention_of=None, spec=None):
    # Copia profunda: assign_slot_ids muta los slots y las entradas base se
    # reutilizan para construir cada mención.
    entries = json.loads(json.dumps(entries))
    assign_slot_ids(entries)
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
            meta = match_curso(cursos, e["name"], spec)
            if not meta:
                warnings.append(f"[{plan_id}] sin match en catálogo: '{e['name']}'")
                continue
            course = {**meta, "isSlot": False, "slotCategory": None}
            # Si la hoja Cursos no trae SCT válido (#REF!), vale el de la malla.
            if not course["credits"] and e["credits"]:
                course["credits"] = e["credits"]
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
    enrich_plan(plan_courses, cursos)
    return {"id": plan_id, "name": plan_name, "mentionOf": mention_of, "courses": plan_courses}


# ─── Menciones (hojas "<ESP> Tit") ───────────────────────────────
# La malla de mención comparte los semestres 1-8 con la malla base y sólo cambia
# los cursos de los años 5-6 (nums 48-62). Los requisitos referencian la misma
# numeración global que la malla base.

# Slug estable por mención (evita depender de acentos/orden del encabezado).
MENCION_IDS = {
    "estructuras": "estructuras",
    "desarrollo de proyectos de infraestructura": "dpi",
    "gestion de operaciones": "operaciones",
    "ingenieria financiera": "financiera",
    "analitica de datos": "datos",
}


def _is_name_cell(v) -> bool:
    """True si la celda parece un nombre de curso (texto, no un número)."""
    if pd.isna(v):
        return False
    s = str(v).strip()
    if not s:
        return False
    return not re.fullmatch(r"\d+(\.0)?", s)


def parse_tit(xl, sheet: str, cursos: dict):
    """Devuelve [{name, id, entries}] con las menciones de la hoja de título."""
    df = pd.read_excel(xl, sheet_name=sheet, header=None)
    # Encabezados de mención: celdas de la columna 0 que parten con "Mención".
    headers = [r for r in range(df.shape[0])
               if pd.notna(df.iat[r, 0]) and norm(df.iat[r, 0]).startswith("mencion")]
    menciones = []
    for hi, h in enumerate(headers):
        end = headers[hi + 1] if hi + 1 < len(headers) else df.shape[0]
        raw = str(df.iat[h, 0]).strip()
        conc = re.sub(r"^menci[oó]n\s+", "", raw, flags=re.I).strip()
        mid = MENCION_IDS.get(norm(conc))
        if not mid:  # mención no reconocida: se omite en vez de generar ids frágiles.
            continue
        entries = []
        for r in range(h + 1, end - 1):
            for c in range(df.shape[1]):
                v = df.iat[r, c]
                if pd.isna(v):
                    continue
                try:
                    num = int(float(v))
                except (TypeError, ValueError):
                    continue
                name_cell = df.iat[r + 1, c]
                if not _is_name_cell(name_cell):
                    continue
                name = str(name_cell).strip()
                # Las prácticas se agregan luego vía enrich_plan (fuera de la grilla).
                if "practice" in norm(name):
                    continue
                sct = df.iat[r, c + 1] if c + 1 < df.shape[1] else None
                req_raw = df.iat[r, c + 2] if c + 2 < df.shape[1] else None
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
                # Semestre global: años 5-6 → 9 (48-52), 10 (53-58), 11 (60-62).
                semester = 9 if num <= 52 else 10 if num <= 58 else 11
                entries.append({
                    "num": num, "name": name,
                    "credits": int(sct) if pd.notna(sct) else 0,
                    "semester": semester, "reqNums": req_nums,
                    "creditReq": credit_req, "slot": detect_slot(name),
                })
        menciones.append({"name": conc, "id": mid, "entries": entries})
    return menciones


def build_mencion_plans(spec_id: str, base_entries: list, tit_menciones: list,
                        cursos: dict, warnings: list, plan_key: str = "pe2022"):
    """Construye un plan completo por mención (semestres 1-8 base + años 5-6 mención)."""
    base_1_8 = [e for e in base_entries if e["semester"] <= 8]
    plans = []
    for men in tit_menciones:
        combined = base_1_8 + men["entries"]
        plan = build_plan(
            f"{spec_id}-{plan_key}-{men['id']}", f"Mención {men['name']}",
            combined, cursos, warnings, mention_of=f"{spec_id}-{plan_key}", spec=spec_id,
        )
        plans.append(plan)
    return plans


def build_icc_ajuste(base_plan: dict, cursos: dict) -> dict:
    """Aplica los ajustes 2025 de ICC documentados en la presentación de la Facultad."""
    remove = {"ICC3103", "ICC5130"}          # Autómatas, Diseño de Software Verificable
    moves = {"ICC3204": 5, "ICC4130": 6, "ICE5204": 7, "ICC5140": 8, "ICC4200": 9}
    req_overrides = {
        "ICC4130": [("ICC3100", False), ("ICC3204", True)],    # Web Tech: Paradigmas + BD en paralelo
        # No incluye ICC4101 (Algorithms and Competitive Programming): ver PREREQ_REMOVALS.
        "ICC4201": [("ICC4130", False), ("ICE5204", False)],
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
    return {"id": "icc-pe2022-a2025", "name": "PE 2022 · Ajuste 2025",
            "mentionOf": None, "courses": courses}


def main():
    version = PLAN_VERSIONS[PLAN_KEY]
    is2026 = PLAN_KEY == "pe2026"
    xl = pd.ExcelFile(SRC)
    xl_icq = pd.ExcelFile(SRC_ICQ) if (is2026 and SRC_ICQ) else None
    if is2026:
        cursos = parse_cursos(xl, "Cursos con códigos")
        # Química: su catálogo propio pisa las fichas del general.
        cursos_icq = merge_cursos(cursos, parse_cursos(xl_icq, "Catalogo", header=5)) if xl_icq else cursos
    else:
        cursos = parse_cursos(xl)
        cursos_icq = cursos
    warnings: list = []

    existing = {}
    names = [Path(SRC).name] + ([Path(SRC_ICQ).name] if xl_icq else [])
    if version["merge"]:
        # Conserva los planes ya publicados y reemplaza sólo los de esta versión.
        prev = json.loads(OUT.read_text(encoding="utf-8"))
        existing = {s_["id"]: s_ for s_ in prev["specialties"]}
        sources = [x for x in prev["source"].split(" + ") if x not in names]
        out = {"source": " + ".join(sources + names), "specialties": []}
    else:
        out = {"source": Path(SRC).name, "specialties": []}

    written = set()
    for spec in SPECIALTIES:
        base_id = f"{spec['id']}-{PLAN_KEY}"
        if is2026:
            cfg = SHEETS_2026.get(spec["id"])
        else:
            cfg = {"sheet": spec["sheet"], "tit": spec.get("tit")} if spec.get("sheet") else None
        plans: list = []
        if cfg:
            if is2026:
                book = xl_icq if cfg.get("src") == "icq" else xl
                spec_cursos = cursos_icq if cfg.get("src") == "icq" else cursos
                entries = parse_malla_blocks(book, cfg["sheet"])
            else:
                book, spec_cursos = xl, cursos
                entries = parse_malla(xl, cfg["sheet"], cursos)
            plan_name = PLAN_NAME_2026.get(spec["id"], version["name"]) if is2026 else version["name"]
            catalog_spec = cfg.get("like", spec["id"])  # fichas del catálogo según esta carrera
            plan = build_plan(base_id, plan_name, entries, spec_cursos, warnings, spec=catalog_spec)
            plans = [plan]
            if spec["id"] == "icc" and version["icc_ajuste"]:
                plans.append(build_icc_ajuste(plan, spec_cursos))
            # Menciones: planes completos que resuelven los cupos "Mención" de los años 5-6.
            if cfg.get("tit"):
                tit = (parse_tit_blocks(book, cfg["tit"], entries) if is2026
                       else parse_tit(xl, cfg["tit"], cursos))
                plans.extend(build_mencion_plans(spec["id"], entries, tit, spec_cursos,
                                                 warnings, PLAN_KEY))
        kept = [p for p in existing.get(spec["id"], {}).get("plans", [])
                if p["id"] != base_id and p.get("mentionOf") != base_id]
        all_plans = kept + plans
        if not all_plans:
            continue  # especialidad sin planes en esta corrida (p. ej. ICQ antes del PE 2026)
        # Nombre de la especialidad por versión del plan; sin regla, hereda el de la especialidad.
        for p in all_plans:
            ver = p["id"].split("-")[1]
            override = SPECIALTY_NAME_BY_VERSION.get((spec["id"], ver))
            if override:
                p.update(override)
            else:
                p.pop("specialtyName", None)
                p.pop("specialtyFullName", None)
        out["specialties"].append({
            "id": spec["id"], "name": spec["name"], "fullName": spec["fullName"],
            "icon": spec["icon"], "tagline": spec["tagline"], "plans": all_plans,
        })
        written.add(spec["id"])
    # Especialidades ya publicadas que esta corrida no toca se conservan tal cual.
    out["specialties"].extend(s_ for sid, s_ in existing.items() if sid not in written)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"OK -> {OUT}")
    for s_ in out["specialties"]:
        for p in s_["plans"]:
            total_sct = sum(c["credits"] for c in p["courses"])
            print(f"  {s_['name']:14} {p['name']:42} {len(p['courses']):3} ramos, {total_sct} SCT")
    if warnings:
        print("\nADVERTENCIAS:")
        for w in warnings:
            print("  -", w)


if __name__ == "__main__":
    main()
