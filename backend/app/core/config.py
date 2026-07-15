from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "docWise API"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    max_upload_bytes: int = 25 * 1024 * 1024
    max_page_count: int = 200

    model_config = SettingsConfigDict(env_prefix="DOCWISE_", env_file=".env")


@lru_cache
def get_settings() -> Settings:
    return Settings()
