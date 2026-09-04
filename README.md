# RailBlock AI — AI-Powered Automatic Block Planning to Maximize Asset Availability for Train Operations on Indian Railways

**Smart India Hackathon 2026 | Problem Statement: SIH26027**

> **DECISION SUPPORT PROTOTYPE**  
> *Prototype using Railway Operations Data modeled after the Tamil Nadu Mainline Corridor (Chennai Central - Katpadi - Salem, Southern Railway).*  
> *"ML determines maintenance priority; OR-Tools determines the optimal schedule."*

---

## 1. Problem Statement & Motivation

On Indian Railways, track sections, overhead electrical equipment (OHE), and signaling systems require periodic and corrective maintenance blocks (corridor possessions). Currently, maintenance planning across the three core railway departments—**Engineering (Civil/Track)**, **Traction Distribution (Electrical/OHE)**, and **Signal & Telecommunication (S&T)**—is handled with manual coordination. 

This leads to:
1. **Excessive separate corridor closures**: Different departments requesting track blocks on the same section on consecutive days, repeatedly halting train traffic.
2. **Train delays**: Maintenance blocks overlapping with high-priority passenger services (e.g., Rajdhani, Shatabdi, Superfast trains).
3. **Suboptimal asset availability**: Track and electrical assets degrading due to missed maintenance windows.

### Core Objective
RailBlock AI solves the question:
> **"WHEN should each maintenance activity be performed, WHICH activities can be combined into the same block, and HOW can maintenance be scheduled while minimizing train disruption and maximizing asset availability?"**

---

## 2. Core Architecture & Pipeline

```
  Maintenance Requirements (ENG, TD, S&T)
                 +
  Train Timetable & Section Corridor Data
                 +
         Asset Condition & History
                 ↓
      [ 1. AI Priority Engine ]
     (Transparent Weighted Scoring 0-100)
                 ↓
  [ 2. Candidate Block Window Generator ]
 (Lean Traffic Hours & Section Availability)
                 ↓
   [ 3. Constraint Validation Engine ]
       (10 Safety & Operational Rules)
                 ↓
 [ 4. Google OR-Tools CP-SAT Optimizer ]
   (Multi-Objective Mixed-Integer Solver)
                 ↓
  [ 5. Optimized Integrated Block Plan ]
(Shared Multi-Department Corridor Closures)
                 ↓
[ 6. Weekly / Monthly Gantt & Network Map ]
 (Interactive Dashboard, Analytics & What-If)
```

---

## 3. Technology Stack

### Frontend
- **Framework**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, Railway Command Center Dark Theme
- **Data Visualization**: Apache ECharts (`echarts-for-react`)
- **Geospatial Map**: Leaflet (`leaflet`) with CartoDB dark tiles
- **Icons**: Lucide React

### Backend
- **Framework**: Python 3.13, FastAPI (Asynchronous REST API)
- **Data Validation**: Pydantic v2
- **ORM & Database**: SQLAlchemy 2.0, PostgreSQL + PostGIS (with zero-config SQLite fallback for local running)
- **Constraint Programming**: Google OR-Tools CP-SAT solver (`ortools.sat.python.cp_model`)
- **AI & Analytics**: NumPy, Pandas, Scikit-learn
- **Network Topology**: NetworkX

---

## 4. Key Architectural Modules

### A. AI Priority Engine (`app/services/ai/priority_engine.py`)
Computes a transparent priority score from 0 to 100 for every pending maintenance task:
$$\text{Priority} = w_1 \cdot \text{Criticality} + w_2 \cdot \text{Urgency} + w_3 \cdot (100 - \text{Condition}) + w_4 \cdot \text{Overdue} + w_5 \cdot \text{Availability Impact} + \text{Bonuses}$$
- **Classifications**: Critical ($\ge 80$), High ($\ge 60$), Medium ($\ge 40$), Low ($< 40$).
- **Explainability**: Every task produces an explainable justification (e.g., *"Task MT-002 received priority 94 because asset criticality is High, maintenance is overdue by 4 days, urgency is Urgent, asset availability is low (50%), asset status is Degraded"*).

