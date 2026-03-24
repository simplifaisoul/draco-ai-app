/**
 * Proxmox REST API Client for Draco Agent
 * Manages LXC container lifecycle via Proxmox VE API
 */

// Allow self-signed SSL for Proxmox API
if (typeof process !== 'undefined') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const PROXMOX_API_URL = process.env.PROXMOX_API_URL || 'https://proxmox.simplifai-1.org';
const PROXMOX_API_TOKEN = process.env.PROXMOX_API_TOKEN || '';
const PROXMOX_NODE = process.env.PROXMOX_NODE || 'server1';
const PROXMOX_LXC_TEMPLATE = process.env.PROXMOX_LXC_TEMPLATE || 'local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst';
const PROXMOX_LXC_STORAGE = process.env.PROXMOX_LXC_STORAGE || 'lxc-storage';

// Debug: log token on module load
console.log('[PROXMOX] Token loaded:', PROXMOX_API_TOKEN ? `"${PROXMOX_API_TOKEN}" (${PROXMOX_API_TOKEN.length} chars)` : 'EMPTY');
console.log('[PROXMOX] Node:', PROXMOX_NODE);

// Base headers for Proxmox API
function getHeaders(): Record<string, string> {
  return {
    'Authorization': `PVEAPIToken=${PROXMOX_API_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

// Proxmox API fetch wrapper (self-signed cert OK)
async function proxmoxFetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${PROXMOX_API_URL}${path}`;
  const headers: Record<string, string> = {
    ...getHeaders(),
    ...(options.headers as Record<string, string> || {}),
  };
  
  console.log(`[PROXMOX] ${options.method || 'GET'} ${url}`);
  console.log(`[PROXMOX] Auth header: ${headers['Authorization']?.substring(0, 60)}...`);
  
  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[PROXMOX] Error ${res.status}:`, text);
    throw new Error(`Proxmox API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  return json.data;
}

// Get next available VMID (starts at 200 for agent containers)
export async function getNextVmid(): Promise<number> {
  const containers = await listContainers();
  const usedIds = containers.map((c: any) => c.vmid);
  
  for (let id = 200; id < 300; id++) {
    if (!usedIds.includes(id)) return id;
  }
  throw new Error('No available container IDs (200-299 exhausted)');
}

// Create an LXC container for a user session
export async function createContainer(
  vmid: number,
  sessionId: string,
  sshPubKey: string,
  userId: string = 'unknown'
): Promise<{ vmid: number; taskId: string }> {
  const hostname = `draco-${sessionId.slice(0, 8)}`;
  // Generate random password per container (not hardcoded)
  const password = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  
  const params = new URLSearchParams({
    vmid: vmid.toString(),
    ostemplate: PROXMOX_LXC_TEMPLATE,
    hostname,
    memory: '512',
    cores: '1',
    swap: '256',
    storage: PROXMOX_LXC_STORAGE,
    rootfs: `${PROXMOX_LXC_STORAGE}:4`,
    'net0': 'name=eth0,bridge=vmbr0,ip=dhcp',
    start: '1',
    unprivileged: '1',
    tags: `draco-agent;uid-${userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`,
    description: `draco-agent|${userId}|${sessionId}`,
    'ssh-public-keys': sshPubKey,
    password,
  });

  const data = await proxmoxFetch(
    `/api2/json/nodes/${PROXMOX_NODE}/lxc`,
    {
      method: 'POST',
      body: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  return { vmid, taskId: data };
}

// Extract userId from container tags (format: "draco-agent;uid-<userId>")
export function parseContainerOwnerFromTags(tags: string): string | null {
  if (!tags) return null;
  // Proxmox tags can be separated by ; or , or space
  const tagList = tags.split(/[;,\s]+/);
  for (const tag of tagList) {
    if (tag.startsWith('uid-')) {
      return tag.slice(4); // Remove 'uid-' prefix — this is the sanitized userId
    }
  }
  return null;
}

// List containers for a specific user (filters by tag, falls back to sessionMeta)
export async function listContainersForUser(userId?: string, sessionMetaVmids?: number[]): Promise<any[]> {
  const all = await listContainers();
  if (!userId) return all;
  
  // Debug: log what Proxmox returns
  console.log(`[PROXMOX] All containers:`, all.map((c: any) => ({ vmid: c.vmid, tags: c.tags, status: c.status })));
  
  // Sanitize userId the same way we do when creating (alphanumeric, first 20 chars)
  const sanitizedId = userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
  
  // Try tag-based filtering first
  let userContainers = all.filter((c: any) => {
    const ownerTag = parseContainerOwnerFromTags(c.tags || '');
    return ownerTag === sanitizedId;
  });

  // Fallback: if no tag-matched containers but we have sessionMeta VMIDs, use those
  if (userContainers.length === 0 && sessionMetaVmids && sessionMetaVmids.length > 0) {
    console.log(`[PROXMOX] No tag match for ${sanitizedId}, falling back to sessionMeta VMIDs:`, sessionMetaVmids);
    userContainers = all.filter((c: any) => sessionMetaVmids.includes(typeof c.vmid === 'string' ? parseInt(c.vmid) : c.vmid));
  }

  return userContainers;
}

// Start a container
export async function startContainer(vmid: number): Promise<string> {
  return proxmoxFetch(
    `/api2/json/nodes/${PROXMOX_NODE}/lxc/${vmid}/status/start`,
    { method: 'POST' }
  );
}

// Stop a container
export async function stopContainer(vmid: number): Promise<string> {
  return proxmoxFetch(
    `/api2/json/nodes/${PROXMOX_NODE}/lxc/${vmid}/status/stop`,
    { method: 'POST' }
  );
}

// Reboot a container
export async function rebootContainer(vmid: number): Promise<string> {
  return proxmoxFetch(
    `/api2/json/nodes/${PROXMOX_NODE}/lxc/${vmid}/status/reboot`,
    { method: 'POST' }
  );
}

// Destroy a container — force stop, wait until stopped, then purge
export async function destroyContainer(vmid: number): Promise<string> {
  console.log(`[PROXMOX] Destroying CT ${vmid}...`);

  // Step 1: Force stop (ignore errors if already stopped)
  try {
    await proxmoxFetch(
      `/api2/json/nodes/${PROXMOX_NODE}/lxc/${vmid}/status/shutdown`,
      { method: 'POST', body: JSON.stringify({ forceStop: 1 }) }
    );
  } catch {}

  // Also try a hard stop
  try {
    await stopContainer(vmid);
  } catch {}

  // Step 2: Poll until container is actually stopped (up to 15s)
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const s = await getContainerStatus(vmid);
      console.log(`[PROXMOX] CT ${vmid} status: ${s.status}`);
      if (s.status === 'stopped') break;
    } catch {
      // Container might already be gone
      break;
    }
  }

  // Step 3: Delete with force + purge flags
  console.log(`[PROXMOX] Sending DELETE for CT ${vmid} with purge+force`);
  return proxmoxFetch(
    `/api2/json/nodes/${PROXMOX_NODE}/lxc/${vmid}?purge=1&force=1`,
    { method: 'DELETE' }
  );
}

// Get container status
export async function getContainerStatus(vmid: number): Promise<{
  status: string;
  name: string;
  vmid: number;
  uptime: number;
  mem: number;
  maxmem: number;
  cpu: number;
}> {
  return proxmoxFetch(
    `/api2/json/nodes/${PROXMOX_NODE}/lxc/${vmid}/status/current`
  );
}

// Get container's IP address via network interfaces
export async function getContainerIP(vmid: number): Promise<string | null> {
  try {
    const interfaces = await proxmoxFetch(
      `/api2/json/nodes/${PROXMOX_NODE}/lxc/${vmid}/interfaces`
    );
    
    for (const iface of interfaces || []) {
      if (iface.name === 'eth0' && iface['inet']) {
        // inet is like "192.168.2.150/24"
        return iface['inet'].split('/')[0];
      }
    }
  } catch {
    // Interfaces endpoint may not be available immediately
  }
  return null;
}

// List all Draco agent containers
export async function listContainers(): Promise<any[]> {
  const data = await proxmoxFetch(
    `/api2/json/nodes/${PROXMOX_NODE}/lxc`
  );
  
  // Debug: log raw Proxmox data
  console.log(`[PROXMOX] Raw LXC list (${(data || []).length} total):`, 
    (data || []).map((c: any) => ({ vmid: c.vmid, name: c.name, tags: c.tags, status: c.status }))
  );
  
  // Filter to draco containers — check tags, name, and VMID range (200-299)
  return (data || []).filter((c: any) => {
    const tags = (c.tags || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    const vmid = typeof c.vmid === 'string' ? parseInt(c.vmid) : c.vmid;
    return tags.includes('draco') || name.includes('draco') || (vmid >= 200 && vmid < 300);
  });
}

// Wait for container to be ready (running + has IP)
export async function waitForContainer(vmid: number, timeoutMs: number = 30000): Promise<string> {
  const start = Date.now();
  
  while (Date.now() - start < timeoutMs) {
    try {
      const status = await getContainerStatus(vmid);
      if (status.status === 'running') {
        // Try to get IP
        const ip = await getContainerIP(vmid);
        if (ip) return ip;
      }
    } catch {}
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  throw new Error(`Container ${vmid} not ready within ${timeoutMs / 1000}s`);
}

// Execute a command inside a container via Proxmox exec API (no SSH needed)
export async function execInContainer(vmid: number, command: string): Promise<string> {
  // Use `pct exec` via the Proxmox API
  // This runs the command directly without SSH
  const data = await proxmoxFetch(
    `/api2/json/nodes/${PROXMOX_NODE}/lxc/${vmid}/status/current`
  );
  
  if (data.status !== 'running') {
    throw new Error(`Container ${vmid} is not running (status: ${data.status})`);
  }
  
  // Proxmox doesn't have a direct exec REST endpoint, but we can use 
  // the vncproxy or termproxy. For Phase 1, we'll use SSH.
  throw new Error('Use SSH execution instead');
}
