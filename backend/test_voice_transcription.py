#!/usr/bin/env python3
"""
Minimal test for voice transcription endpoint.

This test creates a simple synthetic audio file and sends it to the 
transcription endpoint. In a real scenario, you would use an actual 
audio recording.

Usage:
    1. Start the backend server: cd backend && uvicorn app.main:app --reload
    2. Set your OpenAI API key in backend/.env: OPENAI_API_KEY=your_key
    3. Get a valid auth token from the frontend (login and copy from browser dev tools)
    4. Run: python test_voice_transcription.py <your_auth_token>
"""

import sys
import requests
import io

def create_test_webm() -> bytes:
    """
    Create a minimal valid WebM file (silent audio).
    This is just for testing the endpoint structure.
    For real transcription tests, use an actual recording.
    """
    # Minimal WebM header (matroska EBML header + segment)
    # This creates a silent 1-second WebM file
    webm_header = bytes([
        # EBML header
        0x1A, 0x45, 0xDF, 0xA3,  # EBML ID
        0x01, 0x00, 0x00, 0x00,  # Size
        0x00, 0x00, 0x00, 0x1F,  # Actual size
        # EBML Version
        0x42, 0x86, 0x81, 0x01,
        # EBML Read Version
        0x42, 0xF7, 0x81, 0x01,
        # EBML Max ID Length
        0x42, 0xF2, 0x81, 0x04,
        # EBML Max Size Length
        0x42, 0xF3, 0x81, 0x08,
        # Doc Type (webm)
        0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6D,
        # Doc Type Version
        0x42, 0x87, 0x81, 0x04,
        # Doc Type Read Version
        0x42, 0x85, 0x81, 0x02,
        # Segment
        0x18, 0x53, 0x80, 0x67,  # Segment ID
        0x01, 0x00, 0x00, 0x00,  # Size (undefined)
        0x00, 0x00, 0x00, 0x0A,  # Actual content
    ])
    return webm_header


def test_voice_endpoint(token: str, base_url: str = "http://localhost:8000"):
    """Test the voice transcription endpoint."""
    
    url = f"{base_url}/voice/transcribe"
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create test audio (or use a real file)
    # audio_bytes = create_test_webm()
    
    # Better: read from a real audio file if available
    try:
        # Try to read a real test file first
        with open("test_audio.webm", "rb") as f:
            audio_bytes = f.read()
        print(f"Using real audio file: {len(audio_bytes)} bytes")
    except FileNotFoundError:
        print("Note: For a real transcription test, record audio from the frontend")
        print("      or place a 'test_audio.webm' file in the backend directory.")
        print("\nSkipping transcription test - synthetic audio won't produce valid results.")
        
        # Test endpoint accessibility with a small request
        print("\nTesting endpoint accessibility...")
        try:
            response = requests.post(
                url,
                headers=headers,
                files={"audio": ("empty.webm", io.BytesIO(b""), "audio/webm")},
                timeout=5
            )
            if response.status_code == 400:
                print("✓ Endpoint is accessible (returned 400 for empty file as expected)")
            else:
                print(f"? Unexpected response: {response.status_code}")
                print(response.text[:200])
        except requests.exceptions.ConnectionError:
            print("✗ Cannot connect to backend. Make sure it's running on port 8000")
        return
    
    # Send to transcription endpoint
    files = {"audio": ("recording.webm", io.BytesIO(audio_bytes), "audio/webm")}
    
    print(f"\nSending {len(audio_bytes)} bytes to {url}...")
    try:
        response = requests.post(url, headers=headers, files=files, timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n✓ Transcription successful!")
            print(f"  Text: '{result.get('text', 'N/A')}'")
        elif response.status_code == 401:
            print("✗ Authentication failed. Check your token.")
        elif response.status_code == 400:
            print(f"✗ Bad request: {response.json().get('detail', 'Unknown error')}")
        else:
            print(f"✗ Error: {response.text[:200]}")
            
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to backend. Make sure it's running on port 8000")
    except Exception as e:
        print(f"✗ Error: {e}")


def manual_test_instructions():
    """Print instructions for manual testing."""
    print("""
╔══════════════════════════════════════════════════════════════════════════╗
║                    Voice Transcription Test Instructions                 ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  MANUAL TEST (Recommended):                                              ║
║                                                                          ║
║  1. Start the backend server:                                            ║
║     cd backend && uvicorn app.main:app --reload                          ║
║                                                                          ║
║  2. Ensure OPENAI_API_KEY is set in backend/.env                         ║
║                                                                          ║
║  3. Start the frontend:                                                  ║
║     cd frontend && npm run dev                                           ║
║                                                                          ║
║  4. Log in to the application                                            ║
║                                                                          ║
║  5. Start a quiz session with free_text questions                        ║
║                                                                          ║
║  6. Click the microphone button below the textarea                       ║
║                                                                          ║
║  7. Speak for 3-5 seconds, then click stop                               ║
║                                                                          ║
║  8. Wait for transcription to appear in the textarea                     ║
║                                                                          ║
║  9. Edit the transcribed text if needed                                  ║
║                                                                          ║
║  10. Submit your answer                                                  ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
""")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        manual_test_instructions()
        print("\nTo run automated endpoint test: python test_voice_transcription.py <auth_token>")
        sys.exit(0)
    
    token = sys.argv[1]
    base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
    test_voice_endpoint(token, base_url)
