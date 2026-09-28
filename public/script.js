const arquivoInput = document.getElementById("arquivo");

const btnImportar = document.getElementById("btnImportar");

const status = document.getElementById("status");

const areaCampos = document.getElementById("areaCampos");

const camposContainer = document.getElementById("campos");

const formCampos = document.getElementById("formCampos");

const nomeEmpresa = document.getElementById("nomeEmpresa");

let arquivoAtual = null;

// ==========================================
// LER RESPOSTA
// ==========================================

async function lerResposta(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await response.json();
  }

  const texto = await response.text();

  console.error("Resposta inesperada:", texto);

  throw new Error(`O servidor não retornou JSON. HTTP ${response.status}.`);
}

// ==========================================
// IMPORTAR
// ==========================================

btnImportar.addEventListener("click", async () => {
  const arquivo = arquivoInput.files[0];

  if (!arquivo) {
    status.textContent = "Selecione um arquivo DOCX.";

    status.className = "status erro";

    return;
  }

  if (!arquivo.name.toLowerCase().endsWith(".docx")) {
    status.textContent = "O arquivo precisa ser um DOCX.";

    status.className = "status erro";

    return;
  }

  const formData = new FormData();

  formData.append("curriculo", arquivo);

  btnImportar.disabled = true;

  btnImportar.textContent = "Analisando...";

  status.textContent = "Analisando currículo...";

  status.className = "status";

  areaCampos.style.display = "none";

  try {
    const response = await fetch("/api/importar", {
      method: "POST",

      body: formData,
    });

    const resultado = await lerResposta(response);

    if (!response.ok) {
      throw new Error(
        resultado.detalhes || resultado.erro || "Erro ao importar currículo.",
      );
    }

    arquivoAtual = resultado.arquivo;

    criarCampos(resultado.campos || []);

    areaCampos.style.display = "block";

    status.textContent = `Currículo importado: ${resultado.nomeOriginal}`;

    status.className = "status sucesso";
  } catch (error) {
    console.error("Erro ao importar:", error);

    status.textContent = error.message;

    status.className = "status erro";

    arquivoAtual = null;
  } finally {
    btnImportar.disabled = false;

    btnImportar.textContent = "Importar currículo";
  }
});

// ==========================================
// CRIAR CAMPOS
// ==========================================

function criarCampos(campos) {
  camposContainer.innerHTML = "";

  if (!campos.length) {
    camposContainer.innerHTML = `

            <div class="aviso">

                <strong>
                    Nenhum marcador encontrado.
                </strong>

                <p>
                    No Word, use campos como:
                </p>

                <code>{{OBJETIVO}}</code>
                <code>{{RESUMO}}</code>
                <code>{{COMPETENCIAS}}</code>

            </div>

        `;

    return;
  }

  campos.forEach((campo) => {
    const div = document.createElement("div");

    div.className = "campo";

    const label = document.createElement("label");

    label.textContent = campo;

    const marcador = document.createElement("small");

    marcador.textContent = `Marcador: {{${campo}}}`;

    const textarea = document.createElement("textarea");

    textarea.name = campo;

    textarea.placeholder = `Digite o conteúdo de ${campo}...`;

    div.appendChild(label);

    div.appendChild(marcador);

    div.appendChild(textarea);

    camposContainer.appendChild(div);
  });
}

// ==========================================
// GERAR PDF
// ==========================================

formCampos.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!arquivoAtual) {
    alert("Importe um currículo primeiro.");

    return;
  }

  const empresa = nomeEmpresa.value.trim();

  if (!empresa) {
    alert("Digite o nome da empresa.");

    nomeEmpresa.focus();

    return;
  }

  // ----------------------------------
  // COLETA CAMPOS
  // ----------------------------------

  const valores = {};

  const inputs = formCampos.querySelectorAll("textarea");

  inputs.forEach((input) => {
    valores[input.name] = input.value;
  });

  console.log("Valores:", valores);

  console.log("Empresa:", empresa);

  // ----------------------------------
  // BOTÃO
  // ----------------------------------

  const botao = formCampos.querySelector("button");

  botao.disabled = true;

  botao.textContent = "Gerando PDF...";

  try {
    const response = await fetch("/api/gerar", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        arquivo: arquivoAtual,

        valores: valores,

        nomeEmpresa: empresa,
      }),
    });

    if (!response.ok) {
      const resultado = await lerResposta(response);

      throw new Error(
        resultado.detalhes || resultado.erro || "Erro ao gerar currículo.",
      );
    }

    // ----------------------------------
    // RECEBE PDF
    // ----------------------------------

    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    /*
     * O servidor já envia o nome
     * correto no Content-Disposition.
     */

    link.download = `Curriculo_${empresa}.pdf`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    window.URL.revokeObjectURL(url);

    status.textContent = "Currículo gerado com sucesso!";

    status.className = "status sucesso";
  } catch (error) {
    console.error("Erro ao gerar:", error);

    alert("Erro ao gerar currículo:\n\n" + error.message);
  } finally {
    botao.disabled = false;

    botao.textContent = "Gerar currículo em PDF";
  }
});
