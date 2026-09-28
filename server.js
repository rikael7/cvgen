const express = require("express");
const path = require("path");

const cvRoutes = require("./routes/cvRoutes");

const app = express();

const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARES
// ==========================================

app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

// ==========================================
// ROTAS
// ==========================================

app.use("/api", cvRoutes);

// ==========================================
// ROTA PRINCIPAL
// ==========================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// ==========================================
// SERVIDOR
// ==========================================

app.listen(PORT, () => {
  console.log("");
  console.log(
    "=========================================="
  );
  console.log(
    `Servidor rodando em http://localhost:${PORT}`
  );
  console.log(
    "=========================================="
  );
});