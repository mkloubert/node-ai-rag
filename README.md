# node-ai-rag

<p align="center">
  <img src="rag-icon.png" alt="RAG Icon" width="384" />
</p>

## Usage

First, install [Docker](https://www.docker.com) along with [Docker Compose](https://docs.docker.com/compose/).

Next, create a [.env.local file](./.env.local) to define your secret and custom environment variables such as `OPENAI_API_KEY`. Refer to the [Settings section](#settings) for details on available configuration options.

To start the application, run the following command in your terminal:

```bash
docker compose up
```

## Settings

### Environment Variables

#### `OPENAI_API_KEY`

Your [OpenAI API key](https://platform.openai.com/settings/organization/api-keys), required for all OpenAI-related functionality.

#### `TGF_CHAT_MODEL_FILTER`

A [Filtrex expression](https://www.npmjs.com/package/filtrex) used to filter model names. If undefined, no filtering is applied.

**Example:**

```
startsWith(model, "ollama:llama3.1") or
regex(model, "^(openai:gpt-4)([^-]*)$") or
regex(model, "^(openai:gpt-4)([^-]*)((-mini)|(-nano))$")
```

**Constants:**

| Name    | Description                            | Example                                                          |
| ------- | -------------------------------------- | ---------------------------------------------------------------- |
| `model` | The name of the model being evaluated. | `model == "openai:gpt-4o-mini" or model == "ollama:llama3.1:8b"` |

**Functions:**

| Function                            | Description                                                                        | Example                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `endsWith(value, suffix)`           | Returns true if the value ends with the specified suffix.                          | `endsWith(model, "-mini")`                                                  |
| `log(...args)`                      | Logs one or more values; always returns true.                                      | `log(model, startsWith(model, "ollama:")) and startsWith(model, "ollama:")` |
| `regex(value, expr, flags = 'gmi')` | Returns true if the value matches the given regular expression.                    | `regex(model, "^(openai:gpt-4)([^-]*)((-mini))$")`                          |
| `startsWith(value, prefix)`         | Returns true if the value starts with the specified prefix.                        | `startsWith(model, "ollama:")`                                              |
| `str(value)`                        | Converts the input to a string, returns an empty string for `null` or `undefined`. | `str(4) == "4" and str(null) == "" and str(undefined) == ""`                |

#### `TGF_DATABASE_NAME`

The name of the database used by the `chromadb` service, as specified in [docker-compose.yaml](./docker-compose.yaml).  
Defaults to `default-database` (see [.env](./.env)).

#### `TGF_TENANT_NAME`

The name of the tenant for the `chromadb` service, as configured in [docker-compose.yaml](./docker-compose.yaml).  
Defaults to `default-tenant` (see [.env](./.env)).

## Chroma DB

This project uses the [chromadb/chroma Docker image](https://hub.docker.com/r/chromadb/chroma) to store vector embeddings.

On startup, the `chroma-init` service in the [docker-compose.yaml](./docker-compose.yaml) will attempt to create the default tenant (`default-tenant`) and database (`default-database`).

All persistent data is stored in the [./.chromadb](./.chromadb) directory, managed by the Docker container.

## License

The project is licensed under the [MIT](./LICENSE).

## Support

If you like the project you can [donate via PayPal](https://paypal.me/MarcelKloubert).

## Contribution

If you have ideas and/or want to participate you are welcome!

[Open an issue](https://github.com/mkloubert/node-ai-rag/issues/new) or [create a pull request](https://github.com/mkloubert/node-ai-rag/compare).
