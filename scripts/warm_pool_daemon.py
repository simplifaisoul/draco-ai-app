#!/usr/bin/env python3
"""
Draco Agent — Warm Pool Daemon
================================
Runs 24/7 on the ProLiant server. Maintains a pool of pre-booted, pre-tooled
LXC containers tagged 'draco-idle' so users get INSTANT container handoffs
(~0.5s instead of 15-20s).

How it works:
1. Checks Proxmox for containers tagged 'draco-idle'
2. If fewer than POOL_SIZE exist, clones + starts + sets up new ones
3. Repeats every CHECK_INTERVAL seconds

The Next.js backend claims idle containers by re-tagging them from
'draco-idle' to 'draco-agent;uid-{userId}'. This daemon detects the
pool shrunk and replenishes it.

Requirements:
    pip install proxmoxer requests

Usage:
    python3 warm_pool_daemon.py

    Or as a systemd service:
    [Unit]
    Description=Draco Warm Pool Daemon
    After=network.target

    [Service]
    ExecStart=/usr/bin/python3 /opt/draco/warm_pool_daemon.py
    Restart=always
    User=root

    [Install]
    WantedBy=multi-user.target
"""

import os
import time
import subprocess
import logging
from typing import List, Dict

# ── Configuration ──
POOL_SIZE = 3                    # Number of idle containers to maintain
CHECK_INTERVAL = 15              # Seconds between pool checks
VMID_RANGE = range(200, 300)     # VMID range for Draco containers
LXC_TEMPLATE = "local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst"
LXC_STORAGE = os.environ.get("LXC_STORAGE", "lxc-storage")
PROXMOX_NODE = os.environ.get("PROXMOX_NODE", "server1")

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [WARM_POOL] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
log = logging.getLogger("warm_pool")


def run_cmd(cmd: str, check: bool = True) -> str:
    """Run a shell command and return stdout."""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and result.returncode != 0:
        log.error(f"Command failed: {cmd}\n  stderr: {result.stderr.strip()}")
        raise RuntimeError(f"Command failed: {cmd}")
    return result.stdout.strip()


def get_all_containers() -> List[Dict]:
    """Get all LXC containers from Proxmox."""
    try:
        raw = run_cmd("pvesh get /nodes/localhost/lxc --output-format json")
        import json
        return json.loads(raw)
    except Exception as e:
        log.error(f"Failed to list containers: {e}")
        return []


def get_container_tags(vmid: int) -> str:
    """Get tags for a specific container."""
    try:
        raw = run_cmd(f"pvesh get /nodes/localhost/lxc/{vmid}/config --output-format json")
        import json
        config = json.loads(raw)
        return config.get("tags", "")
    except:
        return ""


def get_idle_containers() -> List[int]:
    """Find all containers tagged 'draco-idle'."""
    containers = get_all_containers()
    idle = []
    for c in containers:
        tags = c.get("tags", "") or ""
        vmid = int(c.get("vmid", 0))
        if "draco-idle" in tags and vmid in VMID_RANGE:
            idle.append(vmid)
    return idle


def get_used_vmids() -> set:
    """Get all VMIDs currently in use."""
    containers = get_all_containers()
    return {int(c.get("vmid", 0)) for c in containers}


def get_next_vmid() -> int:
    """Find the next available VMID in our range."""
    used = get_used_vmids()
    for vmid in VMID_RANGE:
        if vmid not in used:
            return vmid
    raise RuntimeError("No available VMIDs in range 200-299!")


