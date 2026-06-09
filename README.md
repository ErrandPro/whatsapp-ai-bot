# WhatsApp AI Bot 🤖

Personal WhatsApp AI Assistant using Baileys + n8n + Claude AI.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Run locally
```bash
npm start
```

### 4. Scan QR Code
Open http://localhost:3000/qr in your browser and scan with WhatsApp.

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | App status |
| `/ping` | GET | Health check (keep-alive) |
| `/qr` | GET | QR code page |
| `/status` | GET | Connection status |
| `/send` | POST | Send a message (requires x-api-key header) |

## Send Message (from n8n)
```json
POST /send
Headers: { "x-api-key": "your-api-key" }
Body: { "to": "256700000000", "message": "Hello!" }
```

## Deploy to Render
1. Push this repo to GitHub
2. Connect to Render as a Node.js web service
3. Set environment variables from .env.example
4. Deploy!
