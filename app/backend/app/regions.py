# Canonical warehouse -> region mapping, carried over from the original dashboard's
# REGION_MAP (index.html) / Region_map sheet (source Excel). This is reference data,
# not something derived from the uploaded file.
REGION_MAP = {
    "CPC - Ahmedabad2 (HP)": "West",
    "CPC - COIMBATORE1 (HP)": "South",
    "CPC - Delhi4 (HP)": "North",
    "CPC - Gurgaon3 (HP)": "North",
    "CPC - HYD3 (HP)": "South",
    "CPC - Kolkata K4 (HP)": "East",
    "CPC - Lucknow (HP)": "North",
    "CPC - Mumbai M10 (HP)": "West",
    "CPC - Noida1 (HP)": "North",
    "CPC - Rajpura1 (HP)": "North",
    "CPC - SURAT1 (HP)": "West",
    "CPC- RANCHI1 (HP)": "East",
    "CPC- VARANASI2": "East",
    "CPC-BBN1(HP)": "East",
    "CPC-BHOPAL1-FRZ (HP)": "West",
    "CPC-BLR8-FRZ(HP)": "South",
    "CPC-CHN1-FRZ (HP)": "South",
    "CPC-DHD1-FRZ (HP)": "North",
    "CPC-GOA2-FRZ (HP)": "South",
    "CPC-GWH1(HP)": "East",
    "CPC-INDORE2-FRZ(HP)": "West",
    "CPC-JAI1-Frz (HP)": "North",
    "CPC-KOL2-FRZ(HP)": "East",
    "CPC-LDH1 (HP)": "North",
    "CPC-MUM4": "West",
    "CPC-NAGPUR2(HP)": "West",
    "CPC-NOIDA2-FRZ(HP)": "North",
    "CPC-PATNA2-FRZ (HP)": "East",
    "CPC-PUNE3-FRZ(HP)": "West",
    "CPC-RAIPUR1-FRZ (HP)": "East",
    "CPC-VIJAY1-FRZ (HP)": "South",
    "CPC-VTZ1(HP)": "South",
}

# Fallback keyword matching for warehouse names not in REGION_MAP (e.g. from a
# differently-formatted upload). City-code substrings, checked case-insensitively.
REGION_KEYWORDS = [
    ("blr", "South"), ("bang", "South"), ("hyd", "South"), ("chn", "South"),
    ("coimb", "South"), ("vijay", "South"), ("vtz", "South"), ("goa", "South"),
    ("mum", "West"), ("pune", "West"), ("ahmed", "West"), ("surat", "West"),
    ("indore", "West"), ("bhopal", "West"), ("nagpur", "West"),
    ("delhi", "North"), ("gurgaon", "North"), ("noida", "North"), ("lucknow", "North"),
    ("rajpura", "North"), ("jai", "North"), ("ludhiana", "North"), ("ldh", "North"), ("dhd", "North"),
    ("kolkata", "East"), ("ranchi", "East"), ("varanasi", "East"), ("bbn", "East"),
    ("gwh", "East"), ("patna", "East"), ("raipur", "East"),
]


def region_of(warehouse) -> str:
    if not isinstance(warehouse, str) or not warehouse:
        return "Unmapped"
    if warehouse in REGION_MAP:
        return REGION_MAP[warehouse]
    low = warehouse.lower()
    for kw, region in REGION_KEYWORDS:
        if kw in low:
            return region
    return "Unmapped"
