const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs/promises");
const handlebars = require("handlebars");

const generateQuotationHTML = (quotation) => {
  handlebars.registerHelper("inc", (value) => {
    return parseInt(value, 10) + 1;
  });

  handlebars.registerHelper("formatCurrency", (value) => {
    if (typeof value !== "number") return value;
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  });

  const template = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quotation #{{quotationNumber}}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #333;
      line-height: 1.6;
      background: #fff;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 30px;
    }
    .header {
      border-bottom: 3px solid #2c3e50;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2c3e50;
      font-size: 28px;
      margin-bottom: 5px;
    }
    .quotation-number {
      color: #7f8c8d;
      font-size: 14px;
      margin-top: 5px;
    }
    .company-info {
      margin-bottom: 30px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 5px;
    }
    .company-info h2 {
      color: #2c3e50;
      font-size: 18px;
      margin-bottom: 10px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 30px;
    }
    .info-section h3 {
      color: #34495e;
      font-size: 16px;
      margin-bottom: 10px;
      border-bottom: 2px solid #ecf0f1;
      padding-bottom: 5px;
    }
    .info-section p {
      margin: 5px 0;
      color: #555;
      font-size: 14px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
      background: #fff;
    }
    .items-table thead {
      background: #2c3e50;
      color: #fff;
    }
    .items-table th,
    .items-table td {
      padding: 12px;
      text-align: left;
      border: 1px solid #ddd;
    }
    .items-table th {
      font-weight: 600;
      font-size: 14px;
    }
    .items-table td {
      font-size: 13px;
    }
    .items-table tbody tr:nth-child(even) {
      background: #f8f9fa;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .pricing-summary {
      margin-top: 30px;
      margin-left: auto;
      width: 300px;
    }
    .pricing-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #ecf0f1;
    }
    .pricing-row:last-of-type {
      border-bottom: none;
    }
    .pricing-row.total {
      font-weight: bold;
      font-size: 18px;
      color: #2c3e50;
      padding-top: 10px;
      border-top: 2px solid #2c3e50;
    }
    .pricing-label {
      color: #555;
    }
    .pricing-value {
      color: #333;
      font-weight: 500;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #ecf0f1;
      font-size: 12px;
      color: #7f8c8d;
      text-align: center;
    }
    .notes {
      margin-top: 30px;
      padding: 15px;
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      border-radius: 4px;
    }
    .notes h4 {
      color: #856404;
      margin-bottom: 8px;
    }
    .notes p {
      color: #856404;
      font-size: 13px;
    }
    .status-badge {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-draft {
      background: #e9ecef;
      color: #495057;
    }
    .status-sent {
      background: #d1ecf1;
      color: #0c5460;
    }
    .status-accepted {
      background: #d4edda;
      color: #155724;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>QUOTATION</h1>
      <div class="quotation-number">Quotation #{{quotationNumber}}</div>
      <div style="margin-top: 10px;">
        <span class="status-badge status-{{status}}">{{status}}</span>
      </div>
    </div>

    <div class="company-info">
      <h2>{{companyName}}</h2>
      <p>{{companyAddress}}</p>
      <p>Phone: {{companyPhone}}</p>
      <p>Email: {{companyEmail}}</p>
    </div>

    <div class="info-grid">
      <div class="info-section">
        <h3>Bill To</h3>
        <p><strong>{{userDetails.name}}</strong></p>
        {{#if userDetails.companyName}}
        <p>{{userDetails.companyName}}</p>
        {{/if}}
        {{#if userDetails.address}}
        <p>{{userDetails.address}}</p>
        {{/if}}
        <p>Phone: {{userDetails.phone}}</p>
        {{#if userDetails.email}}
        <p>Email: {{userDetails.email}}</p>
        {{/if}}
      </div>
      <div class="info-section">
        <h3>Quotation Details</h3>
        <p><strong>Date:</strong> {{quotationDate}}</p>
        {{#if validUntil}}
        <p><strong>Valid Until:</strong> {{validUntil}}</p>
        {{/if}}
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%;">#</th>
          <th style="width: 30%;">Product</th>
          <th style="width: 20%;">Variant</th>
          <th style="width: 10%;" class="text-center">Qty</th>
          <th style="width: 15%;" class="text-right">Unit Price</th>
          <th style="width: 20%;" class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
        <tr>
          <td>{{inc @index}}</td>
          <td>
            <strong>{{productName}}</strong>
            {{#if notes}}
            <br><small style="color: #7f8c8d;">{{notes}}</small>
            {{/if}}
          </td>
          <td>
            {{#if variant.sizeLabel}}
            <small>Size: {{variant.sizeLabel}}</small>
            {{/if}}
          </td>
          <td class="text-center">{{quantity}}</td>
          <td class="text-right">₹{{formatCurrency unitPrice}}</td>
          <td class="text-right"><strong>₹{{formatCurrency totalPrice}}</strong></td>
        </tr>
        {{/each}}
      </tbody>
    </table>

    <div class="pricing-summary">
      <div class="pricing-row">
        <span class="pricing-label">Subtotal:</span>
        <span class="pricing-value">₹{{formatCurrency pricing.subtotal}}</span>
      </div>
      {{#if pricing.discount}}
      <div class="pricing-row">
        <span class="pricing-label">Discount:</span>
        <span class="pricing-value">-₹{{formatCurrency pricing.discount}}</span>
      </div>
      {{/if}}
      {{#if pricing.taxAmount}}
      <div class="pricing-row">
        <span class="pricing-label">Tax ({{pricing.taxRate}}%):</span>
        <span class="pricing-value">₹{{formatCurrency pricing.taxAmount}}</span>
      </div>
      {{/if}}
      <div class="pricing-row total">
        <span>Total:</span>
        <span>₹{{formatCurrency pricing.total}}</span>
      </div>
    </div>

    {{#if notes}}
    <div class="notes">
      <h4>Notes:</h4>
      <p>{{notes}}</p>
    </div>
    {{/if}}

    <div class="footer">
      <p>Thank you for your business!</p>
      <p>This quotation is valid until the date specified above.</p>
    </div>
  </div>
</body>
</html>
  `;

  const compiled = handlebars.compile(template);
  
  const companyName = process.env.COMPANY_NAME || "Navkar Industries";
  const companyAddress = process.env.COMPANY_ADDRESS || "";
  const companyPhone = process.env.COMPANY_PHONE || "";
  const companyEmail = process.env.COMPANY_EMAIL || "";

  const quotationDate = new Date(quotation.createdAt || Date.now()).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const validUntil = quotation.validUntil
    ? new Date(quotation.validUntil).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return compiled({
    ...quotation.toObject(),
    quotationNumber: quotation.quotationNumber,
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
    quotationDate,
    validUntil,
  });
};

const generatePDF = async (quotation, outputPath) => {
  const html = generateQuotationHTML(quotation);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = {
  generatePDF,
};

