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
import { chromaBaseUrl, databaseName, tenantName } from '../constants';

export const DELETE: RequestHandler = async ({ params }) => {
	const collectionId = params.collection_id!;

	const url = `${chromaBaseUrl}/api/v2/tenants/${encodeURIComponent(
		tenantName
	)}/databases/${encodeURIComponent(databaseName)}/collections/${encodeURIComponent(collectionId)}`;
	const response = await fetch(url, {
		method: 'DELETE'
	});

	if (response.status !== 200) {
		const text = await response.text();

		throw new Error(`Unexpected response ${response.status}: ${text}`);
	}

	return new Response(null, { status: 204 });
};