### B. Constraint Validation Engine (`app/services/constraints/constraint_engine.py`)
Validates candidate assignments against 10 strict operational railway rules:
1. **Train Conflict**: Blocks must not overlap high-priority trains (Rajdhani, Shatabdi) plus safety buffers.
2. **Block Duration**: Maintenance duration must safely fit within the block window duration.
3. **Section Availability**: Track section must be open and operational.
4. **Track Occupancy**: Prevents duplicate overlapping block requests on the same physical line.
5. **Asset Availability**: Asset must not be decommissioned.
6. **Resource Limits**: Daily gang crew and heavy equipment (tamping machines, rail grinders) capacity.
7. **Maintenance Dependencies**: Task ordering prerequisites.
8. **Department Constraints**: Daily block caps per department to distribute workload.
9. **Operational Rules**: Minimum 60-minute gap between consecutive blocks on the same section.
10. **Existing Block Conflicts**: No overlap with previously approved blocks.

### C. Google OR-Tools CP-SAT Optimization (`app/services/optimization/cpsat_optimizer.py`)
Decision variable:
$$x_{i, t} \in \{0, 1\} \quad \text{where } x_{i,t} = 1 \text{ if task } i \text{ is assigned to window } t$$

**Objective Function**:
$$\max \sum_{i, t} x_{i, t} \cdot \Big( w_{\text{priority}} \cdot P_i + w_{\text{avail}} \cdot A_i + w_{\text{cand}} \cdot S_{i,t} \Big) + w_{\text{group}} \cdot \text{IntegratedBonus}_t - w_{\text{block}} \cdot \text{BlockUsed}_t - w_{\text{disrupt}} \cdot \text{Disruption}_t$$

- Encourages **Integrated Blocks** where Engineering (Track), Traction (OHE), and S&T share the same corridor possession.
- Minimizes the total number of separate corridor blocks.
- Eliminates passenger train delays during peak hours.

### D. Active Maintenance Detection Engine (`app/services/assets/detection_service.py`)
Analyzes real-time asset condition, due dates, availability, and criticality with configurable thresholds:
- **Statuses**: `CRITICAL`, `OVERDUE`, `MAINTENANCE_DUE`, `MONITOR`, `HEALTHY`
- **Configurable Thresholds**:
  - `condition_score < 40` &rarr; `CRITICAL`
  - `condition_score < 60` and due within 7 days &rarr; `MAINTENANCE_DUE`
  - `next_due_date < today` &rarr; `OVERDUE`
  - `availability < 65%` &rarr; `CRITICAL`; `< 80%` &rarr; `MONITOR`
- **Detection & Severity Score (0–100)**: Deterministic formula combining condition risk (30%), overdue risk (25%), criticality factor (20%), availability risk (15%), and status penalty (10%).
- **End-to-End Pipeline**:
  $$\text{Asset Detection} \longrightarrow \text{Maintenance Task} \longrightarrow \text{AI Priority} \longrightarrow \text{Candidate Block} \longrightarrow \text{Constraint Validation} \longrightarrow \text{OR-Tools CP-SAT} \longrightarrow \text{Optimized Block}$$
- **Duplicate Prevention**: Re-running the scan updates existing active tasks rather than creating redundant duplicates.

---

## 5. Railway Operations Dataset (Tamil Nadu — Southern Railway)

The prototype operates on realistic railway operations data modeled after the **Tamil Nadu Trunk Corridor (Chennai Central - Salem Junction)**:
- **5 Junction Stations**: MGR Chennai Central (MAS), Arakkonam Junction (AJJ), Katpadi Junction (KPD), Jolarpettai Junction (JTJ), Salem Junction (SA)
- **4 Track Sections**: MAS-AJJ (69.0 km), AJJ-KPD (61.0 km), KPD-JTJ (84.0 km), JTJ-SA (120.0 km)
- **3 Departments**: Engineering (ENG), Traction Distribution (TD), Signal & Telecommunication (S&T)
- **28 Monitored Assets**: Quadruple & double mainlines, Palar River bridge, Cooum bridge, turnout switches, home/starter/distant signals, traction substations (TSS Arakkonam, TSS Katpadi), and 25kV AC OHE catenaries
- **15 Trains with 408 Schedule Entries**: Vande Bharat Express, Chennai-Mysuru Shatabdi, Kovai Superfast, Nilgiri Express, Cheran Express, Mangalore SF, Yelagiri Express, Suburban MEMUs, and Freight Rakes (Salem Steel, Mettur Coal, CPCL Petroleum)
- **35 Maintenance Tasks & 71 Block Windows**

