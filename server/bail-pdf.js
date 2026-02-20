import PDFDocument from 'pdfkit'

export function generateBailPDF(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const isMeuble = data.type === 'meuble'
  const typeBail = isMeuble ? 'MEUBLÉE' : 'VIDE'

  function title(text) {
    doc.moveDown(0.8)
    doc.font('Helvetica-Bold').fontSize(11).text(text, { underline: true })
    doc.moveDown(0.4)
    doc.font('Helvetica').fontSize(10)
  }

  function body(text) {
    doc.font('Helvetica').fontSize(10).text(text, { align: 'justify', lineGap: 2 })
  }

  function bodyBold(text) {
    doc.font('Helvetica-Bold').fontSize(10).text(text, { align: 'justify', lineGap: 2 })
  }

  // Header
  doc.font('Helvetica-Bold').fontSize(14)
    .text(`CONTRAT DE LOCATION`, { align: 'center' })
  doc.fontSize(12)
    .text(`BAIL D'HABITATION ${typeBail}`, { align: 'center' })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(9)
    .text(`(Loi n°89-462 du 6 juillet 1989${isMeuble ? ' - Titre Ier bis' : ' - Titre Ier'})`, { align: 'center' })
  doc.moveDown(0.8)

  // Article 1 — Parties
  title('Article 1 — Désignation des parties')
  body('Le présent contrat est conclu entre :')
  doc.moveDown(0.3)
  bodyBold('LE BAILLEUR :')
  body(`Nom : ${data.bailleur_nom}`)
  body(`Adresse : ${data.bailleur_adresse}`)
  doc.moveDown(0.3)
  bodyBold('LE LOCATAIRE :')
  body(`Nom : ${data.locataire_nom}`)
  body(`Adresse précédente : ${data.locataire_adresse_precedente}`)

  // Article 2 — Objet
  title('Article 2 — Objet du contrat')
  body(`Le bailleur loue au locataire le logement ci-après désigné, à usage d'habitation principale :`)
  doc.moveDown(0.3)
  body(`Adresse : ${data.bien_adresse}`)
  if (data.bien_description) body(`Description : ${data.bien_description}`)
  if (data.bien_surface) body(`Surface habitable : ${data.bien_surface} m²`)
  body(`Usage : habitation principale`)

  // Article 3 — Durée
  const dureeAns = isMeuble ? '1 an' : '3 ans'
  const preavisLocataire = isMeuble ? '1 mois' : '3 mois'
  title('Article 3 — Durée du bail')
  body(`Le présent bail est consenti pour une durée de ${data.duree || dureeAns} à compter du ${data.date_debut}.`)
  doc.moveDown(0.3)
  body(`À défaut de congé donné dans les conditions légales, le bail sera reconduit tacitement pour la même durée.`)
  doc.moveDown(0.3)
  body(`Le locataire peut donner congé à tout moment, sous réserve d'un préavis de ${preavisLocataire} (pouvant être réduit à 1 mois dans les zones tendues ou pour les cas prévus par la loi).`)
  doc.moveDown(0.3)
  body(`Le bailleur peut donner congé au locataire pour la fin du bail, avec un préavis de 6 mois (bail vide) ou 3 mois (bail meublé), et uniquement pour l'un des motifs prévus par la loi : reprise pour habiter, vente du logement, ou motif légitime et sérieux.`)

  // Article 4 — Loyer et charges
  title('Article 4 — Loyer et charges')
  body(`Le loyer mensuel est fixé à ${data.loyer} € (${data.loyer} euros), payable d'avance le 1er de chaque mois.`)
  doc.moveDown(0.3)
  if (data.charges) {
    body(`Les charges locatives sont fixées à ${data.charges} € par mois, sous forme de provision avec régularisation annuelle.`)
    doc.moveDown(0.3)
  }
  body(`Mode de paiement : ${data.mode_paiement || 'virement bancaire'}`)
  doc.moveDown(0.3)
  body(`Le loyer sera révisé chaque année à la date anniversaire du bail, en fonction de la variation de l'Indice de Référence des Loyers (IRL) publié par l'INSEE.`)

  // Article 5 — Dépôt de garantie
  const depotMax = isMeuble ? '2 mois' : '1 mois'
  title('Article 5 — Dépôt de garantie')
  body(`À la signature du présent bail, le locataire verse au bailleur un dépôt de garantie d'un montant de ${data.depot_garantie} € (maximum légal : ${depotMax} de loyer hors charges).`)
  doc.moveDown(0.3)
  body(`Ce dépôt sera restitué dans un délai maximum de 1 mois après la remise des clés si l'état des lieux de sortie est conforme à l'état des lieux d'entrée, ou de 2 mois dans le cas contraire, déduction faite des sommes restant dues au bailleur.`)

  // Article 6 — Obligations du bailleur
  title('Article 6 — Obligations du bailleur')
  body(`Le bailleur est tenu :`)
  body(`- De délivrer au locataire le logement en bon état d'usage et de réparation ;`)
  body(`- D'assurer au locataire la jouissance paisible du logement ;`)
  body(`- D'entretenir les locaux en état de servir à l'usage prévu et d'y faire toutes les réparations nécessaires autres que locatives ;`)
  body(`- De ne pas s'opposer aux aménagements réalisés par le locataire, dès lors que ceux-ci ne constituent pas une transformation de la chose louée ;`)
  body(`- De remettre gratuitement une quittance au locataire qui en fait la demande.`)

  // Article 7 — Obligations du locataire
  title('Article 7 — Obligations du locataire')
  body(`Le locataire est tenu :`)
  body(`- De payer le loyer et les charges aux termes convenus ;`)
  body(`- D'user paisiblement des locaux loués suivant la destination qui leur a été donnée par le bail ;`)
  body(`- De répondre des dégradations et pertes qui surviennent pendant la durée du contrat, à moins qu'il ne prouve qu'elles ont eu lieu par cas de force majeure, par la faute du bailleur ou par le fait d'un tiers ;`)
  body(`- De prendre à sa charge l'entretien courant du logement et les menues réparations (réparations locatives) ;`)
  body(`- De souscrire une assurance contre les risques locatifs (incendie, dégât des eaux, etc.) et d'en justifier lors de la remise des clés puis chaque année ;`)
  body(`- De ne pas transformer les locaux sans l'accord écrit du bailleur.`)

  // Article 8 — État des lieux
  title('Article 8 — État des lieux')
  body(`Un état des lieux contradictoire sera établi lors de la remise et de la restitution des clés, conformément aux dispositions de la loi ALUR. En cas de désaccord, l'état des lieux pourra être établi par un huissier de justice, à frais partagés entre les parties.`)

  // Article 9 — Clause résolutoire
  title('Article 9 — Clause résolutoire')
  body(`Le présent bail sera résilié de plein droit :`)
  body(`- À défaut de paiement du loyer, des charges ou du dépôt de garantie aux termes convenus, deux mois après un commandement de payer demeuré infructueux (ou six semaines en cas de saisine du fonds de solidarité pour le logement) ;`)
  body(`- À défaut de souscription d'une assurance des risques locatifs, un mois après un commandement demeuré infructueux ;`)
  body(`- En cas de troubles de voisinage constatés par une décision de justice passée en force de chose jugée.`)

  // Article 10 — Diagnostics
  title('Article 10 — Diagnostics techniques')
  body(`Conformément à la réglementation en vigueur, le bailleur annexe au présent bail le dossier de diagnostic technique comprenant :`)
  body(`- Le diagnostic de performance énergétique (DPE) ;`)
  body(`- Le constat de risque d'exposition au plomb (CREP) pour les logements construits avant le 1er janvier 1949 ;`)
  body(`- L'état des risques et pollutions (ERP) ;`)
  body(`- Le cas échéant, l'état de l'installation intérieure de gaz et d'électricité (si installations de plus de 15 ans) ;`)
  body(`- Le cas échéant, le diagnostic amiante (pour les logements dont le permis de construire a été délivré avant le 1er juillet 1997).`)

  // Article meublé — Inventaire
  if (isMeuble) {
    title('Article 11 — Inventaire et état détaillé du mobilier')
    body(`Le logement est loué meublé, conformément aux dispositions du décret n°2015-981 du 31 juillet 2015 fixant la liste des éléments de mobilier d'un logement meublé.`)
    doc.moveDown(0.3)
    body(`Un inventaire détaillé du mobilier est annexé au présent contrat et signé par les deux parties :`)
    doc.moveDown(0.3)
    if (data.inventaire_meubles) {
      body(data.inventaire_meubles)
    } else {
      body(`(Voir inventaire annexé)`)
    }
  }

  // Signatures
  doc.moveDown(1.5)
  const sigArticle = isMeuble ? 'Article 12' : 'Article 11'
  title(`${sigArticle} — Signatures`)
  body(`Fait à ${data.lieu_signature || '_______________'}, le ${data.date_signature || '_______________'}`)
  doc.moveDown(0.3)
  body(`En deux exemplaires originaux, dont un pour chaque partie.`)
  doc.moveDown(1.5)

  // Signature blocks side by side
  const left = 50
  const right = 320
  const y = doc.y

  doc.font('Helvetica-Bold').fontSize(10)
  doc.text('Le Bailleur', left, y, { width: 200 })
  doc.text('Le Locataire', right, y, { width: 200 })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(9)
  doc.text('(Signature précédée de la mention\n"Lu et approuvé")', left, doc.y, { width: 200 })
  const savedY = doc.y
  doc.text('(Signature précédée de la mention\n"Lu et approuvé")', right, y + 15, { width: 200 })
  doc.y = Math.max(doc.y, savedY)

  // Footer
  doc.moveDown(3)
  doc.font('Helvetica-Oblique').fontSize(8)
    .fillColor('#888888')
    .text('Document généré à titre indicatif. Il ne se substitue pas aux conseils d\'un professionnel du droit.', 50, doc.y, { align: 'center', width: 495 })

  doc.end()
  return doc
}
