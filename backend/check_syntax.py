
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

try:
    print("Importing app.models.sprint...")
    from app.models.sprint import SprintStatusResponse, StartSprintResponse, SprintAnswerRequest
    print("OK")

    print("Importing app.api.routes.sprints...")
    from app.api.routes import sprints
    print("OK")

    print("Importing app.api.routes.daily_sprint...")
    from app.api.routes import daily_sprint
    print("OK")

    print("Importing app.main...")
    from app import main
    print("OK")

    print("ALL CHECKS PASSED")

except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)
