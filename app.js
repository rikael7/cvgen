const express = require("express");
const multer = require("multer");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const app = express();

// Render fornece PORT automaticamente.
// Localmente continua usando 3000.
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// UPLOAD
// ==========================================

const upload = multer({
  storage: multer.memoryStorage(),
});

// ==========================================
// DOCUMENTOS IMPORTADOS
// ==========================================
//
// O documento fica armazenado em memória
// depois do upload.
//
// IMPORTANTE:
// Ele NÃO é removido depois de gerar um PDF.
//
// Assim o mesmo DOCX pode gerar:
// PDF 1
// PDF 2
// PDF 3
// PDF 4
// etc.
//
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

    // ========================================
    // VALIDA SE É UM DOCX
    // ========================================

    const zip = new PizZip(buffer);

    if (!zip.file("word/document.xml")) {
      return res.status(400).json({
        erro: "O arquivo não parece ser um documento Word válido.",
      });
    }

    // ========================================
    // EXTRAI TEXTO
    // ========================================

    const texto = extractDocumentText(zip);

    // ========================================
    // ENCONTRA PLACEHOLDERS
    // ========================================

    const campos = encontrarCampos(texto);

    console.log("");
    console.log("==========================================");
    console.log("CURRÍCULO IMPORTADO");
    console.log("==========================================");

    console.log("Arquivo:", req.file.originalname);

    console.log("Campos encontrados:", campos);

    // ========================================
    // GERA ID
    // ========================================

    const arquivo = crypto.randomUUID();

    // ========================================
    // GUARDA DOCUMENTO EM MEMÓRIA
    // ========================================

    arquivosTemporarios.set(arquivo, {
      buffer,
      nomeOriginal: req.file.originalname,
      criadoEm: Date.now(),
      ultimoUso: Date.now(),
    });

    // ========================================
    // RESPONDE AO FRONT-END
    // ========================================

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

    // ========================================
    // VALIDA ARQUIVO
    // ========================================

    if (!arquivo) {
      return res.status(400).json({
        erro: "Arquivo não informado.",
      });
    }

    // ========================================
    // VALIDA VALORES
    // ========================================

    if (!valores) {
      return res.status(400).json({
        erro: "Valores dos campos não informados.",
      });
    }

    // ========================================
    // PROCURA DOCUMENTO
    // ========================================

    const dadosArquivo = arquivosTemporarios.get(arquivo);

    if (!dadosArquivo) {
      return res.status(404).json({
        erro: "Arquivo temporário não encontrado. Importe o currículo novamente.",
      });
    }

    // ========================================
    // ATUALIZA ÚLTIMO USO
    // ========================================

    dadosArquivo.ultimoUso = Date.now();

    // ========================================
    // ABRE O DOCX ORIGINAL
    // ========================================
    //
    // IMPORTANTE:
    // Sempre usamos o buffer ORIGINAL.
    //
    // Isso permite gerar vários PDFs
    // diferentes a partir do mesmo DOCX.
    //
    // ========================================

    const zip = new PizZip(dadosArquivo.buffer);

    // ========================================
    // PROTEGE CHAVES DO DOCUMENTO
    // ========================================

    sanitizarChavesDoDocumento(zip);

    // ========================================
    // DOCXTEMPLATER
    // ========================================

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,

      linebreaks: true,

      delimiters: {
        start: "{{",
        end: "}}",
      },
    });

    // ========================================
    // NORMALIZA OS DADOS
    // ========================================

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

    console.log("Arquivo base:", dadosArquivo.nomeOriginal);

    console.log("ID:", arquivo);

    console.log("Dados normalizados:");

    console.log(dados);

    // ========================================
    // RENDERIZA DOCX
    // ========================================

    doc.render(dados);

    // ========================================
    // GERA DOCX
    // ========================================

    const output = doc.getZip().generate({
      type: "nodebuffer",
    });

    // ========================================
    // DIRETÓRIO TEMPORÁRIO
    // ========================================

    const tempDir = path.join(__dirname, "temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, {
        recursive: true,
      });
    }

    // ========================================
    // ID DA GERAÇÃO
    // ========================================
    //
    // Cada geração recebe um ID diferente.
    //
    // Isso permite gerar vários PDFs
    // usando o mesmo currículo base.
    //
    // ========================================

    const idPdf = crypto.randomUUID();

    const docxPath = path.join(tempDir, `${idPdf}.docx`);

    const pdfPath = path.join(tempDir, `${idPdf}.pdf`);

    // ========================================
    // SALVA DOCX TEMPORÁRIO
    // ========================================

    fs.writeFileSync(docxPath, output);

    console.log("");

    console.log("DOCX TEMPORÁRIO:");

    console.log(docxPath);

    // ========================================
    // CONVERTE DOCX → PDF
    // ========================================

    console.log("");

    console.log("Convertendo DOCX → PDF...");

    try {
      execFileSync(
        "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
        ["--headless", "--convert-to", "pdf", "--outdir", tempDir, docxPath],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
    } catch (erro) {
      console.error("ERRO DO LIBREOFFICE:");
      console.error("status:", erro.status);
      console.error("stdout:", erro.stdout);
      console.error("stderr:", erro.stderr);

      throw new Error(
        `LibreOffice falhou ao converter o DOCX para PDF. ${erro.stderr || erro.stdout || ""}`,
      );
    }

    // ========================================
    // VERIFICA PDF
    // ========================================

    if (!fs.existsSync(pdfPath)) {
      throw new Error("O LibreOffice não conseguiu gerar o PDF.");
    }

    console.log("");

    console.log("PDF GERADO:");

    console.log(pdfPath);

    // ========================================
    // ATENÇÃO
    // ========================================
    //
    // NÃO fazemos mais:
    //
    // arquivosTemporarios.delete(arquivo);
    //
    // O currículo base continua disponível
    // para novas gerações.
    //
    // ========================================

    // ========================================
    // ENVIA PDF
    // ========================================

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader("Content-Disposition", 'inline; filename="cv.pdf"');

    res.sendFile(pdfPath, (erro) => {
      if (erro) {
        console.error("Erro ao enviar PDF:", erro);

        return;
      }

      // ====================================
      // LIMPA SOMENTE OS ARQUIVOS GERADOS
      // ====================================
      //
      // Não remove o DOCX armazenado
      // no Map.
      //
      // ====================================

      setTimeout(() => {
        try {
          if (fs.existsSync(docxPath)) {
            fs.unlinkSync(docxPath);
          }

          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
          }

          console.log("Arquivos de geração removidos.");
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

  // ========================================
  // PROTEGE TEMPORARIAMENTE
  // TODOS OS {{CAMPO}}
  // ========================================

  xml = xml.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match) => {
    const id = `___DOCX_PLACEHOLDER_${marcadores.length}___`;

    marcadores.push(match);

    return id;
  });

  // ========================================
  // ESCAPA CHAVES SOLTAS
  // ========================================

  xml = xml.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");

  // ========================================
  // RESTAURA PLACEHOLDERS
  // ========================================

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
//
// O documento base continua disponível
// enquanto estiver dentro do tempo limite.
//
// O limite agora considera o ÚLTIMO USO.
//
// Então:
//
// importar
// ↓
// gerar
// ↓
// gerar novamente
// ↓
// gerar novamente
//
// Cada geração renova o tempo.
//
// ==========================================

setInterval(
  () => {
    const agora = Date.now();

    const limite = 30 * 60 * 1000;

    for (const [id, arquivo] of arquivosTemporarios) {
      const ultimaAtividade = arquivo.ultimoUso || arquivo.criadoEm;

      if (agora - ultimaAtividade > limite) {
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

  console.log(`Servidor rodando na porta ${PORT}`);

  console.log("==========================================");
});
