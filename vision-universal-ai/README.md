<div align="center">

# 🌌 Vision Universal AI

### **One SDK. Every AI.**

[![npm version](https://img.shields.io/npm/v/vision-universal-ai.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/vision-universal-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict%20Mode-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node: 18+](https://img.shields.io/badge/Node.js-18%2B%20%7C%20Edge%20%7C%20Bun%20%7C%20Deno-brightgreen?style=flat-square)](https://nodejs.org)

**Vision Universal AI** is an enterprise-grade, production-ready **Universal AI SDK** for TypeScript and JavaScript. It provides a single, unified, strictly typed API to interact with **Google Gemini, OpenAI, Anthropic Claude, Groq, DeepSeek, OpenRouter, Ollama, and Mistral** without vendor lock-in.

---

</div>

## 🚀 Why Vision Universal AI?

Switching AI providers shouldn't require rewriting your codebase. Vision Universal AI abstracts provider idiosyncrasies into a unified interface while retaining the unique capabilities of each model.

```
                  ┌───────────────────────────────┐
                  │      Your Application         │
                  └──────────────┬────────────────┘
                                 │
                 import { VisionAI } from "vision-universal-ai"
                                 │
                  ┌──────────────▼────────────────┐
                  │    Vision Universal AI SDK    │
                  │   Pipeline • Retry • Router   │
                  └──────┬───┬───┬───┬───┬───┬───┬┘
                         │   │   │   │   │   │   │
      ┌──────────────────┼───┼───┼───┼───┼───┼───┼──────────────────┐
      │                  │   │   │   │   │   │   │                  │
┌─────▼─────┐      ┌─────▼───▼┐ ┌▼───▼─────┐ ┌───▼───────┐      ┌─────▼─────┐
│  Gemini   │      │  OpenAI  │ │Anthropic │ │ DeepSeek  │      │  Ollama   │
│2.0 / Flash│      │GPT-4o/o3 │ │Claude 3.5│ │ V3 / R1   │      │  (Local)  │
└───────────┘      └──────────┘ └──────────┘ └───────────┘      └───────────┘
```

- 🔄 **Zero-Code Provider Swapping**: Switch between Gemini, OpenAI, Claude, and local models with one string change.
- ⚡ **Real-Time Streaming**: Native async iterables and Web standard ReadableStreams with token aggregation.
- 🛠️ **Autonomous Multi-Step Tool Calling**: Automatic execution loop with recursive conversation resolution.
- 📐 **Strict Structured Outputs**: JSON Schema validation with automatic extraction from markdown code fences.
- 👁️ **Multimodal**: Native support for text, images (URLs & Base64), audio, and documents across supported models.
- 🛡️ **Resilient Model Routing**: Automatic failover chains (e.g. Gemini ➔ OpenAI ➔ Claude) when rate limits or server errors occur.
- ⏱️ **Production Resilience**: Exponential backoff retries with jitter, strict timeouts, normalized error classes, and request cancellation.
- 🪶 **Zero-Dependency Edge Core**: Built on standard `fetch` and SSE parsers — runs on Node.js, Next.js, Cloudflare Workers, Bun, Deno, and Electron.

---

## 📦 Supported Providers Matrix

| Provider | Chat | Streaming | Tool Calling | Vision | Structured JSON | Embeddings | Reasoning (R1/o1) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Google Gemini** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **OpenAI** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Anthropic Claude** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Groq** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **DeepSeek** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **OpenRouter** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Ollama (Local)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Mistral AI** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 📥 Installation

```bash
npm install vision-universal-ai
```

or with yarn / pnpm / bun:

```bash
pnpm add vision-universal-ai
bun add vision-universal-ai
```

---

## ⚡ Quick Start

Create an AI client in 3 lines:

```ts
import { VisionAI } from "vision-universal-ai";

const ai = new VisionAI({
  provider: "gemini",
  apiKey: process.env.GEMINI_API_KEY
});

const response = await ai.chat("What are the fundamentals of quantum computing?");
console.log(response.text);
```

### Switching Providers Instantly

Change only the `provider` configuration — your application logic remains 100% identical:

```ts
// OpenAI
const ai = new VisionAI({ provider: "openai", apiKey: process.env.OPENAI_API_KEY });

// Anthropic Claude
const ai = new VisionAI({ provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY });

// Groq
const ai = new VisionAI({ provider: "groq", apiKey: process.env.GROQ_API_KEY });

// DeepSeek (V3 / R1)
const ai = new VisionAI({ provider: "deepseek", apiKey: process.env.DEEPSEEK_API_KEY });

// Local Ollama (no API key needed)
const ai = new VisionAI({ provider: "ollama", baseUrl: "http://localhost:11434" });
```

---

## 🌊 Real-Time Streaming

Consume real-time token streams using modern `for await...of`:

```ts
import { VisionAI } from "vision-universal-ai";

const ai = new VisionAI({ provider: "gemini" });
const stream = await ai.stream("Write an essay on the future of humanoid robotics.");

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
}

// Access aggregated response & usage metadata when complete:
const finalResponse = await stream.getFinalResponse();
console.log("\nTotal tokens used:", finalResponse.usage?.totalTokens);
```

---

## 🛠️ Autonomous Multi-Step Tool Calling

Provide standard executable tools. Vision Universal AI will automatically execute the functions and feed their outputs back into the model until a final answer is reached:

```ts
import { VisionAI, type AITool } from "vision-universal-ai";

const weatherTool: AITool<{ city: string }> = {
  name: "get_weather",
  description: "Get the current weather forecast for a given city.",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name, e.g. London" }
    },
    required: ["city"]
  },
  execute: async ({ city }) => {
    return { city, temperature: 21, condition: "Sunny" };
  }
};

const ai = new VisionAI({ provider: "gemini" });

const response = await ai.chat({
  prompt: "What is the weather in London right now?",
  tools: [weatherTool]
});

console.log(response.text);
// "The current weather in London is sunny with a temperature of 21°C."
```

---

## 📐 Strict Structured Output (JSON Schema)

Extract strictly validated, type-safe data structures:

```ts
import { VisionAI } from "vision-universal-ai";

interface Product {
  name: string;
  price: number;
  tags: string[];
}

const ai = new VisionAI({ provider: "openai" });

const result = await ai.generate<Product>({
  prompt: "Generate a futuristic smart glass product description.",
  responseFormat: {
    type: "json",
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        price: { type: "number" },
        tags: { type: "array", items: { type: "string" } }
      },
      required: ["name", "price", "tags"]
    }
  }
});

console.log(result.data.name);  // Type-safe string
console.log(result.data.price); // Type-safe number
```

---

## 👁️ Multimodal (Vision, Audio, Files)

Analyze images from remote URLs or inline Base64 buffers:

```ts
const response = await ai.chat({
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What is depicted in this photo?" },
        { type: "image", image: "https://example.com/satellite-photo.jpg" }
      ]
    }
  ]
});
```

---

## 🛡️ Model Routing & High-Availability Fallback

Never suffer downtime due to provider outages or 429 rate limits. Configure resilient fallback matrices:

```ts
const ai = new VisionAI({
  routing: {
    default: "gemini",
    fallback: ["openai", "anthropic", "groq"],
    fallbackOnRateLimit: true,
    fallbackOnServerError: true,
    onFallback: ({ failedProvider, error, nextProvider }) => {
      console.warn(`[Failover] ${failedProvider} failed (${error.message}). Failing over to ${nextProvider}...`);
    }
  }
});

// If Google Gemini hits a rate limit or 503 outage, the SDK transparently
// switches to OpenAI, then Claude, without throwing an unhandled exception.
const response = await ai.chat("Generate quarterly financial summary.");
```

---

## 🧠 Reasoning Tokens (DeepSeek-R1, o1, o3-mini)

Access raw thinking tokens for advanced chain-of-thought models:

```ts
const ai = new VisionAI({ provider: "deepseek", defaultModel: "deepseek-reasoner" });
const response = await ai.chat("Solve this combinatorial math problem step by step.");

console.log("=== THOUGHT PROCESS ===");
console.log(response.reasoningContent);

console.log("\n=== FINAL ANSWER ===");
console.log(response.text);
```

---

## 🔌 Creating Custom Providers

Add any bespoke internal enterprise model in ~20 lines:

```ts
import { VisionAI, type AIProvider } from "vision-universal-ai";

class MyEnterpriseLLM implements AIProvider {
  public readonly name = "enterprise-ai";
  public readonly displayName = "Enterprise AI";
  public readonly defaultModel = "v1";
  public readonly capabilities = {
    chat: true, stream: true, tools: false, vision: false,
    audioInput: false, pdfInput: false, jsonSchema: true,
    embeddings: false, imageGeneration: false, speechToText: false, textToSpeech: false
  };

  async chat(options) {
    const res = await fetch("https://internal-llm.corp.local/v1/chat", { ... });
    return { text: "...", provider: this.name, model: this.defaultModel };
  }

  async *stream(options) {
    // yield AIChunk objects
  }
}

const ai = new VisionAI();
ai.register(new MyEnterpriseLLM());
```

---

## 💻 CLI

Vision Universal AI includes an interactive command-line interface:

```bash
# Scaffold a starter project configuration
npx vision-ai init

# Launch interactive terminal chat with live streaming
npx vision-ai chat gemini

# Test connectivity of all configured API keys
npx vision-ai test

# List model profiles
npx vision-ai models
```

---

## 🧪 Testing

Vision Universal AI has a 100% mocked, deterministic test suite:

```bash
# Run unit & integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate code coverage
npm run test:coverage
```

---

## 🤝 Contributing

We welcome community contributions! Please read our [CONTRIBUTING.md](./CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before submitting pull requests.

---

## 📄 License

Vision Universal AI is licensed under the [MIT License](./LICENSE).
