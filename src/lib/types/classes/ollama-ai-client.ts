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

import {
	AiClientBase,
	type AiQueryItem,
	type AiQueryOptions,
	type AiQueryResult
} from './ai-client-base';

/**
 * An Ollama implementation of `AiClientBase`.
 */
export class OllamaAIClient extends AiClientBase {
	/**
	 * Initializes a new instance of that class.
	 *
	 * @param {string} [model="llama4"] The custom model to use.
	 */
	constructor(model = 'llama4') {
		super(model);
	}

	/**
	 * @inheritdoc
	 */
	get provider(): string {
		return 'ollama';
	}

	/**
	 * @inheritdoc
	 */
	async query(q: AiQueryItem[], options: AiQueryOptions): Promise<AiQueryResult> {
		if (options.temperature < 0 || options.temperature > 2) {
			throw new TypeError(`options.temperature must be between 0 and 2`);
		}

		const messages = q.map((item) => {
			return {
				role: item.role,
				content: item.content
			};
		});

		const response = await fetch('http://localhost:11434/api/chat', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: this.model,
				messages,
				stream: false,
				options: {
					temperature: options.temperature
				}
			})
		});

		if (response.status !== 200) {
			const text = await response.text();

			throw new Error(`Unexpected response ${response.status}: ${text}`);
		}

		const data = await response.json();

		return {
			content: String(data.message.content ?? '')
		};
	}
}
