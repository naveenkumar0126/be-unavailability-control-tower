"""
Maps the short warehouse codes used in the Fill Rate PO data (e.g. "CPC-AMD2")
to the full warehouse names used in the main Availability dataset (e.g.
"CPC - Ahmedabad2 (HP)") - the two data sources were never given a shared
identifier, so joining fill rate onto the main data (PAN India, Warehouse x
Item) needs this translation.

Built by matching city/airport-code abbreviations against the live facet
lists from both datasets (AMD=Ahmedabad, COI=Coimbatore, DEL=Delhi,
GGN=Gurgaon, LKO=Lucknow, RPJ=Rajpura, etc). Static and best-effort: new
warehouses in either source won't join until added here.
"""
from __future__ import annotations

CODE_TO_NAME = {
    "CPC-AMD2": "CPC - Ahmedabad2 (HP)",
    "CPC-BBN1": "CPC-BBN1(HP)",
    "CPC-BHOPAL1-FRZ": "CPC-BHOPAL1-FRZ (HP)",
    "CPC-BLR8-FRZ": "CPC-BLR8-FRZ(HP)",
    "CPC-CHN1-FRZ": "CPC-CHN1-FRZ (HP)",
    "CPC-COI1": "CPC - COIMBATORE1 (HP)",
    "CPC-DEL4": "CPC - Delhi4 (HP)",
    "CPC-DHD1-FRZ": "CPC-DHD1-FRZ (HP)",
    "CPC-GGN3": "CPC - Gurgaon3 (HP)",
    "CPC-GOA2-FRZ": "CPC-GOA2-FRZ (HP)",
    "CPC-GWH-SNOW1": "CPC-GWH-SNOW1 (HP)",
    "CPC-GWH1": "CPC-GWH1(HP)",
    "CPC-HYD3": "CPC - HYD3 (HP)",
    "CPC-INDORE2-FRZ": "CPC-INDORE2-FRZ(HP)",
    "CPC-JAI1-FRZ": "CPC-JAI1-Frz (HP)",
    "CPC-K4": "CPC - Kolkata K4 (HP)",
    "CPC-KOL2-FRZ": "CPC-KOL2-FRZ(HP)",
    "CPC-LDH1": "CPC-LDH1 (HP)",
    "CPC-LKO1": "CPC - Lucknow (HP)",
    "CPC-M10": "CPC - Mumbai M10 (HP)",
    "CPC-MUM4": "CPC-MUM4",
    "CPC-NAGPUR2": "CPC-NAGPUR2(HP)",
    "CPC-NAGPURINDICOLD1": "CPC-NAGPURINDICOLD1 (HP)",
    "CPC-NOIDA1": "CPC - Noida1 (HP)",
    "CPC-NOIDA2-FRZ": "CPC-NOIDA2-FRZ(HP)",
    "CPC-PATNA2-FRZ": "CPC-PATNA2-FRZ (HP)",
    "CPC-PUNE3-FRZ": "CPC-PUNE3-FRZ (HP)",
    "CPC-RAIPUR1-FRZ": "CPC-RAIPUR1-FRZ (HP)",
    "CPC-RANCHI1": "CPC- RANCHI1 (HP)",
    "CPC-RPJ1": "CPC - Rajpura1 (HP)",
    "CPC-SURAT1": "CPC - SURAT1 (HP)",
    "CPC-VARANASI2": "CPC- VARANASI2",
    "CPC-VIJAY1-FRZ": "CPC-VIJAY1-FRZ (HP)",
    "CPC-VTZ1": "CPC-VTZ1(HP)",
}

NAME_TO_CODE = {v: k for k, v in CODE_TO_NAME.items()}


def code_for_name(warehouse_name: str) -> str | None:
    return NAME_TO_CODE.get(warehouse_name)


def name_for_code(code: str) -> str | None:
    return CODE_TO_NAME.get(code)
