"""
Seed data script for Railway Maintenance Block Planning System
PROTOTYPE USING REALISTIC RAILWAY OPERATIONS DATA FOR TAMIL NADU (SOUTHERN RAILWAY)

Corridor: Chennai Central (MAS) - Arakkonam (AJJ) - Katpadi (KPD) - Jolarpettai (JTJ) - Salem (SA)
Covers key trunk sections across the state of Tamil Nadu.
Departments: Engineering (ENG), Traction Distribution (TD), Signal & Telecom (S&T)
"""

import random
import sys
import os
from datetime import date, time, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal, engine
from app.database.base import Base
from app.models import (
    Department, Corridor, TrackSection, Asset, AssetType, AssetStatus,
    CriticalityLevel, Train, TrainType, TrainPriority, TrainSchedule,
    TrainDirection, MaintenanceTask, MaintenanceType, TaskStatus,
    UrgencyLevel, BlockWindow, BlockStatus, PlanningConstraint,
    MaintenanceHistory,
)

# Seed for reproducibility
random.seed(42)


def seed_departments(db):
    """Seed the 3 railway maintenance departments."""
    departments = [
        Department(
            name="Engineering",
            code="ENG",
            description="Responsible for track, rails, sleepers, switches, bridges, and civil infrastructure"
        ),
        Department(
            name="Traction Distribution",
            code="TD",
            description="Responsible for 25kV AC OHE, substations, feeding posts, and power distribution"
        ),
        Department(
            name="Signal & Telecommunication",
            code="SNT",
            description="Responsible for electronic interlocking, signals, point machines, track circuits, and OFC"
        ),
    ]
    db.add_all(departments)
    db.flush()
    return {d.code: d for d in departments}


def seed_corridor_and_sections(db):
    """Seed the Tamil Nadu Southern Railway mainline corridor with real coordinates."""
    corridor = Corridor(
        corridor_code="MAS-SA",
        name="Chennai Central - Salem Junction Corridor",
        description="Major electrified high-density trunk route across Tamil Nadu connecting Chennai, Vellore, and Salem (Southern Railway)"
    )
    db.add(corridor)
    db.flush()

    # Tamil Nadu Stations with real geographical coordinates
    stations = [
        ("MGR Chennai Central", "MAS", 13.0827, 80.2707),
        ("Arakkonam Junction", "AJJ", 13.0783, 79.6682),
        ("Katpadi Junction", "KPD", 12.9698, 79.1360),
        ("Jolarpettai Junction", "JTJ", 12.5621, 78.5779),
        ("Salem Junction", "SA", 11.6643, 78.1460),
    ]

    sections = []
    for i in range(len(stations) - 1):
        s_from = stations[i]
        s_to = stations[i + 1]
        # Approximate track distance
        approx_km = [69.0, 61.0, 84.0, 120.0][i]
        section = TrackSection(
            corridor_id=corridor.id,
            section_code=f"{s_from[1]}-{s_to[1]}",
            from_station=s_from[0],
            to_station=s_to[0],
            from_station_code=s_from[1],
            to_station_code=s_to[1],
            length_km=approx_km,
            available=True,
            from_lat=s_from[2],
            from_lng=s_from[3],
            to_lat=s_to[2],
            to_lng=s_to[3],
        )
        sections.append(section)

    db.add_all(sections)
    db.flush()
    return corridor, sections


