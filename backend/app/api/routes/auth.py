import uuid
import hashlib
import time
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Depends, status
from app.db.mongodb import get_database
from app.schemas.models import LoginRequestSchema, AuthResponseSchema, UserSchema

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# In-memory active tokens cache (backed by MongoDB verification & expiration timestamps)
# Structure: { token: { "user": dict, "created_at": float, "expires_at": float } }
ACTIVE_TOKENS = {}
SESSION_TTL_SECONDS = 86400  # 24 hours validity

DEFAULT_USERS = [
    {
        "investigator_id": "RAKSHAK-LEAD-001",
        "email": "lead.investigator@rakshak.gov.in",
        "full_name": "Lead Investigator",
        "badge_number": "Badge #RK-001",
        "role": "Lead Investigator",
        "authorized_cases": ["*"],
        "password_hash": hashlib.sha256("Rakshak@Lead2026".encode()).hexdigest()
    },
    {
        "investigator_id": "RAKSHAK-SPEC-001",
        "email": "forensic.analyst@rakshak.gov.in",
        "full_name": "Forensic Analyst",
        "badge_number": "Badge #RK-002",
        "role": "Forensic Analyst",
        "authorized_cases": ["CASE-CYBER-8841", "CASE-NARCO-9921", "CASE-000001", "CASE-000002", "C0001", "C0002"],
        "password_hash": hashlib.sha256("Rakshak@Forensic2026".encode()).hexdigest()
    },
    {
        "investigator_id": "RAKSHAK-FIELD-001",
        "email": "field.investigator@rakshak.gov.in",
        "full_name": "Field Investigator",
        "badge_number": "Badge #RK-003",
        "role": "Field Investigator",
        "authorized_cases": ["CASE-CYBER-8841", "C0001"],
        "password_hash": hashlib.sha256("Rakshak@Field2026".encode()).hexdigest()
    }
]

async def ensure_seed_users():
    """Ensure default authorized investigator accounts exist in MongoDB users collection."""
    db = get_database()
    if db is not None:
        try:
            users_coll = db["users"]
            for u in DEFAULT_USERS:
                await users_coll.update_one(
                    {"investigator_id": u["investigator_id"]},
                    {"$set": u},
                    upsert=True
                )
            print("[RAKSHAK AUTH] Initialized three-tier RBAC seed investigator users in MongoDB.")
        except Exception as e:
            print(f"[RAKSHAK AUTH WARNING] Could not seed users collection in MongoDB: {e}")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

@router.post("/login", response_model=AuthResponseSchema)
async def login(credentials: LoginRequestSchema):
    await ensure_seed_users()
    
    id_input = (credentials.investigator_id or "").strip()
    email_input = (credentials.email or "").strip().lower()
    pwd_input = credentials.password or ""

    if not id_input and not email_input:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Investigator ID or Organization Email is required."
        )

    target_user = None
    db = get_database()
    
    # First query MongoDB Atlas users collection
    if db is not None:
        try:
            users_coll = db["users"]
            query = []
            if id_input:
                query.append({"investigator_id": {"$regex": f"^{id_input}$", "$options": "i"}})
            if email_input:
                query.append({"email": email_input})
            
            if query:
                user_doc = await asyncio.wait_for(users_coll.find_one({"$or": query}), timeout=1.0)
                if user_doc:
                    hashed = hash_password(pwd_input)
                    if user_doc.get("password_hash") == hashed:
                        target_user = user_doc
        except Exception as e:
            print(f"[RAKSHAK AUTH DB SEARCH WARNING] {e}")

    # Fallback to default user matching if DB query returns nothing or during offline fallback
    if not target_user:
        hashed = hash_password(pwd_input)
        for seed_user in DEFAULT_USERS:
            matches_id = id_input and seed_user["investigator_id"].lower() == id_input.lower()
            matches_email = email_input and seed_user["email"].lower() == email_input
            if (matches_id or matches_email) and seed_user["password_hash"] == hashed:
                target_user = seed_user
                break

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Access denied."
        )

    # Generate session token with 24h expiration
    session_token = f"sherlock_session_{uuid.uuid4().hex}"
    now = time.time()
    expires_at = now + SESSION_TTL_SECONDS
    
    user_payload = UserSchema(
        investigator_id=target_user.get("investigator_id", "INV-LEAD-001"),
        email=target_user.get("email", "miller@sherlock.gov"),
        full_name=target_user.get("full_name", "Sgt. Miller"),
        badge_number=target_user.get("badge_number", "Badge #4412"),
        role=target_user.get("role", "Lead Investigator"),
        authorized_cases=target_user.get("authorized_cases", ["CASE-CYBER-8841", "CASE-NARCO-9921", "CASE-000001", "C0001"])
    )

    session_data = {
        "user": user_payload.model_dump(),
        "created_at": now,
        "expires_at": expires_at
    }

    ACTIVE_TOKENS[session_token] = session_data

    # Persist session to MongoDB if database is available
    if db is not None:
        try:
            sessions_coll = db["sessions"]
            await sessions_coll.update_one(
                {"token": session_token},
                {"$set": {
                    "token": session_token,
                    "user": user_payload.model_dump(),
                    "created_at": now,
                    "expires_at": expires_at
                }},
                upsert=True
            )
        except Exception as e:
            print(f"[SHERLOCK AUTH SESSION SAVE WARNING] {e}")

    return AuthResponseSchema(
        token=session_token,
        user=user_payload,
        message="Authentication successful. Session established."
    )

