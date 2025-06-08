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

import { collectionDocumentItemSchema } from '$lib/types';
import type { RequestHandler } from '@sveltejs/kit';
import { fileTypeFromBuffer } from 'file-type';
import { Document } from 'langchain/document';
import { Readable } from 'node:stream';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OllamaEmbeddings } from '$lib/types/classes/ollama-embeddings';
import { chromaBaseUrl, databaseName, tenantName } from '../../constants';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const indexFilesSchema = z.object({
	chunkOverlap: z.number().int().min(0),
	chunkSize: z.number().int().min(1),
	collectionName: z.string().min(1),
	uploads: z.array(collectionDocumentItemSchema).min(1)
});

export const POST: RequestHandler = async ({ request }) => {
	const body = await indexFilesSchema.parseAsync(await request.json());

	const l = (...args: any[]) => {
		console.log('[/api/collections/[collection_id]/files', ...args);
	};

	const OLLAMA_BASE_URL =
		process.env.TGF_OLLAMA_BASE_URL?.trim() || 'http://host.docker.internal:11434';
	const OLLAMA_EMBEDDING_MODEL =
		process.env.TGF_OLLAMA_EMBEDDING_MODEL?.trim() || 'nomic-embed-text';

	const { chunkOverlap, chunkSize, collectionName, uploads: items } = body;

	for (const item of items) {
		l('Handling uploaded file', item.name, '...');

		const allDocuments: Document[] = [];

		const metadata: Record<string, unknown> = {
			source: item.name
		};

		const data = Buffer.from(item.data, 'base64');

		const mime = String((await fileTypeFromBuffer(data))?.mime ?? '')
			.toLowerCase()
			.trim();
		if (mime.includes('image/')) {
			l('... as image ...');

			const Tesseract = (await import('tesseract.js')).default;

			// TODO: support more languages
			const result = await Tesseract.recognize(data, 'eng', {
				// logger: (m) => console.log(m),
			});

			allDocuments.push(
				new Document({
					pageContent: String(result.data.text ?? '').trim(),
					metadata: {
						...metadata
					}
				})
			);
		} else if (mime.includes('/pdf')) {
			l('... as PDF ...');

			const { PDFLoader } = await import('@langchain/community/document_loaders/fs/pdf');

			const blob = new Blob([data]);
			const loader = new PDFLoader(blob);

			const docs = await loader.load();

			allDocuments.push(...docs);
		} else if (mime.includes('powerpoint') || mime.includes('presentation')) {
			l('... as PowerPoint ...');

			const officeParser = (await import('officeparser')).default;

			const pageContent = (await officeParser.parseOfficeAsync(data)).trim();

			allDocuments.push(
				new Document({
					pageContent,
					metadata: {
						...metadata
					}
				})
			);
		} else if (mime.includes('excel') || mime.includes('sheet')) {
			l('... as Excel/CSV ...');

			const ExcelJS = (await import('exceljs')).default;

			const stream = Readable.from(data);

			const workbook = new ExcelJS.Workbook();
			await workbook.xlsx.read(stream);

			// sheets ...
			for (const sheet of workbook.worksheets) {
				const sheetName = String(sheet.name);
				const rowTexts: string[] = [];

				// rows ...
				for (let i = 1; i <= sheet.rowCount; i++) {
					const cellTexts: string[] = [];

					const row = sheet.getRow(i);

					// cells ...
					for (let j = 1; j <= row.cellCount; j++) {
						const cell = row.getCell(j);

						cellTexts.push(String(cell.value ?? ''));
					}

					rowTexts.push(cellTexts.join('\t').trim());
				}

				allDocuments.push(
					new Document({
						pageContent: rowTexts.join('\n').trim(),
						metadata: {
							...metadata,

							sheet: sheetName
						}
					})
				);
			}
		} else {
			l('... as plain text ...');

			allDocuments.push({
				metadata: {
					...metadata
				},
				pageContent: data.toString('utf-8')
			});
		}

		const allTexts = allDocuments.map((doc) => doc.pageContent);
		if (allTexts.length === 0) {
			continue;
		}

		const allMetadatas = allDocuments.map((doc) => doc.metadata ?? null);

		const splitter = new RecursiveCharacterTextSplitter({
			chunkSize,
			chunkOverlap
		});

		const embeddings = new OllamaEmbeddings(OLLAMA_EMBEDDING_MODEL, OLLAMA_BASE_URL);
		const chunks = await splitter.createDocuments([...allTexts], [...allMetadatas]);

		l('Created', chunks.length, 'chunks');

		const upsertData = {
			ids: [] as string[],
			documents: chunks.map((c) => c.pageContent),
			embeddings: await embeddings.embedDocuments(chunks.map((c) => c.pageContent)),
			metadatas: [] as unknown[]
		};

		for (const { metadata } of chunks) {
			upsertData.ids.push(randomUUID());

			if (metadata) {
				let locFrom: any;
				let locTo: any;
				if (metadata?.loc) {
					if (metadata.loc.lines?.from !== undefined) {
						locFrom = metadata.loc.lines.from;
					}
					if (metadata.loc.lines?.to !== undefined) {
						locTo = metadata.loc.lines.to;
					}
				}

				const newMetadata: any = {
					...metadata,
					...(locFrom !== undefined && { locFrom }),
					...(locTo !== undefined && { locTo })
				};

				delete newMetadata.loc;

				upsertData.metadatas.push(newMetadata);
			} else {
				upsertData.metadatas.push(null);
			}
		}

		const url = `${chromaBaseUrl}/api/v2/tenants/${encodeURIComponent(
			tenantName
		)}/databases/${encodeURIComponent(databaseName)}/collections/${encodeURIComponent(
			collectionName
		)}/upsert`;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: Buffer.from(JSON.stringify(upsertData), 'utf-8')
		});

		if (response.status !== 200) {
			const text = await response.text();

			throw new Error(`Unexpected response ${response.status}: ${text}`);
		}
	}

	return new Response(null, { status: 204 });
};
