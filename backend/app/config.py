import os
from dotenv import load_dotenv

# Load env variables from .env if present
load_dotenv()

class Settings:
    PROJECT_NAME: str = "AI-Powered Code Review Agent"
    API_V1_STR: str = "/api"
    
    # GEMINI / GOOGLE API Configuration
    @property
    def GEMINI_API_KEY(self) -> str:
        return os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))
    
    # Storage Configuration
    # Local path inside the workspace to clone remote repositories or write sample projects
    @property
    def STORAGE_DIR(self) -> str:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        path = os.path.join(base_dir, "workspace_storage")
        os.makedirs(path, exist_ok=True)
        return path

settings = Settings()