@router.get("/me", response_model=UserSchema)
async def get_current_user(authorization: Optional[str] = Header(None), token: Optional[str] = None):
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]
    elif token:
        auth_token = token

    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing."
        )

    now = time.time()
    user_payload_dict = None

    # 1. Check in-memory active tokens
    if auth_token in ACTIVE_TOKENS:
        session_info = ACTIVE_TOKENS[auth_token]
        # Check for expired token
        if session_info.get("expires_at", 0) < now:
            ACTIVE_TOKENS.pop(auth_token, None)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session token has expired. Please log in again."
            )
        user_payload_dict = session_info["user"]

    # 2. Check MongoDB sessions collection if not in memory (e.g., across backend restart)
    if not user_payload_dict:
        db = get_database()
        if db is not None:
            try:
                sessions_coll = db["sessions"]
                session_doc = await asyncio.wait_for(
                    sessions_coll.find_one({"token": auth_token}),
                    timeout=1.0
                )
                if session_doc:
                    if session_doc.get("expires_at", 0) < now:
                        await sessions_coll.delete_one({"token": auth_token})
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Session token has expired. Please log in again."
                        )
                    user_payload_dict = session_doc.get("user")
                    # Re-cache in memory
                    ACTIVE_TOKENS[auth_token] = {
                        "user": user_payload_dict,
                        "created_at": session_doc.get("created_at", now),
                        "expires_at": session_doc.get("expires_at", now + SESSION_TTL_SECONDS)
                    }
            except HTTPException:
                raise
            except Exception as e:
                print(f"[SHERLOCK AUTH SESSION LOOKUP WARNING] {e}")

    if not user_payload_dict:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token."
        )

    return UserSchema(**user_payload_dict)

@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    logged_user_id = "UNKNOWN"
    logged_user_role = "UNKNOWN"
    
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]
        
        # Remove from memory
        if auth_token in ACTIVE_TOKENS:
            session_info = ACTIVE_TOKENS.pop(auth_token, {})
            u_dict = session_info.get("user", {})
            logged_user_id = u_dict.get("investigator_id", logged_user_id)
            logged_user_role = u_dict.get("role", logged_user_role)

        # Remove from MongoDB
        db = get_database()
        if db is not None:
            try:
                sessions_coll = db["sessions"]
                session_doc = await sessions_coll.find_one_and_delete({"token": auth_token})
                if session_doc and logged_user_id == "UNKNOWN":
                    u_dict = session_doc.get("user", {})
                    logged_user_id = u_dict.get("investigator_id", logged_user_id)
                    logged_user_role = u_dict.get("role", logged_user_role)
            except Exception as e:
                print(f"[SHERLOCK AUTH LOGOUT DB WARNING] {e}")

    return {"status": "success", "message": "Logged out successfully."}


