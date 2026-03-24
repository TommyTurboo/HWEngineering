from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "HWEngineering API"
    app_env: str = "development"


settings = Settings()

