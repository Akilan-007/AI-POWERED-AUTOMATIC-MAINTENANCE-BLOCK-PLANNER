"""Application configuration using pydantic-settings."""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = "postgresql://railblock_user:railblock_pass_2026@localhost:5432/railblock"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    debug: bool = True

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Optimization weights
    optimization_time_limit_seconds: int = 30
    optimization_asset_availability_weight: float = 0.30
    optimization_maintenance_priority_weight: float = 0.25
    optimization_train_disruption_weight: float = 0.20
    optimization_grouping_weight: float = 0.15
    optimization_block_count_weight: float = 0.10

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = (".env", "../.env")
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
