<!--
	MIT License

	Copyright (c) 2025 Marcel Joachim Kloubert (https://marcel.coffee)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
-->

<script lang="ts">
	import type { VectorCollection } from '$lib/types';

	import ChatArea from './chat-area.svelte';
	import SettingsArea from './settings-area.svelte';

	let chatModel = '';
	let collections: VectorCollection[] = [];
	let isSubmittingQuestion = false;
	let maxTokens = 10000;
	let numberOfVectorDocs = 1000;
	let temperature = 0.3;
</script>

<div class="flex h-screen flex-col bg-gray-900 text-gray-100 md:flex-row">
	<!-- Chat Section -->
	<ChatArea
		{chatModel}
		{collections}
		{maxTokens}
		{numberOfVectorDocs}
		{temperature}
		onIsSubmittingQuestionChange={(value) => (isSubmittingQuestion = value)}
	/>

	<!-- Settings Section -->
	<SettingsArea
		{isSubmittingQuestion}
		onChatModelChange={(value) => (chatModel = value)}
		onCollectionsChange={(items) => (collections = [...items])}
		onMaxTokensChange={(value) => (maxTokens = value)}
		onNumberOfVectorDocsChange={(value) => (numberOfVectorDocs = value)}
		onTemperatureChange={(value) => (temperature = value)}
	/>
</div>
