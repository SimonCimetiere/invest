import ExcelJS from 'exceljs'

// Mapping des types de transactions vers le plan comptable SCI
const COMPTE_PRODUITS = [
  { type: 'loyer', compte: '706000', label: 'Loyers encaisses' },
  { type: 'autre_revenu', compte: '708300', label: 'Autres produits' },
]

const COMPTE_CHARGES_EXPLOIT = [
  { type: 'charges_copro', compte: '614000', label: 'Charges de copropriete' },
  { type: 'travaux', compte: '615210', label: "Travaux d'entretien et reparations" },
  { type: 'assurance_pno', compte: '616100', label: 'Assurance PNO' },
  { type: 'taxe_fonciere', compte: '635125', label: 'Taxes et impots (taxe fonciere)' },
  { type: 'comptable', compte: '622610', label: 'Honoraires comptable / gerance' },
  { type: 'autre_depense', compte: '671400', label: 'Autres charges' },
]

const ALL_TYPES = [...COMPTE_PRODUITS, ...COMPTE_CHARGES_EXPLOIT]

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
const SECTION_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
const SECTION_FONT = { bold: true, size: 11, color: { argb: 'FF1E293B' } }
const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
const TOTAL_FONT = { bold: true, size: 11 }
const RESULT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
const RESULT_FONT = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
const EURO_FORMAT = '#,##0.00 €;-#,##0.00 €;0.00 €'
const THIN_BORDER = { style: 'thin', color: { argb: 'FFCBD5E1' } }
const BORDERS = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER }

export async function generateBilanExcel(data) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Investissement App'
  workbook.created = new Date()

  buildCompteResultat(workbook, data)
  buildDetailParBien(workbook, data)

  return workbook
}

function buildCompteResultat(workbook, data) {
  const ws = workbook.addWorksheet('Compte de resultat')
  ws.columns = [
    { width: 12 },  // A: N° compte
    { width: 45 },  // B: Libellé
    { width: 18 },  // C: Montant
  ]

  // Titre
  const titleRow = ws.addRow(['', `COMPTE DE RESULTAT — ${data.periodLabel}`, ''])
  titleRow.getCell(2).font = { bold: true, size: 16, color: { argb: 'FF1E293B' } }
  ws.addRow(['', `Document genere le ${new Date().toLocaleDateString('fr-FR')}`, ''])
  ws.getRow(2).getCell(2).font = { italic: true, size: 9, color: { argb: 'FF94A3B8' } }
  ws.addRow([])

  // ---- PRODUITS D'EXPLOITATION ----
  const prodHeader = ws.addRow(['N° Compte', "PRODUITS D'EXPLOITATION", 'Montant'])
  styleSectionHeader(prodHeader)

  let totalProduits = 0
  for (const item of COMPTE_PRODUITS) {
    const amount = data.byType[item.type] || 0
    const absAmount = Math.abs(amount)
    totalProduits += absAmount
    const row = ws.addRow([item.compte, item.label, absAmount])
    row.getCell(3).numFmt = EURO_FORMAT
    row.eachCell(c => { c.border = BORDERS })
  }

  const totalProdRow = ws.addRow(['', 'TOTAL PRODUITS', totalProduits])
  styleTotalRow(totalProdRow)
  ws.addRow([])

  // ---- CHARGES D'EXPLOITATION ----
  const chargesHeader = ws.addRow(['N° Compte', "CHARGES D'EXPLOITATION", 'Montant'])
  styleSectionHeader(chargesHeader)

  let totalCharges = 0
  for (const item of COMPTE_CHARGES_EXPLOIT) {
    const amount = data.byType[item.type] || 0
    const absAmount = Math.abs(amount)
    totalCharges += absAmount
    const row = ws.addRow([item.compte, item.label, absAmount])
    row.getCell(3).numFmt = EURO_FORMAT
    row.eachCell(c => { c.border = BORDERS })
  }

  const totalChargesRow = ws.addRow(['', 'TOTAL CHARGES', totalCharges])
  styleTotalRow(totalChargesRow)
  ws.addRow([])

  // ---- RÉSULTAT NET ----
  const resultat = totalProduits - totalCharges
  const resultRow = ws.addRow(['', 'RESULTAT NET', resultat])
  resultRow.eachCell(c => {
    c.fill = RESULT_FILL
    c.font = RESULT_FONT
    c.border = BORDERS
  })
  resultRow.getCell(3).numFmt = EURO_FORMAT
}

