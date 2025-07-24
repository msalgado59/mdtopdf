// .netlify/functions/pdf.js
// Convertit du Markdown reçu en POST → en PDF
import { mdToPdf } from 'md-to-pdf';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const markdown = event.body;

  if (!markdown) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing markdown content' }),
    };
  }

  try {
    const pdfBuffer = await mdToPdf({ content: markdown }).toBuffer();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document.pdf"',
      },
      body: pdfBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'PDF generation failed' }),
    };
  }
};
