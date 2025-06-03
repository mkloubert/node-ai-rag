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

import * as commonmark from "commonmark";
import dotenv from "dotenv";
import fastGlob from "fast-glob";
import fs from "node:fs";
import open from "open";
import os from "node:os";
import path from "node:path";
import tempfile from "tempfile";
import winston from "winston";
import yargs from "yargs";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OllamaEmbeddings } from "./ollama.mjs";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { hideBin } from "yargs/helpers";
import { calcTokens } from "./utils.mts";
import { AiClientBase } from "./ai.mts";
import { fileTypeFromFile } from "file-type";
import { Document } from "langchain/document";

const argv = await yargs(hideBin(process.argv)).parse();
const silent = !!argv["silent"];
const logLevel =
  String(argv["log-level"] ?? "")
    .toLowerCase()
    .trim() || "info";

const cwd = process.cwd();

const l = winston.createLogger({
  level: logLevel,
  transports: [new winston.transports.Console()],
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
  silent,
});

const lang =
  String(argv["lang"] ?? "")
    .toLowerCase()
    .trim() || "en";
const isNoLangDefined = String(argv["lang"] ?? "").trim() === "";

const chunkSize = parseInt(
  String(argv["chunk-size"] ?? "").trim() || "1000",
  10
);
const chunkOverlap = parseInt(
  String(argv["chunk-overlap"] ?? "").trim() || "200",
  10
);
const maxTokens = parseInt(
  String(argv["max-tokens"] ?? "").trim() || "10000",
  10
);
const numberOfVectorDocs = parseInt(
  String(argv["number-of-vector-docs"] ?? "").trim() || "10",
  10
);
const temperature = parseFloat(
  String(argv["temperature"] ?? "").trim() || "0.3"
);

if (Number.isNaN(chunkSize) || chunkSize < 1) {
  l.error(`chunk-size is invalid and must be at least 1`);

  process.exit(2);
}
if (Number.isNaN(chunkOverlap) || chunkOverlap < 0) {
  l.error(`chunk-overlap is invalid and must be at least 0`);

  process.exit(2);
}
if (Number.isNaN(numberOfVectorDocs) || numberOfVectorDocs < 1) {
  l.error(`number-of-vector-docs is invalid and must be at least 1`);

  process.exit(2);
}
if (Number.isNaN(temperature)) {
  l.error(`temperature is invalid`);

  process.exit(2);
}
if (Number.isNaN(maxTokens) || maxTokens < 1) {
  l.error(`max-tokens is invalid and must be at least 1`);

  process.exit(2);
}

const dryRun = !!argv["dry-run"];

const localEnvFile = path.join(cwd, ".env");
if (fs.existsSync(localEnvFile)) {
  dotenv.config({ path: localEnvFile });

  l.info("Loaded local .env file");
}

const query = argv._.map((a) => {
  return String(a ?? "").trim();
})
  .filter((a) => {
    return a !== "";
  })
  .join(" ")
  .trim();
l.info(`Query: ${query}`);
if (query === "") {
  l.error("No query defined!");

  process.exit(2);
}

const dataDir = path.join(cwd, ".data");

const allDocuments: Document[] = [];

