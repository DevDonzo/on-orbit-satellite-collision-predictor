from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    model_config = SettingsConfigDict(env_prefix="SCP_", case_sensitive=False)

    api_title: str = "On-Orbit Satellite Collision Predictor"
    api_version: str = "1.0.0"
    token_url: str = "/auth/token"
    environment: Literal["development", "staging", "production"] = "development"

    jwt_secret_key: str = Field(
        default="replace-this-secret-in-production",
        min_length=32,
        description="JWT signing secret. Replace in production.",
    )
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "scp-api"
    jwt_audience: str = "scp-clients"
    access_token_expire_minutes: int = Field(default=60, gt=0, le=24 * 60)

    model_artifact_path: str = "models/collision_model.joblib"
    model_probability_threshold: float = Field(default=0.5, gt=0.0, lt=1.0)
    cache_ttl_seconds: int = Field(default=300, gt=0)
    parsed_dataset_ttl_seconds: int = Field(default=180, gt=0)
    cache_max_entries: int = Field(default=50000, gt=0)
    redis_url: str | None = None

    auth_demo_user: str = "mission_operator"
    auth_demo_password: str = "change-me-now"
    auth_users_json: str | None = None
    auth_rate_limit_per_minute: int = Field(default=240, gt=0, le=50000)

    tle_pairing_strategy: Literal["adjacent", "all_pairs"] = "adjacent"
    max_tle_pairs: int = Field(default=50000, gt=1)

    enable_model_selection: bool = True
    enable_probability_calibration: bool = True

    @model_validator(mode="after")
    def _validate_secure_defaults(self) -> "Settings":
        if self.environment == "production":
            if self.jwt_secret_key == "replace-this-secret-in-production":
                raise ValueError("SCP_JWT_SECRET_KEY must be overridden in production.")
            if self.auth_demo_password == "change-me-now" and not self.auth_users_json:
                raise ValueError(
                    "Use SCP_AUTH_USERS_JSON or override SCP_AUTH_DEMO_PASSWORD in production."
                )
        return self


settings = Settings()
