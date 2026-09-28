# CVGen

Sistema para geração de currículos personalizados a partir de um modelo `.docx` com **placeholders**.

O usuário envia um currículo base, o sistema identifica automaticamente os campos existentes no documento, apresenta esses campos para preenchimento e, ao finalizar, gera um novo documento e o converte para **PDF**.

## 📌 Sobre o projeto

O CVGen foi desenvolvido para facilitar a criação de diferentes versões de um currículo utilizando um único documento base.

Em vez de editar manualmente o currículo toda vez que for necessário adaptar informações como:

- Objetivo
- Resumo profissional
- Competências
- Experiências
- Cursos
- Palavras-chave
- Cargo desejado

o sistema utiliza placeholders dentro de um documento Word.

Exemplo:

```text
{{nome}}

{{palavrachave1}} | {{palavrachave2}} | {{palavrachave3}}

{{objetivo}}

{{resumo}}

{{experiencia1}}

{{experiencia2}}
```

Durante a geração, cada placeholder é substituído pelo valor informado pelo usuário.

---

# 🚀 Tecnologias

O projeto utiliza:

- **Node.js**
- **Express**
- **JavaScript**
- **Multer**
- **PizZip**
- **Docxtemplater**
- **LibreOffice**

Dependências principais:

```text
express
multer
pizzip
docxtemplater
cors
nodemon
```

O `package.json` atual utiliza CommonJS e possui o script de desenvolvimento com Nodemon.

---

# 📋 Requisitos

Antes de executar o projeto, é necessário ter instalado:

### Node.js

Instale o Node.js em:

https://nodejs.org/

Depois verifique:

```bash
node -v
```

e:

```bash
npm -v
```

### LibreOffice

O LibreOffice é necessário porque o sistema utiliza o executável `soffice.exe` para converter o documento `.docx` gerado em PDF.

O projeto atualmente utiliza:

```text
C:\Program Files\LibreOffice\program\soffice.exe
```

Portanto, no Windows, o LibreOffice deve estar instalado nesse caminho ou o caminho deverá ser alterado no código.

---

# 📥 Instalação

Clone o repositório:

```bash
git clone https://github.com/rikael7/cvgen.git
```

Entre na pasta:

```bash
cd cvgen
```

Instale as dependências:

```bash
npm install
```

---

# ▶️ Executando o projeto

Para iniciar o servidor em modo de desenvolvimento:

```bash
npm run dev
```

O servidor será iniciado em:

```text
http://localhost:3000
```

Também é possível iniciar diretamente:

```bash
node server.js
```

Ao iniciar, o terminal deverá informar:

```text
Servidor rodando em http://localhost:3000
```

---

# 📁 Estrutura do projeto

A estrutura atual é simples:

```text
cvgen/
│
├── public/
│   └── index.html
│
├── temp/
│
├── .gitignore
├── package-lock.json
├── package.json
├── server.js
└── README.md
```

## `public/`

Contém o front-end da aplicação.

O arquivo:

```text
public/index.html
```

é utilizado como interface principal do sistema.

O Express disponibiliza essa pasta como conteúdo estático.

---

## `server.js`

É o back-end da aplicação.

Ele é responsável por:

- receber o currículo;
- validar o arquivo;
- identificar placeholders;
- armazenar temporariamente o documento;
- receber os valores preenchidos;
- substituir os placeholders;
- gerar o `.docx`;
- converter o `.docx` para `.pdf`;
- enviar o PDF para o usuário;
- remover arquivos temporários.

---

## `temp/`

É utilizado durante o processo de geração.

O sistema cria temporariamente:

```text
arquivo.docx
arquivo.pdf
```

Depois que o PDF é enviado, esses arquivos são removidos.

---

# 🧩 Como funciona o modelo

O currículo base deve ser um arquivo `.docx`.

Dentro dele, os campos devem ser escritos utilizando:

```text
{{nome_do_campo}}
```

Por exemplo:

```text
{{nome}}

{{palavrachave1}} | {{palavrachave2}} | {{palavrachave3}}

{{objetivo}}

{{resumo}}
```

Os nomes dos campos são detectados automaticamente pelo sistema.

---

# 🔄 Fluxo da aplicação

O funcionamento pode ser resumido da seguinte forma:

