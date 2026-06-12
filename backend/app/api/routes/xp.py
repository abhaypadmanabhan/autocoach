
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.routes.documents import get_user_id_from_token
from app.core.supabase import supabase_admin
from app.services.usage import get_or_create_daily_usage

router = APIRouter()
logger = logging.getLogger(__name__)

XP_REDEMPTION_COST = 100


class RedeemXPResponse(BaseModel):
    success: bool
    message: str
    new_total_xp: int
    credits_added: int


@router.post("/redeem", response_model=RedeemXPResponse)
async def redeem_xp(
    user_id: UUID = Depends(get_user_id_from_token),
):
    # Deduct is atomic: the `.eq("total_xp", current_xp)` predicate runs inside a single
    # `UPDATE ... WHERE` statement; Postgres row-locks serialize concurrent requests,
    # and any losing CAS returns zero rows. Deduct + credit are NOT in one transaction —
    # see tasks/security-followups.md §1 for the residual partial-commit risk.


    user_res = (
        supabase_admin.table("users")
        .select("total_xp")
        .eq("id", str(user_id))
        .single()
        .execute()
    )
    
    if not user_res.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    current_xp = user_res.data.get("total_xp", 0)
    
    if current_xp < 100:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient XP. You have {current_xp}, but need 100."
        )
        
    # Optimistic update: verified by checking if row is returned
    new_xp = current_xp - 100
    update_res = (
        supabase_admin.table("users")
        .update({"total_xp": new_xp})
        .eq("id", str(user_id))
        .eq("total_xp", current_xp)  # Concurrency check
        .execute()
    )
    
    if not update_res.data:
        raise HTTPException(
            status_code=409, 
            detail="XP transaction failed due to concurrent update. Please try again."
        )
        
    # 2. Grant extra quiz credit
    try:
        # Ensure usage record exists
        usage = get_or_create_daily_usage(user_id)
        current_extra = usage.get("extra_quizzes", 0)
        
        supabase_admin.table("user_daily_usage").update(
            {"extra_quizzes": current_extra + 1}
        ).eq("user_id", str(user_id)).eq("date", usage["date"]).execute()
        
    except Exception as e:
        logger.error(f"Failed to grant credit after deducting XP for user {user_id}: {e}")
        # Attempt refund
        supabase_admin.table("users").update({"total_xp": current_xp}).eq(
            "id", str(user_id)
        ).eq("total_xp", new_xp).execute()
        raise HTTPException(status_code=500, detail="Redemption failed. XP refunded.")

    return RedeemXPResponse(
        success=True,
        message="Redemption successful! +1 Quiz Credit added.",
        new_total_xp=new_xp,
        credits_added=1
    )
