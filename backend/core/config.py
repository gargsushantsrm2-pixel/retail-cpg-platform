from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql://cpg_user:cpg_secure_pass_2024@localhost:5432/cpg_platform"
    api_secret_key: str = "dev-secret-key"
    environment: str = "development"
    log_level: str = "INFO"
    app_name: str = "Triax — Revenue Margin Intelligence"
    app_version: str = "1.0.0"
    api_v1_prefix: str = "/api/v1"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
