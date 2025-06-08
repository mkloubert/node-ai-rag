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
	import {
		Alert,
		Input,
		Label,
		Select,
		type SelectOptionType,
		Tabs,
		TabItem,
		Button,
		Spinner,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		Modal
	} from 'flowbite-svelte';
	import _ from 'lodash';
	import { onMount } from 'svelte';
	import { validate } from 'uuid';
	import { filesize } from 'filesize';
	import {
		CheckCircleOutline,
		EditSolid,
		FolderPlusSolid,
		TrashBinSolid,
		UploadSolid
	} from 'flowbite-svelte-icons';
	import type { ChangeEventHandler, DragEventHandler } from 'svelte/elements';
	import type { CollectionDocumentItem, VectorCollection } from '$lib/types';
	import { loadFileAsURI } from '$lib/browser';

	const chunkSizeStorageKey = 'tgf-chunk-size';
	const chunkOverlapStorageKey = 'tgf-chunk-overlap';
	const dataURIBase64Part = ';base64,';
	const maxTokensStorageKey = 'tgf-max-tokens';
	const numberOfVectorDocumentsStorageKey = 'tgf-number-of-vector-documents';
	const selectedCollectionsStorageKey = 'tgf-selected-vector-collection-ids';
	const selectedChatModelStorageKey = 'tgf-selected-chat-model';
	const temperatureStorageKey = 'tgf-temperature';

	export let onChatModelChange: (chatModel: string) => void;
	export let onCollectionsChange: (collections: VectorCollection[]) => void;
	export let onMaxTokensChange: (maxTokens: number) => void;
	export let onNumberOfVectorDocsChange: (numberOfVectorDocs: number) => void;
	export let onTemperatureChange: (temperature: number) => void;

	let chatModels: SelectOptionType<string>[] = [];
	let chunkOverlap = 200;
	let chunkSize = 1000;
	let collectionFilesToUpload: File[] = [];
	let collections: VectorCollection[] = [];
	let collectionToDelete: VectorCollection | null = null;
	let collectionToEdit: VectorCollection | null = null;
	let isAddingCollection = false;
	let isDeletingCollection = false;
	let isDraggingCollectionFiles = false;
	let isLoadingChatModels = false;
	let isLoadingCollections = false;
	let isUploadingCollectionDocuments = false;
	let lastAddCollectionError = '';
	let lastLoadingCollectionsError = '';
	let maxTokens = 10000;
	let newCollectionName = '';
	let numberOfVectorDocs = 10;
	let selectedChatModel = '';
	let selectedCollectionIds: string[] = [];
	let selectedTab: 'data' | 'settings' = 'data';
	let temperature = 0.3;

	async function addCollection() {
		if (newCollectionName.trim() === '') {
			return;
		}

		isAddingCollection = true;
		lastAddCollectionError = '';

		try {
			const response = await fetch('/api/collections', {
				method: 'POST',
				headers: {
					'content-type': 'application/json; charset=UTF-8'
				},
				body: JSON.stringify({
					collectionName: newCollectionName.trim()
				})
			});

			if (response.status !== 201) {
				const text = await response.text();

				throw new Error(`Unexpected response ${response.status}: ${text}`);
			}

			reloadCollections();
			newCollectionName = '';
		} catch (error) {
			lastAddCollectionError = `${error}`;
		} finally {
			isAddingCollection = false;
		}
	}

	function closeDeleteCollectionDialog() {
		collectionToDelete = null;
	}

	function closeEditCollectionDialog() {
		collectionToEdit = null;
	}

	async function deleteCollection() {
		const collectionId = collectionToDelete?.name;
		if (!collectionId) {
			return;
		}

		isDeletingCollection = true;

		try {
			const response = await fetch(`/api/collections/${encodeURIComponent(collectionId)}`, {
				method: 'DELETE'
			});

			if (response.status !== 204) {
				const text = await response.text();

				throw new Error(`Unexpected response ${response.status}: ${text}`);
			}

			closeDeleteCollectionDialog();
			reloadCollections();
		} finally {
			isDeletingCollection = false;
		}
	}

	function getChatProviderIconByModel(modelName: string): string {
		if (modelName.startsWith('ollama')) {
			return '🦙 ';
		} else if (modelName.startsWith('openai')) {
			return '🤖 ';
		}

		return '';
	}

	const handleDrop: DragEventHandler<HTMLDivElement> = (e) => {
		e.preventDefault();
		isDraggingCollectionFiles = false;

		updateCollectionFilesToUpload(e.dataTransfer?.files);
	};

	const handleDragOver: DragEventHandler<HTMLDivElement> = (e) => {
		e.preventDefault();

		isDraggingCollectionFiles = true;
	};

	const handleDragLeave: DragEventHandler<HTMLDivElement> = (e) => {
		isDraggingCollectionFiles = false;
	};

	const handleFileSelect: ChangeEventHandler<HTMLInputElement> = (e) => {
		updateCollectionFilesToUpload((e.target as any)?.files);
	};

	async function reloadChatModels() {
		isLoadingChatModels = true;

		try {
			const loadedModels = new Set<string>(['openai:gpt-4o-mini']);

			// Ollama models from backend API
			(await reloadOllamaChatModels())
				.map((modelName) => {
					return `ollama:${modelName}`;
				})
				.forEach((fullModelName) => {
					loadedModels.add(fullModelName);
				});

			// OpenAI chat models from backend API
			(await reloadOpenAIChatModels())
				.map((modelName) => {
					return `openai:${modelName}`;
				})
				.forEach((fullModelName) => {
					loadedModels.add(fullModelName);
				});

			chatModels = _([...loadedModels])
				.filter((modelName: string) => {
					return modelName.trim() !== '';
				})
				.sortBy(
					(modelName: string) => {
						return modelName.startsWith('openai:gpt-4o-mini') ? 0 : 1;
					},
					(modelName: string) => {
						return modelName.startsWith('openai:gpt-4o') ? 0 : 1;
					},
					(modelName: string) => {
						return modelName.startsWith('openai:gpt-4') ? 0 : 1;
					},
					(modelName: string) => {
						return modelName.startsWith('openai:gpt-3') ? 0 : 1;
					},
					(modelName: string) => {
						return modelName.startsWith('ollama:llama4') ? 0 : 1;
					},
					(modelName: string) => {
						return modelName.startsWith('ollama:llama3') ? 0 : 1;
					},
					(modelName: string) => {
						return modelName.startsWith('ollama:llama') ? 0 : 1;
					}
				)
				.map((modelName: string) => {
					return {
						name: `${getChatProviderIconByModel(modelName)}${modelName}`.trim(),
						value: modelName
					} satisfies SelectOptionType<string>;
				})
				.value();
		} finally {
			isLoadingChatModels = false;
		}
	}

	function reloadChunkOverlapFromStorage() {
		try {
			const jsonStr = localStorage.getItem(chunkOverlapStorageKey)?.trim();
			if (jsonStr) {
				const value = parseInt(jsonStr, 10);
				if (!Number.isNaN(value) && value >= 0) {
					chunkOverlap = value;
				}
			}
		} catch (error) {
			console.warn('reloadChunkOverlapFromStorage():', error);
		}
	}

	function reloadChunkSizeFromStorage() {
		try {
			const jsonStr = localStorage.getItem(chunkSizeStorageKey)?.trim();
			if (jsonStr) {
				const value = parseInt(jsonStr, 10);
				if (!Number.isNaN(value) && value >= 1) {
					chunkSize = value;
				}
			}
		} catch (error) {
			console.warn('reloadChunkSizeFromStorage():', error);
		}
	}

	async function reloadCollections() {
		isLoadingCollections = true;
		lastLoadingCollectionsError = '';

		try {
			const response = await fetch('/api/collections', {
				method: 'GET'
			});

			if (response.status !== 200) {
				const text = await response.text();

				throw new Error(`Unexpected response ${response.status}: ${text}`);
			}

			collections = await response.json();
			reloadSelectedCollectionsFromStorage();
		} catch (error) {
			lastLoadingCollectionsError = `${error}`;
		} finally {
			isLoadingCollections = false;
		}
	}

	async function reloadOllamaChatModels() {
		const response = await fetch('/api/ollama/models/chat');

		if (response.status !== 200) {
			const text = await response.text();

			throw new Error(`Unexpected response ${response.status}: ${text}`);
		}

		const data: { models: string[] } = await response.json();

		return data.models;
	}

	async function reloadOpenAIChatModels() {
		const response = await fetch('/api/openai/models/chat');

		if (response.status !== 200) {
			const text = await response.text();

			throw new Error(`Unexpected response ${response.status}: ${text}`);
		}

		const data: { models: string[] } = await response.json();

		return data.models;
	}

	function reloadMaxTokensFromStorage() {
		try {
			const jsonStr = localStorage.getItem(maxTokensStorageKey)?.trim();
			if (jsonStr) {
				const value = parseInt(jsonStr, 10);
				if (!Number.isNaN(value) && value >= 1) {
					maxTokens = value;
				}
			}
		} catch (error) {
			console.warn('reloadMaxTokensFromStorage():', error);
		}
	}

	function reloadNumberOfVectorDocsFromStorage() {
		try {
			const jsonStr = localStorage.getItem(numberOfVectorDocumentsStorageKey)?.trim();
			if (jsonStr) {
				const value = parseInt(jsonStr, 10);
				if (!Number.isNaN(value) && value >= 1) {
					numberOfVectorDocs = value;
				}
			}
		} catch (error) {
			console.warn('reloadNumberOfVectorDocsFromStorage():', error);
		}
	}

	function reloadSelectedChatModelFromStorage() {
		try {
			const jsonStr = localStorage.getItem(selectedChatModelStorageKey)?.trim();
			if (jsonStr) {
				const loadedSelectedChatModel = JSON.parse(jsonStr);
				if (typeof loadedSelectedChatModel === 'string') {
					selectedChatModel = loadedSelectedChatModel.trim();
				} else {
					selectedChatModel = '';
				}
			}
		} catch (error) {
			console.warn('reloadSelectedChatModelFromStorage():', error);
		}
	}

	function reloadSelectedCollectionsFromStorage() {
		try {
			const jsonStr = localStorage.getItem(selectedCollectionsStorageKey)?.trim();
			if (jsonStr) {
				const loadedSelectedCollectionIds = JSON.parse(jsonStr);
				if (Array.isArray(loadedSelectedCollectionIds)) {
					selectedCollectionIds = _(loadedSelectedCollectionIds)
						.filter((item: any) => {
							return typeof item === 'string';
						})
						.map((item) => {
							return item.trim();
						})
						.filter((item) => {
							return validate(item);
						})
						.uniq()
						.value();
				}
			}
		} catch (error) {
			console.warn('reloadSelectedCollectionIds():', error);
		}
	}

	function reloadTemperatureFromStorage() {
		try {
			const jsonStr = localStorage.getItem(temperatureStorageKey)?.trim();
			if (jsonStr) {
				const value = parseFloat(jsonStr);
				if (!Number.isNaN(value) && value >= 0) {
					temperature = value;
				}
			}
		} catch (error) {
			console.warn('reloadTemperatureFromStorage():', error);
		}
	}

	function toggleSelectedCollectionId(id: string) {
		if (selectedCollectionIds.includes(id)) {
			selectedCollectionIds = selectedCollectionIds.filter((i) => i !== id);
		} else {
			selectedCollectionIds = [...selectedCollectionIds, id];
		}

		updateSelectedCollectionsInStorage();
	}

	function updateChunkOverlapInStorage(newValue: number) {
		if (typeof window === 'undefined') {
			return;
		}

		if (!Number.isNaN(newValue)) {
			localStorage.setItem(chunkOverlapStorageKey, JSON.stringify(newValue));
		}
	}

	function updateChunkSizeInStorage(newValue: number) {
		if (typeof window === 'undefined') {
			return;
		}

		if (!Number.isNaN(newValue)) {
			localStorage.setItem(chunkSizeStorageKey, JSON.stringify(newValue));
		}
	}

	async function updateCollectionFilesToUpload(files: FileList | null | undefined) {
		if (!files) {
			return;
		}

		const additionalFiles = [...files];
		if (additionalFiles.length === 0) {
			return;
		}

		const newFileList: File[] = [];

		try {
			const filesWithData = additionalFiles.map((file) => {
				return {
					file,
					data: ''
				};
			});
			for (const item of filesWithData) {
				item.data = await loadFileAsURI(item.file);
			}

			newFileList.length = 0;
			newFileList.push(...collectionFilesToUpload);
			newFileList.push(...filesWithData.map((fwd) => fwd.file));
		} catch {
			newFileList.length = 0;
			newFileList.push(...collectionFilesToUpload);
			newFileList.push(...additionalFiles);
		}

		collectionFilesToUpload = newFileList;
	}

	function updateMaxTokensInStorage(newValue: number) {
		if (typeof window === 'undefined') {
			return;
		}

		if (!Number.isNaN(newValue)) {
			localStorage.setItem(maxTokensStorageKey, JSON.stringify(newValue));
		}
	}

	function updateNumberOfVectorDocsInStorage(newValue: number) {
		if (typeof window === 'undefined') {
			return;
		}

		if (!Number.isNaN(newValue)) {
			localStorage.setItem(numberOfVectorDocumentsStorageKey, JSON.stringify(newValue));
		}
	}

	function updateSelectedChatModelInStorage() {
		if (typeof window === 'undefined') {
			return;
		}

		if (selectedChatModel) {
			localStorage.setItem(selectedChatModelStorageKey, JSON.stringify(selectedChatModel));
		} else {
			localStorage.removeItem(selectedChatModelStorageKey);
		}
	}

	function updateSelectedCollectionsInStorage() {
		if (typeof window === 'undefined') {
			return;
		}

		localStorage.setItem(selectedCollectionsStorageKey, JSON.stringify(selectedCollectionIds));
	}

	function updateTemperatureInStorage(newValue: number) {
		if (typeof window === 'undefined') {
			return;
		}

		if (!Number.isNaN(newValue)) {
			localStorage.setItem(temperatureStorageKey, JSON.stringify(newValue));
		}
	}

	async function uploadCollectionDocuments() {
		const collectionId = collectionToEdit?.id;
		if (!collectionId) {
			return;
		}
		const files = [...collectionFilesToUpload];
		if (files.length === 0) {
			return;
		}

		isUploadingCollectionDocuments = true;

		try {
			const uploadItems: CollectionDocumentItem[] = [];
			while (files.length > 0) {
				const file = files.shift()!;
				const dataURI = await loadFileAsURI(file);
				const base64Index = dataURI.indexOf(dataURIBase64Part);
				const base64Data = dataURI.substring(base64Index + dataURIBase64Part.length).trim();

				uploadItems.push({
					name: file.name || '',
					data: base64Data
				});
			}

			const response = await fetch(`/api/collections/${encodeURIComponent(collectionId)}/files`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					collectionName: collectionId,
					uploads: uploadItems,
					chunkSize,
					chunkOverlap
				})
			});
			if (response.status !== 204) {
				const text = await response.text();

				throw new Error(`Unexpected response ${response.status}: ${text}`);
			}

			collectionFilesToUpload = [];
			reloadCollections();
		} finally {
			isUploadingCollectionDocuments = false;
		}
	}

	onMount(() => {
		reloadChunkOverlapFromStorage();
		reloadChunkSizeFromStorage();
		reloadMaxTokensFromStorage();
		reloadNumberOfVectorDocsFromStorage();
		reloadTemperatureFromStorage();

		reloadChatModels().finally(() => {
			reloadSelectedChatModelFromStorage();
		});
		reloadCollections();

		const tab = document.getElementsByClassName('tgfTabs').item(0)!;
		tab.querySelectorAll<HTMLDivElement>('div[role="tabpanel"]').forEach((div) => {
			div.style.backgroundColor = 'transparent';
			div.style.paddingTop = '0px';
		});
	});

	$: if (selectedChatModel || !selectedChatModel) {
		onChatModelChange(selectedChatModel);
	}

	$: if (typeof maxTokens === 'number') {
		onMaxTokensChange(maxTokens);
	}

	$: if (typeof numberOfVectorDocs === 'number') {
		onNumberOfVectorDocsChange(numberOfVectorDocs);
	}

	$: if (typeof temperature === 'number') {
		onTemperatureChange(temperature);
	}

	$: if (selectedCollectionIds || !selectedCollectionIds) {
		const selectedCollections = collections.filter((collection) => {
			return selectedCollectionIds.includes(collection.id);
		});

		onCollectionsChange(selectedCollections);
	}
