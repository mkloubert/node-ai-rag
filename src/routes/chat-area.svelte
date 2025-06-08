<script lang="ts">
	import type { AIMessageItem, VectorCollection } from '$lib/types';
	import { Input, Button, Spinner } from 'flowbite-svelte';
	import { PlaySolid } from 'flowbite-svelte-icons';
	import MarkdownIt from 'markdown-it';

	const questionPrefix = '### QUESTION: ';

	export let chatModel: string;
	export let collections: VectorCollection[];
	export let maxTokens: number;
	export let numberOfVectorDocs: number;
	export let temperature: number;

	let conversation: AIMessageItem[] = [];
	let question = '';
	let isSubmittingQuestion = false;

	function getAIItemHtml(item: AIMessageItem): string {
		if (item.role !== 'system') {
			try {
				if (item.role === 'user') {
					const lines = item.content.split('\n');
					const lineWithQuestionPrefix = lines.find((line) =>
						line.trim().startsWith(questionPrefix)
					);
					if (lineWithQuestionPrefix) {
						const index = lineWithQuestionPrefix.indexOf(questionPrefix);
						const jsonStr = lineWithQuestionPrefix.substring(index + questionPrefix.length).trim();
						const markdown = JSON.parse(jsonStr);

						return getStringAsMarkdown(markdown);
					}
				} else {
					return getStringAsMarkdown(item.content);
				}
			} catch {
				// ignore
			}

			return item.content;
		}

		return '';
	}

	function getQuestionHtml(): string {
		return getAIItemHtml({
			content: question,
			role: 'user'
		});
	}

	function getStringAsMarkdown(str: any): string {
		const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
		return md.render(String(str ?? ''));
	}

	function handleKeyDown(e: any) {
		if (e.key === "Enter") {
			submitQuestion();
		}
	}

	async function submitQuestion() {
		if (!question.trim()) {
			return;
		}

		isSubmittingQuestion = true;

		try {
			const response = await fetch('/api/chats/ask', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					conversation: [...conversation],
					collections: collections.map((c) => c.id),
					maxTokens,
					model: chatModel,
					numberOfVectorDocs,
					query: question.trim(),
					temperature
				})
			});

			if (response.status !== 200) {
				const text = await response.text();

				throw new Error(`Unexpected response ${response.status}: ${text}`);
			}

			const r = await response.json();

			conversation = [...r.conversation];
			question = '';

			(document.getElementsByClassName('tfg-message-input')[0] as HTMLInputElement)?.focus();
		} finally {
			isSubmittingQuestion = false;
		}
	}
</script>

<div class="dark flex w-full flex-col border-r border-gray-700 md:w-3/4">
	<div class="flex-1 space-y-2 overflow-y-auto p-4">
		{#each conversation as item}
			<div class="flex {item.role === 'user' ? 'justify-end' : 'justify-start'}">
				<div
					class="prose prose-neutral dark:prose-invert max-w-xs rounded-lg p-3 text-sm md:max-w-md"
					class:bg-gray-700={item.role === 'user'}
					class:bg-green-700={item.role === 'assistant'}
				>
					{@html getAIItemHtml(item)}
				</div>
			</div>
		{/each}

		{#if isSubmittingQuestion}
			<div class="flex justify-end">
				<div
					class="prose prose-neutral dark:prose-invert max-w-xs rounded-lg bg-gray-700 p-3 text-sm md:max-w-md"
				>
					{@html getQuestionHtml()}
				</div>
			</div>

			<div class="flex justify-start">
				<div
					class="prose prose-neutral dark:prose-invert max-w-xs rounded-lg bg-green-700 p-3 text-sm md:max-w-md"
				>
					<Spinner size="4" />
					<span class="px-2">Thinking ...</span>
				</div>
			</div>
		{/if}
	</div>

	<div class="border-t border-gray-700 p-4">
		<div class="flex gap-2">
			<Input
				bind:value={question}
				class="tfg-message-input flex-1"
				type="text"
				placeholder="Send message ..."
				required
				autofocus
				disabled={isSubmittingQuestion}
				onKeydown={handleKeyDown}
			/>
			<Button
				disabled={isSubmittingQuestion || !question || !chatModel || collections.length === 0}
				color="primary"
				onclick={submitQuestion}
				class="cursor-pointer"
				type="button"><PlaySolid /></Button
			>
		</div>
	</div>
</div>