const dataFiles = await fastGlob(
  [
    "**/*.gif",
    "**/*.jpeg",
    "**/*.jpg",
    "**/*.png",
    "**/*.pdf",
    "**/*.pptx",
    "**/*.txt",
    "**/*.xlsx",
  ],
  {
    absolute: true,
    unique: true,
    onlyFiles: true,
    dot: false,
    cwd: dataDir,
  }
);
for (const dataFile of dataFiles) {
  const relPath = path.relative(dataDir, dataFile);

  l.info(`Loading data file from '${relPath}' ...`);

  const metadata: Record<string, any> = {
    source: dataFile,
  };

  const mime = String((await fileTypeFromFile(dataFile))?.mime ?? "")
    .toLowerCase()
    .trim();
  if (mime.includes("image/")) {
    l.info("... as image file ...");

    const Tesseract = await import("tesseract.js");

    // TODO: support more languages
    const result = await Tesseract.recognize(
      dataFile,
      lang.startsWith("de") ? "deu" : "eng",
      {
        // logger: (m) => console.log(m),
      }
    );

    allDocuments.push(
      new Document({
        pageContent: String(result.data.text ?? "").trim(),
        metadata: {
          ...metadata,
        },
      })
    );
  } else if (mime.includes("/pdf")) {
    l.info("... as PDF ...");

    const { PDFLoader } = await import(
      "@langchain/community/document_loaders/fs/pdf"
    );

    const loader = new PDFLoader(dataFile);

    const docs = await loader.load();

    allDocuments.push(...docs);
  } else if (mime.includes("powerpoint") || mime.includes("presentation")) {
    l.info("... as PowerPoint file ...");

    const officeParser = await import("officeparser");

    const pageContent = (await officeParser.parseOfficeAsync(dataFile)).trim();

    allDocuments.push(
      new Document({
        pageContent,
        metadata: {
          ...metadata,
        },
      })
    );
  } else if (mime.includes("excel") || mime.includes("sheet")) {
    l.info("... as Excel file ...");

    const ExcelJS = await import("exceljs");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(dataFile);

    // sheets ...
    for (const sheet of workbook.worksheets) {
      const sheetName = String(sheet.name);
      const rowTexts: string[] = [];

      // rows ...
      for (let i = 1; i <= sheet.rowCount; i++) {
        const cellTexts: string[] = [];

        const row = sheet.getRow(i);

        // cells ...
        for (let j = 1; j <= row.cellCount; j++) {
          const cell = row.getCell(j);

          cellTexts.push(String(cell.value ?? ""));
        }

        rowTexts.push(cellTexts.join("\t").trim());
      }

      allDocuments.push(
        new Document({
          pageContent: rowTexts.join("\n").trim(),
          metadata: {
            ...metadata,

            sheet: sheetName,
          },
        })
      );
    }
  } else {
    l.info("... as binary / plain text ...");

    allDocuments.push({
      metadata: {
        ...metadata,
      },
      pageContent: await fs.promises.readFile(dataFile, "utf-8"),
    });
  }
}

const allTexts = allDocuments.map((doc) => doc.pageContent);

l.info(
  `Splitting into chunks of size ${chunkSize} with overlap of ${chunkOverlap} ...`
);
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize,
  chunkOverlap,
});

const allTextCombined = allTexts.join("\n\n").trim();
l.info(`Combined text length is ${allTextCombined.length}`);

const chunks = await splitter.createDocuments([...allTexts]);
l.info(`Split into ${chunks.length} chunks`);

const embeddings = new OllamaEmbeddings();

const embeddedChunks = await embeddings.embedDocuments(
  chunks.map((doc) => doc.pageContent)
);
l.info(`Number of embedded chunks: ${embeddedChunks.length}`);

l.info("Loading chunks into vector store ...");
const vectorStore = await MemoryVectorStore.fromDocuments(chunks, embeddings);

l.info(`Searching for up to ${numberOfVectorDocs} relevant docs ...`);
const relevantDocs = await vectorStore.similaritySearch(
  query,
  numberOfVectorDocs
);

const context = relevantDocs
  .map((doc) => doc.pageContent)
  .join("\n\n")
  .trim();
l.info(`Length of context: ${context.length}`);

const systemContent = `Use the following context to answer the question (both are submitted as serialied JSON strings). Use ${
  isNoLangDefined ? "same language" : `'${lang}' language`
} for each answer.`;
const userContent = `### CONTEXT:
${JSON.stringify(context)}

### QUESTION:
${JSON.stringify(query)}

Answer:`;

const numberOfQueryTokens = calcTokens(systemContent + userContent);
l.info(`Number of input tokens about: ${numberOfQueryTokens}`);

const client = await AiClientBase.fromSettings(argv);
l.info(
  `Will use AI provider '${client.provider}' with model '${client.model}' ...`
);

if (dryRun) {
  l.warn("Will not execute, because of dry running mode");
} else {
  l.info("Doing AI query ...");

  const result = await client.query(
    [
      {
        role: "system",
        content: systemContent,
      },
      { role: "user", content: userContent },
    ],
    {
      maxTokens,
      temperature,
    }
  );

  const outputAnswer = async () => {
    if (!silent) {
      process.stdout.write(os.EOL);
    }
    process.stdout.write(result.content);
    process.stdout.write(os.EOL);
  };

  try {
    const reader = new commonmark.Parser();
    const writer = new commonmark.HtmlRenderer();

    const parsed = reader.parse(result.content);
    const resultHtml = writer.render(parsed);

    const htmlFile = tempfile({ extension: "html" });
    await fs.promises.writeFile(
      htmlFile,
      `<html>
  <head>
    <meta charset="UTF-8">

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/default.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css">

    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.8/dist/index.global.js"></script>
    <script>
      window.addEventListener('DOMContentLoaded', function() {
        hljs.highlightAll();
      });
    </script>
  </head>

  <body class="dark p-4">

${resultHtml}

  </body>
</html>`,
      "utf-8"
    );

    await open(htmlFile, { wait: false });
  } catch (error) {
    l.warn(`Could not open browser: ${error}`);

    await outputAnswer();
  }
}
