const express = require("express");
const multer = require("multer");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const app = express();
const PORT = 3000;

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// UPLOAD
// ==========================================

const upload = multer({
  storage: multer.memoryStorage(),
});

// ==========================================
// ARQUIVOS TEMPORÁRIOS
// ==========================================

const arquivosTemporarios = new Map();

// ==========================================
// IMPORTAR CURRÍCULO
// ==========================================

app.post("/api/importar", upload.single("curriculo"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        erro: "Nenhum arquivo enviado.",
      });
    }

    const buffer = req.file.buffer;

    const zip = new PizZip(buffer);

    if (!zip.file("word/document.xml")) {
      return res.status(400).json({
        erro: "O arquivo não parece ser um documento Word válido.",
      });
    }

    const texto = extractDocumentText(zip);

    const campos = encontrarCampos(texto);

    console.log("");
    console.log("CAMPOS ENCONTRADOS:");
    console.log(campos);

    const arquivo = crypto.randomUUID();

    arquivosTemporarios.set(arquivo, {
      buffer,
      nomeOriginal: req.file.originalname,
      criadoEm: Date.now(),
    });

    return res.json({
      sucesso: true,
      arquivo,
      nomeOriginal: req.file.originalname,
      campos,
    });
  } catch (error) {
    console.error("ERRO AO IMPORTAR:", error);

    return res.status(500).json({
      erro: "Erro ao processar o currículo.",
      detalhes: error.message,
    });
  }
});

// ==========================================
// GERAR CURRÍCULO
// ==========================================

app.post("/api/gerar", (req, res) => {
  try {
    const { arquivo, valores } = req.body;

    if (!arquivo) {
      return res.status(400).json({
        erro: "Arquivo não informado.",
      });
    }

    if (!valores) {
      return res.status(400).json({
        erro: "Valores dos campos não informados.",
      });
    }

    const dadosArquivo = arquivosTemporarios.get(arquivo);

    if (!dadosArquivo) {
      return res.status(404).json({
        erro: "Arquivo temporário não encontrado. Importe o currículo novamente.",
      });
    }

    // ==========================================
    // ABRE O DOCX ORIGINAL
    // ==========================================

    const zip = new PizZip(dadosArquivo.buffer);

    // ==========================================
    // PROTEGE CHAVES DO DOCUMENTO
    // ==========================================

    sanitizarChavesDoDocumento(zip);

    // ==========================================
    // DOCXTEMPLATER
    // ==========================================

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,

      delimiters: {
        start: "{{",
        end: "}}",
      },
    });

    // ==========================================
    // NORMALIZA OS DADOS
    // ==========================================

    const dados = {};

    Object.keys(valores).forEach((chave) => {
      const nome = chave.trim().replace(/\s+/g, "_");

      const valor = valores[chave];

      dados[nome] =
        valor === undefined || valor === null || String(valor).trim() === ""
          ? ""
          : String(valor).trim();
    });

    console.log("");
    console.log("==========================================");
    console.log("GERANDO CURRÍCULO");
    console.log("==========================================");

    console.log("DADOS NORMALIZADOS:");

    console.log(dados);

    // ==========================================
    // RENDERIZA
    // ==========================================

    doc.render(dados);

    // ==========================================
    // GERA DOCX
    // ==========================================

    const output = doc.getZip().generate({
      type: "nodebuffer",
    });

    // ==========================================
    // DIRETÓRIO TEMPORÁRIO
    // ==========================================

    const tempDir = path.join(__dirname, "temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, {
        recursive: true,
      });
    }

    // ==========================================
    // NOME DOS ARQUIVOS
    // ==========================================

    const idPdf = crypto.randomUUID();

    const docxPath = path.join(tempDir, `${idPdf}.docx`);

    const pdfPath = path.join(tempDir, `${idPdf}.pdf`);

    // ==========================================
    // SALVA DOCX TEMPORÁRIO
    // ==========================================

    fs.writeFileSync(docxPath, output);

    console.log("");
    console.log("DOCX TEMPORÁRIO:");

    console.log(docxPath);

    // ==========================================
    // CONVERTE DOCX → PDF
    // ==========================================

    console.log("");
    console.log();

    execFileSync(
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      ["--headless", "--convert-to", "pdf", "--outdir", tempDir, docxPath],
      {
        stdio: "inherit",
      },
    );

    // ==========================================
    // VERIFICA PDF
    // ==========================================

    if (!fs.existsSync(pdfPath)) {
      throw new Error("O LibreOffice não conseguiu gerar o PDF.");
    }

    console.log("");
    console.log("PDF GERADO:");

    console.log(pdfPath);

    // ==========================================
    // REMOVE ARQUIVO DO MAPA
    // ==========================================

    arquivosTemporarios.delete(arquivo);

    // ==========================================
    // ENVIA PDF
    // ==========================================

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader("Content-Disposition", 'inline; filename="cv.pdf"');

    res.sendFile(pdfPath, (erro) => {
      if (erro) {
        console.error("Erro ao enviar PDF:", erro);

        return;
      }

      // ==========================================
      // LIMPA TEMPORÁRIOS
      // ==========================================

      setTimeout(() => {
        try {
          if (fs.existsSync(docxPath)) {
            fs.unlinkSync(docxPath);
          }

          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
          }

          console.log("Arquivos temporários removidos.");
        } catch (erroLimpeza) {
          console.error("Erro ao remover temporários:", erroLimpeza);
        }
      }, 1000);
    });
  } catch (error) {
    console.error("");
    console.error("==========================================");
    console.error("ERRO AO GERAR CURRÍCULO");
    console.error("==========================================");

    console.error(error);

    return res.status(500).json({
      erro: "Erro ao gerar o currículo.",
      detalhes: error.message,
    });
  }
});

