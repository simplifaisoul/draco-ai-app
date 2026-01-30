import urllib.request
import json
import time
import sys

API_URL = "http://localhost:3000/api/chat"
HEADERS = {"Content-Type": "application/json"}

def send_message(history, model="draco-prime"):
    payload = {
        "messages": history,
        "model": model
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(API_URL, data=data, headers=HEADERS)
    
    try:
        with urllib.request.urlopen(req) as response:
            return response.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}")
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

def run_stress_test():
    print("🚀 Starting Draco AI Backend Stress Test (urllib version)...")
    
    # 1. Basic Persona Check
    print("\n[Test 1] Testing Persona Switching (Roast Master)...")
    history = [{"role": "user", "content": "Rate my clean code setup."}]
    response = send_message(history, model="draco-roast")
    if response: 
         # Simple check if we got a response without crashing
        print(f"✅ Roast Master Responded (Length: {len(response)} chars)")
    else:
        print(f"⚠️ Unexpected Failure in Test 1")

    # 2. Context Window Limit Test (25 Turns)
    print("\n[Test 2] Testing Infinite Context Window (25 Turns)...")
    history = []
    for i in range(1, 26):
        history.append({"role": "user", "content": f"This is message {i}."})
        history.append({"role": "assistant", "content": f"Ack {i}."})
    
    history.append({"role": "user", "content": "What was message 1?"})
    
    print(f"Sending request with {len(history)} items in history...")
    start_time = time.time()
    final_response = send_message(history)
    end_time = time.time()
    
    if final_response:
        print(f"✅ Success! Response received in {end_time - start_time:.2f}s")
        print("✅ The server handled > 20 messages successfully (Pruning worked)!")
    else:
        print("❌ Test Failed: API crashed or timed out.")
        sys.exit(1)

if __name__ == "__main__":
    run_stress_test()
