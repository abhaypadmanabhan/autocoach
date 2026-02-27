# Sprint Resume Feature Plan

## Requirements
- Allow users to resume incomplete quiz sessions automatically.
- Tasks:
  1. On sprint page load: Check for existing session with status="in_progress"
  2. If exists: Load unanswered questions, navigate user to last question
  3. Track analytics event "quiz_resumed"
  4. If no session exists: Create new session
- Constraints: Use existing sprint/today endpoint, No duplicate sessions, Maintain question ordering

## Todo
- [x] Understand current `/sprint/today` endpoint (backend)
- [x] Understand current sprint page logic (frontend)
- [x] Formulate Implementation Plan
- [x] Verify plan with user
