# Deploy AIlumina to GitHub Codespaces (Free!)

Run the complete AIlumina baseline system for free using GitHub Codespaces and Groq's free LLM inference.

## Prerequisites

1. **GitHub Account** (free)
2. **Groq API Key** (free, no credit card required)
   - Sign up at [console.groq.com](https://console.groq.com)
   - Create a new API key
   - Copy the key (you'll need it in step 3)

## Quick Start (3 steps)

### 1. Open in Codespaces

Click the green **Code** button on GitHub → **Codespaces** → **Create codespace on main**

GitHub will:
- Create a cloud development environment
- Install Node.js, Bun, and all dependencies
- Set up the AIlumina project automatically

*This takes ~2-3 minutes on first launch*

### 2. Add Your Groq API Key

Once the Codespace opens, add your Groq API key:

**Option A: Using Codespaces Secrets (Recommended)**
1. Go to GitHub Settings → Codespaces → Secrets
2. Click **New secret**
3. Name: `GROQ_API_KEY`
4. Value: Your Groq API key
5. Restart the Codespace

**Option B: Using Terminal (Quick Testing)**
```bash
export GROQ_API_KEY="your_groq_api_key_here"
```

### 3. Start AIlumina

In the Codespace terminal:

**Option A: Automated (Recommended)**

```bash
# Navigate to AIlumina directory
cd AIlumina

# Run the startup script
./start.sh
```

This will:
- Install all dependencies
- Build everything
- Configure environment files
- Deploy the client
- Optionally start the server

**Option B: Manual Development**

```bash
cd AIlumina

# Start both backend and frontend
npm run dev
```

> **Note:** The demo configuration is automatically set up during Codespace creation. No manual configuration needed!

**That's it!** 🎉

The frontend will automatically open in a new browser tab. Start chatting with AIlumina!

## What You Get

- **Backend**: WebSocket server on port 3000
- **Frontend**: React app with text + voice interaction on port 5173
- **AI Models**: Three free Groq-powered variants:
  - `AIlumina-Free` - Llama 3.1 70B (powerful, balanced)
  - `AIlumina-Fast` - Llama 3.1 8B (ultra-fast responses)
  - `AIlumina-Mixtral` - Mixtral 8x7B (32K context window)

## Free Tier Limits

**GitHub Codespaces:**
- 60 hours/month (free account)
- 120 hours/month (GitHub Pro)
- Auto-stops after 30 minutes of inactivity

**Groq API:**
- 14,400 requests/day
- 30 requests/minute
- No credit card required

## Available Models

The demo configuration includes three Groq models. Switch between them in the UI:

| Agent | Model | Best For |
|-------|-------|----------|
| AIlumina-Free | llama-3.1-70b-versatile | Balanced power and speed |
| AIlumina-Fast | llama-3.1-8b-instant | Quick responses |
| AIlumina-Mixtral | mixtral-8x7b-32768 | Long conversations (32K context) |

## Manual Commands

```bash
# Install dependencies (done automatically)
npm install

# Start backend only
npm run dev:server

# Start frontend only
npm run dev:client

# Build for production
npm run build

# Run the production build
npm start
```

## Troubleshooting

### "GROQ_API_KEY is not set"

Make sure you've added the API key (see step 2 above). If using Option A, restart the Codespace after adding the secret.

### "Port 3000 already in use"

Stop the backend and restart:
```bash
pkill -f "bun src/http-server"
npm run dev:server
```

### "Module not found" errors

Reinstall dependencies:
```bash
npm run clean
npm install
```

### Frontend won't connect to backend

Check that both servers are running:
- Backend: Port 3000 (WebSocket)
- Frontend: Port 5173 (Vite dev server)

## Customization

### Add Your Own AI Provider

Edit `server/agents.json` to use Anthropic, OpenAI, Google, or other supported providers:

```json
{
  "MyAgent": {
    "key": "MyAgent",
    "agent_name": "My Custom Agent",
    "service_provider": "ANTHROPIC",
    "model_name": "claude-3-5-sonnet-20241022",
    "system_prompt": "Your custom prompt...",
    "do_stream": true,
    "available_functions": []
  }
}
```

**Supported providers:**
- `ANTHROPIC` (requires `ANTHROPIC_API_KEY`)
- `OPENAI` (requires `OPENAI_API_KEY`)
- `GOOGLE` (requires `GOOGLE_API_KEY`)
- `GROQ` (requires `GROQ_API_KEY`)
- `OLLAMA` (requires local Ollama instance)
- `LMSTUDIO` (requires local LMStudio instance)

### Change the Model

Groq supports many open-source models. See [Groq's model list](https://console.groq.com/docs/models) for available options.

## Architecture

This Codespace runs the complete Section 0 baseline system:

**Backend** (`server/`):
- Multi-provider architecture (Anthropic, OpenAI, Google, Groq, etc.)
- WebSocket streaming for real-time responses
- Direct HTTP transport (no SDK dependencies)
- TypeScript + Bun runtime

**Frontend** (`client/`):
- React + TypeScript
- Four interaction modalities (Type+Read, Speak+Read, Type+Listen, Speak+Listen)
- XState state machine for conversation flow
- Browser-native Web Speech API

## Next Steps

Once you have AIlumina running:

1. **Try voice interaction** - Toggle SR (Speech Recognition) and TTS (Text-to-Speech)
2. **Switch models** - Try different Groq models to see performance differences
3. **Read the documentation** - See [README.md](./README.md) for architecture details
4. **Explore the code** - Check out the implementation in `server/` and `client/`

## Cost

**Total cost to run AIlumina: $0** ✨

- GitHub Codespaces: Free tier (60-120 hours/month)
- Groq API: Free tier (14,400 requests/day)
- No credit card required for either

Perfect for demos, testing, and learning!

## Links

- [Groq Console](https://console.groq.com) - Get your free API key
- [GitHub Codespaces Docs](https://docs.github.com/en/codespaces) - Learn more about Codespaces
- [AIlumina README](./README.md) - Full project documentation
