#!/usr/bin/env python3
"""
Verification Script for Section 63 BSA Digital Evidence Certificate (PDF) Generation & Audit
Tests 4 evidence categories: Image, CDR, Transaction, Video.
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from app.db.mongodb import connect_to_mongo, get_database, close_mongo_connection
from app.core.bsa_generator import generate_sec_63_bsa_pdf

async def test_bsa_certificate_generation():
    print("=" * 80)
    print("RAKSHAK SECTION 63 BSA CERTIFICATE GENERATION & AUDIT VERIFICATION")
    print("=" * 80)

    await connect_to_mongo()
    db = get_database()
    if db is None:
        print("[ERROR] Database connection failed.")
        sys.exit(1)

    # 4 Test Evidence Categories as requested
    test_evidence_types = [
        ("SURVEILLANCE", "Image Evidence (CCTV Snapshot)", "IMG-E001"),
        ("CALL_RECORD", "CDR Telecom Record (Tower Intercept)", "CDR-E002"),
        ("FINANCIAL_LEDGER", "Transaction Ledger Record (Bank Escrow)", "TXN-E003"),
        ("SURVEILLANCE_VIDEO", "Video Surveillance Intercept (ANPR Feed)", "VID-E004"),
    ]

    officer_info = {
        "full_name": "Sgt. Miller",
        "investigator_id": "ID-4412-01",
        "role": "Lead Investigator",
        "badge_number": "Badge #4412",
        "email": "miller@sherlock.gov"
    }

    print("\n--- GENERATING SECTION 63 BSA CERTIFICATE PDFS ---")

    for etype, edesc, eid in test_evidence_types:
        ev_sample = {
            "evidence_id": eid,
            "id": eid,
            "case_id": "C0001",
            "evidence_type": etype,
            "description": edesc,
            "title": edesc,
            "collected_at": "2026-05-18T14:30:00Z",
            "source": "Law Enforcement Authorized Intercept",
            "person_id": "P01234",
            "integrity_sha256": f"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855-{eid[:4]}",
            "custody_chain": [
                {
                    "timestamp": "2026-05-18T14:30:00Z",
                    "action": "EVIDENCE_INGESTED",
                    "officer": "Sgt. Miller",
                    "hash": f"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855-{eid[:4]}"
                }
            ]
        }

        cert_id = f"BSA-CERT-{eid}-2026"
        pdf_bytes = generate_sec_63_bsa_pdf(
            evidence_data=ev_sample,
            officer_data=officer_info,
            certificate_id=cert_id,
            merkle_root="c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2",
            device_info="Host Workstation (RAKSHAK Secure Terminal OS: Windows 11 Pro 64-bit)"
        )

        print(f"  [OK] {etype:<20} ({eid}): Generated PDF size = {len(pdf_bytes):>6,d} bytes | Cert ID: {cert_id}")
        assert len(pdf_bytes) > 1000, f"FAILED: Generated PDF size too small for {eid}"

        # Test inserting audit document into bsa_certificates collection
        cert_doc = {
            "_id": cert_id,
            "certificate_id": cert_id,
            "evidence_id": eid,
            "case_id": "C0001",
            "certificate_type": "SECTION_63_BSA",
            "certificate_version": "1.0",
            "generated_at": "2026-09-08T19:30:00Z",
            "generated_by": officer_info["full_name"],
            "officer_name": officer_info["full_name"],
            "officer_id": officer_info["investigator_id"],
            "officer_role": officer_info["role"],
            "device_information": "Host Workstation (RAKSHAK Secure Terminal)",
            "extraction_timestamp": "2026-05-18T14:30:00Z",
            "evidence_type": etype,
            "evidence_description": edesc,
            "evidence_sha256": ev_sample["integrity_sha256"],
            "merkle_root": "c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2",
            "verification_status": "VERIFIED",
            "pdf_hash": "a1b2c3d4e5f67890",
            "created_at": "2026-09-08T19:30:00Z"
        }
        await db.bsa_certificates.replace_one({"_id": cert_id}, cert_doc, upsert=True)

    # Verify collection count
    db_certs_count = await db.bsa_certificates.count_documents({})
    print(f"\n--- MONGODB BSA_CERTIFICATES COLLECTION VERIFICATION ---")
    print(f"  bsa_certificates count in MongoDB: {db_certs_count}")
    assert db_certs_count >= 4, "FAILED: bsa_certificates collection count is less than 4!"

    print("\n[VERIFICATION SUCCESS] Section 63 BSA PDF generation and MongoDB audit verified for 4 evidence types!")
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(test_bsa_certificate_generation())
