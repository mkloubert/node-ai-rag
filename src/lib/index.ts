/* eslint-disable @typescript-eslint/no-explicit-any */

// place files you want to import through the `$lib` alias in this folder.

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

import { compileExpression } from 'filtrex';

/**
 * Filters a sequence of modules with regex filter.
 *
 * @param {Iterable<string>} modelNames The list of model (names).
 * @param {string|null|undefined} regexExpr The expression.
 *
 * @returns {string[]} The filtered list as array.
 */
export function filterModels(
	modelNames: Iterable<string>,
	regexExpr: string | null | undefined
): string[] {
	let filter: (modelName: string) => boolean;
	if (regexExpr?.trim()) {
		const str = (val: unknown) => String(val ?? '');
		const log = (...args: unknown[]): boolean => {
			console.log(...args);
			return true;
		};
		const regex = (val: unknown, expr: unknown, flags: unknown = 'gmi') =>
			new RegExp(str(expr), str(flags) || undefined).test(str(val));
		const endsWith = (val: unknown, suffix: unknown) => str(val).endsWith(str(suffix));
		const startsWith = (val: unknown, prefix: unknown) => str(val).startsWith(str(prefix));

		const f = compileExpression(regexExpr, {
			extraFunctions: {
				endsWith,
				log,
				regex,
				startsWith,
				str
			}
		});

		filter = (modelName) =>
			!!f({
				model: modelName
			});
	} else {
		filter = () => true;
	}

	return [...new Set(modelNames)]
		.map((modelName) => {
			return modelName.trim();
		})
		.filter(filter);
}

/**
 * Flattens an object.
 *
 * @param {any} obj The input object.
 * @param {string} [prefix=''] The current prefix.
 * @param {any} [result={}] The result.
 *
 * @returns {Record<string, any>} The new, flatten object.
 */
export function flattenObj(obj: any, prefix = '', result: any = {}): Record<string, any> {
	for (const key in obj) {
		const value = obj[key];
		const prefixedKey = prefix ? `${prefix}.${key}` : key;

		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			flattenObj(value, prefixedKey, result);
		} else {
			result[prefixedKey] = value;
		}
	}

	return result;
}
