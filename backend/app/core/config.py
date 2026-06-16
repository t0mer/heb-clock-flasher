from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    port: int = 8080
    firmware_dir: str = "./firmware"
    log_level: str = "info"
    fail_on_empty: bool = True
    admin_token: str = ""
    cors_origins: str = ""
    static_dir: str = "./static"
    site_url: str = ""
    google_tag_id: str = ""


settings = Settings()
