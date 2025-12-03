const express = require("express");
const productController = require("../controllers/productController");
const upload = require("../middleware/upload");
const imageUpload = require("../middleware/imageUpload");

const router = express.Router();

router.get("/search", productController.searchProducts);
router.get("/", productController.getProducts);
router.post("/", imageUpload.single("image"), productController.createProduct);
router.post(
  "/bulk-upload",
  upload.single("file"),
  productController.bulkUploadProducts
);
router.get("/:id", productController.getProductById);
router.put("/:id", imageUpload.single("image"), productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

module.exports = router;