---

## 6. Benchmarking: Baseline Heuristic vs. AI-Optimized

| Metric | Baseline (First-Fit Heuristic) | AI-Optimized (OR-Tools CP-SAT) | Net Impact |
| :--- | :---: | :---: | :---: |
| **Corridor Blocks** | 22 blocks | **14 blocks** | **8 fewer closures (-36%)** |
| **Track Possession Time** | 62.0 hours | **45.0 hours** | **17.0 hours saved** |
| **Train Disruption Delay** | 5,923 minutes | **1,392 minutes** | **76.5% delay reduction** |
| **Integrated Blocks** | 0 blocks | **10 blocks** | **10 multi-dept unified blocks** |
| **Tasks Scheduled** | 22 tasks | **31 tasks** | **+9 more tasks completed** |
| **Availability Gain** | +1.2% | **+5.4%** | **+4.2% availability improvement** |

---

## 7. How to Install & Run

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Start Database (Optional: Docker or local SQLite)
- To run with PostgreSQL & PostGIS via Docker:
  ```bash
  docker compose up -d
  ```
- *Note: If Docker is not running, the application automatically falls back to local SQLite (`railblock.db`) seamlessly without any configuration changes.*

### 2. Backend Setup
```bash
# From project root
cd backend

# Install Python requirements
pip install -r requirements.txt

# Seed synthetic railway operations data
python scripts/seed_data.py

# Run the FastAPI server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be live at: `http://127.0.0.1:8000/docs`

### 3. Frontend Setup
```bash
# In a separate terminal, from project root
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev -- --host 127.0.0.1 --port 5173
```
Open your browser at: **`http://127.0.0.1:5173/`**

### 4. Run Automated Tests
```bash
cd backend
python -m pytest tests/ -v
```
All 11 unit, integration, and edge-case tests will run and pass.

---

## 8. SIH Demonstration Workflow

1. **Dashboard — Active Maintenance Detection**:
   - Inspect the prominent **Active Maintenance Detection** panel showing real-time health counts: **CRITICAL (5)**, **OVERDUE (1)**, **DUE (3)**, **MONITOR (9)**, **HEALTHY (10)**.
   - Observe the calibrated benchmark cases:
     - `TK-014`: Track condition 38/100, High criticality, 4 days overdue &rarr; **CRITICAL** (Score: 86)
     - `OHE-008`: Catenary condition 58/100, due in 2 days &rarr; **MAINTENANCE_DUE** (Score: 50)
     - `SIG-003`: Distant signal condition 91/100, availability 98% &rarr; **HEALTHY** (Score: 6)
   - Click **"Run Asset Health Scan"** to watch the multi-phase scan simulation (*Scanning assets &rarr; Analyzing conditions &rarr; Checking due dates &rarr; Detecting requirements*).
   - Click **"Schedule Maintenance &rarr;"** on any detected asset to see it seamlessly convert into a maintenance task and transition into the optimization pipeline.
2. **Maintenance Tasks**: Inspect tasks filterable by Department (`ENG`, `TD`, `S&T`), Criticality, and Status. Click on any row to open the modal showing the **AI Priority Score breakdown** and transparent reasoning.
3. **Block Planner (Centerpiece)**:
   - Click **"Recalculate AI Priorities"** to demonstrate ML-based priority classification.
   - Click **"Run Baseline (Heuristic)"** to demonstrate unoptimized first-available planning (22 blocks, 5923m disruption).
   - Click **"Generate Optimized Plan"** to execute the **Google OR-Tools CP-SAT solver**.
   - Review the **Integrated Blocks** combining Engineering, Traction, and S&T tasks into single possession windows.
   - Read the **"Why was this block selected?"** AI explainability rationale.
4. **Weekly & Monthly Schedule**: View the interactive Gantt schedule across Monday–Sunday.
5. **Railway Network Map**: Explore the interactive Leaflet map of the Tamil Nadu corridor (Chennai - Katpadi - Salem) with real station coordinates, track section states, and asset pins color-coded by operational condition.
6. **Simulation & What-If**: Run scenario stress-tests (*Critical Asset Failure*, *High Train Demand*) and observe dynamic before vs. after re-optimization.
7. **Analytics & Baseline**: View ECharts comparison graphs demonstrating the quantifiable 36% reduction in corridor closures and 76.5% delay reduction.