// ==========================================
// EXTRAIR TEXTO DO DOCUMENTO
// ==========================================

function extractDocumentText(zip) {
  const documentXml = zip.file("word/document.xml")?.asText();

  if (!documentXml) {
    throw new Error("Não foi possível encontrar word/document.xml");
  }

  const partes = [];

  const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;

  let match;

  while ((match = regex.exec(documentXml)) !== null) {
    partes.push(decodificarXML(match[1]));
  }

  return partes.join("");
}

// ==========================================
// ENCONTRAR CAMPOS {{CAMPO}}
// ==========================================

function encontrarCampos(texto) {
  const campos = [];

  const regex = /\{\{\s*([^{}]+?)\s*\}\}/g;

  let match;

  while ((match = regex.exec(texto)) !== null) {
    const campo = match[1].trim().replace(/\s+/g, "_");

    if (campo && !campos.includes(campo)) {
      campos.push(campo);
    }
  }

  return campos;
}

// ==========================================
// SANITIZAR CHAVES DO DOCUMENTO
// ==========================================

function sanitizarChavesDoDocumento(zip) {
  const arquivo = zip.file("word/document.xml");

  if (!arquivo) {
    return;
  }

  let xml = arquivo.asText();

  const marcadores = [];

  // Protege temporariamente
  // todos os {{campo}}

  xml = xml.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match) => {
    const id = `___DOCX_PLACEHOLDER_${marcadores.length}___`;

    marcadores.push(match);

    return id;
  });

  // Escapa chaves soltas

  xml = xml.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");

  // Restaura placeholders

  marcadores.forEach((marcador, index) => {
    const id = `___DOCX_PLACEHOLDER_${index}___`;

    xml = xml.replace(id, marcador);
  });

  zip.file("word/document.xml", xml);
}

// ==========================================
// DECODIFICAR XML
// ==========================================

function decodificarXML(texto) {
  return texto
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ==========================================
// LIMPEZA AUTOMÁTICA
// ==========================================

setInterval(
  () => {
    const agora = Date.now();

    const limite = 30 * 60 * 1000;

    for (const [id, arquivo] of arquivosTemporarios) {
      if (agora - arquivo.criadoEm > limite) {
        arquivosTemporarios.delete(id);

        console.log("Arquivo temporário removido:", arquivo.nomeOriginal);
      }
    }
  },
  10 * 60 * 1000,
);

// ==========================================
// ROTA PRINCIPAL
// ==========================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ==========================================
// SERVIDOR
// ==========================================

app.listen(PORT, () => {
  console.log("");
  console.log("==========================================");

  console.log(`Servidor rodando em http://localhost:${PORT}`);

  console.log("==========================================");
});
