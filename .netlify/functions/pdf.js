// .netlify/functions/pdf.js
// CommonJS + marked + jsPDF + jspdf-plugin-autotable → Full table & text support
const marked = require('marked');
const jsPDF = require('jspdf');
require('jspdf-plugin-autotable'); // Ajoute le support des tableaux

// Configuration de marked
marked.setOptions({
  gfm: true,
  breaks: true,
  sanitize: false,
});

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
    // Parser le Markdown
    const tokens = marked.lexer(markdown);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let y = 20; // Position verticale initiale
    doc.setFontSize(12);
    doc.setFont('helvetica');

    // Style global
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;

    // Traitement des tokens Markdown
    for (const token of tokens) {
      doc.setFont(undefined, 'normal');
      doc.setFontSize(12);

      if (token.type === 'heading') {
        doc.setFontSize(14 + (6 - token.depth * 2)); // # = 14, ## = 12, etc.
        doc.setFont(undefined, 'bold');
        const text = token.text;
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, margin, y);
        y += 10;
      }

      else if (token.type === 'text') {
        const text = token.tokens
          ? token.tokens.map(t => t.text || '').join('')
          : token.text;
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, margin, y);
        y += lines.length * 6 + 4;
      }

      else if (token.type === 'list') {
        for (const item of token.items) {
          const itemText = item.tokens.map(t => t.text || '').join('');
          const lines = doc.splitTextToSize(' • ' + itemText, maxWidth);
          doc.text(lines, margin + 5, y);
          y += lines.length * 6 + 4;
        }
      }

      else if (token.type === 'table') {
        // Prépare les données du tableau
        const tableData = [];
        const headers = token.header.map(cell => ({ content: cell.text, styles: { fontStyle: 'bold' } }));
        tableData.push(headers);

        for (const row of token.rows) {
          const rowData = row.map(cell => cell.text);
          tableData.push(rowData);
        }

        // Ajoute le tableau au PDF
        doc.autoTable({
          head: [tableData[0].map(h => h.content)],
          body: tableData.slice(1),
          startY: y,
          margin: { left: margin, right: margin },
          styles: { fontSize: 10, cellPadding: 3 },
          headStyles: { fillColor: [200, 200, 200], fontStyle: 'bold' },
        });

        y = doc.lastAutoTable.finalY + 10;
      }

      else if (token.type === 'code') {
        doc.setFont('courier');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(token.text, maxWidth - 10);
        for (const line of lines) {
          if (y + 5 > 280) doc.addPage();
          doc.text(line, margin + 5, y);
          y += 4;
        }
        doc.setFont('helvetica');
        doc.setFontSize(12);
        y += 5;
      }

      else if (token.type === 'hr') {
        y += 5;
        doc.setDrawColor(200);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;
      }

      // Nouvelle page si nécessaire
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
    }

    // Générer le PDF
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
      body: JSON.stringify({
        error: 'PDF generation failed',
        details: error.message,
      }),
    };
  }
};
