// MIT License
//
// Copyright (c) 2025 Marcel Joachim Kloubert (https://marcel.coffee)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { OllamaAIClient } from "./ollama.mts";

/**
 * An item for an AI query.
 */
export interface AiQueryItem {
  /**
   * The (message) content.
   */
  content: string;
  /**
   * The role.
   */
  role: "system" | "user";
}

/**
 * Options for `query()` method.
 */
export interface AiQueryOptions {
  /**
   * The maximum number of tokens.
   */
  maxTokens: number;
  /**
   * The temperature value.
   */
  temperature: number;
}

/**
 * Result of an AI query operation.
 */
export interface AiQueryResult {
  /**
   * The content.
   */
  content: string;
}

/**
 * A basic AI client.
 */
export abstract class AiClientBase {
  /**
   * Initializes a new instance of that class.
   *
   * @param {string} model The ID of the model.
   */
  constructor(public readonly model: string) {}

  /**
   * Creates a new instance from current settings.
   *
   * @param argv Arguments from the command line.
   *
   * @returns {Promise<AiClientBase>} The promise with the new instance.
   */
  static async fromSettings(argv: any): Promise<AiClientBase> {
    const { OpenAIClient } = await import("./openai.mjs");

    const customModel = String(argv?.["model"] ?? "").trim();
    const useOllama = !!argv?.["ollama"];

    let client: AiClientBase;
    if (useOllama) {
      const model = customModel || "llama4";

      client = new OllamaAIClient(model);
    } else {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error("no OPENAI_API_KEY defined");
      }

      const model = customModel || "gpt-4o-mini";

      client = new OpenAIClient(apiKey, model);
    }

    return client;
  }

  /**
   * Gets the ID of the provider.
   *
   * @returns {string} The ID of the provider.
   */
  abstract get provider(): string;

  /**
   * Starts a query.
   *
   * @param {AiQueryItem[]} q The list with items.
   * @param {AiQueryOptions} options Additional options.
   *
   * @returns {PromiseLike<AiQueryResult>} The promise with the result.
   */
  abstract query(
    q: AiQueryItem[],
    options: AiQueryOptions
  ): PromiseLike<AiQueryResult>;
}
