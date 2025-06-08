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

import type { EmbeddingsInterface } from '@langchain/core/embeddings';

/**
 * Ollama embeddings.
 */
export class OllamaEmbeddings implements EmbeddingsInterface {
	readonly #model: string;
	readonly #baseUrl: string;

	/**
	 * Initializes a new instance of that class.
	 *
	 * @param {string} [model="nomic-embed-text"] The custom model.
	 * @param {string} [baseUrl="http://host.docker.internal:11434"] The custom base URL for Ollama.
	 */
	constructor(model = 'nomic-embed-text', baseUrl = 'http://host.docker.internal:11434') {
		this.#model = model;
		this.#baseUrl = baseUrl;
	}

	/**
	 * @inheritdoc
	 */
	async embedDocuments(texts: string[]): Promise<number[][]> {
		return Promise.all(texts.map((text) => this.embedQuery(text)));
	}

	/**
	 * @inheritdoc
	 */
	async embedQuery(text: string): Promise<number[]> {
		const url = `${this.#baseUrl}/api/embeddings`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=UTF-8'
			},
			body: Buffer.from(
				JSON.stringify({
					model: this.#model,
					prompt: text
				}),
				'utf-8'
			)
		});

		const jsonResponse = await response.json();

		return jsonResponse.embedding;
	}
}
