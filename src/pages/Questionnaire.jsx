import { useState, useEffect } from 'react'
import './Questionnaire.css'

const sections = [
  {
    icon: '1',
    title: 'Objectifs et Vision',
    fields: [
      { key: 'horizon', label: 'Quel est votre horizon de temps ? (5, 10, 20 ans)' },
      { key: 'objectif_principal', label: 'Objectif principal : patrimoine retraite, revenus complémentaires, ou revente après valorisation ?' },
      { key: 'nb_biens', label: 'Combien de biens souhaitez-vous acquérir à terme ?' },
      { key: 'activite_type', label: 'Voyez-vous cela comme une activité annexe ou principale à terme ?' },
      { key: 'rentabilite_min', label: 'Quelle rentabilité minimale visez-vous ?' },
    ],
  },
  {
    icon: '2',
    title: 'Moyens et Capacités Financières',
    fields: [
      { key: 'apport_a1', label: 'Apport disponible - Associé 1' },
      { key: 'apport_a2', label: 'Apport disponible - Associé 2' },
      { key: 'epargne_mensuelle_a1', label: "Capacité d'épargne mensuelle - Associé 1" },
      { key: 'epargne_mensuelle_a2', label: "Capacité d'épargne mensuelle - Associé 2" },
      { key: 'revenus_a1', label: 'Revenus mensuels nets - Associé 1' },
      { key: 'revenus_a2', label: 'Revenus mensuels nets - Associé 2' },
      { key: 'credits_a1', label: 'Autres crédits en cours - Associé 1' },
      { key: 'credits_a2', label: 'Autres crédits en cours - Associé 2' },
      { key: 'epargne_securite', label: "Épargne de sécurité disponible (pour faire face aux imprévus)" },
      { key: 'emprunt_max', label: "Montant maximum d'emprunt envisagé" },
    ],
  },
  {
    icon: '3',
    title: 'Compétences et Disponibilités',
    fields: [
      { key: 'competences_reno_a1', label: 'Compétences en rénovation - Associé 1' },
      { key: 'competences_reno_a2', label: 'Compétences en rénovation - Associé 2' },
      { key: 'dispo_travaux_a1', label: 'Disponibilité pour gérer les travaux - Associé 1' },
      { key: 'dispo_travaux_a2', label: 'Disponibilité pour gérer les travaux - Associé 2' },
      { key: 'competences_gestion', label: 'Compétences en gestion locative/administrative' },
      { key: 'travaux_soi_meme', label: 'Êtes-vous prêts à faire des travaux vous-mêmes ? Quel type ?' },
      { key: 'dispo_urgence', label: 'Qui peut se rendre disponible en urgence (fuite, problème locataire, etc.) ?' },
      { key: 'competences_compta', label: 'Compétences en comptabilité/fiscalité' },
    ],
  },
  {
    icon: '4',
    title: 'Répartition des Rôles et Décisions',
    fields: [
      { key: 'repartition_apports', label: 'Répartition des apports financiers : 50/50 ou proportionnelle ?' },
      { key: 'repartition_parts', label: 'Répartition des parts de propriété' },
      { key: 'decision_travaux', label: 'Qui prend les décisions sur les travaux ?' },
      { key: 'decision_locataires', label: 'Qui prend les décisions sur le choix des locataires ?' },
      { key: 'decision_revente', label: 'Qui prend les décisions sur la revente ?' },
      { key: 'gestion_artisans', label: 'Qui gère la relation avec les artisans ?' },
      { key: 'gestion_locataires', label: 'Qui gère la relation avec les locataires ?' },
      { key: 'gestion_compta', label: 'Qui gère la comptabilité et les déclarations ?' },
      { key: 'gestion_desaccords', label: 'Comment gérez-vous les désaccords ? Vote, médiation, autre ?' },
      { key: 'depense_max_sans_accord', label: "Montant maximum de dépense sans accord de l'autre associé" },
    ],
  },
  {
    icon: '5',
    title: 'Structure Juridique',
    fields: [
      { key: 'structure_type', label: "Type de structure envisagée : SCI à l'IR, SCI à l'IS, SARL, indivision ?" },
      { key: 'gerant', label: 'Qui sera le gérant ?' },
      { key: 'remuneration_gerant', label: 'Rémunération du gérant prévue ?' },
      { key: 'regles_majorite', label: 'Règles de majorité pour les décisions importantes (unanimité, majorité simple, 2/3)' },
      { key: 'notaire_statuts', label: 'Avez-vous prévu de consulter un notaire pour les statuts ?' },
      { key: 'capital_social', label: 'Capital social envisagé' },
    ],
  },
  {
    icon: '6',
    title: 'Scénarios de Sortie et Gestion des Conflits',
    fields: [
      { key: 'sortie_vente_parts', label: 'Que se passe-t-il si un associé veut vendre ses parts ?' },
      { key: 'clause_preemption', label: "Clause de préemption : l'autre associé a-t-il la priorité pour racheter ?" },
      { key: 'valorisation_parts', label: 'Comment valorisez-vous les parts en cas de sortie ?' },
      { key: 'delai_preavis', label: 'Délai de préavis en cas de volonté de sortie' },
      { key: 'divorce_separation', label: "Que se passe-t-il en cas de divorce/séparation d'un associé ?" },
      { key: 'defaut_paiement', label: 'Que se passe-t-il si un associé ne peut plus payer sa part ?' },
      { key: 'procedure_desaccord', label: 'En cas de désaccord majeur, quelle procédure ? (médiation, arbitrage, rachat forcé)' },
      { key: 'clause_non_concurrence', label: 'Clause de non-concurrence prévue ?' },
    ],
  },
  {
    icon: '7',
    title: "Stratégie d'Investissement",
    fields: [
      { key: 'type_bien', label: 'Type de bien recherché : appartement, maison, immeuble ?' },
      { key: 'surface_cible', label: 'Surface cible' },
      { key: 'zone_geo', label: 'Zone géographique prioritaire' },
      { key: 'budget_acquisition', label: "Budget d'acquisition cible" },
      { key: 'niveau_travaux', label: 'Niveau de travaux souhaité : rafraîchissement, rénovation partielle, rénovation lourde ?' },
      { key: 'budget_travaux', label: 'Budget travaux envisagé' },
      { key: 'type_location', label: 'Type de location : nue, meublée, courte durée (Airbnb) ?' },
      { key: 'cible_locative', label: 'Cible locative : étudiants, jeunes actifs, familles, touristes ?' },
      { key: 'priorite_rendement', label: 'Priorité : rendement locatif ou plus-value à la revente ?' },
      { key: 'rendement_net_min', label: 'Rendement locatif net minimum visé' },
      { key: 'duree_detention', label: 'Durée de détention envisagée avant revente' },
    ],
  },
  {
    icon: '8',
    title: 'Fiscalité et Optimisation',
    fields: [
      { key: 'regime_fiscal', label: 'Régime fiscal envisagé : LMNP, LMP, régime réel, micro-BIC ?' },
      { key: 'expert_comptable', label: 'Prévoyez-vous un accompagnement par un expert-comptable ?' },
      { key: 'budget_expert_comptable', label: "Budget annuel prévu pour l'expert-comptable" },
      { key: 'strategie_amortissement', label: "Stratégie d'amortissement (si applicable)" },
      { key: 'dispositifs_fiscaux', label: 'Avez-vous étudié les dispositifs fiscaux applicables (Denormandie, Pinel, etc.) ?' },
    ],
  },
  {
    icon: '9',
    title: 'Financement',
    fields: [
      { key: 'emprunt_mode', label: 'Emprunt en nom propre ou via la structure ?' },
      { key: 'type_garantie', label: 'Type de garantie : caution solidaire, hypothèque, autre ?' },
      { key: 'duree_credit', label: 'Durée de crédit souhaitée' },
      { key: 'taux_endettement_a1', label: 'Taux d\'endettement actuel - Associé 1' },
      { key: 'taux_endettement_a2', label: 'Taux d\'endettement actuel - Associé 2' },
      { key: 'apport_minimum', label: 'Apport minimum que vous êtes prêts à mettre' },
      { key: 'banques_contactees', label: 'Avez-vous déjà contacté des banques ? Lesquelles ?' },
      { key: 'assurance_emprunteur', label: 'Assurance emprunteur : comment la répartissez-vous ?' },
    ],
  },
  {
    icon: '10',
    title: 'Aspects Relationnels',
    fields: [
      { key: 'anciennete_relation', label: 'Depuis combien de temps vous connaissez-vous ?' },
      { key: 'projet_commun_passe', label: "Avez-vous déjà travaillé ensemble sur un projet ? Si oui, comment s'est-il déroulé ?" },
      { key: 'communication_desaccord', label: 'Comment communiquez-vous habituellement en cas de désaccord ?' },
      { key: 'transparence_financiere', label: 'Êtes-vous tous deux transparents sur vos situations financières respectives ?' },
      { key: 'consequences_amitie', label: "Avez-vous discuté des conséquences possibles sur votre amitié ?" },
      { key: 'frequence_bilans', label: 'Fréquence des points réguliers prévus pour faire le bilan' },
      { key: 'mediateur', label: 'En cas de tension, qui pourrait servir de médiateur (personne de confiance commune) ?' },
    ],
  },
]

