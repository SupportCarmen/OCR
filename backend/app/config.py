"""
Application configuration — loads settings from .env file.
"""

from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # OpenRouter API
    openrouter_api_key: str = ""
    openrouter_ocr_model: str = "google/gemini-2.5-flash-lite"
    openrouter_suggestion_model: str = "google/gemini-2.0-flash-lite"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # OCR engine label (informational — actual engine is the OpenRouter vision LLM)
    ocr_engine: str = "openrouter_vision"

    # Application
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_debug: bool = True

    # Upload / Export
    max_file_size_mb: int = 20
    upload_dir: str = "./uploads"
    export_dir: str = "./exports"

    # Database
    database_url: str = "mysql+aiomysql://root:123456@localhost:3306/ocr_db"
    
    # Carmen API
    carmen_authorization: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure upload/export directories exist
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(settings.export_dir, exist_ok=True)
