const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// ==========================================
// ARQUIVOS TEMPORÁRIOS
// ==========================================

const arquivosTemporarios =
  new Map();

// ==========================================
// IMPORTAR CURRÍCULO
// ==========================================

function importarCurriculo(file) {
  const buffer = file.buffer;

  const zip =
    new PizZip(buffer);

  // ==========================================
  // VERIFICA DOCUMENTO WORD
  // ==========================================

  if (!zip.file("word/document.xml")) {
    throw new Error(
      "O arquivo não parece ser um documento Word válido."
    );
  }

  // ==========================================
  // EXTRAI TEXTO
  // ==========================================

  const texto =
    extractDocumentText(zip);

  // ==========================================
  // ENCONTRA CAMPOS
  // ==========================================

  const campos =
    encontrarCampos(texto);

  console.log("");
  console.log(
    "=========================================="
  );
  console.log(
    "CURRÍCULO IMPORTADO"
  );
  console.log(
    "=========================================="
  );

  console.log(
    "Arquivo:",
    file.originalname
  );

  console.log(
    "Campos encontrados:",
    campos
  );

  // ==========================================
  // GERA ID
  // ==========================================

  const arquivo =
    crypto.randomUUID();

  // ==========================================
  // GUARDA DOCX ORIGINAL
  // ==========================================

  const agora =
    Date.now();

  arquivosTemporarios.set(
    arquivo,
    {
      buffer,
      nomeOriginal:
        file.originalname,

      criadoEm: agora,

      ultimoUso: agora,
    }
  );

  return {
    arquivo,
    nomeOriginal:
      file.originalname,
    campos,
  };
}

// ==========================================
// GERAR CURRÍCULO
// ==========================================

function gerarCurriculo(
  arquivo,
  valores
) {
  // ==========================================
  // PROCURA ARQUIVO
  // ==========================================

  const dadosArquivo =
    arquivosTemporarios.get(
      arquivo
    );

  if (!dadosArquivo) {
    throw new Error(
      "Arquivo temporário não encontrado. Importe o currículo novamente."
    );
  }

  // ==========================================
  // RENOVA TEMPO DE UTILIZAÇÃO
  // ==========================================

  dadosArquivo.ultimoUso =
    Date.now();

  // ==========================================
  // ABRE DOCX ORIGINAL
  // ==========================================

  const zip =
    new PizZip(
      dadosArquivo.buffer
    );

  // ==========================================
  // PROTEGE CHAVES
  // ==========================================

  sanitizarChavesDoDocumento(
    zip
  );

  // ==========================================
  // DOCXTEMPLATER
  // ==========================================

  const doc =
    new Docxtemplater(
      zip,
      {
        paragraphLoop: true,

        linebreaks: true,

        delimiters: {
          start: "{{",
          end: "}}",
        },
      }
    );

  // ==========================================
  // NORMALIZA DADOS
  // ==========================================

  const dados = {};

  Object.keys(valores).forEach(
    (chave) => {
      const nome =
        chave
          .trim()
          .replace(/\s+/g, "_");

      const valor =
        valores[chave];

      dados[nome] =
        valor === undefined ||
        valor === null ||
        String(valor).trim() === ""
          ? ""
          : String(valor).trim();
    }
  );

  console.log("");
  console.log(
    "=========================================="
  );

  console.log(
    "GERANDO CURRÍCULO"
  );

  console.log(
    "=========================================="
  );

  console.log(
    "Arquivo base:",
    dadosArquivo.nomeOriginal
  );

  console.log(
    "ID:",
    arquivo
  );

  console.log(
    "Dados normalizados:"
  );

  console.log(dados);

  // ==========================================
  // RENDERIZA
  // ==========================================

  doc.render(dados);

  // ==========================================
  // GERA DOCX
  // ==========================================

  const output =
    doc
      .getZip()
      .generate({
        type: "nodebuffer",
      });

  // ==========================================
  // DIRETÓRIO TEMPORÁRIO
  // ==========================================

  const tempDir =
    path.join(
      __dirname,
      "..",
      "temp"
    );

  if (
    !fs.existsSync(tempDir)
  ) {
    fs.mkdirSync(
      tempDir,
      {
        recursive: true,
      }
    );
  }

  // ==========================================
  // NOMES DOS ARQUIVOS
  // ==========================================

  const idPdf =
    crypto.randomUUID();

  const docxPath =
    path.join(
      tempDir,
      `${idPdf}.docx`
    );

  const pdfPath =
    path.join(
      tempDir,
      `${idPdf}.pdf`
    );

  // ==========================================
  // SALVA DOCX
  // ==========================================

  fs.writeFileSync(
    docxPath,
    output
  );

  console.log("");

  console.log(
    "DOCX TEMPORÁRIO:"
  );

  console.log(
    docxPath
  );

  // ==========================================
  // CONVERTE DOCX → PDF
  // ==========================================

  console.log("");

  console.log(
    "Convertendo DOCX → PDF..."
  );

  try {
    execFileSync(
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      [
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        tempDir,
        docxPath,
      ],
      {
        encoding: "utf8",
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      }
    );
  } catch (erro) {
    console.error("");

    console.error(
      "=========================================="
    );

    console.error(
      "ERRO DO LIBREOFFICE"
    );

    console.error(
      "=========================================="
    );

    console.error(
      "Status:",
      erro.status
    );

    console.error(
      "stdout:",
      erro.stdout
    );

    console.error(
      "stderr:",
      erro.stderr
    );

    throw new Error(
      `LibreOffice falhou ao converter o DOCX para PDF. ${
        erro.stderr ||
        erro.stdout ||
        ""
      }`
    );
  }

  // ==========================================
  // VERIFICA PDF
  // ==========================================

  if (
    !fs.existsSync(pdfPath)
  ) {
    throw new Error(
      "O LibreOffice não conseguiu gerar o PDF."
    );
  }

  console.log("");

  console.log(
    "PDF GERADO:"
  );

  console.log(
    pdfPath
  );

  // ==========================================
  // IMPORTANTE:
  //
  // NÃO REMOVEMOS O ARQUIVO DO MAPA AQUI.
  //
  // O MESMO DOCX PODE SER USADO
  // PARA GERAR VÁRIOS PDFs.
  // ==========================================

  return {
    docxPath,
    pdfPath,
  };
}

