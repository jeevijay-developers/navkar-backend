const mongoose = require("mongoose");

const QuotationItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    productImageUrl: {
      type: String,
      default: "",
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    variant: {
      sizeLabel: String,
      brimfulCapacity: String,
      neckSize: String,
      totalHeight: String,
      diameter: String,
      labelHeight: String,
      standardWeight: String,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const QuotationSchema = new mongoose.Schema(
  {
    quotationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    userId: {
      type: String,
      required: false,
      trim: true,
    },
    userDetails: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      companyName: {
        type: String,
        trim: true,
      },
      address: {
        type: String,
        trim: true,
      },
    },
    items: {
      type: [QuotationItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "At least one item is required",
      },
    },
    pricing: {
      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },
      taxRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      taxAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
      discount: {
        type: Number,
        default: 0,
        min: 0,
      },
      total: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    status: {
      type: String,
      enum: ["draft", "sent", "viewed", "accepted", "rejected", "expired"],
      default: "draft",
    },
    pdfUrl: {
      type: String,
      default: "",
    },
    pdfPublicId: {
      type: String,
      default: "",
    },
    whatsappUserStatus: {
      sent: {
        type: Boolean,
        default: false,
      },
      sentAt: {
        type: Date,
      },
      messageId: {
        type: String,
      },
      error: {
        type: String,
      },
    },
    whatsappCompanyStatus: {
      sent: {
        type: Boolean,
        default: false,
      },
      sentAt: {
        type: Date,
      },
      messageId: {
        type: String,
      },
      error: {
        type: String,
      },
    },
    validUntil: {
      type: Date,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

QuotationSchema.index({ quotationNumber: 1 });
QuotationSchema.index({ userId: 1 });
QuotationSchema.index({ status: 1 });
QuotationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Quotation", QuotationSchema);
