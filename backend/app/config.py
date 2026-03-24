from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HWEngineering API"
    app_env: str = "development"
    database_url: str = "postgresql+psycopg://hwengineering:hwengineering@db:5432/hwengineering"
    etim_db_path: str = "/data/ETIM.db"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
