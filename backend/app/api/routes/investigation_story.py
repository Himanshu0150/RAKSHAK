from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional
from app.db.mongodb import get_database
from app.core.story_generator import generate_case_investigation_story

router = APIRouter(prefix="/api/cases", tags=["Investigation Story"])

@router.get("/{case_id}/investigation-story", response_model=dict)
async def get_investigation_story(case_id: str):
    """
    Fetches the chronological Investigation Story for the specified case_id from MongoDB.
    If no story exists yet, automatically generates and stores a new story.
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")

    # 1. Check if story already exists in investigation_stories collection
    story_doc = await db.investigation_stories.find_one({"case_id": case_id}, {"_id": 0})
    
    if not story_doc:
        # Auto-generate story if not existing
        try:
            story_doc = await generate_case_investigation_story(case_id=case_id)
        except ValueError as ve:
            raise HTTPException(status_code=404, detail=str(ve))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate investigation story: {e}")

    # 2. Fetch story items from investigation_story_items collection sorted by sequence
    items_cursor = db.investigation_story_items.find({"case_id": case_id}, {"_id": 0}).sort("sequence", 1)
    items = await items_cursor.to_list(length=500)
    
    story_doc["items"] = items if items else story_doc.get("items", [])
    return story_doc


@router.post("/{case_id}/investigation-story/generate", response_model=dict)
async def generate_investigation_story_endpoint(case_id: str, payload: Optional[dict] = Body(None)):
    """
    Triggers chronological case reconstruction & story generation for case_id.
    Stores results in investigation_stories and investigation_story_items MongoDB collections.
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")

    generated_by = (payload.get("generated_by") if payload else None) or "Lead Investigator"

    try:
        story_doc = await generate_case_investigation_story(case_id=case_id, generated_by=generated_by)
        
        items_cursor = db.investigation_story_items.find({"case_id": case_id}, {"_id": 0}).sort("sequence", 1)
        items = await items_cursor.to_list(length=500)
        story_doc["items"] = items if items else story_doc.get("items", [])
        
        return story_doc
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Story generation failed: {e}")