def seed_assets(db, departments, sections):
    """Seed 28 railway assets across Tamil Nadu mainline sections."""
    assets_data = [
        # Track assets (Engineering)
        ("TK-001", "Track Segment MAS-AJJ Fast Main Line", AssetType.TRACK, "ENG", 0, 0.3, CriticalityLevel.HIGH, 72.0),
        ("TK-002", "Track Segment MAS-AJJ Suburban Line", AssetType.TRACK, "ENG", 0, 0.7, CriticalityLevel.MEDIUM, 85.0),
        ("TK-003", "Track Segment AJJ-KPD Up Main Line", AssetType.TRACK, "ENG", 1, 0.4, CriticalityLevel.HIGH, 58.0),
        ("TK-004", "Track Segment KPD-JTJ Down Main Line", AssetType.TRACK, "ENG", 2, 0.5, CriticalityLevel.HIGH, 65.0),
        ("TK-005", "Track Segment JTJ-SA Morappur Ghat Section", AssetType.TRACK, "ENG", 3, 0.5, CriticalityLevel.MEDIUM, 78.0),
        ("TK-006", "Track Segment AJJ Yard Loop Line", AssetType.TRACK, "ENG", 1, 0.8, CriticalityLevel.LOW, 90.0),
        # Bridges (Engineering)
        ("BR-001", "Palar River Rail Bridge No. 128 (near Katpadi)", AssetType.BRIDGE, "ENG", 1, 0.5, CriticalityLevel.CRITICAL, 70.0),
        ("BR-002", "Cooum River Rail Bridge No. 4 (Chennai)", AssetType.BRIDGE, "ENG", 0, 0.2, CriticalityLevel.HIGH, 80.0),
        # Switches (Engineering)
        ("SW-001", "Turnout Point No. 1 MAS Terminal", AssetType.SWITCH, "ENG", 0, 0.1, CriticalityLevel.CRITICAL, 68.0),
        ("SW-002", "Turnout Switch No. 4 Arakkonam Jn", AssetType.SWITCH, "ENG", 0, 0.9, CriticalityLevel.HIGH, 75.0),
        ("SW-003", "Turnout Switch No. 7 Katpadi Jn", AssetType.SWITCH, "ENG", 1, 0.95, CriticalityLevel.MEDIUM, 82.0),
        # Signals (S&T)
        ("SIG-001", "Home Signal MGR Chennai Central", AssetType.SIGNAL, "SNT", 0, 0.05, CriticalityLevel.CRITICAL, 88.0),
        ("SIG-002", "Starter Signal Arakkonam Junction", AssetType.SIGNAL, "SNT", 0, 0.95, CriticalityLevel.HIGH, 76.0),
        ("SIG-003", "Distant Signal Katpadi Junction", AssetType.SIGNAL, "SNT", 1, 0.1, CriticalityLevel.HIGH, 91.0),
        ("SIG-004", "Home Signal Jolarpettai Junction", AssetType.SIGNAL, "SNT", 2, 0.92, CriticalityLevel.CRITICAL, 55.0),
        ("SIG-005", "Automatic Block Signal Morappur", AssetType.SIGNAL, "SNT", 3, 0.4, CriticalityLevel.MEDIUM, 85.0),
        ("SIG-006", "Home Signal Salem Junction", AssetType.SIGNAL, "SNT", 3, 0.9, CriticalityLevel.HIGH, 79.0),
        # Telecom (S&T)
        ("TEL-001", "OFC Optical Fiber Route MAS-AJJ", AssetType.TELECOM, "SNT", 0, 0.5, CriticalityLevel.MEDIUM, 92.0),
        ("TEL-002", "OFC Optical Fiber Route KPD-JTJ", AssetType.TELECOM, "SNT", 2, 0.5, CriticalityLevel.LOW, 88.0),
        # OHE (Traction Distribution)
        ("OHE-001", "25kV AC Catenary MAS-AJJ Section", AssetType.OHE, "TD", 0, 0.5, CriticalityLevel.HIGH, 74.0),
        ("OHE-002", "25kV AC Catenary AJJ-KPD Section", AssetType.OHE, "TD", 1, 0.5, CriticalityLevel.HIGH, 60.0),
        ("OHE-003", "25kV AC Catenary KPD-JTJ Section", AssetType.OHE, "TD", 2, 0.5, CriticalityLevel.MEDIUM, 83.0),
        ("OHE-004", "25kV AC Catenary JTJ-SA Section", AssetType.OHE, "TD", 3, 0.5, CriticalityLevel.MEDIUM, 87.0),
        # Substations (Traction Distribution)
        ("SUB-001", "Traction Substation (TSS) Arakkonam", AssetType.SUBSTATION, "TD", 0, 0.85, CriticalityLevel.CRITICAL, 71.0),
        ("SUB-002", "Traction Substation (TSS) Katpadi", AssetType.SUBSTATION, "TD", 1, 0.9, CriticalityLevel.HIGH, 77.0),
        # Level Crossings (Engineering)
        ("LC-001", "Level Crossing LC-48 Tiruvallur", AssetType.LEVEL_CROSSING, "ENG", 0, 0.6, CriticalityLevel.HIGH, 65.0),
        # Explicit SIH Demo Benchmark Assets
        ("TK-014", "Track Section AJJ-KPD Walajah Curve Main", AssetType.TRACK, "ENG", 1, 0.5, CriticalityLevel.HIGH, 38.0),
        ("OHE-008", "OHE Catenary Katpadi West Approach", AssetType.OHE, "TD", 1, 0.8, CriticalityLevel.MEDIUM, 58.0),
    ]

    today = date.today()
    assets = []
    for code, name, atype, dept_code, section_idx, pos, crit, cond in assets_data:
        days_since = random.randint(10, 120)
        days_until = random.randint(-5, 60)

        # Calibrated values for demo benchmark assets
        if code == "TK-014":
            cond = 38.0
            availability = 72.0
            days_until = -4  # Overdue by 4 days
            status = AssetStatus.DEGRADED
        elif code == "OHE-008":
            cond = 58.0
            availability = 84.0
            days_until = 2  # Due in 2 days
            status = AssetStatus.OPERATIONAL
        elif code == "SIG-003":
            cond = 91.0
            availability = 98.0
            days_until = 35  # Healthy
            status = AssetStatus.OPERATIONAL
        else:
            status = AssetStatus.OPERATIONAL
            if cond < 50:
                status = AssetStatus.FAILED
            elif cond < 65:
                status = AssetStatus.DEGRADED
            availability = min(100.0, max(50.0, cond + random.uniform(-10, 10)))

        asset = Asset(
            asset_code=code,
            name=name,
            asset_type=atype,
            department_id=departments[dept_code].id,
            location=f"Section {sections[section_idx].section_code}",
            section_id=sections[section_idx].id,
            criticality=crit,
            condition_score=round(cond, 1),
            availability=round(availability, 1),
            last_maintenance_date=today - timedelta(days=days_since),
            next_due_date=today + timedelta(days=days_until),
            status=status,
            position_on_section=pos,
        )
        assets.append(asset)

    db.add_all(assets)
    db.flush()
    return assets


