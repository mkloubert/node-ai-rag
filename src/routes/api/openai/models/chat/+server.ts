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

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	const OPENAI_API_KEY = process.env.OPENAI_API_KEY!.trim();
	if (!OPENAI_API_KEY) {
		throw new Error(`No OPENAI_API_KEY found!`);
	}

	const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com';

	const models = new Set<string>();

	try {
		const response = await fetch(`${OPENAI_BASE_URL}/v1/models`, {
			headers: {
				Authorization: `Bearer ${OPENAI_API_KEY}`
			}
		});

		if (response.status !== 200) {
			const text = await response.text();

			throw new Error(`Unexpected response ${response.status}: ${text}`);
		}

		const r = await response.json();

		r.data
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.filter(({ object, owned_by }: any) => {
				return object === 'model' && owned_by === 'openai';
			})
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.forEach(({ id }: any) => {
				models.add(String(id));
			});
	} catch (error) {
		console.log('[ERROR]:', 'Could not fetch OpenAI model list:', error);
	}

	return json({ models: [...models] });
};
