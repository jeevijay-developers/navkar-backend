const express = require("express");
const quotationController = require("../controllers/quotationController");
const { validateCreateQuotation } = require("../middleware/validateQuotation");

const router = express.Router();

router.post("/", validateCreateQuotation, quotationController.createQuotation);
router.get("/", quotationController.getQuotations);
router.get("/:id", quotationController.getQuotationById);
router.get("/:id/pdf", quotationController.getQuotationPDF);
router.post("/:id/resend-whatsapp", quotationController.resendWhatsApp);

module.exports = router;

