const cvService = require("../services/cvService");

// ==========================================
// IMPORTAR CURRÍCULO
// ==========================================

async function importar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        erro: "Nenhum arquivo enviado.",
      });
    }

    const resultado =
      cvService.importarCurriculo(
        req.file
      );

    return res.json({
      sucesso: true,
      arquivo: resultado.arquivo,
      nomeOriginal:
        resultado.nomeOriginal,
      campos: resultado.campos,
    });
  } catch (error) {
    console.error(
      "ERRO AO IMPORTAR:",
      error
    );

    return res.status(500).json({
      erro:
        "Erro ao processar o currículo.",
      detalhes: error.message,
    });
  }
}

// ==========================================
// GERAR CURRÍCULO
// ==========================================

async function gerar(req, res) {
  try {
    const {
      arquivo,
      valores,
    } = req.body;

    if (!arquivo) {
      return res.status(400).json({
        erro: "Arquivo não informado.",
      });
    }

    if (!valores) {
      return res.status(400).json({
        erro:
          "Valores dos campos não informados.",
      });
    }

    const resultado =
      cvService.gerarCurriculo(
        arquivo,
        valores
      );

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      'inline; filename="cv.pdf"'
    );

    return res.sendFile(
      resultado.pdfPath,
      (erro) => {
        if (erro) {
          console.error(
            "Erro ao enviar PDF:",
            erro
          );

          return;
        }

        // ==========================================
        // LIMPA SOMENTE OS ARQUIVOS GERADOS
        // ==========================================

        setTimeout(() => {
          cvService.limparArquivosGerados(
            resultado.docxPath,
            resultado.pdfPath
          );
        }, 1000);
      }
    );
  } catch (error) {
    console.error("");

    console.error(
      "=========================================="
    );

    console.error(
      "ERRO AO GERAR CURRÍCULO"
    );

    console.error(
      "=========================================="
    );

    console.error(error);

    return res.status(500).json({
      erro:
        "Erro ao gerar o currículo.",
      detalhes: error.message,
    });
  }
}

module.exports = {
  importar,
  gerar,
};