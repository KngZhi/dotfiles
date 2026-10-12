#!/usr/bin/env python3
"""Match K2046 raw stock-check details by product ID; no network or writes to ERP."""

import argparse
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
import sys


def positive_id(value, label):
    if type(value) is not int or value <= 0:
        raise ValueError(f"{label}: expected a positive integer ID")
    return value


def quantity(value, label):
    if isinstance(value, bool) or value is None or str(value).strip() == "":
        raise ValueError(f"{label}: missing or invalid quantity")
    try:
        result = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError(f"{label}: invalid quantity") from exc
    if not result.is_finite():
        raise ValueError(f"{label}: quantity must be finite")
    return result


def decimal_text(value):
    return format(value, "f")


def match_checks(products, checks, require_complete=False):
    if not isinstance(products, list) or not products:
        raise ValueError("products must be a nonempty array")
    if not isinstance(checks, dict) or not all(
        isinstance(checks.get(key), list) for key in ("headers", "details")
    ):
        raise ValueError("checks must contain headers and details arrays")
    product_map = {}
    for row in products:
        pid = positive_id(row.get("id"), "product.id")
        sku = row.get("productNumber")
        if pid in product_map or not isinstance(sku, str) or not sku.strip():
            raise ValueError(f"product {pid}: duplicate ID or missing current SKU")
        product_map[pid] = sku.strip()

    headers = {}
    for row in checks["headers"]:
        hid = positive_id(row.get("id"), "header.id")
        if hid in headers:
            raise ValueError(f"duplicate header ID {hid}")
        if row.get("deleted"):
            raise ValueError(f"header {hid}: deleted record needs separate historical review")
        if row.get("status") not in ("Checked", "NotChecked") or type(row.get("temp")) is not bool:
            raise ValueError(f"header {hid}: unknown status or missing draft flag")
        if not isinstance(row.get("checkId"), str) or not row["checkId"].strip():
            raise ValueError(f"header {hid}: missing check number")
        if type(row.get("detailsCount")) is not int or row["detailsCount"] < 0:
            raise ValueError(f"header {hid}: invalid detailsCount")
        headers[hid] = row

    seen = set()
    received = Counter()
    matched = []
    totals = defaultdict(Decimal)
    for row in checks["details"]:
        did = positive_id(row.get("id"), "detail.id")
        if did in seen:
            raise ValueError(f"duplicate detail ID {did}")
        seen.add(did)
        if row.get("deleted"):
            raise ValueError(f"detail {did}: deleted record needs separate historical review")
        hid = positive_id(row.get("stockCheckId"), f"detail {did}.stockCheckId")
        if hid not in headers:
            raise ValueError(f"detail {did}: missing header {hid}")
        header = headers[hid]
        received[hid] += 1
        pid = positive_id(row.get("productId"), f"detail {did}.productId")
        nested = row.get("product")
        if isinstance(nested, dict) and nested.get("id") is not None and nested["id"] != pid:
            raise ValueError(f"detail {did}: productId disagrees with product.id")
        if row.get("status") != header["status"]:
            raise ValueError(f"detail {did}: status disagrees with header")
        if pid not in product_map:
            continue
        wid = positive_id(row.get("warehouseId"), f"detail {did}.warehouseId")
        before = quantity(row.get("oldNumber"), f"detail {did}.oldNumber")
        after = quantity(row.get("newNumber"), f"detail {did}.newNumber")
        historical = row.get("productNumber")
        if not isinstance(historical, str) or not historical.strip():
            raise ValueError(f"detail {did}: missing historical SKU")
        effective = header["status"] == "Checked" and not header["temp"]
        delta = after - before
        applied = delta if effective else Decimal(0)
        totals[(pid, wid)] += applied
        matched.append({
            "detail_id": did, "check_id": hid, "check_number": header["checkId"],
            "product_id": pid, "current_sku": product_map[pid],
            "historical_sku": historical, "warehouse_id": wid,
            "status": header["status"], "temp": header["temp"],
            "before": decimal_text(before), "after": decimal_text(after),
            "delta": decimal_text(delta), "applied_delta": decimal_text(applied),
            "included": effective,
        })
    for hid, header in headers.items():
        if received[hid] > header["detailsCount"]:
            raise ValueError(f"header {hid}: received more than detailsCount")
        if require_complete and received[hid] != header["detailsCount"]:
            raise ValueError(f"header {hid}: incomplete details ({received[hid]}/{header['detailsCount']})")
    return {
        "coverage": {
            "products": len(product_map), "headers_supplied": len(headers),
            "details_supplied": len(seen), "details_matched": len(matched),
            "included": sum(row["included"] for row in matched),
            "complete_details_verified": require_complete,
            "note": "Coverage describes supplied data, not API pagination or historical versions.",
        },
        "matches": sorted(matched, key=lambda row: (row["check_id"], row["detail_id"])),
        "adjustments": [
            {"product_id": pid, "current_sku": product_map[pid], "warehouse_id": wid,
             "applied_delta": decimal_text(delta)}
            for (pid, wid), delta in sorted(totals.items())
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--products", type=Path, required=True)
    parser.add_argument("--checks", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--require-complete-details", action="store_true")
    args = parser.parse_args()
    if args.output.resolve() in (args.products.resolve(), args.checks.resolve()):
        parser.error("output must not overwrite either input file")
    try:
        result = match_checks(
            json.loads(args.products.read_text()), json.loads(args.checks.read_text()),
            args.require_complete_details,
        )
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    except (ValueError, TypeError, AttributeError, OSError) as exc:
        print(f"Stock-check audit failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result["coverage"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
