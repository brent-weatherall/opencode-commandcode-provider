# commandcode-go-opencode-provider

[Command Code](https://commandcode.ai) API provider for [opencode](https://opencode.ai). Use Claude, GPT, Gemini, DeepSeek, Qwen, Kimi, GLM, MiniMax, Step, and other models through a single API key.

## Quick Start

### 1. Get an API key

Sign up at [commandcode.ai](https://commandcode.ai) and generate an API key.

### 2. Install

Add the provider to your `opencode.json`:

```bash
opencode plugin commandcode-go-opencode-provider
```

Or add it manually (see [Manual Configuration](#manual-configuration)).

### 3. Connect

Run `/connect` in opencode, search for **Command Code**, and enter your API key:

```
/connect
```

### 4. Select a model

Run `/models` to pick from available models:

```
/models
```

## Manual Configuration

You can also configure the provider directly in `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["commandcode-go-opencode-provider/server"],
  "provider": {
    "commandcode": {
      "npm": "commandcode-go-opencode-provider",
      "name": "Command Code",
      "env": ["COMMANDCODE_API_KEY"]
    }
  },
  "model": "commandcode/deepseek-v4-flash"
}
```

The plugin enables the `/connect` auth flow. The provider key (`commandcode`) is used to prefix model IDs (e.g. `commandcode/deepseek-v4-flash`).

### Environment Variable

Set `COMMANDCODE_API_KEY` instead of using `/connect`:

```bash
COMMANDCODE_API_KEY=your-key opencode
```

## Available Models

| Model ID | Name | Tier | Reasoning | Context |
|---|---|---|---|---|
| `claude-haiku-4-5-20251001`                | Claude Haiku 4.5            | premium      | no  | 200K   |
| `claude-opus-4-7`                          | Claude Opus 4.7             | premium      | yes | 1M     |
| `claude-sonnet-4-6`                        | Claude Sonnet 4.6           | premium      | yes | 1M     |
| `gpt-5.3-codex`                            | GPT-5.3 Codex               | premium      | yes | 400K   |
| `gpt-5.4`                                  | GPT-5.4                     | premium      | yes | 400K   |
| `gpt-5.4-mini`                             | GPT-5.4 Mini                | premium      | yes | 400K   |
| `gpt-5.5`                                  | GPT-5.5                     | premium      | yes | 256K   |
| `deepseek/deepseek-v4-flash`               | DeepSeek V4 Flash           | open-source  | yes | 1M     |
| `deepseek/deepseek-v4-pro`                 | DeepSeek V4 Pro             | open-source  | yes | 1M     |
| `google/gemini-3.1-flash-lite`             | Gemini 3.1 Flash Lite       | open-source  | yes | 1M     |
| `google/gemini-3.5-flash`                  | Gemini 3.5 Flash            | open-source  | yes | 1M     |
| `zai-org/GLM-5`                            | GLM-5                       | open-source  | no  | 200K   |
| `zai-org/GLM-5.1`                          | GLM-5.1                     | open-source  | no  | 200K   |
| `moonshotai/Kimi-K2.5`                     | Kimi K2.5                   | open-source  | no  | 256K   |
| `moonshotai/Kimi-K2.6`                     | Kimi K2.6                   | open-source  | no  | 256K   |
| `MiniMaxAI/MiniMax-M2.5`                   | MiniMax M2.5                | open-source  | no  | 200K   |
| `MiniMaxAI/MiniMax-M2.7`                   | MiniMax M2.7                | open-source  | no  | 1M     |
| `Qwen/Qwen3.6-Max-Preview`                 | Qwen 3.6 Max Preview        | open-source  | yes | 1M     |
| `Qwen/Qwen3.6-Plus`                        | Qwen 3.6 Plus               | open-source  | yes | 1M     |
| `Qwen/Qwen3.7-Max`                         | Qwen 3.7 Max                | open-source  | yes | 1M     |
| `stepfun/Step-3.5-Flash`                   | Step 3.5 Flash              | open-source  | yes | 1M     |

Full model list is maintained in [`models.json`](./models.json). Run `bun run sync` to refresh from the latest Command Code CLI release on npm.

## Development

```bash
git clone https://github.com/brent-weatherall/commandcode-go-opencode-provider.git
cd commandcode-go-opencode-provider
bun install
```

For local testing, create `opencode.local.json` (gitignored) with `file://` paths:

```json
{
  "plugin": ["file:///path/to/commandcode-go-opencode-provider/plugin.ts"],
  "provider": {
    "commandcode": {
      "npm": "file:///path/to/commandcode-go-opencode-provider",
      "name": "Command Code (local)",
      "env": ["COMMANDCODE_API_KEY"]
    }
  }
}
```

Run `opencode --config opencode.local.json` to test with your local build.

### Sync Models

```bash
bun run sync              # update models.json from Command Code
bun run sync:global       # update models.json + write to ~/.config/opencode/opencode.jsonc
```

## License

MIT
