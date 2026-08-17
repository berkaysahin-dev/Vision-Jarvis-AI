import { describe, it, expect } from "vitest";
import { createAIStream, parseSSEStream } from "@vision-ai/core";

describe("Streaming Utilities", () => {
  it("should iterate chunks and compute final text and response", async () => {
    async function* sampleGenerator() {
      yield { text: "Hello", delta: "Hello" };
      yield { text: "Hello world", delta: " world" };
      yield {
        text: "Hello world!",
        delta: "!",
        finishReason: "stop" as const,
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 }
      };
    }

    const stream = createAIStream(sampleGenerator(), { provider: "mock", model: "test-model" });

    // Test text stream generator
    const collectedDeltas: string[] = [];
    for await (const chunk of stream.toTextStream()) {
      collectedDeltas.push(chunk);
    }
    expect(collectedDeltas).toEqual(["Hello", " world", "!"]);

    // Test full text aggregation
    const stream2 = createAIStream(sampleGenerator(), { provider: "mock", model: "test-model" });
    const fullText = await stream2.getText();
    expect(fullText).toBe("Hello world!");

    // Test final response aggregation
    const stream3 = createAIStream(sampleGenerator(), { provider: "mock", model: "test-model" });
    const final = await stream3.getFinalResponse();
    expect(final.text).toBe("Hello world!");
    expect(final.finishReason).toBe("stop");
    expect(final.usage?.totalTokens).toBe(8);
  });

  it("should parse SSE streams correctly", async () => {
    const sseData = new TextEncoder().encode(
      'data: {"message":"chunk 1"}\n\nevent: custom\ndata: {"message":"chunk 2"}\n\n'
    );

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(sseData);
        controller.close();
      }
    });

    const parsedEvents: Array<{ event?: string; data: string }> = [];
    for await (const sse of parseSSEStream(readable)) {
      parsedEvents.push(sse);
    }

    expect(parsedEvents).toHaveLength(2);
    expect(parsedEvents[0].data).toBe('{"message":"chunk 1"}');
    expect(parsedEvents[1].event).toBe("custom");
    expect(parsedEvents[1].data).toBe('{"message":"chunk 2"}');
  });
});