function buildEmptyData() {
  const initial = {
    date: new Date().toISOString().slice(0, 10),
    associe1: '',
    associe2: '',
    notes: '',
  }
  for (const section of sections) {
    for (const field of section.fields) {
      initial[field.key] = ''
    }
  }
  return initial
}

function Questionnaire() {
  const [editing, setEditing] = useState(true)
  const [formData, setFormData] = useState(buildEmptyData)
  const [recordId, setRecordId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/questionnaires')
      .then(res => res.json())
      .then(rows => {
        if (rows.length > 0) {
          const latest = rows[0]
          setFormData(latest.data)
          setRecordId(latest.id)
          setEditing(!latest.validated)
        }
      })
      .catch(err => console.error('Erreur chargement questionnaire:', err))
      .finally(() => setLoading(false))
  }, [])

  function handleChange(key, value) {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  async function handleValidate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (recordId) {
        await fetch(`/api/questionnaires/${recordId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: formData, validated: true }),
        })
      } else {
        const res = await fetch('/api/questionnaires', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: formData, validated: true }),
        })
        const created = await res.json()
        setRecordId(created.id)
      }
      setEditing(false)
    } catch (err) {
      console.error('Erreur sauvegarde:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit() {
    setEditing(true)
  }

  async function handleSaveDraft() {
    setSaving(true)
    try {
      if (recordId) {
        await fetch(`/api/questionnaires/${recordId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: formData, validated: false }),
        })
      } else {
        const res = await fetch('/api/questionnaires', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: formData, validated: false }),
        })
        const created = await res.json()
        setRecordId(created.id)
      }
    } catch (err) {
      console.error('Erreur sauvegarde brouillon:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="questionnaire">
        <h1>Questionnaire Projet Immobilier</h1>
        <p>Chargement...</p>
      </div>
    )
  }

  if (!editing) {
    return (
      <div className="questionnaire">
        <div className="questionnaire-header">
          <h1>Questionnaire Projet Immobilier</h1>
          <button className="btn btn-secondary" onClick={handleEdit}>Modifier</button>
        </div>
        <div className="meta-display">
          <div className="meta-item"><span className="meta-label">Date</span><span>{formData.date}</span></div>
          <div className="meta-item"><span className="meta-label">Associé 1</span><span>{formData.associe1 || '—'}</span></div>
          <div className="meta-item"><span className="meta-label">Associé 2</span><span>{formData.associe2 || '—'}</span></div>
        </div>
        {sections.map((section) => (
          <div key={section.title} className="section-display">
            <h2><span className="section-number">{section.icon}</span>{section.title}</h2>
            <div className="answers-list">
              {section.fields.map((field) => (
                <div key={field.key} className="answer-item">
                  <div className="answer-label">{field.label}</div>
                  <div className="answer-value">{formData[field.key] || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="section-display">
          <h2><span className="section-number">+</span>Notes et Réflexions Complémentaires</h2>
          <div className="answer-value notes-display">{formData.notes || '—'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="questionnaire">
      <div className="questionnaire-header">
        <h1>Questionnaire Projet Immobilier</h1>
        <button type="button" className="btn btn-outline" onClick={handleSaveDraft} disabled={saving}>
          {saving ? 'Sauvegarde...' : 'Sauvegarder le brouillon'}
        </button>
      </div>
      <form onSubmit={handleValidate}>
        <div className="meta-fields">
          <div className="field">
            <label>Date de remplissage</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Associé 1</label>
            <input
              type="text"
              value={formData.associe1}
              onChange={(e) => handleChange('associe1', e.target.value)}
              placeholder="Nom de l'associé 1"
            />
          </div>
          <div className="field">
            <label>Associé 2</label>
            <input
              type="text"
              value={formData.associe2}
              onChange={(e) => handleChange('associe2', e.target.value)}
              placeholder="Nom de l'associé 2"
            />
          </div>
        </div>

        {sections.map((section) => (
          <fieldset key={section.title} className="section-fieldset">
            <legend><span className="section-number">{section.icon}</span>{section.title}</legend>
            {section.fields.map((field) => (
              <div key={field.key} className="field">
                <label>{field.label}</label>
                <textarea
                  rows={2}
                  value={formData[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                />
              </div>
            ))}
          </fieldset>
        ))}

        <fieldset className="section-fieldset">
          <legend><span className="section-number">+</span>Notes et Réflexions Complémentaires</legend>
          <div className="field">
            <textarea
              rows={5}
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Utilisez cet espace pour toute information ou réflexion supplémentaire..."
            />
          </div>
        </fieldset>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Valider le questionnaire'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Questionnaire
