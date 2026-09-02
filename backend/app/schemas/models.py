from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class CaseSchema(BaseModel):
    case_id: str
    case_number: str
    title: str
    summary: str
    priority: str
    status: str
    lead_investigator: str
    jurisdiction: Optional[str] = "Precinct-7 Special Enforcement"
    date_opened: Optional[str] = None
    subjects: List[Dict[str, Any]] = []
    observed_entities: List[Dict[str, Any]] = []
    evidence_ids: List[str] = []

class EntitySchema(BaseModel):
    id: str
    name: str
    type: str  # person, organization, phone, account, vehicle, location
    flagged_risk: str = "LOW"
    aliases: List[str] = []
    attributes: Dict[str, Any] = {}

class EvidenceSchema(BaseModel):
    evidence_id: str
    case_id: Optional[str] = None
    title: str
    evidence_type: str
    sha256_hash: str
    collected_by: str
    verified: bool = True
    tampered: bool = False

class CDRSchema(BaseModel):
    cdr_id: str
    caller_phone: str
    receiver_phone: str
    duration_seconds: int
    timestamp: str
    cell_tower_id: str
    flagged_anomaly: bool = False

class TransactionSchema(BaseModel):
    transaction_id: str
    source_account: str
    target_account: str
    amount: float
    currency: str = "INR"
    timestamp: str
    txn_type: str
    flagged_aml: bool = False

class RelationshipSchema(BaseModel):
    relationship_id: str
    source_id: str
    target_id: str
    relationship_type: str
    confidence: float = 1.0

class TimelineEventSchema(BaseModel):
    event_id: str
    case_id: Optional[str] = None
    timestamp: str
    title: str
    description: str
    category: str
    entity_ids: List[str] = []

class AnalyticsSummarySchema(BaseModel):
    total_records: int
    active_cases_count: int
    indexed_entities_count: int
    evidence_records_count: int
    cdrs_count: int
    transactions_count: int
    critical_cases_count: int
    anomalies_count: int
    tamper_simulated: bool = False

class SearchResponseSchema(BaseModel):
    query: str
    total_matches: int
    entities: List[EntitySchema]
    cases: List[CaseSchema]

class UserSchema(BaseModel):
    investigator_id: str
    email: str
    full_name: str
    badge_number: str
    role: str = "Senior Investigator"

class LoginRequestSchema(BaseModel):
    investigator_id: Optional[str] = None
    email: Optional[str] = None
    password: str
    remember_device: Optional[bool] = False

class AuthResponseSchema(BaseModel):
    token: str
    user: UserSchema
    message: str = "Authentication successful"

