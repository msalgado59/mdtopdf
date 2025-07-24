// .netlify/functions/pdf.js
// Markdown → HTML → PDF (léger, sans puppeteer ni phantomjs)
import { marked } from 'marked';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Configuration du marked (sécurité + HTML autorisé)
marked.setOptions({
  gfm: true,
  breaks: true,
  sanitize: false, // Attention : désactivé => tu maîtrises l'input
});

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
    // 1. Convertir Markdown → HTML
    const htmlContent = marked.parse(markdown);

    // 2. Créer un PDF avec jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // 3. Style simple (tu peux enrichir)
    const style = `
      <style>
        body { font-family: helvetica; font-size: 12px; line-height: 1.4; }
        h1 { font-size: 18px; margin: 10px 0; }
        h2 { font-size: 16px; margin: 8px 0; }
        p { margin: 6px 0; }
        pre { background: #f4f4f4; padding: 5px; border-radius: 3px; }
        code { font-family: monospace; }
      </style>
    `;

    // 4. Injecter HTML dans le PDF
    // jsPDF ne supporte pas tout → on fait simple : on ajoute du texte
    // Ici on simule un rendu "proche" du HTML
    const lines = doc.splitTextToSize(htmlContent.replace(/<\/?[^>]+(>|$)/g, ''), 180);
    doc.text(lines, 15, 20);

    // 5. Générer le PDF en buffer
    const pdfBuffer = doc.output('arraybuffer');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document.pdf"',
      },
      body: Buffer.from(pdfBuffer).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'PDF generation failed', details: error.message }),
    };
  }
};
