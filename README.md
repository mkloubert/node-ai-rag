# AI RAG CLI for Node.js

> A command line tool for a local RAG written for Node.js 20+

## Requirements

- [Ollama](https://ollama.com/) with an embedding model like [nomic-embed-text](https://ollama.com/library/nomic-embed-text)

## Usage

First run

```bash
npm install
```

from [this directory](./) to install all dependencies.

Then create a [.data folder](./.data) and put all your documents in there. Supported are:

- `.gif`, `.jp(e)g`, `.png`
- `.pdf`
- `.pptx`
- `.txt`
- `.xlsx`

All files with leading `.` will be ignored.

Optionally you can create an [.env file](./.env) to define things like `OPENAI_API_KEY`.

## Flags and options

| Name                    | Description                                                                                                                                                                                           | Example / Default            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `chunk-size`            | Sets the size for chunks.                                                                                                                                                                             | `--chunk-size=1000`          |
| `chunk-overlap`         | Sets the size for chunk overlaps.                                                                                                                                                                     | `--chunk-overlap=200`        |
| `dry-run`               | Flag that indicates NOT to run query to AI provider. Default: `false`.                                                                                                                                | `--dry-run`                  |
| `lang`                  | Sets the explicit language.                                                                                                                                                                           | `--lang="eng"`               |
| `log-level`             | The custom [log level](https://www.npmjs.com/package/winston#logging-levels).                                                                                                                         | `--log-level="info"`         |
| `max-tokens`            | Maximum number of response tokens.                                                                                                                                                                    | `--max-tokens=10000`         |
| `model`                 | The custom model to use. Default for OpenAI is [gpt-4o-mini](https://openai.com/index/gpt-4o-mini-advancing-cost-efficient-intelligence/) and for Ollama [llama4](https://ollama.com/library/llama4). | `--model="gpt-4o-mini"`      |
| `number-of-vector-docs` | Number of relevant vector docs to search for.                                                                                                                                                         | `--number-of-vector-docs=10` |
| `ollama`                | Flag that indicates to use [Ollama API](https://ollama.com/) instead of [OpenAI](https://platform.openai.com/docs/api-reference/chat/create). Default: `false`.                                       | `--ollama`                   |
| `silent`                | Flag that indicates NOT to log. Default: `false`.                                                                                                                                                     | `--silent`                   |
| `temperature`           | Temperature value for the AI model.                                                                                                                                                                   | `--temperature=0.3`          |
