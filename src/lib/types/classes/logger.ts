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

/**
 * A logger which itself ist a `LoggerAction`.
 */
export interface Logger extends LoggerAction {
	/**
	 * Writes an error.
	 */
	err: LoggerAction;
	/**
	 * Writes an info.
	 */
	info: LoggerAction;
	/**
	 * Writes a warning.
	 */
	warn: LoggerAction;
}

/**
 * A logger action.
 *
 * @param {any[]} [args=[]] The arguments for the action.
 */
export type LoggerAction = (...args: any[]) => void;

/**
 * Creates a new instance of a `Logger` for a specific `tag`.
 *
 * @param {string} tag The tag.
 *
 * @returns {Logger} The new instance.
 */
export function createLogger(tag: string): Logger {
	const doLog = (method: keyof Logger | '', ...args: any[]) => {
		const now = new Date();

		try {
			let consoleLogger = console.log;
			let icon = '🐛';

			if (method === 'err') {
				consoleLogger = console.error;
				icon = '❗';
			} else if (method === 'warn') {
				consoleLogger = console.warn;
				icon = '⚠️';
			} else if (method === 'info') {
				consoleLogger = console.info;
				icon = 'ℹ️';
			}

			consoleLogger(`[${now.toISOString()}]`, `[${tag}]`, icon, ...args);
		} catch {
			// ignore errors
		}
	};

	const l = ((...args: any[]) => {
		doLog('', ...args);
	}) satisfies LoggerAction as unknown as Logger;

	l.err = (args) => doLog('err', ...args);
	l.info = (args) => doLog('info', ...args);
	l.warn = (args) => doLog('warn', ...args);

	return l;
}
