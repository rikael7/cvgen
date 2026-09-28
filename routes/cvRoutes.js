const express = require("express");
const multer = require("multer");

const cvController = require("../controllers/cvController");

const router = express.Router();

// ==========================================
// UPLOAD
// ==========================================

const upload = multer({
  storage: multer.memoryStorage(),
});

// ==========================================
// IMPORTAR CURRÍCULO
// ==========================================

router.post(
  "/importar",
  upload.single("curriculo"),
  cvController.importar
);

// ==========================================
// GERAR CURRÍCULO
// ==========================================

router.post(
  "/gerar",
  cvController.gerar
);

module.exports = router;