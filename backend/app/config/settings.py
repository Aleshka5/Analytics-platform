from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Process environment wins over a present .env file. Unknown variables are ignored."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    upload_limit_bytes: int = 100 * 1024 * 1024
    dataset_ttl_minutes: int = 60
