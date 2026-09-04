"""Network API endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Corridor, TrackSection, Asset, BlockPlan, BlockWindow, PlanStatus
from app.schemas import NetworkOut, StationNode, SectionEdge, AssetOut

router = APIRouter()


@router.get("/network", response_model=NetworkOut)
def get_network(db: Session = Depends(get_db)):
    """Get the railway network topology for map visualization."""
    corridor = db.query(Corridor).first()
    if not corridor:
        return NetworkOut(corridor="", stations=[], sections=[])

    sections = db.query(TrackSection).filter(
        TrackSection.corridor_id == corridor.id
    ).order_by(TrackSection.id).all()

    # Build unique stations
    seen = set()
    stations = []
    for s in sections:
        if s.from_station_code not in seen:
            stations.append(StationNode(
                code=s.from_station_code,
                name=s.from_station,
                lat=s.from_lat or 0,
                lng=s.from_lng or 0,
            ))
            seen.add(s.from_station_code)
        if s.to_station_code not in seen:
            stations.append(StationNode(
                code=s.to_station_code,
                name=s.to_station,
                lat=s.to_lat or 0,
                lng=s.to_lng or 0,
            ))
            seen.add(s.to_station_code)

    # Build section edges with assets
    section_edges = []
    for s in sections:
        assets = db.query(Asset).filter(Asset.section_id == s.id).all()
        asset_outs = []
        for a in assets:
            out = AssetOut.model_validate(a)
            out.department_name = a.department.name if a.department else None
            out.section_code = s.section_code
            asset_outs.append(out)

        # Count active blocks
        active_blocks = db.query(BlockPlan).join(BlockWindow).filter(
            BlockWindow.section_id == s.id,
            BlockPlan.status.in_([PlanStatus.OPTIMIZED, PlanStatus.APPROVED]),
        ).count()

        section_edges.append(SectionEdge(
            id=s.id,
            section_code=s.section_code,
            from_station=s.from_station,
            to_station=s.to_station,
            length_km=s.length_km,
            from_lat=s.from_lat or 0,
            from_lng=s.from_lng or 0,
            to_lat=s.to_lat or 0,
            to_lng=s.to_lng or 0,
            assets=asset_outs,
            active_blocks=active_blocks,
        ))

    return NetworkOut(
        corridor=corridor.name,
        stations=stations,
        sections=section_edges,
    )
