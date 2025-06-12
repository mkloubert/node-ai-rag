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
	import dayjs from 'dayjs';
	import dayjs_timezone from 'dayjs/plugin/timezone';
	import dayjs_utc from 'dayjs/plugin/utc';
	dayjs.extend(dayjs_timezone);
	dayjs.extend(dayjs_utc);

	import { conversationSchema, type AIMessageItem, type VectorCollection } from '$lib/types';
	import { Input, Button, Skeleton, Hr, Toast } from 'flowbite-svelte';
	import {
		CheckCircleSolid,
		ClipboardSolid,
		ExclamationCircleSolid,
		PlaySolid,
		ReplyAllSolid,
		TrashBinSolid
	} from 'flowbite-svelte-icons';
	import MarkdownIt from 'markdown-it';
	import { onDestroy, onMount } from 'svelte';
	import { loadFileAsString } from '$lib/browser';
	import { slide } from 'svelte/transition';
	import { questionPrefix } from '$lib/constants';

	const conversationStorageKey = 'tgf-conversation';

	export let chatModel: string;
	export let collections: VectorCollection[];
	export let maxTokens: number;
	export let numberOfVectorDocs: number;
	export let onIsSubmittingQuestionChange: (valu: boolean) => void;
	export let temperature: number;

	let copyToClipboardToastRef: any;
	let contextMenuPosition = { x: 0, y: 0 };
	let conversation: AIMessageItem[] = [];
	let copyToClipboardToastStatus = false;
	let isContextMenuVisible = false;
	let isSubmittingQuestion = false;
	let lastCopyToClipboardError = '';
	let question = '';

	function closeContextMenu() {
		isContextMenuVisible = false;
	}

	async function copyItemToClipboard(item: AIMessageItem) {
		copyToClipboardToastStatus = false;

		try {
			const content = getAIItemContent(item);

			await navigator.clipboard.writeText(content);
		} catch (error) {
			lastCopyToClipboardError = String(error);
		} finally {
			copyToClipboardToastStatus = true;
		}
	}

	function focusMessageInput() {
		document
			.querySelectorAll<HTMLInputElement>('input.tgf-message-input-6caf3f70274d')
			.forEach((inputEl) => {
				inputEl.focus();
			});
	}

	function getAIItemContent(item: AIMessageItem): string {
		try {
			if (item.role === 'user') {
				const lines = item.content.split('\n');
				const lineWithQuestionPrefix = lines.find((line) => line.trim().startsWith(questionPrefix));
				if (lineWithQuestionPrefix) {
					const index = lineWithQuestionPrefix.indexOf(questionPrefix);
					const jsonStr = lineWithQuestionPrefix.substring(index + questionPrefix.length).trim();
					const markdown = JSON.parse(jsonStr);

					return markdown;
				}
			}
		} catch (error) {
			console.warn('getAIItemContent():', error);
		}

		return item.content;
	}

	function getAIItemHtml(item: AIMessageItem): string {
		return getStringAsMarkdown(getAIItemContent(item));
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

	function handleClearClick(e: any) {
		e.preventDefault();

		updateConversationInStorage((conversation = []));

		closeContextMenu();

		focusMessageInput();
	}

	function handleExportClick(e: any) {
		const now = dayjs.utc();

		const jsonStr = JSON.stringify(conversation);

		const blob = new Blob([jsonStr], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		const link = document.createElement('a');
		link.className = 'hidden';
		link.href = url;
		link.download = `${now.format('YYYYMMDD')}${now.format('HHmmss')}_ai-conversation.json`;
		link.click();
		setTimeout(() => {
			link.remove();
		}, 1500);
	}

	async function handleImportClick(e: any) {
		try {
			document
				.querySelectorAll<HTMLInputElement>('.tgf-import-file-input-df46ce1f')
				.forEach((el: any) => {
					el.value = '';

					el.click();
				});
		} catch (error) {}
	}

	async function handleImportFileChange(e: any) {
		const files: FileList = e.target.files;
		if (!files?.length) {
			return;
		}

		try {
			for (let i = 0; i < files.length; i++) {
				const file = files.item(i)!;
				const jsonStr = await loadFileAsString(file);

				const conversationToAppend = await conversationSchema.parseAsync(
					JSON.parse(jsonStr.trim())
				);
				updateConversationInStorage((conversation = [...conversation, ...conversationToAppend]));
			}
		} catch {}
	}

	function handleKeyDown(e: any) {
		if (e.key === 'Enter') {
			submitQuestion();
		}
	}

	function openContextMenu(e: MouseEvent) {
		e.preventDefault();

		isContextMenuVisible = true;

		contextMenuPosition = {
			x: e.pageX,
			y: e.pageY
		};
	}

	function reloadConversationFromStorage() {
		try {
			const jsonStr = localStorage.getItem(conversationStorageKey)?.trim();
			if (jsonStr) {
				const mayBeArray = JSON.parse(jsonStr);
				if (Array.isArray(mayBeArray)) {
					conversation = mayBeArray;
				}
			}
		} catch (error) {
			console.warn('reloadConversationFromStorage():', error);
		}
	}

	function removeConversationItem(item: AIMessageItem) {
		updateConversationInStorage((conversation = conversation.filter((ci) => ci !== item)));
	}

	function resendUserMessage(item: AIMessageItem) {
		removeConversationItem(item);

		question = getAIItemContent(item);
		submitQuestion();
	}

	function scrollToConversationBottom() {
		// TODO: implement
	}

	async function submitQuestion() {
		if (isSubmittingQuestion) {
			return;
		}

		question = question.trim();
		if (!question) {
			return;
		}

		if (collections.length === 0) {
			return;
		}

		updateIsSubmittingQuestion(true);

		try {
			scrollToConversationBottom();

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

			updateConversationInStorage((conversation = [...r.conversation]));
			question = '';

			focusMessageInput();
		} finally {
			updateIsSubmittingQuestion(false);

			scrollToConversationBottom();
		}
	}

	function updateConversationInStorage(newData: AIMessageItem[]) {
		localStorage.setItem(conversationStorageKey, JSON.stringify(newData));
	}

	function updateIsSubmittingQuestion(value: boolean) {
		onIsSubmittingQuestionChange((isSubmittingQuestion = value));
	}

	onMount(() => {
		if (typeof window === 'undefined') {
			return;
		}

		window.addEventListener('click', closeContextMenu);

		reloadConversationFromStorage();
		onIsSubmittingQuestionChange(isSubmittingQuestion);
	});

	onDestroy(() => {
		if (typeof window === 'undefined') {
			return;
		}

		window.removeEventListener('click', closeContextMenu);
	});
</script>

<div class="dark tgf-chat-area flex w-full flex-col border-r border-gray-700 md:w-3/4">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div oncontextmenu={openContextMenu} class="flex-1 space-y-2 overflow-y-auto p-4">
		{#each conversation as item, itemIndex}
			{#if item.role !== 'system'}
				<div class={`mb-4 flex w-full ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
					<div
						class="prose prose-neutral dark:prose-invert rounded-lg p-3 text-sm"
						class:bg-gray-700={item.role === 'user'}
						class:bg-green-700={item.role === 'assistant'}
						style="min-width: 25%; max-width: 75%;"
					>
						{@html getAIItemHtml(item)}

						{#if !isSubmittingQuestion}
							<div class="flex w-full justify-end pt-4 text-xs">
								<Button
									size="xs"
									class="cursor-pointer p-1.5!"
									color="blue"
									onclick={() => copyItemToClipboard(item)}
									><ClipboardSolid class="h-4 w-4" /></Button
								>

								{#if itemIndex === conversation.length - 1}
									{#if item.role === 'user'}
										<Button
											size="xs"
											class="ml-1 cursor-pointer p-1.5!"
											color="teal"
											onclick={() => resendUserMessage(item)}
											><ReplyAllSolid class="h-4 w-4" /></Button
										>
									{/if}

									<Button
										size="xs"
										class="ml-1 cursor-pointer p-1.5!"
										color="red"
										onclick={() => removeConversationItem(item)}
										><TrashBinSolid class="h-4 w-4" /></Button
									>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{/each}

		{#if isSubmittingQuestion}
			<div class="flex justify-end">
				<div
					class="prose prose-neutral dark:prose-invert max-w-xs rounded-lg bg-gray-700 p-3 text-sm md:max-w-md"
				>
					{@html getQuestionHtml()}
				</div>
			</div>

			<Skeleton size="2xl" class="mt-8 mb-2.5" />
		{/if}
	</div>

	<div class="border-t border-gray-700 p-4">
		<div class="flex gap-2">
			<Input
				bind:value={question}
				class="tgf-message-input-6caf3f70274d flex-1"
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
				onclick={() => submitQuestion()}
				class="cursor-pointer"
				type="button"><PlaySolid /></Button
			>
		</div>
	</div>

	<div class="tgf-toast-area flex gap-10">
		<Toast
			color={lastCopyToClipboardError ? 'red' : 'green'}
			dismissable={true}
			position="top-left"
			transition={slide}
			bind:toastStatus={copyToClipboardToastStatus}
			bind:this={copyToClipboardToastRef}
		>
			{#snippet icon()}
				{#if lastCopyToClipboardError}
					<ExclamationCircleSolid class="h-5 w-5" />
				{:else}
					<CheckCircleSolid class="h-5 w-5" />
				{/if}
			{/snippet}
			{#if lastCopyToClipboardError}
				Could not copy Markdown to clipboard: {lastCopyToClipboardError}
			{:else}
				Markdown has been copied to clipboard.
			{/if}
		</Toast>
	</div>
</div>

{#if isContextMenuVisible && !!contextMenuPosition}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<ul
		class="absolute z-50 w-72 rounded-lg border bg-white shadow-md"
		style="top: {contextMenuPosition.y}px; left: {contextMenuPosition.x}px;"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<li class="flex cursor-pointer text-black" onclick={handleExportClick}>
			<div class="m-1 mr-2 flex-1 py-2 pl-2 hover:bg-black hover:text-white">Export</div>
		</li>

		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<li class="flex cursor-pointer text-black" onclick={handleImportClick}>
			<div class="m-1 mr-2 flex-1 py-2 pl-2 hover:bg-black hover:text-white">Import</div>
		</li>

		<Hr class="my-4" />

		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<li class="flex cursor-pointer text-black" onclick={handleClearClick}>
			<div class="m-1 mr-2 flex-1 py-2 pl-2 hover:bg-black hover:text-white">Clear</div>
		</li>
	</ul>
{/if}

<input
	class="tgf-import-file-input-df46ce1f hidden"
	onchange={handleImportFileChange}
	type="file"
	accept=".json"
/>