def create_idle_container(vmid: int) -> bool:
    """Create a new pre-booted idle container."""
    log.info(f"Creating idle container CT {vmid}...")

    try:
        # Create the container
        run_cmd(
            f"pct create {vmid} {LXC_TEMPLATE} "
            f"--hostname draco-idle-{vmid} "
            f"--memory 512 --cores 1 --swap 256 "
            f"--storage {LXC_STORAGE} "
            f"--rootfs {LXC_STORAGE}:4 "
            f"--net0 name=eth0,bridge=vmbr0,ip=dhcp "
            f"--start 1 "
            f"--unprivileged 1 "
            f"--tags 'draco-idle' "
            f"--description 'draco-idle|pool|preheated' "
            f"--nameserver '8.8.8.8 1.1.1.1' "
            f"--searchdomain draco.local "
            f"--password $(openssl rand -hex 8)"
        )
        log.info(f"CT {vmid} created. Waiting for boot...")

        # Wait for it to be running
        for _ in range(30):
            time.sleep(2)
            try:
                status = run_cmd(f"pct status {vmid}", check=False)
                if "running" in status:
                    break
            except:
                pass

        # Wait for network
        log.info(f"CT {vmid} booted. Waiting for network...")
        time.sleep(5)

        # Pre-install essential tools (the "pre-tooled" part)
        setup_commands = [
            # Wait for network
            "for i in $(seq 1 15); do ping -c1 8.8.8.8 > /dev/null 2>&1 && break || sleep 2; done",
            # Install essential tools
            "apt-get update -qq && apt-get install -y -qq curl git wget sudo nano locales ca-certificates python3 python3-pip > /dev/null 2>&1",
            # Fix locale
            "locale-gen en_US.UTF-8 > /dev/null 2>&1 && update-locale LANG=en_US.UTF-8 > /dev/null 2>&1",
            # Create workspace
            "mkdir -p /workspace",
            # Set nice prompt
            'echo \'export PS1="\\[\\e[1;32m\\]root@draco\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ "\' >> /root/.bashrc',
            # Default cd to workspace
            'echo "cd /workspace" >> /root/.bashrc',
            # Pre-install common Python packages for document generation
            "pip3 install -q reportlab python-docx openpyxl requests 2>/dev/null || true",
        ]

        for cmd in setup_commands:
            try:
                run_cmd(f"pct exec {vmid} -- bash -c '{cmd}'", check=False)
            except Exception as e:
                log.warning(f"Setup command warning for CT {vmid}: {e}")

        log.info(f"✅ CT {vmid} is pre-heated, pre-loaded, and pre-tooled!")
        return True

    except Exception as e:
        log.error(f"❌ Failed to create CT {vmid}: {e}")
        # Clean up on failure
        try:
            run_cmd(f"pct stop {vmid}", check=False)
            time.sleep(2)
            run_cmd(f"pct destroy {vmid} --purge --force", check=False)
        except:
            pass
        return False


def replenish_pool():
    """Check pool size and create new containers if needed."""
    idle = get_idle_containers()
    current_count = len(idle)

    if current_count >= POOL_SIZE:
        return  # Pool is full

    needed = POOL_SIZE - current_count
    log.info(f"Pool has {current_count}/{POOL_SIZE} idle containers. Creating {needed} more...")

    for _ in range(needed):
        try:
            vmid = get_next_vmid()
            success = create_idle_container(vmid)
            if success:
                log.info(f"Pool replenished: CT {vmid} added")
            else:
                log.error(f"Failed to add CT {vmid} to pool")
                break  # Don't spam if there's a systemic issue
        except Exception as e:
            log.error(f"Replenishment error: {e}")
            break


def cleanup_stale():
    """Remove any idle containers that have been sitting for too long (>6 hours)."""
    # For now, idle containers don't expire — they're lightweight
    # Could add age-based cleanup later if needed
    pass


def main():
    log.info("=" * 60)
    log.info("🔥 Draco Warm Pool Daemon starting...")
    log.info(f"   Pool size target: {POOL_SIZE}")
    log.info(f"   Check interval:   {CHECK_INTERVAL}s")
    log.info(f"   VMID range:       {VMID_RANGE.start}-{VMID_RANGE.stop - 1}")
    log.info(f"   Template:         {LXC_TEMPLATE}")
    log.info(f"   Storage:          {LXC_STORAGE}")
    log.info("=" * 60)

    # Initial replenish
    replenish_pool()

    # Main loop
    while True:
        try:
            time.sleep(CHECK_INTERVAL)
            idle = get_idle_containers()
            log.debug(f"Pool check: {len(idle)}/{POOL_SIZE} idle containers")

            if len(idle) < POOL_SIZE:
                replenish_pool()

            cleanup_stale()

        except KeyboardInterrupt:
            log.info("Daemon stopped by user.")
            break
        except Exception as e:
            log.error(f"Main loop error: {e}")
            time.sleep(30)  # Wait longer on errors


if __name__ == "__main__":
    main()
