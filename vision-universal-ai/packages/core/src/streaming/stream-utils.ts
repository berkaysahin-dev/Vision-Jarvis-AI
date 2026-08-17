import type { AIChunk, AIResponse, UsageInfo, FinishReason } from "../types/chat.js";

/**
 * Universal Stream Wrapper providing convenient async iteration and conversion methods
 */
export class AIStream implements AsyncIterable<AIChunk> {
  private iteratorFactory: () => AsyncIterator<AIChunk>;
  private provider: string;
  private model: string;

  constructor(
    source: AsyncIterable<AIChunk> | (() => AsyncIterator<AIChunk>),
    meta: { provider: string; model: string }
  ) {
    if (typeof source === "function") {
      this.iteratorFactory = source;
    } else {
      this.iteratorFactory = () => source[Symbol.asyncIterator]();
    }
    this.provider = meta.provider;
    this.model = meta.model;
  }

  [Symbol.asyncIterator](): AsyncIterator<AIChunk> {
    return this.iteratorFactory();
  }

  /**
   * Converts chunk stream to a stream of incremental text deltas
   */
  async *toTextStream(): AsyncGenerator<string, void, unknown> {
    for await (const chunk of this) {
      if (chunk.delta) {
        yield chunk.delta;
      }
    }
  }

  /**
   * Reads the entire stream until completion and returns the final full text
   */
  async getText(): Promise<string> {
    let fullText = "";
    for await (const chunk of this) {
      if (chunk.delta) {
        fullText += chunk.delta;
      } else if (chunk.text && chunk.text.length > fullText.length) {
        fullText = chunk.text;
      }
    }
    return fullText;
  }

  /**
   * Reads stream to completion and aggregates all metadata into an AIResponse
   */
  async getFinalResponse(): Promise<AIResponse> {
    let fullText = "";
    let reasoningContent = "";
    let finishReason: FinishReason = "stop";
    let usage: UsageInfo | undefined;
    let lastRaw: unknown;

    for await (const chunk of this) {
      if (chunk.delta) {
        fullText += chunk.delta;
      } else if (chunk.text) {
        fullText = chunk.text;
      }
      if (chunk.reasoningDelta) {
        reasoningContent += chunk.reasoningDelta;
      }
      if (chunk.finishReason) {
        finishReason = chunk.finishReason;
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
      lastRaw = chunk.rawChunk;
    }

    return {
      text: fullText,
      reasoningContent: reasoningContent || undefined,
      finishReason,
      usage,
      provider: this.provider,
      model: this.model,
      rawResponse: lastRaw
    };
  }

  /**
   * Converts to a Web standard ReadableStream of AIChunk objects
   */
  toReadableStream(): ReadableStream<AIChunk> {
    const iterator = this[Symbol.asyncIterator]();
    return new ReadableStream<AIChunk>({
      async pull(controller) {
        try {
          const { value, done } = await iterator.next();
          if (done) {
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch (err) {
          controller.error(err);
        }
      },
      async cancel() {
        if (iterator.return) {
          await iterator.return();
        }
      }
    });
  }

  /**
   * Converts to a Web standard ReadableStream of UTF-8 encoded text chunks
   */
  toTextReadableStream(): ReadableStream<Uint8Array> {
    const textStream = this.toTextStream();
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await textStream.next();
          if (done) {
            controller.close();
          } else {
            controller.enqueue(encoder.encode(value));
          }
        } catch (err) {
          controller.error(err);
        }
      },
      async cancel() {
        if (textStream.return) {
          await textStream.return();
        }
      }
    });
  }
}

/**
 * Creates an AIStream from any AsyncIterable<AIChunk>
 */
export function createAIStream(
  source: AsyncIterable<AIChunk>,
  meta: { provider: string; model: string }
): AIStream {
  return new AIStream(source, meta);
}

/**
 * Robust SSE (Server-Sent Events) line parser for Web standard ReadableStream
 */
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array> | null
): AsyncGenerator<{ event?: string; data: string }, void, unknown> {
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      let currentEvent: string | undefined;
      let currentData: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          if (currentData.length > 0) {
            yield { event: currentEvent, data: currentData.join("\n") };
            currentEvent = undefined;
            currentData = [];
          }
          continue;
        }

        if (trimmed.startsWith("event:")) {
          currentEvent = trimmed.slice(6).trim();
        } else if (trimmed.startsWith("data:")) {
          currentData.push(trimmed.slice(5).trim());
        }
      }

      if (currentData.length > 0) {
        yield { event: currentEvent, data: currentData.join("\n") };
      }
    }

    if (buffer.trim()) {
      if (buffer.startsWith("data:")) {
        yield { data: buffer.slice(5).trim() };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