// ==========================================
// LIMPAR ARQUIVOS GERADOS
// ==========================================

function limparArquivosGerados(
  docxPath,
  pdfPath
) {
  try {
    if (
      fs.existsSync(docxPath)
    ) {
      fs.unlinkSync(
        docxPath
      );
    }

    if (
      fs.existsSync(pdfPath)
    ) {
      fs.unlinkSync(
        pdfPath
      );
    }

    console.log(
      "Arquivos temporários removidos."
    );
  } catch (erro) {
    console.error(
      "Erro ao remover temporários:",
      erro
    );
  }
}

// ==========================================
// EXTRAIR TEXTO DO DOCUMENTO
// ==========================================

function extractDocumentText(
  zip
) {
  const documentXml =
    zip
      .file("word/document.xml")
      ?.asText();

  if (!documentXml) {
    throw new Error(
      "Não foi possível encontrar word/document.xml"
    );
  }

  const partes = [];

  const regex =
    /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;

  let match;

  while (
    (match =
      regex.exec(
        documentXml
      )) !== null
  ) {
    partes.push(
      decodificarXML(
        match[1]
      )
    );
  }

  return partes.join("");
}

// ==========================================
// ENCONTRAR CAMPOS
// ==========================================

function encontrarCampos(
  texto
) {
  const campos = [];

  const regex =
    /\{\{\s*([^{}]+?)\s*\}\}/g;

  let match;

  while (
    (match =
      regex.exec(texto)) !== null
  ) {
    const campo =
      match[1]
        .trim()
        .replace(
          /\s+/g,
          "_"
        );

    if (
      campo &&
      !campos.includes(
        campo
      )
    ) {
      campos.push(
        campo
      );
    }
  }

  return campos;
}

// ==========================================
// SANITIZAR CHAVES DO DOCUMENTO
// ==========================================

function sanitizarChavesDoDocumento(
  zip
) {
  const arquivo =
    zip.file(
      "word/document.xml"
    );

  if (!arquivo) {
    return;
  }

  let xml =
    arquivo.asText();

  const marcadores = [];

  // ==========================================
  // PROTEGE TEMPORARIAMENTE
  // OS PLACEHOLDERS
  // ==========================================

  xml =
    xml.replace(
      /\{\{\s*([^{}]+?)\s*\}\}/g,
      (match) => {
        const id =
          `___DOCX_PLACEHOLDER_${marcadores.length}___`;

        marcadores.push(
          match
        );

        return id;
      }
    );

  // ==========================================
  // ESCAPA CHAVES SOLTAS
  // ==========================================

  xml =
    xml
      .replace(
        /\{/g,
        "&#123;"
      )
      .replace(
        /\}/g,
        "&#125;"
      );

  // ==========================================
  // RESTAURA PLACEHOLDERS
  // ==========================================

  marcadores.forEach(
    (
      marcador,
      index
    ) => {
      const id =
        `___DOCX_PLACEHOLDER_${index}___`;

      xml =
        xml.replace(
          id,
          marcador
        );
    }
  );

  zip.file(
    "word/document.xml",
    xml
  );
}

// ==========================================
// DECODIFICAR XML
// ==========================================

function decodificarXML(
  texto
) {
  return texto
    .replace(
      /&amp;/g,
      "&"
    )
    .replace(
      /&lt;/g,
      "<"
    )
    .replace(
      /&gt;/g,
      ">"
    )
    .replace(
      /&quot;/g,
      '"'
    )
    .replace(
      /&apos;/g,
      "'"
    );
}

// ==========================================
// LIMPEZA AUTOMÁTICA
// ==========================================

setInterval(
  () => {
    const agora =
      Date.now();

    const limite =
      30 * 60 * 1000;

    for (
      const [
        id,
        arquivo,
      ] of arquivosTemporarios
    ) {
      const ultimaAtividade =
        arquivo.ultimoUso ||
        arquivo.criadoEm;

      if (
        agora -
          ultimaAtividade >
        limite
      ) {
        arquivosTemporarios.delete(
          id
        );

        console.log(
          "Arquivo temporário removido:",
          arquivo.nomeOriginal
        );
      }
    }
  },
  10 * 60 * 1000
);

// ==========================================
// EXPORTA
// ==========================================

module.exports = {
  importarCurriculo,
  gerarCurriculo,
  limparArquivosGerados,
};