```text
┌─────────────────────────────┐
│           USUÁRIO           │
│                             │
│ Seleciona currículo .DOCX   │
└──────────────┬──────────────┘
               │
               │ Upload
               ▼
┌─────────────────────────────┐
│          EXPRESS            │
│                             │
│ POST /api/importar          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│           PizZip            │
│                             │
│ Abre o arquivo DOCX         │
│ e acessa document.xml       │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│     IDENTIFICA CAMPOS       │
│                             │
│ {{nome}}                    │
│ {{objetivo}}                │
│ {{resumo}}                  │
│ {{experiencia}}             │
└──────────────┬──────────────┘
               │
               │ campos
               ▼
┌─────────────────────────────┐
│          FRONT-END          │
│                             │
│ Usuário preenche os campos  │
└──────────────┬──────────────┘
               │
               │ valores
               ▼
┌─────────────────────────────┐
│          EXPRESS            │
│                             │
│ POST /api/gerar             │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│       DOCXTEMPLATER         │
│                             │
│ Substitui os placeholders   │
│ pelos valores informados    │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│            DOCX             │
│                             │
│ Currículo preenchido        │
└──────────────┬──────────────┘
               │
               │ LibreOffice
               ▼
┌─────────────────────────────┐
│            PDF              │
│                             │
│ Currículo final             │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│           USUÁRIO           │
│                             │
│ Recebe o PDF                │
└─────────────────────────────┘
```

---

# 🔍 Fluxo detalhado

## 1. Importação do currículo

O front-end envia o arquivo para:

```http
POST /api/importar
```

O campo utilizado no upload é:

```text
curriculo
```

O Multer recebe o arquivo utilizando armazenamento em memória.

O arquivo não é inicialmente salvo em uma pasta de uploads. O conteúdo é mantido em um `Buffer`.

---

## 2. Validação do documento

O sistema utiliza o PizZip para abrir o `.docx`.

Como um `.docx` é essencialmente um pacote ZIP contendo arquivos XML, o sistema verifica a existência de:

```text
word/document.xml
```

Caso esse arquivo não exista, o documento é considerado inválido.

---

## 3. Identificação dos placeholders

Depois de abrir o documento, o sistema extrai o texto de `document.xml`.

Em seguida procura por padrões como:

```text
{{nome}}
{{objetivo}}
{{resumo}}
```

A expressão utilizada identifica automaticamente esses campos.

Além disso, os espaços são normalizados.

Por exemplo:

```text
{{ palavra chave }}
```

é convertido internamente para:

```text
palavra_chave
```

Campos repetidos também não são adicionados mais de uma vez.

---

# 🆔 Arquivo temporário

Após a importação, o servidor cria um identificador único:

```text
crypto.randomUUID()
```

Esse identificador representa o currículo importado.

O servidor mantém temporariamente:

```text
ID
Buffer do documento
Nome original
Data de criação
```

em memória.

O front-end recebe o identificador e os campos encontrados.

---

# ✏️ Preenchimento

Depois que os campos são identificados, o usuário preenche as informações.

Por exemplo:

```json
{
  "nome": "Rikael Ribeiro",
  "objetivo": "Atuar na área de Tecnologia da Informação",
  "resumo": "Profissional com experiência em suporte técnico..."
}
```

Esses dados são enviados para:

```http
POST /api/gerar
```

---

# 🔄 Normalização dos dados

Antes de enviar os valores para o Docxtemplater, o sistema normaliza os nomes dos campos.

Por exemplo:

```text
Palavra Chave 1
```

é transformado em:

```text
Palavra_Chave_1
```

Valores vazios também são tratados como strings vazias.

Isso evita problemas durante a substituição dos placeholders.

---

# 🛡️ Proteção dos placeholders

O documento Word possui uma estrutura XML.

Por isso, chaves `{` e `}` presentes no documento podem interferir no processamento do Docxtemplater.

O sistema possui uma etapa de sanitização.

Primeiro, os placeholders válidos:

```text
{{nome}}
```

são temporariamente protegidos.

Depois, chaves soltas são escapadas.

Por fim, os placeholders originais são restaurados.

Isso permite que o documento continue utilizando:

```text
{{campo}}
```

sem que outras chaves presentes no XML causem problemas.

---

# 📄 Geração do DOCX

O Docxtemplater recebe os dados normalizados e renderiza o documento:

```text
{{nome}}
```

vira:

```text
Rikael Ribeiro
```

e:

```text
{{objetivo}}
```

vira:

```text
Atuar na área de Tecnologia da Informação
```

