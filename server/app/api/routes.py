from fastapi import APIRouter, HTTPException, Request
from ..models.responses import HardwareResponse, OfferResponse

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/hardware", response_model=list[HardwareResponse])
def hardware(request: Request):
    return request.app.state.database.list_hardware()


@router.get("/hardware/{hardware_id}/offers", response_model=list[OfferResponse])
def offers(hardware_id: str, request: Request):
    database = request.app.state.database
    if not database.hardware_exists(hardware_id):
        raise HTTPException(status_code=404, detail="Hardware not found")
    return database.list_offers(hardware_id)
