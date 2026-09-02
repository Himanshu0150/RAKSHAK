import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "sherlock"
    gemini_api_key: str = ""
    backend_port: int = 8000
    demo_dataset_enabled: bool = True
    demo_person_limit: int = 200
    
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE) if ENV_FILE.exists() else ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
