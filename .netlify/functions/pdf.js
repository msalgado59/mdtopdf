// .netlify/functions/pdf.js
// Version corrigée — Fonctionne sur Netlify
const marked = require('marked');
const pdfmake = require('pdfmake');

// ✅ Correction ici : les polices doivent être chargées comme ceci
const vfsFonts = require('pdfmake/build/vfs_fonts');
pdfmake.vfs = vfsFonts.pdfMake.vfs; // 👈 Pas de destructuring, on assigne directement
// ou : Object.assign(pdfmake.vfs, vfsFonts.pdfMake.vfs); si tu veux l'agrandir

module.exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify('Method Not Allowed') };
  }

  const markdown = event.body;

  if (!markdown) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing markdown content' }),
    };
  }

  try {
    const tokens = marked.lexer(markdown);
    const content = [];

    for (const token of tokens) {
      if (token.type === 'heading') {
        content.push({
          text: token.text,
          fontSize: 18 - (token.depth * 2),
          bold: true,
          margin: [0, 10, 0, 5],
        });
      } else if (token.type === 'text') {
        const inline = token.tokens || [];
        const chunks = inline.map(t => {
          if (t.type === 'text') return t.text;
          if (t.type === 'strong') return { text: t.text, bold: true };
          if (t.type === 'em') return { text: t.text, italics: true };
          if (t.type === 'codespan') return { text: t.text, font: 'Courier' };
          if (t.type === 'link') return { text: t.text, link: t.href, color: 'blue' };
          return t.text || '';
        });
        content.push({ text: chunks, margin: [0, 5] });
      } else if (token.type === 'list') {
        const listItems = token.items.map(item => {
          return (item.tokens || []).map(t => t.text || '').join('');
        });
        content.push({ [token.ordered ? 'ol' : 'ul']: listItems, margin: [0, 5, 0, 10] });
      } else if (token.type === 'table') {
        const body = [];
        const headerRow = token.header.map(cell => ({ text: cell.text, style: 'tableHeader' }));
        body.push(headerRow);

        for (const row of token.rows) {
          body.push(row.map(cell => cell.text));
        }

        content.push({
          table: { body, headerRows: 1 },
          layout: 'lightHorizontalLines',
          margin: [0, 10, 0, 10],
        });
      } else if (token.type === 'code') {
        content.push({
          text: token.text,
          font: 'Courier',
          fontSize: 10,
          background: '#f4f4f4',
          margin: [10, 5],
          padding: 5,
        });
      } else if (token.type === 'hr') {
        content.push({ canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, color: '#ccc' }], margin: [0, 10] });
      }
    }

    const docDefinition = {
      content,
      styles: {
        tableHeader: { bold: true, fillColor: '#eeeeee' },
      },
    };

    const doc = new pdfmake.createPdfKitDocument(docDefinition);
    const chunks = [];
    for await (const chunk of doc) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

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
    console.error('PDF Generation Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'PDF generation failed',
        details: error.message,
      }),
    };
  }
};
