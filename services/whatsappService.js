const axios = require("axios");

const WHATSAPP_API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;

const getAccessToken = () => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is not configured");
  }
  return token;
};

const getPhoneNumberId = () => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is not configured");
  }
  return phoneNumberId;
};

const getCompanyPhoneNumber = () => {
  return process.env.COMPANY_WHATSAPP_NUMBER || "";
};

const formatPhoneNumber = (phone) => {
  if (!phone) {
    return null;
  }
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }
  if (!cleaned.startsWith("91") && cleaned.length === 10) {
    cleaned = "91" + cleaned;
  }
  return cleaned;
};

const sendDocumentMessage = async (to, documentUrl, filename, caption = "") => {
  const accessToken = getAccessToken();
  const phoneNumberId = getPhoneNumberId();
  const formattedPhone = formatPhoneNumber(to);

  if (!formattedPhone) {
    throw new Error("Invalid phone number format");
  }

  const url = `${BASE_URL}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "document",
    document: {
      link: documentUrl,
      filename: filename,
      caption: caption,
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return {
      success: true,
      messageId: response.data.messages?.[0]?.id || null,
      data: response.data,
    };
  } catch (error) {
    console.error("WhatsApp API Error:", error.response?.data || error.message);
    return {
      success: false,
      error:
        error.response?.data?.error?.message ||
        error.message ||
        "Failed to send WhatsApp message",
      data: error.response?.data || null,
    };
  }
};

const sendTextMessage = async (to, text) => {
  const accessToken = getAccessToken();
  const phoneNumberId = getPhoneNumberId();
  const formattedPhone = formatPhoneNumber(to);

  if (!formattedPhone) {
    throw new Error("Invalid phone number format");
  }

  const url = `${BASE_URL}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "text",
    text: {
      body: text,
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return {
      success: true,
      messageId: response.data.messages?.[0]?.id || null,
      data: response.data,
    };
  } catch (error) {
    console.error("WhatsApp API Error:", error.response?.data || error.message);
    return {
      success: false,
      error:
        error.response?.data?.error?.message ||
        error.message ||
        "Failed to send WhatsApp message",
      data: error.response?.data || null,
    };
  }
};

const sendQuotationToUser = async (quotation) => {
  const userPhone = quotation.userDetails?.phone;
  if (!userPhone) {
    return {
      success: false,
      error: "User phone number not found in quotation",
    };
  }

  if (!quotation.pdfUrl) {
    return {
      success: false,
      error: "PDF URL not found in quotation",
    };
  }

  const filename = `Quotation_${quotation.quotationNumber}.pdf`;
  const caption = `Hello ${quotation.userDetails.name},\n\nYour quotation #${quotation.quotationNumber} is ready.\n\nTotal Amount: ₹${quotation.pricing.total}\n\nPlease find the attached quotation document.\n\nThank you for your interest!`;

  return await sendDocumentMessage(
    userPhone,
    quotation.pdfUrl,
    filename,
    caption
  );
};

const sendQuotationToCompany = async (quotation) => {
  const companyPhone = getCompanyPhoneNumber();
  if (!companyPhone) {
    console.warn(
      "Company WhatsApp number not configured. Skipping company notification."
    );
    return {
      success: false,
      error: "Company WhatsApp number not configured",
    };
  }

  if (!quotation.pdfUrl) {
    return {
      success: false,
      error: "PDF URL not found in quotation",
    };
  }

  const filename = `Quotation_${quotation.quotationNumber}_${quotation.userDetails.name}.pdf`;
  const caption = `New Quotation Request\n\nQuotation #${quotation.quotationNumber}\nCustomer: ${quotation.userDetails.name}\nPhone: ${quotation.userDetails.phone}\nTotal Amount: ₹${quotation.pricing.total}\n\nPlease review the attached quotation.`;

  return await sendDocumentMessage(
    companyPhone,
    quotation.pdfUrl,
    filename,
    caption
  );
};

module.exports = {
  sendQuotationToUser,
  sendQuotationToCompany,
  sendTextMessage,
  sendDocumentMessage,
};