O resultado é convertido para um `Buffer`.

Esse Buffer representa o novo documento `.docx`.

---

# 📑 Conversão para PDF

Depois da geração do `.docx`, o sistema cria um diretório temporário:

```text
temp/
```

O documento é salvo temporariamente nesse diretório.

Depois o LibreOffice é executado em modo headless:

```text
soffice.exe
```

utilizando a conversão:

```text
DOCX → PDF
```

O PDF gerado é então localizado pelo servidor.

---

# 📤 Envio do PDF

Quando o PDF é encontrado, o servidor configura:

```http
Content-Type: application/pdf
```

e envia o arquivo para o navegador.

O usuário recebe o currículo final em PDF.

---

# 🧹 Limpeza dos arquivos

Depois do envio, o sistema remove os arquivos temporários:

```text
.docx
.pdf
```

Isso evita deixar arquivos gerados acumulados dentro do projeto.

Além disso, existe uma limpeza automática dos currículos armazenados temporariamente em memória.

Currículos que permanecerem no mapa por mais de:

```text
30 minutos
```

são removidos automaticamente.

Essa verificação ocorre a cada:

```text
10 minutos
```

---

# 🔌 API

## `POST /api/importar`

Importa um currículo `.docx` e identifica seus placeholders.

### Request

```text
multipart/form-data
```

Campo:

```text
curriculo
```

### Resposta

Exemplo:

```json
{
  "sucesso": true,
  "arquivo": "uuid",
  "nomeOriginal": "curriculo.docx",
  "campos": ["nome", "objetivo", "resumo", "experiencia"]
}
```

---

## `POST /api/gerar`

Gera o currículo preenchido e retorna o PDF.

### Request

```json
{
  "arquivo": "uuid",
  "valores": {
    "nome": "Rikael Ribeiro",
    "objetivo": "Atuar na área de TI",
    "resumo": "Profissional com experiência em suporte..."
  }
}
```

### Response

O endpoint retorna:

```text
application/pdf
```

contendo o currículo gerado.

---

# ⚠️ Observação importante sobre o LibreOffice

Atualmente o caminho do LibreOffice está definido diretamente no código:

```text
C:\Program Files\LibreOffice\program\soffice.exe
```

Isso significa que a aplicação está configurada especificamente para esse caminho no Windows.

Em outro computador, caso o LibreOffice esteja instalado em outro diretório, será necessário alterar essa configuração.

Para execução em servidores Linux ou plataformas de deploy, essa parte também precisa ser adaptada para o caminho do executável disponível no ambiente.

---

# 🔐 Arquivos temporários e privacidade

O currículo importado é mantido temporariamente em memória para permitir a geração do documento.

Os arquivos `.docx` e `.pdf` utilizados durante a conversão são temporários e são removidos após o processamento.

O sistema não utiliza banco de dados para armazenar currículos.

---

# 🎯 Objetivo do projeto

O objetivo do CVGen é transformar um currículo estático em um **modelo reutilizável**.

A ideia é separar:

```text
MODELO
   +
DADOS
   ↓
CURRÍCULO PERSONALIZADO
```

Assim, o mesmo currículo base pode ser utilizado para gerar diferentes versões sem precisar editar manualmente o documento original.

---

# 📌 Exemplo

Um modelo pode conter:

```text
{{nome}}

{{palavrachave1}} | {{palavrachave2}} | {{palavrachave3}}

OBJETIVO

{{objetivo}}

RESUMO PROFISSIONAL

{{resumo}}

EXPERIÊNCIA

{{experiencia1}}

{{experiencia2}}
```

O usuário informa os valores:

```text
nome = Rikael Ribeiro

palavrachave1 = Suporte Técnico

palavrachave2 = Infraestrutura

palavrachave3 = Troubleshooting

objetivo = Atuar na área de Tecnologia da Informação

resumo = Profissional com experiência em suporte...
```

O resultado será um novo currículo com os placeholders substituídos.

---

# 🛠️ Desenvolvimento

Para desenvolver o projeto:

```bash
npm install
```

Depois:

```bash
npm run dev
```

O Nodemon reinicia automaticamente o servidor quando os arquivos são alterados.

---

# 📄 Licença

Este projeto está atualmente publicado no GitHub sem uma licença open source específica definida no repositório.

---

# 👨‍💻 Autor

**Rikael Ribeiro de Araújo Moraes**

GitHub:

https://github.com/rikael7