function buildDetailParBien(workbook, data) {
  const ws = workbook.addWorksheet('Detail par bien')

  // Colonnes dynamiques
  const headers = ['Bien', 'Loyers', 'Autres produits', 'Charges copro', 'Taxe fonciere', 'Assurance PNO', 'Travaux', 'Honoraires', 'Autres charges', 'Total Produits', 'Total Charges', 'Resultat']
  const typeOrder = ['loyer', 'autre_revenu', 'charges_copro', 'taxe_fonciere', 'assurance_pno', 'travaux', 'comptable', 'autre_depense']

  ws.columns = [
    { width: 25 },
    ...Array(headers.length - 1).fill({ width: 16 }),
  ]

  // Titre
  const titleRow = ws.addRow([`DETAIL PAR BIEN — ${data.periodLabel}`])
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E293B' } }
  ws.addRow([])

  // Header
  const headerRow = ws.addRow(headers)
  headerRow.eachCell(c => {
    c.fill = HEADER_FILL
    c.font = HEADER_FONT
    c.border = BORDERS
    c.alignment = { horizontal: 'center' }
  })
  headerRow.getCell(1).alignment = { horizontal: 'left' }

  // Totaux pour la ligne de total
  const colTotals = Array(typeOrder.length + 3).fill(0)

  for (const bien of data.perBien) {
    const values = typeOrder.map(t => bien.byType[t] || 0)
    const totalProduits = (bien.byType['loyer'] || 0) + (bien.byType['autre_revenu'] || 0)
    const totalCharges = ['charges_copro', 'taxe_fonciere', 'assurance_pno', 'travaux', 'comptable', 'autre_depense']
      .reduce((s, t) => s + (bien.byType[t] || 0), 0)
    const resultat = totalProduits + totalCharges

    const rowData = [bien.title, ...values, totalProduits, totalCharges, resultat]
    const row = ws.addRow(rowData)

    // Format
    for (let i = 2; i <= rowData.length; i++) {
      row.getCell(i).numFmt = EURO_FORMAT
      row.getCell(i).border = BORDERS
      const val = row.getCell(i).value
      if (val < 0) row.getCell(i).font = { color: { argb: 'FFDC2626' } }
      else if (val > 0) row.getCell(i).font = { color: { argb: 'FF16A34A' } }
    }
    row.getCell(1).border = BORDERS
    row.getCell(1).font = { bold: true }

    // Accumulate totals
    values.forEach((v, i) => { colTotals[i] += v })
    colTotals[typeOrder.length] += totalProduits
    colTotals[typeOrder.length + 1] += totalCharges
    colTotals[typeOrder.length + 2] += resultat
  }

  // Total row
  const totalRowData = ['TOTAL', ...colTotals]
  const totalRow = ws.addRow(totalRowData)
  totalRow.eachCell((c, colNumber) => {
    c.fill = TOTAL_FILL
    c.font = TOTAL_FONT
    c.border = BORDERS
    if (colNumber > 1) {
      c.numFmt = EURO_FORMAT
      if (c.value < 0) c.font = { ...TOTAL_FONT, color: { argb: 'FFDC2626' } }
      else if (c.value > 0) c.font = { ...TOTAL_FONT, color: { argb: 'FF16A34A' } }
    }
  })

  // Autofilter
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + data.perBien.length, column: headers.length } }
}

function styleSectionHeader(row) {
  row.eachCell(c => {
    c.fill = SECTION_FILL
    c.font = SECTION_FONT
    c.border = BORDERS
  })
}

function styleTotalRow(row) {
  row.eachCell(c => {
    c.fill = TOTAL_FILL
    c.font = TOTAL_FONT
    c.border = BORDERS
  })
  row.getCell(3).numFmt = EURO_FORMAT
}
