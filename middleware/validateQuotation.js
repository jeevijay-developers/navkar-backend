const validateCreateQuotation = (req, res, next) => {
  const { userDetails, items } = req.body;

  const errors = [];

  if (!userDetails) {
    errors.push("userDetails is required");
  } else {
    if (!userDetails.name || typeof userDetails.name !== "string" || !userDetails.name.trim()) {
      errors.push("userDetails.name is required and must be a non-empty string");
    }
    if (!userDetails.phone || typeof userDetails.phone !== "string" || !userDetails.phone.trim()) {
      errors.push("userDetails.phone is required and must be a non-empty string");
    }
    if (userDetails.email && typeof userDetails.email !== "string") {
      errors.push("userDetails.email must be a string");
    }
    if (userDetails.companyName && typeof userDetails.companyName !== "string") {
      errors.push("userDetails.companyName must be a string");
    }
    if (userDetails.address && typeof userDetails.address !== "string") {
      errors.push("userDetails.address must be a string");
    }
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.push("items is required and must be a non-empty array");
  } else {
    items.forEach((item, index) => {
      if (!item.productId) {
        errors.push(`items[${index}].productId is required`);
      }
      if (!item.quantity || typeof item.quantity !== "number" || item.quantity < 1) {
        errors.push(`items[${index}].quantity is required and must be a positive number`);
      }
      if (item.unitPrice !== undefined && (typeof item.unitPrice !== "number" || item.unitPrice < 0)) {
        errors.push(`items[${index}].unitPrice must be a non-negative number`);
      }
    });
  }

  if (req.body.taxRate !== undefined) {
    if (typeof req.body.taxRate !== "number" || req.body.taxRate < 0 || req.body.taxRate > 100) {
      errors.push("taxRate must be a number between 0 and 100");
    }
  }

  if (req.body.discount !== undefined) {
    if (typeof req.body.discount !== "number" || req.body.discount < 0) {
      errors.push("discount must be a non-negative number");
    }
  }

  if (req.body.validUntil) {
    const validUntilDate = new Date(req.body.validUntil);
    if (isNaN(validUntilDate.getTime())) {
      errors.push("validUntil must be a valid date string");
    }
  }

  if (req.body.notes && typeof req.body.notes !== "string") {
    errors.push("notes must be a string");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Validation failed",
      errors,
    });
  }

  next();
};

module.exports = {
  validateCreateQuotation,
};

