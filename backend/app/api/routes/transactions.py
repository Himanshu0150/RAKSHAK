from fastapi import APIRouter, Query
from typing import List, Optional
from app.core.context_resolver import get_scoped_transactions

router = APIRouter(tags=["Financial / AML"])

@router.get("/api/transactions", response_model=List[dict])
@router.get("/api/financial/transactions", response_model=List[dict])
async def get_transactions(
    limit: int = 50,
    skip: int = 0,
    account_id: Optional[str] = None,
    case_id: Optional[str] = None
):
    limit_int = int(limit) if not isinstance(limit, int) and str(limit).isdigit() else 50
    skip_int = int(skip) if not isinstance(skip, int) and str(skip).isdigit() else 0
    aid_str = account_id if isinstance(account_id, str) else None
    cid_str = case_id if isinstance(case_id, str) else None

    raw_txns = await get_scoped_transactions(case_id=cid_str, account_id=aid_str, limit=limit_int, skip=skip_int)
    
    formatted = []
    seen = set()
    for t in raw_txns:
        txid = t.get("transaction_id") or f"{t.get('source_account_id')}-{t.get('timestamp')}"
        if txid in seen:
            continue
        seen.add(txid)

        amt = float(t.get("amount") or 0)
        formatted.append({
            "id": txid,
            "sourceAccount": t.get("source_account_id") or "Unknown",
            "sourceOwnerName": t.get("source_account_id") or "Unknown Entity",
            "targetAccount": t.get("destination_account_id") or "Unknown",
            "targetOwnerName": t.get("destination_account_id") or "Unknown Beneficiary",
            "amount": amt,
            "currency": "INR",
            "timestamp": t.get("timestamp", ""),
            "transactionType": t.get("transaction_type", "WIRE_TRANSFER"),
            "flaggedStructuring": amt > 50000 and amt < 100000,
            "flaggedLayering": amt >= 100000,
            "bankName": t.get("institution_type", "Commercial Bank")
        })
    return formatted
