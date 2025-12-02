const mongoose = require("mongoose");
const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const Quotation = require("../models/Quotation");
const Product = require("../models/Product");
const asyncHandler = require("../utils/asyncHandler");
const { generatePDF } = require("../utils/pdfGenerator");
const { uploadPDFFromPath } = require("../utils/cloudinaryPDF");
const {
  sendQuotationToUser,
  sendQuotationToCompany,
} = require("../services/whatsappService");

const generateQuotationNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `QT${timestamp}${random}`;
};

const validateAndProcessItems = async (items) => {
  const processedItems = [];

  for (const item of items) {
    if (!item.productId || !item.quantity) {
      throw new Error("Each item must have productId and quantity");
    }

    const product = await Product.findById(item.productId);
    if (!product) {
      throw new Error(`Product with ID ${item.productId} not found`);
    }

    const unitPrice = item.unitPrice || 0;
    const quantity = parseInt(item.quantity, 10);
    const totalPrice = unitPrice * quantity;

    processedItems.push({
      productId: product._id,
      productName: product.name,
      productImageUrl: product.imageUrl || "",
      quantity,
      unitPrice,
      totalPrice,
      variant: item.variant || {},
      notes: item.notes || "",
    });
  }

  return processedItems;
};

const calculatePricing = (items, taxRate = 0, discount = 0) => {
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountAmount = discount;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = (taxableAmount * taxRate) / 100;
  const total = taxableAmount + taxAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxRate,
    taxAmount: Math.round(taxAmount * 100) / 100,
    discount: Math.round(discountAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
};

const createQuotation = asyncHandler(async (req, res) => {
  const {
    userId,
    userDetails,
    items,
    taxRate = 0,
    discount = 0,
    validUntil,
    notes,
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: "Items array is required and must not be empty",
    });
  }

  if (!userDetails || !userDetails.name || !userDetails.phone) {
    return res.status(400).json({
      message: "userDetails with name and phone are required",
    });
  }

  const processedItems = await validateAndProcessItems(items);
  const pricing = calculatePricing(processedItems, taxRate, discount);

  const quotationNumber = generateQuotationNumber();

  let validUntilDate = null;
  if (validUntil) {
    validUntilDate = new Date(validUntil);
    if (isNaN(validUntilDate.getTime())) {
      return res.status(400).json({ message: "Invalid validUntil date format" });
    }
  } else {
    validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + 30);
  }

  const quotationData = {
    quotationNumber,
    userId: userId || null,
    userDetails: {
      name: userDetails.name.trim(),
      email: userDetails.email?.trim() || "",
      phone: userDetails.phone.trim(),
      companyName: userDetails.companyName?.trim() || "",
      address: userDetails.address?.trim() || "",
    },
    items: processedItems,
    pricing,
    status: "draft",
    validUntil: validUntilDate,
    notes: notes?.trim() || "",
  };

  const quotation = await Quotation.create(quotationData);

  let pdfPath = null;
  let pdfUploadResult = null;

  try {
    const tempDir = os.tmpdir();
    pdfPath = path.join(tempDir, `quotation-${quotation._id}-${Date.now()}.pdf`);

    await generatePDF(quotation, pdfPath);

    pdfUploadResult = await uploadPDFFromPath(pdfPath, "");

    if (pdfUploadResult) {
      quotation.pdfUrl = pdfUploadResult.url;
      quotation.pdfPublicId = pdfUploadResult.publicId;
      await quotation.save();
    }
  } catch (pdfError) {
    console.error("PDF generation/upload error:", pdfError);
    return res.status(500).json({
      message: "Quotation created but PDF generation failed",
      quotation: quotation.toObject(),
      error: pdfError.message,
    });
  } finally {
    if (pdfPath) {
      try {
        await fs.unlink(pdfPath);
      } catch (unlinkError) {
        console.error("Failed to delete temp PDF:", unlinkError);
      }
    }
  }

  const sendWhatsApp = req.body.sendWhatsApp !== false;

  if (sendWhatsApp && quotation.pdfUrl) {
    try {
      const userResult = await sendQuotationToUser(quotation);
      quotation.whatsappUserStatus = {
        sent: userResult.success,
        sentAt: userResult.success ? new Date() : null,
        messageId: userResult.messageId || null,
        error: userResult.error || null,
      };

      const companyResult = await sendQuotationToCompany(quotation);
      quotation.whatsappCompanyStatus = {
        sent: companyResult.success,
        sentAt: companyResult.success ? new Date() : null,
        messageId: companyResult.messageId || null,
        error: companyResult.error || null,
      };

      if (userResult.success || companyResult.success) {
        quotation.status = "sent";
      }

      await quotation.save();
    } catch (whatsappError) {
      console.error("WhatsApp sending error:", whatsappError);
    }
  }

  res.status(201).json({
    message: "Quotation created successfully",
    quotation: quotation.toObject(),
  });
});

const getQuotationById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid quotation ID" });
  }

  const quotation = await Quotation.findById(id).populate(
    "items.productId",
    "name imageUrl"
  );

  if (!quotation) {
    return res.status(404).json({ message: "Quotation not found" });
  }

  res.json({ quotation: quotation.toObject() });
});

const getQuotations = asyncHandler(async (req, res) => {
  const {
    userId,
    status,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = req.query;

  const query = {};

  if (userId) {
    query.userId = userId;
  }

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const [quotations, total] = await Promise.all([
    Quotation.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Quotation.countDocuments(query),
  ]);

  res.json({
    quotations,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

const resendWhatsApp = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sendToUser = true, sendToCompany = true } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid quotation ID" });
  }

  const quotation = await Quotation.findById(id);

  if (!quotation) {
    return res.status(404).json({ message: "Quotation not found" });
  }

  if (!quotation.pdfUrl) {
    return res
      .status(400)
      .json({ message: "PDF not available for this quotation" });
  }

  const results = {
    user: null,
    company: null,
  };

  if (sendToUser) {
    const userResult = await sendQuotationToUser(quotation);
    quotation.whatsappUserStatus = {
      sent: userResult.success,
      sentAt: userResult.success ? new Date() : null,
      messageId: userResult.messageId || null,
      error: userResult.error || null,
    };
    results.user = userResult;
  }

  if (sendToCompany) {
    const companyResult = await sendQuotationToCompany(quotation);
    quotation.whatsappCompanyStatus = {
      sent: companyResult.success,
      sentAt: companyResult.success ? new Date() : null,
      messageId: companyResult.messageId || null,
      error: companyResult.error || null,
    };
    results.company = companyResult;
  }

  if (results.user?.success || results.company?.success) {
    quotation.status = "sent";
  }

  await quotation.save();

  res.json({
    message: "WhatsApp messages sent",
    results,
  });
});

const getQuotationPDF = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid quotation ID" });
  }

  const quotation = await Quotation.findById(id);

  if (!quotation) {
    return res.status(404).json({ message: "Quotation not found" });
  }

  if (!quotation.pdfUrl) {
    return res.status(404).json({ message: "PDF not available for this quotation" });
  }

  res.redirect(quotation.pdfUrl);
});

module.exports = {
  createQuotation,
  getQuotationById,
  getQuotations,
  resendWhatsApp,
  getQuotationPDF,
};

