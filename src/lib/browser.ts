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
 * Loads a file as a string.
 *
 * @param {Blob} blob The file/blob to load.
 *
 * @returns {Promise<string>} A promise that resolves with the URI of the file.
 */
export function loadFileAsString(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onerror = (err) => reject(err);
		reader.onload = function (e) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			resolve((e.target as any).result);
		};

		reader.readAsText(blob);
	});
}

/**
 * Loads a file as a URI.
 *
 * @param {Blob} blob The file/blob to load.
 *
 * @returns {Promise<string>} A promise that resolves with the URI of the file.
 */
export function loadFileAsURI(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onerror = (err) => reject(err);
		reader.onload = function (e) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			resolve((e.target as any).result);
		};

		reader.readAsDataURL(blob);
	});
}
