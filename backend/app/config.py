import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "AI-Powered Code Review Agent"
    API_V1_STR: str   = "/api"

    @property
    def GEMINI_API_KEY(self) -> str:
        return os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))

    @property
    def STORAGE_DIR(self) -> str:
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        path = os.path.join(base, "workspace_storage")
        os.makedirs(path, exist_ok=True)
        return path

settings = Settings()
