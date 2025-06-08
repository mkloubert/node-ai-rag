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
import { chromaBaseUrl, databaseName, tenantName } from './constants';
import slugify from 'slugify';
import { z } from 'zod';

const createCollectionSchema = z.object({
	collectionName: z.string().min(1),
});

export const GET: RequestHandler = async () => {
	const url = `${chromaBaseUrl}/api/v2/tenants/${encodeURIComponent(
		tenantName
	)}/databases/${encodeURIComponent(databaseName)}/collections`;
	const response = await fetch(url, {
		method: 'GET'
	});

	if (response.status !== 200) {
		const text = await response.text();

		throw new Error(`Unexpected response ${response.status}: ${text}`);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const r: any = await response.json();

	return Response.json(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		r.map(({ id, name }: any) => {
			return {
				id,
				name
			};
		}),
		{ status: 200 }
	);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await createCollectionSchema.parseAsync(await request.json());

	const collectionName = slugify(String(body.collectionName), {
		locale: 'en',
		lower: true,
		trim: true
	});

	const url = `${chromaBaseUrl}/api/v2/tenants/${encodeURIComponent(
		tenantName
	)}/databases/${encodeURIComponent(databaseName)}/collections`;
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: Buffer.from(
			JSON.stringify({
				name: collectionName
			}),
			'utf8'
		)
	});

	if (response.status !== 200) {
		const text = await response.text();

		throw new Error(`Unexpected response ${response.status}: ${text}`);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const r: any = await response.json();

	return Response.json(
		{
			id: r.id,
			name: r.name
		},
		{ status: 201 }
	);
};
