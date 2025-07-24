// .netlify/functions/pdf.js
// Using pdfmake + marked for full table & text support on Netlify
const marked = require('marked');
const pdfmake = require('pdfmake');
const vfsFonts = require('pdfmake/build/vfs_fonts');

// Configurer pdfmake avec les polices
pdfmake.vfs = {
  ...pdfmake.vfs,
  ...vfsFonts.pdfMake.vfs,
};

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
    // Parser le markdown en tokens
    const tokens = marked.lexer(markdown);
    const content = [];

    for (const token of tokens) {
      if (token.type === 'heading') {
        content.push({
          text: token.text,
          fontSize: 16 - token.depth,
          bold: true,
          margin: [0, 10, 0, 5],
        });
      }

      else if (token.type === 'text') {
        const inlineTokens = token.tokens || [];
        const chunks = [];
        for (const t of inlineTokens) {
          if (t.type === 'text') chunks.push(t.text);
          else if (t.type === 'strong') chunks.push({ text: t.text, bold: true });
          else if (t.type === 'em') chunks.push({ text: t.text, italics: true });
          else if (t.type === 'codespan') chunks.push({ text: t.text, font: 'Courier' });
          else if (t.type === 'link') chunks.push({ text: t.text, link: t.href, color: 'blue' });
        }
        content.push({
          text: chunks,
          margin: [0, 5],
        });
      }

      else if (token.type === 'list') {
        content.push({
          ul: token.items.map(item => {
            const inline = item.tokens.map(t => typeof t === 'string' ? t : t.text || '').join('');
            return inline;
          }),
          margin: [0, 5, 0, 10],
        });
      }

      else if (token.type === 'table') {
        const tableBody = [];
        const headerRow = token.header.map(cell => ({
          text: cell.text,
          style: 'tableHeader',
        }));
        tableBody.push(headerRow);

        for (const row of token.rows) {
          const rowData = row.map(cell => cell.text);
          tableBody.push(rowData);
        }

        content.push({
          table: {
            headerRows: 1,
            widths: Array(token.header.length).fill('auto'),
            body: tableBody,
          },
          margin: [0, 10, 0, 10],
          layout: 'lightHorizontalLines',
        });
      }

      else if (token.type === 'code') {
        content.push({
          text: token.text,
          font: 'Courier',
          fontSize: 10,
          background: '#f0f0f0',
          margin: [10, 5],
          padding: 5,
        });
      }

      else if (token.type === 'hr') {
        content.push({
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, color: '#ccc' }],
          margin: [0, 10],
        });
      }
    }

    // Générer le PDF
    const docDef = {
      content,
      styles: {
        tableHeader: {
          bold: true,
          fillColor: '#eeeeee',
          color: '#000',
        },
      },
    };

    const doc = new pdfmake.createPdfKitDocument(docDef);
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
      body: JSON.stringify({ error: 'PDF generation failed', details: error.message }),
    };
  }
};
