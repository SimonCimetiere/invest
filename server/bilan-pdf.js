import PDFDocument from 'pdfkit'

const TYPE_LABELS = {
  loyer: 'Loyer',
  charges_copro: 'Charges copropriete',
  taxe_fonciere: 'Taxe fonciere',
  assurance_pno: 'Assurance PNO',
  travaux: 'Travaux',
  comptable: 'Comptable',
  autre_depense: 'Autre depense',
  autre_revenu: 'Autre revenu',
}

function formatEuro(n) {
  if (n == null) return '0 €'
  const sign = n > 0 ? '+' : ''
  return sign + Number(n).toLocaleString('fr-FR') + ' €'
}

function formatEuroAbs(n) {
  return Number(Math.abs(n || 0)).toLocaleString('fr-FR') + ' €'
}

export function generateBilanPDF(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const pageWidth = 595.28 - 100 // A4 width minus margins
  const col1 = 50
  const col2 = 350

  // ---- Header ----
  doc.font('Helvetica-Bold').fontSize(16)
    .text('BILAN COMPTABLE', { align: 'center' })
  doc.fontSize(13)
    .text(data.periodLabel, { align: 'center' })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(9).fillColor('#666666')
    .text(`Document genere le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' })
  doc.fillColor('#000000')
  doc.moveDown(1)

  // ---- Synthese globale ----
  const synthY = doc.y
  doc.rect(col1, synthY, pageWidth, 60).lineWidth(1).stroke('#cbd5e1')
  doc.rect(col1, synthY, pageWidth, 20).fill('#f1f5f9').stroke('#cbd5e1')

  doc.fillColor('#334155').font('Helvetica-Bold').fontSize(9)
  doc.text('TOTAL REVENUS', col1 + 10, synthY + 6, { width: 150 })
  doc.text('TOTAL DEPENSES', col1 + 170, synthY + 6, { width: 150 })
  doc.text('CASH-FLOW', col1 + 340, synthY + 6, { width: 150 })

  doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(12)
  doc.text(formatEuroAbs(data.totals.revenus), col1 + 10, synthY + 30, { width: 150 })
  doc.fillColor('#dc2626')
  doc.text(formatEuroAbs(data.totals.depenses), col1 + 170, synthY + 30, { width: 150 })
  doc.fillColor(data.totals.cashFlow >= 0 ? '#16a34a' : '#dc2626')
  doc.text(formatEuro(data.totals.cashFlow), col1 + 340, synthY + 30, { width: 150 })

  doc.fillColor('#000000')
  doc.y = synthY + 75

  // ---- Detail par bien ----
  for (const bien of data.perBien) {
    // Check if we need a new page (need ~200px minimum)
    if (doc.y > 650) doc.addPage()

    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b')
      .text(bien.title, col1)
    doc.moveDown(0.3)

    // Table header
    const headerY = doc.y
    doc.rect(col1, headerY, pageWidth, 18).fill('#f8fafc')
    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8)
    doc.text('TYPE', col1 + 8, headerY + 5, { width: 280 })
    doc.text('MONTANT', col2 + 8, headerY + 5, { width: 120, align: 'right' })
    doc.y = headerY + 22

    let rowIndex = 0

    // Revenue lines
    const revenueLines = bien.lines.filter(l => l.total > 0)
    const expenseLines = bien.lines.filter(l => l.total < 0)

    if (revenueLines.length > 0) {
      for (const line of revenueLines) {
        const ry = doc.y
        if (rowIndex % 2 === 1) doc.rect(col1, ry, pageWidth, 16).fill('#fafafa')
        doc.fillColor('#334155').font('Helvetica').fontSize(9)
        doc.text(line.label, col1 + 8, ry + 4, { width: 280 })
        doc.fillColor('#16a34a').font('Helvetica').fontSize(9)
        doc.text(formatEuroAbs(line.total), col2 + 8, ry + 4, { width: 120, align: 'right' })
        doc.y = ry + 16
        rowIndex++
      }
    }

    if (expenseLines.length > 0) {
      for (const line of expenseLines) {
        const ry = doc.y
        if (rowIndex % 2 === 1) doc.rect(col1, ry, pageWidth, 16).fill('#fafafa')
        doc.fillColor('#334155').font('Helvetica').fontSize(9)
        doc.text(line.label, col1 + 8, ry + 4, { width: 280 })
        doc.fillColor('#dc2626').font('Helvetica').fontSize(9)
        doc.text('-' + formatEuroAbs(line.total), col2 + 8, ry + 4, { width: 120, align: 'right' })
        doc.y = ry + 16
        rowIndex++
      }
    }

    // Subtotals
    const subY = doc.y
    doc.rect(col1, subY, pageWidth, 42).lineWidth(0.5).stroke('#e2e8f0')
    doc.rect(col1, subY, pageWidth, 42).fill('#f8fafc')

    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(9)
    doc.text('Revenus', col1 + 8, subY + 4, { width: 280 })
    doc.fillColor('#16a34a')
    doc.text(formatEuroAbs(bien.revenus), col2 + 8, subY + 4, { width: 120, align: 'right' })

    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(9)
    doc.text('Depenses', col1 + 8, subY + 18, { width: 280 })
    doc.fillColor('#dc2626')
    doc.text(formatEuroAbs(bien.depenses), col2 + 8, subY + 18, { width: 120, align: 'right' })

    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(9)
    doc.text('Cash-flow', col1 + 8, subY + 32, { width: 280 })
    doc.fillColor(bien.cashFlow >= 0 ? '#16a34a' : '#dc2626').font('Helvetica-Bold')
    doc.text(formatEuro(bien.cashFlow), col2 + 8, subY + 32, { width: 120, align: 'right' })

    doc.fillColor('#000000')
    doc.y = subY + 48
  }

  // ---- Footer ----
  doc.moveDown(2)
  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#888888')
    .text('Document genere a titre indicatif. Il ne se substitue pas aux documents comptables officiels.', col1, doc.y, { align: 'center', width: pageWidth })

  doc.end()
  return doc
}
