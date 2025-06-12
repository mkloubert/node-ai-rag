/* eslint-disable @typescript-eslint/no-explicit-any */

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

import { aiMessageItemSchema, type AIMessageItem } from '$lib/types';
import type { RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import type { AiClientBase, AiQueryItem } from '$lib/types/classes/ai-client-base';
import { OllamaAIClient } from '$lib/types/classes/ollama-ai-client';
import { OpenAIClient } from '$lib/types/classes/openai-ai-client';
import { OllamaEmbeddings } from '$lib/types/classes/ollama-embeddings';
import type { DocumentInterface } from '@langchain/core/documents';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { chromaBaseUrl, databaseName, tenantName } from '../../collections/constants';
import { createLogger } from '$lib/types/classes/logger';
import { questionPrefix } from '$lib/constants';

const askAISchema = z.object({
	collections: z.array(z.string().trim().min(1)).min(1),
	conversation: z.array(aiMessageItemSchema).min(0),
	maxTokens: z.number().int().min(1).max(128000).nullish(),
	model: z.string().trim().min(1),
	numberOfVectorDocs: z.number().int().min(1).nullish(),
	query: z.string().min(1),
	temperature: z.number().min(0).max(1).nullish()
});

export const POST: RequestHandler = async ({ request }) => {
	const l = createLogger('POST.ask-ai');

	const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
	const OLLAMA_BASE_URL =
		process.env.TGF_OLLAMA_BASE_URL?.trim() || 'http://host.docker.internal:11434';
	const OLLAMA_EMBEDDING_MODEL =
		process.env.TGF_OLLAMA_EMBEDDING_MODEL?.trim() || 'nomic-embed-text';

	const body = await askAISchema.parseAsync(await request.json());

	const maxTokens = body.maxTokens ?? 10000;
	const modelName = body.model.substring(body.model.indexOf(':') + 1).trim();
	const numberOfVectorDocs = body.numberOfVectorDocs ?? 10;
	const provider = body.model.split(':')[0].toLowerCase().trim();
	const temperature = body.temperature ?? 0.3;

	l('Max tokens:', maxTokens);
	l('Number of vector docs:', numberOfVectorDocs);
	l('Provider:', provider);
	l('Temperature:', temperature);

	let client: AiClientBase;
	if (provider === 'ollama') {
		client = new OllamaAIClient(modelName);
	} else if (provider === 'openai') {
		if (!OPENAI_API_KEY) {
			throw new Error(`No OPENAI_API_KEY defined`);
		}

		client = new OpenAIClient(OPENAI_API_KEY, modelName);
	} else {
		throw new Error(`AI provider '${provider}' not supported`);
	}

	l('Provider / model:', client.provider, '/', client.model);

	const conversation: AiQueryItem[] = body.conversation.map((item) => {
		return {
			...item
		};
	});

	const embeddings = new OllamaEmbeddings(OLLAMA_EMBEDDING_MODEL, OLLAMA_BASE_URL);

	const hasSystemMessage = conversation.some((item) => item.role === 'system');
	if (!hasSystemMessage) {
		l('Setting up system message ...');

		const systemContent = `Use the following context to answer the question (both are submitted as serialied JSON strings).
Use same language for each answer.`;

		conversation.unshift({
			role: 'system',
			content: systemContent
		});
	}

	l(`Embedding query '${body.query}' ...`);
	const queryEmbedding = await embeddings.embedQuery(body.query);

	const allDocuments: DocumentInterface<Record<string, any>>[] = [];

	for (const collectionName of body.collections) {
		l(`Querying collection '${collectionName}' ...`);

		const queryData = {
			query_embeddings: [[...queryEmbedding]],
			n_results: numberOfVectorDocs
		};

		const url = `${chromaBaseUrl}/api/v2/tenants/${encodeURIComponent(
			tenantName
		)}/databases/${encodeURIComponent(databaseName)}/collections/${encodeURIComponent(
			collectionName
		)}/query`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: Buffer.from(JSON.stringify(queryData), 'utf-8')
		});

		if (response.status !== 200) {
			const text = await response.text();

			throw new Error(`Unexpected response ${response.status}: ${text}`);
		}

		const r = await response.json();

		const relevantDocsInThisCollection: DocumentInterface<Record<string, any>>[] = [];

		const ids: string[] = r.ids;
		for (let i = 0; i < ids.length; i++) {
			const id: string = r.ids[i];
			const metadata: any = r.metadatas[i];
			const documents: string[] = r.documents[i];

			relevantDocsInThisCollection.push({
				id,
				metadata,
				pageContent: documents.join('\n\n')
			});
		}

		l('Found', ids.length, `relevant documents in collection ${collectionName}:`, ids.join());

		allDocuments.push(...relevantDocsInThisCollection);
	}

	const memoryStore = await MemoryVectorStore.fromDocuments(allDocuments, embeddings);

	const relevantDocs = await memoryStore.similaritySearch(body.query, numberOfVectorDocs);

	l(
		'Found',
		relevantDocs.length,
		'relevant documents for all collections:',
		relevantDocs.map((rd) => rd.id).join()
	);

	const context = relevantDocs
		.map((doc) => doc.pageContent)
		.join('\n\n')
		.trim();

	const userContent = `### CONTEXT: ${JSON.stringify(context)}

${questionPrefix}${JSON.stringify(body.query)}

Answer:`;

	l('Build user message with AI content of length', userContent.length);

	conversation.push({
		role: 'user',
		content: userContent
	});

	l('Sending AI conversation:');
	conversation.forEach(({ role, content }, index) => {
		l(`AI conversation #${index + 1}: role=${role}, content.length=${content.length}`);
	});

	const chatResult = await client.query(conversation, {
		maxTokens,
		temperature
	});

	const aiContent = chatResult.content;
	l('Got answer from', modelName, 'with a length of', aiContent.length);

	return Response.json(
		{
			conversation: [
				...conversation,
				{
					content: aiContent,
					role: 'assistant'
				}
			] satisfies AIMessageItem[]
		},
		{ status: 200 }
	);
};
