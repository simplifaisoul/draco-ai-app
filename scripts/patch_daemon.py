#!/usr/bin/env python3
"""Patch warm_pool_daemon.py to add OpenCode install step."""
import sys

DAEMON = "/opt/draco/warm_pool_daemon.py"
MARKER = 'pip3 install -q reportlab python-docx openpyxl requests 2>/dev/null || true",'
INSERT = '''            # Install OpenCode AI coding agent
            "curl -fsSL https://opencode.ai/install | bash 2>/dev/null || true",'''

with open(DAEMON, "r") as f:
    content = f.read()

if "opencode.ai/install" in content:
    print("OpenCode install already present in daemon. Skipping.")
    sys.exit(0)

if MARKER not in content:
    print(f"ERROR: Could not find marker line in {DAEMON}")
    sys.exit(1)

content = content.replace(MARKER, MARKER + "\n" + INSERT)

with open(DAEMON, "w") as f:
    f.write(content)

print("SUCCESS: Patched warm_pool_daemon.py with OpenCode install step.")
