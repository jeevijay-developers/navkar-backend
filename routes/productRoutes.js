const express = require("express");
const productController = require("../controllers/productController");
const upload = require("../middleware/upload");

const router = express.Router();

router.get("/", productController.getProducts);
router.post("/", productController.createProduct);
router.post(
  "/bulk-upload",
  upload.single("file"),
  productController.bulkUploadProducts
);
router.get("/:id", productController.getProductById);
router.put("/:id", productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

module.exports = router;
