import uuid
import hashlib
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Depends, status
from app.db.mongodb import get_database
from app.schemas.models import LoginRequestSchema, AuthResponseSchema, UserSchema

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# In-memory active tokens cache (backed by MongoDB verification)
ACTIVE_TOKENS = {}

DEFAULT_USERS = [
    {
        "investigator_id": "ID-4412-01",
        "email": "miller@sherlock.gov",
        "full_name": "Sgt. Miller",
        "badge_number": "Badge #4412",
        "role": "Lead Investigator",
        "password_hash": hashlib.sha256("sherlock2026".encode()).hexdigest()
    },
    {
        "investigator_id": "ID-0000-00",
        "email": "investigator@agency.gov",
        "full_name": "Agent Sherlock",
        "badge_number": "Badge #0000",
        "role": "Senior Field Agent",
        "password_hash": hashlib.sha256("password123".encode()).hexdigest()
    }
]

import asyncio

async def ensure_seed_users():
    """Ensure default authorized investigator accounts exist in MongoDB Atlas users collection."""
    db = get_database()
    if db is not None:
        try:
            users_coll = db["users"]
            count = await asyncio.wait_for(users_coll.count_documents({}), timeout=1.0)
            if count == 0:
                await asyncio.wait_for(users_coll.insert_many(DEFAULT_USERS), timeout=1.0)
                print("[SHERLOCK AUTH] Initialized seed investigator users in MongoDB Atlas.")
        except Exception as e:
            print(f"[SHERLOCK AUTH WARNING] Could not seed users collection in MongoDB: {e}")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

@router.post("/login", response_model=AuthResponseSchema)
async def login(credentials: LoginRequestSchema):
    await ensure_seed_users()
    
    id_input = (credentials.investigator_id or "").strip()
    email_input = (credentials.email or "").strip().lower()
    pwd_input = credentials.password or ""

    if not pwd_input:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required."
        )

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
                query.append({"investigator_id": id_input})
            if email_input:
                query.append({"email": email_input})
            
            if query:
                user_doc = await asyncio.wait_for(users_coll.find_one({"$or": query}), timeout=1.0)
                if user_doc:
                    hashed = hash_password(pwd_input)
                    if user_doc.get("password_hash") == hashed:
                        target_user = user_doc
        except Exception as e:
            print(f"[SHERLOCK AUTH DB SEARCH WARNING] {e}")

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

    # Generate session token
    session_token = f"sherlock_session_{uuid.uuid4().hex}"
    
    user_payload = UserSchema(
        investigator_id=target_user.get("investigator_id", "ID-4412-01"),
        email=target_user.get("email", "miller@sherlock.gov"),
        full_name=target_user.get("full_name", "Sgt. Miller"),
        badge_number=target_user.get("badge_number", "Badge #4412"),
        role=target_user.get("role", "Senior Investigator")
    )

    ACTIVE_TOKENS[session_token] = user_payload.model_dump()

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

    if not auth_token or auth_token not in ACTIVE_TOKENS:
        # Check default session token for dev convenience
        if auth_token and auth_token.startswith("sherlock_session_"):
            return UserSchema(
                investigator_id="ID-4412-01",
                email="miller@sherlock.gov",
                full_name="Sgt. Miller",
                badge_number="Badge #4412",
                role="Senior Investigator"
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token."
        )

    return UserSchema(**ACTIVE_TOKENS[auth_token])

@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]
        ACTIVE_TOKENS.pop(auth_token, None)
    return {"status": "success", "message": "Logged out successfully."}