def seed_trains(db):
    """Seed 15 authentic Southern Railway / Tamil Nadu trains."""
    trains_data = [
        ("20607", "Vande Bharat Express (MAS-MYS)", TrainType.SHATABDI, TrainPriority.CRITICAL),
        ("12007", "Chennai - Mysuru Shatabdi", TrainType.SHATABDI, TrainPriority.CRITICAL),
        ("12675", "Kovai Superfast Express (MAS-CBE)", TrainType.SUPERFAST, TrainPriority.HIGH),
        ("12671", "Nilgiri Superfast Express (MAS-MTP)", TrainType.SUPERFAST, TrainPriority.HIGH),
        ("12673", "Cheran Superfast Express (MAS-CBE)", TrainType.SUPERFAST, TrainPriority.HIGH),
        ("12685", "Chennai - Mangalore Central SF", TrainType.SUPERFAST, TrainPriority.HIGH),
        ("12601", "Mangalore Superfast Mail", TrainType.SUPERFAST, TrainPriority.HIGH),
        ("12639", "Brindavan Express (MAS-SBC)", TrainType.EXPRESS, TrainPriority.MEDIUM),
        ("16089", "Yelagiri Express (MAS-JTJ)", TrainType.EXPRESS, TrainPriority.MEDIUM),
        ("16057", "Sapthagiri Express", TrainType.EXPRESS, TrainPriority.MEDIUM),
        ("66017", "MAS-AJJ Suburban MEMU", TrainType.PASSENGER, TrainPriority.LOW),
        ("66021", "AJJ-KPD MEMU Passenger", TrainType.PASSENGER, TrainPriority.LOW),
        ("BGCT1", "BCN Goods - Salem Steel Rake", TrainType.GOODS, TrainPriority.LOW),
        ("BGCT2", "BOXN Goods - Ennore to Mettur Coal", TrainType.GOODS, TrainPriority.LOW),
        ("BGCT3", "BTPN Goods - CPCL Chennai Petroleum", TrainType.GOODS, TrainPriority.LOW),
    ]

    trains = []
    for number, name, ttype, priority in trains_data:
        train = Train(
            train_number=number,
            train_name=name,
            train_type=ttype,
            priority=priority,
        )
        trains.append(train)

    db.add_all(trains)
    db.flush()
    return trains


