# node-ai-rag

## Settings

### Environment variables

#### `OPENAI_API_KEY`

The [API key](https://platform.openai.com/settings/organization/api-keys) which is required for all OpenAI operations.

#### `TGF_CHAT_MODEL_FILTER`

A [filtrex expression](https://www.npmjs.com/package/filtrex) which filters all model names. If not defined no filter will be used.

Example:

```
startsWith(model, "ollama:llama3.1") or regex(model, "^(openai:gpt-4)([^-]*)$") or regex(model, "^(openai:gpt-4)([^-]*)((-mini)|(-nano))$")
```

Constants:

| Name    | Description                                      | Example                                                          |
| ------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| `model` | The name of the model that is currently checked. | `model == "openai:gpt-4o-mini" or model == "ollama:llama3.1:8b"` |

Functions:

| Name                                                       | Description                                                                           | Example                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `endsWith(value: any, suffix: string): boolean`            | Checks if the string representation of a value has a suffix.                          | `endsWith(model, "-mini") or endsWith(model, "-nano")`       |
| `log(...args: any[]): true`                                | Logs one or more values.                                                              | `log(model) and startsWith(model, "ollama:")`                |
| `regex(value: any, expr: string, flags? = 'gmi'): boolean` | Checks a file for a regular expression.                                               | `regex(model, "^(openai:gpt-4)([^-]*)((-mini))$")`           |
| `startsWith(value: any, prefix: string): boolean`          | Checks if the string representation of a value has a prefix.                          | `startsWith(model, "ollama:")`                               |
| `str(value: any): string`                                  | Converts a value to its string representation that is not `null` and not `undefined`. | `str(4) == "4" and str(null) == "" and str(undefined) == ""` |

#### `TGF_DATABASE_NAME`

The custom name of the database for `chromadb` service in [docker-compose.yaml file](./docker-compose.yaml).

This is [default-database](./.env) by default.

#### `TGF_TENANT_NAME`

The custom name of the tenant for `chromadb` service in [docker-compose.yaml file](./docker-compose.yaml).

This is [default-tenant](./.env) by default.

## Chroma DB

The [chromadb/chroma Docker image](https://hub.docker.com/r/chromadb/chroma) is used to provide a vector storage for the text embeddings.

Initially the `chroma-init` service in the [docker-compose.yaml file](./docker-compose.yaml) tries to create a `default-tenant` tenant and a `default-database` database on a each startup.

Inside this project there will be a [./.chromadb subfolder](./.chromadb) that stores all data created by the Docker container.
