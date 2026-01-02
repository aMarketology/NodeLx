# 🌐 NodeLx Network Setup Guide

## Overview

NodeLx now supports **network-based editing**, allowing you to run the server on one machine (e.g., your laptop with source code) and edit from another device (e.g., your desktop, tablet).

```
Desktop/Tablet              Laptop/Server
┌─────────────┐            ┌─────────────┐
│  Editor UI  │  ───────►  │   NodeLx    │
│ :5174       │    HTTP    │   Server    │
└─────────────┘    WS      │   :3001     │
                            │             │
                            │  ↓ Files    │
                            └─────────────┘
```

---

## Quick Start

### 1. On Your Laptop (Source Code Machine)

Start the NodeLx server:

```bash
cd NodeLx
npm run server
```

The server will display:
```
🚀 NodeLx Development Server
==========================================
Server running at: http://localhost:3001
Network access: http://<YOUR_IP>:3001
==========================================
```

**Find your laptop's IP address:**

**Windows:**
```powershell
ipconfig
# Look for "IPv4 Address" under your network adapter
# Example: 192.168.1.178
```

**Mac/Linux:**
```bash
ifconfig
# or
ip addr show
# Look for "inet" address
# Example: 192.168.1.178
```

### 2. On Your Desktop (Editing Machine)

Start the NodeLx editor:

```bash
cd NodeLx
npm run client
```

The editor will open at `http://localhost:5174`

### 3. Configure Connection

1. Click **"⚙️ Configure Server"** in the top-right corner
2. Enter your laptop's IP: `http://192.168.1.178:3001`
3. Click **"💾 Save & Reload"**
4. The editor will reconnect to your laptop's server

---

## Firewall Configuration

### Windows (Laptop)

Open port 3001 for incoming connections:

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "NodeLx Server" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

Or manually:
1. Open "Windows Defender Firewall with Advanced Security"
2. Click "Inbound Rules" → "New Rule"
3. Select "Port" → Next
4. TCP, Specific local ports: `3001` → Next
5. Allow the connection → Next
6. Check all profiles → Next
7. Name: "NodeLx Server" → Finish

### Mac (Laptop)

```bash
# Allow NodeLx through firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /path/to/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /path/to/node
```

Or via System Settings:
1. System Settings → Network → Firewall
2. Click "Firewall Options"
3. Click "+" and add Node.js
4. Set to "Allow incoming connections"

### Linux (Laptop)

```bash
# UFW
sudo ufw allow 3001/tcp

# iptables
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
```

---

## Architecture Explained

### Local Mode (Default)
```
Desktop Browser
    ↓
http://localhost:5174 (Editor UI)
    ↓
http://localhost:3001 (NodeLx Server)
    ↓
Local Files
```

**Use when:** Editing on the same machine as your source code.

### Network Mode
```
Desktop Browser
    ↓
http://localhost:5174 (Editor UI)
    ↓
http://192.168.1.178:3001 (NodeLx Server on Laptop)
    ↓
Laptop Files
```

**Use when:** 
- Editing from a different device
- Collaborative editing with team members
- Working on a tablet/phone
- Remote development

---

## Why This Pattern?

### ✅ Advantages

1. **Files Stay Put**  
   Source code remains on your primary dev machine. No syncing, no conflicts.

2. **Edit From Anywhere**  
   Use any device on your network to edit.

3. **Real-Time Sync**  
   WebSocket keeps all connected clients synchronized.

4. **No Network Filesystem**  
   No SMB/NFS mounts required. Works over simple HTTP/WS.

5. **Industry Standard**  
   Same pattern used by VS Code Remote, JetBrains Gateway.

### ⚠️ Considerations

1. **Local Network Only**  
   This setup is designed for trusted local networks (192.168.x.x).

2. **No Built-in Auth (Yet)**  
   Anyone on your network can access the server. Coming soon: token-based auth.

3. **Firewall Required**  
   Make sure port 3001 is allowed on the laptop.

---

## Troubleshooting

### "Cannot connect to server"

**Check server is running:**
```bash
# On laptop
curl http://localhost:3001/api/health
```

**Check firewall:**
```bash
# On laptop (Windows)
Test-NetConnection -ComputerName localhost -Port 3001

# On desktop
Test-NetConnection -ComputerName 192.168.1.178 -Port 3001
```

**Check IP address:**
- Make sure you're using the correct IP
- IP addresses can change (use static IP if possible)

### "WebSocket connection failed"

WebSocket uses the same port as HTTP (3001). If HTTP works but WebSocket doesn't:
- Check firewall allows both TCP and WebSocket protocols
- Some antivirus software blocks WebSocket connections

### "Connection works but files don't save"

- Ensure the NodeLx server has write permissions to the project directory
- Check server logs for error messages

---

## Security Recommendations

### Development (Current)
✅ Use on trusted local network (home/office WiFi)  
✅ Firewall port 3001 to local network only  
✅ Don't expose to public internet

### Coming Soon
🔜 Token-based authentication  
🔜 Session management  
🔜 HTTPS support

### Production (Future)
🔒 HTTPS with Let's Encrypt  
🔒 OAuth2 / JWT authentication  
🔒 Role-based access control  
🔒 Audit logging

---

## Multiple Users

NodeLx supports multiple simultaneous connections:

```
Desktop 1 ──┐
Desktop 2 ──┼──► Laptop (NodeLx Server) ──► Files
Tablet   ──┘
```

All connected clients receive real-time updates via WebSocket.

---

## Advanced: Remote Access (NOT RECOMMENDED YET)

If you **really** need to access NodeLx from outside your local network:

### Option 1: VPN
Use Tailscale, WireGuard, or corporate VPN to securely connect devices.

### Option 2: SSH Tunnel
```bash
# On remote machine
ssh -L 3001:localhost:3001 user@laptop-ip

# Now access http://localhost:3001
```

### Option 3: Ngrok (Dev Only)
```bash
# On laptop
ngrok http 3001

# Use the ngrok URL in NodeLx config
```

⚠️ **Warning**: These expose your file system. Only use on trusted networks or wait for authentication features.

---

## What's Next?

- [ ] Token-based authentication
- [ ] HTTPS support
- [ ] User management
- [ ] Session persistence
- [ ] Connection health monitoring
- [ ] Auto-reconnect on network change
- [ ] Mobile-optimized editor UI

---

*Built for developers who want to edit from anywhere.*

**Questions?** Open an issue on GitHub.