def seed_train_schedules(db, trains, sections):
    """Seed train schedules for a week across Tamil Nadu mainline sections."""
    today = date.today()
    monday = today - timedelta(days=today.weekday())

    schedules = []

    # Realistic departure times from Chennai Central / reverse
    base_times = {
        "20607": (5, 50),   # Vande Bharat early morning departure
        "12007": (6, 0),    # Shatabdi morning departure
        "12675": (6, 10),   # Kovai Express morning
        "12639": (7, 10),   # Brindavan Express morning
        "16089": (17, 55),  # Yelagiri Express evening
        "16057": (6, 25),   # Sapthagiri morning
        "12671": (21, 0),   # Nilgiri Express night
        "12673": (22, 10),  # Cheran Express night
        "12685": (17, 0),   # Mangalore SF evening
        "12601": (20, 10),  # Mangalore Mail night
        "66017": (8, 30),   # Suburban morning
        "66021": (16, 30),  # Suburban evening (returns)
        "BGCT1": (1, 15),   # Steel freight early morning
        "BGCT2": (2, 45),   # Mettur coal rake pre-dawn
        "BGCT3": (23, 30),  # Petroleum freight late night
    }

    # Travel time per section in minutes [MAS-AJJ, AJJ-KPD, KPD-JTJ, JTJ-SA]
    section_travel = [45, 40, 55, 75]

    for day_offset in range(7):
        current_date = monday + timedelta(days=day_offset)

        for train in trains:
            base_h, base_m = base_times.get(train.train_number, (8, 0))

            # Goods trains don't run on Sundays
            if train.train_type == TrainType.GOODS and day_offset == 6:
                continue

            # Return directions
            is_down = train.train_number in ["66021", "16089"]
            direction = TrainDirection.DOWN if is_down else TrainDirection.UP

            running_minutes = base_h * 60 + base_m
            section_list = list(reversed(range(len(sections)))) if is_down else range(len(sections))

            for idx in section_list:
                section = sections[idx]
                travel = section_travel[idx]
                halt = random.randint(2, 6) if train.train_type != TrainType.GOODS else 0

                arr_h = (running_minutes // 60) % 24
                arr_m = running_minutes % 60
                dep_minutes = running_minutes + halt
                dep_h = (dep_minutes // 60) % 24
                dep_m = dep_minutes % 60

                schedule = TrainSchedule(
                    train_id=train.id,
                    section_id=section.id,
                    station_from=section.from_station if not is_down else section.to_station,
                    station_to=section.to_station if not is_down else section.from_station,
                    arrival_time=time(arr_h, arr_m),
                    departure_time=time(dep_h, dep_m),
                    direction=direction,
                    date=current_date,
                )
                schedules.append(schedule)
                running_minutes = dep_minutes + travel

    db.add_all(schedules)
    db.flush()
    return schedules


def seed_maintenance_tasks(db, assets, departments, sections):
    """Seed 35 maintenance tasks across Tamil Nadu corridor infrastructure."""
    today = date.today()

    tasks_data = [
        # Engineering tasks (Civil / Track)
        ("MT-001", "TK-001", "ENG", MaintenanceType.PREVENTIVE, "Track tamping and alignment - MAS-AJJ fast main line",
         120, "High", UrgencyLevel.URGENT, -2),
        ("MT-002", "TK-003", "ENG", MaintenanceType.CORRECTIVE, "Rail grinding - AJJ-KPD worn rail head",
         150, "High", UrgencyLevel.URGENT, -4),
        ("MT-003", "TK-004", "ENG", MaintenanceType.PREVENTIVE, "PSC Sleeper replacement - KPD-JTJ section",
         180, "Medium", UrgencyLevel.NORMAL, 5),
        ("MT-004", "TK-005", "ENG", MaintenanceType.ROUTINE, "Track geometry inspection - JTJ-SA Morappur ghat",
         90, "Low", UrgencyLevel.PLANNED, 15),
        ("MT-005", "BR-001", "ENG", MaintenanceType.PREVENTIVE, "Palar River Bridge structural girder painting & inspection",
         240, "Critical", UrgencyLevel.URGENT, 1),
        ("MT-006", "BR-002", "ENG", MaintenanceType.ROUTINE, "Cooum River rail bridge structural integrity survey",
         120, "Medium", UrgencyLevel.PLANNED, 20),
        ("MT-007", "SW-001", "ENG", MaintenanceType.CORRECTIVE, "Turnout crossing nose repair - MAS Terminal Yard",
         90, "Critical", UrgencyLevel.IMMEDIATE, -3),
        ("MT-008", "SW-002", "ENG", MaintenanceType.PREVENTIVE, "Switch tongue rail lubrication - Arakkonam Jn",
         60, "Medium", UrgencyLevel.NORMAL, 7),
        ("MT-009", "SW-003", "ENG", MaintenanceType.ROUTINE, "Point machine track switch inspection - Katpadi Jn",
         45, "Low", UrgencyLevel.PLANNED, 25),
        ("MT-010", "TK-002", "ENG", MaintenanceType.PREVENTIVE, "Suburban slow line track maintenance - MAS-AJJ",
         90, "Low", UrgencyLevel.NORMAL, 10),
        ("MT-011", "LC-001", "ENG", MaintenanceType.CORRECTIVE, "Level crossing gate boom overhaul - Tiruvallur (LC-48)",
         60, "High", UrgencyLevel.URGENT, -1),
        ("MT-012", "TK-006", "ENG", MaintenanceType.ROUTINE, "Loop line track inspection - Arakkonam Yard",
         60, "Low", UrgencyLevel.PLANNED, 30),

        # S&T tasks (Signaling & Telecom)
        ("MT-013", "SIG-001", "SNT", MaintenanceType.PREVENTIVE, "Home signal LED lamp and lens cleaning - MAS Terminal",
         45, "High", UrgencyLevel.NORMAL, 3),
        ("MT-014", "SIG-002", "SNT", MaintenanceType.CORRECTIVE, "Signal aspect failure repair - Arakkonam Junction",
         60, "Critical", UrgencyLevel.IMMEDIATE, -4),
        ("MT-015", "SIG-003", "SNT", MaintenanceType.PREVENTIVE, "Distant signal track circuit cable overhaul - Katpadi Jn",
         90, "High", UrgencyLevel.URGENT, 0),
        ("MT-016", "SIG-004", "SNT", MaintenanceType.CORRECTIVE, "Electronic interlocking relay replacement - Jolarpettai Jn",
         120, "Critical", UrgencyLevel.IMMEDIATE, -6),
        ("MT-017", "SIG-005", "SNT", MaintenanceType.ROUTINE, "Automatic block signaling test - Morappur Section",
         60, "Medium", UrgencyLevel.PLANNED, 14),
        ("MT-018", "SIG-006", "SNT", MaintenanceType.PREVENTIVE, "Home signal mechanical gear overhaul - Salem Junction",
         90, "High", UrgencyLevel.NORMAL, 5),
        ("MT-019", "TEL-001", "SNT", MaintenanceType.ROUTINE, "OFC route optical OTDR patrolling - MAS-AJJ",
         60, "Low", UrgencyLevel.PLANNED, 20),
        ("MT-020", "TEL-002", "SNT", MaintenanceType.PREVENTIVE, "OFC optical fiber joint box maintenance - KPD-JTJ",
         45, "Low", UrgencyLevel.PLANNED, 18),

        # Traction Distribution tasks (Electrical / OHE)
        ("MT-021", "OHE-001", "TD", MaintenanceType.PREVENTIVE, "25kV AC contact wire tension adjustment - MAS-AJJ",
         90, "High", UrgencyLevel.URGENT, 1),
        ("MT-022", "OHE-002", "TD", MaintenanceType.CORRECTIVE, "Polymer OHE insulator replacement - AJJ-KPD section",
         120, "Critical", UrgencyLevel.IMMEDIATE, -3),
        ("MT-023", "OHE-003", "TD", MaintenanceType.PREVENTIVE, "OHE steel portal structure anti-corrosion painting - KPD-JTJ",
         150, "Medium", UrgencyLevel.NORMAL, 8),
        ("MT-024", "OHE-004", "TD", MaintenanceType.ROUTINE, "OHE tower wagon inspection - JTJ-SA ghat section",
         60, "Low", UrgencyLevel.PLANNED, 22),
        ("MT-025", "SUB-001", "TD", MaintenanceType.PREVENTIVE, "Transformer oil filtration & BDV test - Arakkonam Substation",
         90, "Critical", UrgencyLevel.URGENT, 2),
        ("MT-026", "SUB-002", "TD", MaintenanceType.ROUTINE, "Vacuum circuit breaker calibration - Katpadi Substation",
         60, "Medium", UrgencyLevel.NORMAL, 12),

        # Integrated Cross-Department Candidate Tasks
        ("MT-027", "TK-001", "ENG", MaintenanceType.PREDICTIVE, "Ultrasonic rail flaw testing (USFD) - MAS-AJJ Fast Line",
         90, "High", UrgencyLevel.NORMAL, 4),
        ("MT-028", "OHE-001", "TD", MaintenanceType.PREDICTIVE, "Pantograph clearance laser measurement - MAS-AJJ",
         60, "Medium", UrgencyLevel.NORMAL, 10),
        ("MT-029", "SIG-001", "SNT", MaintenanceType.PREDICTIVE, "Solid-state electronic interlocking audit - MAS",
         120, "Critical", UrgencyLevel.URGENT, 0),
        ("MT-030", "TK-003", "ENG", MaintenanceType.EMERGENCY, "Emergency thermit weld collar repair - AJJ-KPD",
         60, "Critical", UrgencyLevel.IMMEDIATE, -7),
        ("MT-031", "OHE-002", "TD", MaintenanceType.EMERGENCY, "Emergency catenary dropper replacement - AJJ-KPD",
         45, "Critical", UrgencyLevel.IMMEDIATE, -5),
        ("MT-032", "SIG-003", "SNT", MaintenanceType.CORRECTIVE, "Track circuit axle-counter fault repair - AJJ-KPD",
         75, "High", UrgencyLevel.URGENT, -1),
        ("MT-033", "TK-004", "ENG", MaintenanceType.PREVENTIVE, "Flash butt weld joint ultrasonic check - KPD-JTJ",
         90, "Medium", UrgencyLevel.NORMAL, 6),
        ("MT-034", "OHE-003", "TD", MaintenanceType.PREVENTIVE, "OHE mast foundation concrete integrity survey - KPD-JTJ",
         60, "Medium", UrgencyLevel.PLANNED, 15),
        ("MT-035", "SIG-004", "SNT", MaintenanceType.PREVENTIVE, "Signal post anti-corrosion painting - Jolarpettai Jn",
         45, "Low", UrgencyLevel.PLANNED, 28),
    ]

    asset_map = {a.asset_code: a for a in assets}

    tasks = []
    for (code, asset_code, dept_code, mtype, desc, duration,
         crit, urgency, due_offset) in tasks_data:
        asset = asset_map[asset_code]
        resources = {"crew": random.randint(3, 8)}
        if mtype in [MaintenanceType.CORRECTIVE, MaintenanceType.EMERGENCY]:
            resources["equipment"] = ["inspection_car"]
        if "tamping" in desc.lower():
            resources["equipment"] = ["tamping_machine"]
        if "grinding" in desc.lower():
            resources["equipment"] = ["rail_grinding_machine"]

        status = TaskStatus.PENDING
        if due_offset < -5:
            status = TaskStatus.OVERDUE

        task = MaintenanceTask(
            task_code=code,
            asset_id=asset.id,
            department_id=departments[dept_code].id,
            section_id=asset.section_id,
            maintenance_type=mtype,
            description=desc,
            duration_minutes=duration,
            priority=50,
            criticality=crit,
            urgency=urgency,
            due_date=today + timedelta(days=due_offset),
            status=status,
            required_resources=resources,
        )
        tasks.append(task)

    db.add_all(tasks)
    db.flush()
    return tasks


def seed_block_windows(db, sections):
    """Seed block windows for 7 days across Tamil Nadu corridor sections."""
    today = date.today()
    monday = today - timedelta(days=today.weekday())

    windows = []

    # Lean traffic windows typical for Southern Railway mainline operations
    window_slots = [
        (time(0, 30), time(4, 30)),    # Night block window (4 hours - lean passenger hours)
        (time(10, 30), time(12, 30)),  # Mid-morning window (2 hours)
        (time(13, 30), time(15, 30)),  # Early afternoon window (2 hours)
        (time(11, 0), time(14, 0)),    # Extended morning (3 hours)
        (time(23, 30), time(2, 30)),   # Midnight window (3 hours)
    ]

    for day_offset in range(7):
        current_date = monday + timedelta(days=day_offset)
        for section in sections:
            day_windows = random.sample(window_slots[:4], k=random.randint(2, 3))
            for start, end in day_windows:
                window = BlockWindow(
                    section_id=section.id,
                    date=current_date,
                    start_time=start,
                    end_time=end,
                    capacity=2,
                    status=BlockStatus.AVAILABLE,
                )
                windows.append(window)

    db.add_all(windows)
    db.flush()
    return windows


def seed_constraints(db):
    """Seed Southern Railway planning constraints."""
    constraints = [
        PlanningConstraint(
            constraint_type="train_conflict",
            description="No maintenance during train passage through Tamil Nadu corridor sections",
            enabled=True,
            value={"buffer_minutes": 10},
            priority=1,
        ),
        PlanningConstraint(
            constraint_type="block_duration",
            description="Maintenance activities must fit completely within block window duration",
            enabled=True,
            value={"min_duration_minutes": 30},
            priority=1,
        ),
        PlanningConstraint(
            constraint_type="section_availability",
            description="Track section must be available and cleared of overlapping possessions",
            enabled=True,
            value={},
            priority=1,
        ),
        PlanningConstraint(
            constraint_type="track_occupancy",
            description="Only one active maintenance block per track section at a time",
            enabled=True,
            value={"max_concurrent": 1},
            priority=1,
        ),
        PlanningConstraint(
            constraint_type="resource_availability",
            description="Daily gang crew and heavy maintenance equipment allocation limits",
            enabled=True,
            value={"max_crew_per_day": 30, "max_equipment_per_day": 5},
            priority=2,
        ),
        PlanningConstraint(
            constraint_type="department_constraint",
            description="Maximum maintenance blocks per department per day to avoid crew saturation",
            enabled=True,
            value={"max_blocks_per_dept_per_day": 4},
            priority=2,
        ),
        PlanningConstraint(
            constraint_type="maintenance_dependency",
            description="Precursor tasks must be cleared before downstream track possessions",
            enabled=True,
            value={"dependencies": {}},
            priority=3,
        ),
        PlanningConstraint(
            constraint_type="min_gap_between_blocks",
            description="Minimum gap of 60 minutes between consecutive blocks on the same section",
            enabled=True,
            value={"min_gap_minutes": 60},
            priority=2,
        ),
        PlanningConstraint(
            constraint_type="asset_availability",
            description="Asset must not be decommissioned or locked under unscheduled breakdown",
            enabled=True,
            value={},
            priority=1,
        ),
        PlanningConstraint(
            constraint_type="integrated_block_priority",
            description="Priority boost for combined multi-department possessions (ENG + TD + S&T)",
            enabled=True,
            value={"bonus_score": 15},
            priority=2,
        ),
    ]
    db.add_all(constraints)
    db.flush()
    return constraints


def seed_maintenance_history(db, assets):
    """Seed historical maintenance interventions."""
    today = date.today()
    history = []

    for asset in assets:
        num_records = random.randint(2, 5)
        for j in range(num_records):
            days_ago = random.randint(15, 365)
            comp_date = today - timedelta(days=days_ago)
            downtime = random.choice([60, 90, 120, 150, 180, 240])

            cond_before = random.randint(40, 70)
            cond_after = min(100, cond_before + random.randint(15, 35))

            rec = MaintenanceHistory(
                asset_id=asset.id,
                completed_date=comp_date,
                downtime_minutes=downtime,
                condition_before=cond_before,
                condition_after=cond_after,
            )
            history.append(rec)

    db.add_all(history)
    db.flush()
    return history


def seed_all():
    """Run all seed functions in dependency order."""
    print("=" * 60)
    print("Railway Maintenance Block Planning System")
    print("TAMIL NADU CORRIDOR (SOUTHERN RAILWAY)")
    print("Chennai Central (MAS) - Katpadi (KPD) - Salem (SA)")
    print("=" * 60)

    print("\n[1/8] Creating database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("  [OK] Tables created")

    db = SessionLocal()
    try:
        print("[2/8] Seeding departments (ENG, TD, S&T)...")
        departments = seed_departments(db)
        print(f"  [OK] {len(departments)} departments")

        print("[3/8] Seeding Tamil Nadu corridor and track sections...")
        corridor, sections = seed_corridor_and_sections(db)
        print(f"  [OK] 1 corridor ({corridor.name}), {len(sections)} track sections")

        print("[4/8] Seeding Tamil Nadu railway assets...")
        assets = seed_assets(db, departments, sections)
        print(f"  [OK] {len(assets)} assets")

        print("[5/8] Seeding Southern Railway trains...")
        trains = seed_trains(db)
        print(f"  [OK] {len(trains)} trains (Vande Bharat, Shatabdi, Kovai, Cheran, Goods)")

        print("[6/8] Seeding weekly train timetable schedules...")
        schedules = seed_train_schedules(db, trains, sections)
        print(f"  [OK] {len(schedules)} schedule entries")

        print("[7/8] Seeding maintenance tasks...")
        tasks = seed_maintenance_tasks(db, assets, departments, sections)
        print(f"  [OK] {len(tasks)} maintenance tasks")

        print("[7b/8] Seeding block windows...")
        windows = seed_block_windows(db, sections)
        print(f"  [OK] {len(windows)} block windows")

        print("[7c/8] Seeding planning constraints...")
        constraints = seed_constraints(db)
        print(f"  [OK] {len(constraints)} constraints")

        print("[8/8] Seeding maintenance history...")
        history = seed_maintenance_history(db, assets)
        print(f"  [OK] {len(history)} history records")

        db.commit()
        print("\n" + "=" * 60)
        print("[OK] Tamil Nadu Railway Operations Data seeded successfully!")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
