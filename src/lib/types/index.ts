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

import { z } from 'zod';

/**
 * Schema for an item in an AI conversation.
 */
export const aiMessageItemSchema = z.object({
	content: z.string(),
	role: z.enum(['assistant', 'system', 'user'])
});

/**
 * Schema for a document (item) that should be written to
 */
export const collectionDocumentItemSchema = z.object({
	data: z.string().trim().base64(),
	name: z.string().trim().min(1)
});

/**
 * A schema for an (AI) conversaion.
 */
export const conversationSchema = z.array(aiMessageItemSchema);

/**
 * Type of `aiMessageItemSchema`.
 */
export type AIMessageItem = z.infer<typeof aiMessageItemSchema>;

/**
 * Type of `collectionDocumentItemSchema`.
 */
export type CollectionDocumentItem = z.infer<typeof collectionDocumentItemSchema>;

/**
 * Type of `conversationSchema`.
 */
export type Conversation = z.infer<typeof conversationSchema>;

/**
 * A vector collection.
 */
export interface VectorCollection {
	/**
	 * The ID.
	 */
	id: string;
	/**
	 * The name.
	 */
	name: string;
}
