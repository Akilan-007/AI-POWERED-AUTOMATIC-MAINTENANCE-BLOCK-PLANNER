"""
Railway Maintenance Block Planning System - FastAPI Application

AI-Powered Automatic Block Planning to Maximize Asset Availability
for Train Operations on Indian Railways

SIH26027 - Smart India Hackathon 2026

DECISION SUPPORT PROTOTYPE
Prototype using Synthetic Railway Operations Data
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Railway Maintenance Block Planning System",
    description=(
        "AI-Powered Automatic Block Planning to Maximize Asset Availability "
        "for Train Operations on Indian Railways. "
        "DECISION SUPPORT PROTOTYPE — Uses Synthetic Railway Operations Data."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from fastapi.responses import HTMLResponse
from fastapi import Request


@app.get("/")
def root(request: Request):
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        return HTMLResponse(
            """
            <!DOCTYPE html>
            <html>
            <head>
                <title>RailBlock AI — Backend & Web App</title>
                <style>
                    body { font-family: system-ui, sans-serif; background: #0b1222; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                    .card { background: #0f172a; border: 1px solid #1e293b; padding: 32px; border-radius: 16px; max-width: 520px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
                    h1 { font-size: 22px; margin-bottom: 8px; color: #38bdf8; }
                    p { font-size: 14px; color: #94a3b8; line-height: 1.5; }
                    .btn { display: inline-block; padding: 12px 24px; margin: 8px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 14px; transition: all 0.2s; }
                    .btn-primary { background: #2563eb; color: white; }
                    .btn-primary:hover { background: #1d4ed8; }
                    .btn-secondary { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; }
                    .btn-secondary:hover { background: #334155; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>🚆 RailBlock AI Backend Running</h1>
                    <p>Smart India Hackathon 2026 (SIH26027)<br>Automatic Railway Maintenance Block Planning</p>
                    <div style="margin-top: 24px;">
                        <a href="http://127.0.0.1:5173/" class="btn btn-primary">Open Web Application (Port 5173) &rarr;</a>
                        <a href="/docs" class="btn btn-secondary">Open Swagger API Docs (/docs)</a>
                    </div>
                </div>
            </body>
            </html>
            """
        )
    return {
        "system": "Railway Maintenance Block Planning System",
        "problem_statement": "SIH26027",
        "status": "operational",
        "web_ui": "http://127.0.0.1:5173/",
        "api_docs": "http://127.0.0.1:8000/docs",
        "disclaimer": "Decision Support Prototype — Tamil Nadu Mainline Corridor (Southern Railway)",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


# Import and register routers
from app.api import assets, maintenance, trains, corridors, blocks, planning, analytics, network, ai_insights, simulation, detection

app.include_router(assets.router, prefix="/api", tags=["Assets"])
app.include_router(maintenance.router, prefix="/api", tags=["Maintenance"])
app.include_router(trains.router, prefix="/api", tags=["Trains"])
app.include_router(corridors.router, prefix="/api", tags=["Corridors"])
app.include_router(blocks.router, prefix="/api", tags=["Blocks"])
app.include_router(planning.router, prefix="/api", tags=["Planning"])
app.include_router(analytics.router, prefix="/api", tags=["Analytics"])
app.include_router(network.router, prefix="/api", tags=["Network"])
app.include_router(ai_insights.router, prefix="/api", tags=["AI Insights"])
app.include_router(simulation.router, prefix="/api", tags=["Simulation"])
app.include_router(detection.router, prefix="/api", tags=["Active Maintenance Detection"])