</script>

<div class="tgfTabs dark flex h-screen w-full flex-col md:w-1/4">
	<Tabs divider tabStyle="underline" contentClass="flex flex-col overflow-y-auto">
		<TabItem
			open={selectedTab === 'data'}
			title="Data"
			onclick={() => {
				selectedTab = 'data';
			}}
		>
			<div class="flex w-full gap-2">
				<Input
					disabled={isAddingCollection}
					bind:value={newCollectionName}
					placeholder="New collection name ..."
					onKeydown={(e) => {
						if (e.key === 'Enter') {
							addCollection();
						}
					}}
				/>

				<Button
					size="xs"
					class="cursor-pointer"
					type="button"
					disabled={isAddingCollection ||
						isLoadingCollections ||
						isDeletingCollection ||
						newCollectionName.trim() === ''}
					onclick={addCollection}
				>
					<FolderPlusSolid class="h-4 w-4" />
				</Button>
			</div>

			{#if lastAddCollectionError}
				<Alert color="red" class="mt-4">
					<span class="font-medium">COULD NOT CREATE: </span>
					<span>{lastAddCollectionError}</span>
				</Alert>
			{/if}

			<div class="mt-4 w-full">
				{#if isLoadingCollections}
					<div class="w-full text-center"><Spinner /></div>
				{:else if lastLoadingCollectionsError}
					<Alert color="red">
						<span class="font-medium"
							>COULD NOT LOAD COLLECTIONS (<span
								class="cursor-pointer underline"
								tabindex={0}
								onclick={() => reloadCollections()}>retry</span
							>):
						</span>
						<span>{lastLoadingCollectionsError}</span>
					</Alert>
				{:else if collections.length > 0}
					<Table>
						<TableBody>
							{#each collections as collection}
								<TableBodyRow>
									<TableBodyCell class="cursor-pointer">
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div
											class={`flex w-full ${selectedCollectionIds.includes(collection.id) ? 'font-medium text-white' : 'italic'}`}
											onclick={(e) => {
												toggleSelectedCollectionId(collection.id);
											}}
										>
											{#if selectedCollectionIds.includes(collection.id)}
												<div class="pr-2"><CheckCircleOutline /></div>
											{/if}

											<div class="flex-1">
												<span>{collection.name}</span>
											</div>
										</div>
									</TableBodyCell>

									<TableBodyCell class="w-10 text-right">
										<Button
											class="ml-0.5 cursor-pointer p-1.5!"
											color="blue"
											disabled={isAddingCollection ||
												isDeletingCollection ||
												isUploadingCollectionDocuments}
											onclick={() => {
												collectionToEdit = collection;
											}}><EditSolid class="h-3 w-3" /></Button
										>

										<Button
											class="ml-0.5 cursor-pointer p-1.5!"
											color="red"
											disabled={isAddingCollection ||
												isDeletingCollection ||
												isUploadingCollectionDocuments}
											onclick={() => {
												collectionToDelete = collection;
											}}><TrashBinSolid class="h-3 w-3" /></Button
										>
									</TableBodyCell>
								</TableBodyRow>
							{/each}
						</TableBody>
					</Table>
				{:else}
					<div class="w-full text-center italic">No collections found</div>
				{/if}
			</div>
		</TabItem>

		<TabItem
			open={selectedTab === 'settings'}
			title="Settings"
			onclick={() => {
				selectedTab = 'settings';
			}}
		>
			<div class="flex gap-4">
				<div class="flex-1">
					<Label>
						<span class="text-white">Chat Model</span>
						<Select
							class="mt-2"
							items={chatModels}
							disabled={isLoadingChatModels}
							value={selectedChatModel}
							onchange={(e: any) => {
								selectedChatModel = e.target.value;

								updateSelectedChatModelInStorage();
							}}
						/>
					</Label>
				</div>
			</div>

			<div class="mt-4 flex gap-4">
				<div class="flex-1">
					<Label>
						<span class="text-white">Max Tokens</span>
						<Input
							class="mt-2"
							type="number"
							value={maxTokens}
							min={1}
							max={128000}
							step={100}
							onchange={(e: any) => {
								updateMaxTokensInStorage(parseInt(String(e.target.value)));
							}}
						/>
					</Label>
				</div>

				<div class="flex-1">
					<Label>
						<span class="text-white">Temperature</span>
						<Input
							class="mt-2"
							type="number"
							value={temperature}
							min={0}
							max={2}
							step={0.1}
							onchange={(e: any) => {
								updateTemperatureInStorage(parseFloat(String(e.target.value).split(',').join('.')));
							}}
						/>
					</Label>
				</div>
			</div>

			<div class="mt-4 flex gap-4">
				<div class="flex-1">
					<Label>
						<span class="text-white"># of vector docs</span>
						<Input
							class="mt-2"
							type="number"
							value={numberOfVectorDocs}
							min={1}
							step={1}
							onchange={(e: any) => {
								updateNumberOfVectorDocsInStorage(parseInt(String(e.target.value)));
							}}
						/>
					</Label>
				</div>
			</div>
		</TabItem>
	</Tabs>
</div>

<Modal
	title={`Delete collection?`}
	open={!!collectionToDelete}
	outsideclose={false}
	onclose={() => closeDeleteCollectionDialog()}
	dismissable={false}
>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		Are you sure that you want to delete the collection <span class="font-bold italic"
			>{collectionToDelete?.name}</span
		>?
	</p>

	{#snippet footer()}
		<Button
			class="cursor-pointer"
			disabled={isDeletingCollection}
			onclick={() => deleteCollection()}>Yes</Button
		>
		<Button
			disabled={isDeletingCollection}
			onclick={() => closeDeleteCollectionDialog()}
			color="alternative"
			autofocus
			class="cursor-pointer">No</Button
		>
	{/snippet}
</Modal>

<Modal
	title={`Edit collection`}
	open={!!collectionToEdit}
	outsideclose={false}
	onclose={() => closeEditCollectionDialog()}
	dismissable={false}
	size="xl"
>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		<Label>
			<span>Name</span>
			<Input type="text" class="mt-1" readonly disabled value={collectionToEdit?.name || ''} />
		</Label>

		<Label class="pt-2">
			<span>Files to upload</span>
		</Label>
	</p>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class={`p-x rounded-2xl border-2 border-dashed p-3 transition-colors duration-300 ${
			isDraggingCollectionFiles ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
		}`}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
	>
		<label class="flex cursor-pointer flex-col items-center justify-center space-y-3 text-sm">
			<UploadSolid class="h-8 w-8 text-gray-400" />

			<span class="text-center text-gray-600">
				<span class="font-bold">Drop documents</span><br />
				or <span class="font-bold">click to upload</span>
			</span>
			<input
				type="file"
				accept=".csv, .gif, .jpeg, .jpg, .png, .pdf, .pptx, .txt, .xlsx"
				multiple
				class="hidden"
				onchange={handleFileSelect}
			/>
		</label>
	</div>

	<div class="flex gap-4">
		<div class="flex-1">
			<Label>
				<span>Chunk Size</span>
				<Input
					class="mt-2"
					type="number"
					value={chunkSize}
					min={1}
					step={100}
					onchange={(e: any) => {
						updateChunkSizeInStorage(parseInt(String(e.target.value)));
					}}
				/>
			</Label>
		</div>

		<div class="flex-1">
			<Label>
				<span>Chunk Overlap</span>
				<Input
					class="mt-2"
					type="number"
					value={chunkOverlap}
					min={0}
					step={10}
					onchange={(e: any) => {
						updateChunkOverlapInStorage((chunkOverlap = parseInt(String(e.target.value))));
					}}
				/>
			</Label>
		</div>
	</div>

	{#if collectionFilesToUpload.length > 0}
		<Table>
			<TableBody>
				{#each _(collectionFilesToUpload)
					.sortBy((cftu) => cftu.name?.toLowerCase().trim())
					.value() as file}
					<TableBodyRow>
						<TableBodyCell class="px-0 py-2">{file.name}</TableBodyCell>

						<TableBodyCell class="w-20 px-0 py-2 text-right">{filesize(file.size)}</TableBodyCell>

						<TableBodyCell class="w-20 px-0 py-2 text-right">
							<Button
								class="mr-1 ml-0.5 cursor-pointer p-1.5!"
								color="red"
								disabled={false}
								onclick={() => {
									collectionFilesToUpload = collectionFilesToUpload.filter((cftu) => {
										return cftu !== file;
									});
								}}><TrashBinSolid class="h-3 w-3" /></Button
							>
						</TableBodyCell>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>
	{/if}

	{#snippet footer()}
		<Button
			color="blue"
			disabled={isUploadingCollectionDocuments || collectionFilesToUpload.length === 0}
			onclick={() => uploadCollectionDocuments()}
			class="cursor-pointer"
		>
			<UploadSolid /><span class="mx-1">Upload</span>
		</Button>

		<Button
			disabled={isUploadingCollectionDocuments}
			onclick={() => closeEditCollectionDialog()}
			color="alternative"
			class="cursor-pointer">Cancel</Button
		>
	{/snippet}
</Modal>
