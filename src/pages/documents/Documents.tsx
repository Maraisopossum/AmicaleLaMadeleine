import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, Document } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'

const TYPES = ['statut', 'reglement', 'proces_verbal', 'compte_rendu', 'autre']

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const showArchive = searchParams.get('archive') === '1'

  const [showAddForm, setShowAddForm] = useState(false)
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('autre')
  const [fichier, setFichier] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (user) {
      fetchDocuments()
    }
  }, [user, showArchive])

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('archive', showArchive)
      .order('created_at', { ascending: false })

    setDocuments(data || [])
    setLoading(false)
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fichier) return
    setUploading(true)
    setUploadError('')

    const chemin = `${Date.now()}-${fichier.name}`
    const { error: uploadErr } = await supabase.storage.from('documents').upload(chemin, fichier)

    if (uploadErr) {
      setUploadError(uploadErr.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(chemin)

    const { error: insertErr } = await supabase.from('documents').insert({
      titre: titre.trim(),
      description: description.trim() || null,
      fichier_url: urlData.publicUrl,
      type,
    })

    setUploading(false)

    if (insertErr) {
      setUploadError(insertErr.message)
    } else {
      setShowAddForm(false)
      setTitre('')
      setDescription('')
      setType('autre')
      setFichier(null)
      fetchDocuments()
    }
  }

  const toggleArchive = async (doc: Document) => {
    await supabase.from('documents').update({ archive: !doc.archive }).eq('id', doc.id)
    fetchDocuments()
  }

  const handleDelete = async (doc: Document) => {
    if (!window.confirm(`Supprimer "${doc.titre}" ? Cette action est définitive.`)) return

    const marker = '/object/public/documents/'
    const idx = doc.fichier_url.indexOf(marker)
    if (idx !== -1) {
      const chemin = decodeURIComponent(doc.fichier_url.slice(idx + marker.length))
      await supabase.storage.from('documents').remove([chemin])
    }

    await supabase.from('documents').delete().eq('id', doc.id)
    fetchDocuments()
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-parchment">
        <p className="eyebrow">Chargement…</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
      <ModuleHeader
        eyebrowCode="§03"
        eyebrowLabel="Archives"
        title={showArchive ? 'Documents archivés' : 'Documents officiels'}
        subtitle="Statuts, règlement intérieur, procès-verbaux"
      />
      <div className="chevron-band" />

      <main className="max-w-6xl mx-auto p-xl">
        {isAdmin && !showArchive && (
          <button className="btn-primary mb-xl" onClick={() => setShowAddForm(true)}>
            + Ajouter un document
          </button>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-lg">
          {documents.map((doc) => (
            <div key={doc.id} className="signature-card">
              <div className="mb-md">
                <span className={`tag ${getTypeClass(doc.type)}`}>
                  {getTypeLabel(doc.type)}
                </span>
              </div>

              <h3 className="font-display font-bold uppercase text-lg mb-sm">{doc.titre}</h3>

              {doc.description && (
                <p className="text-sm text-brand-ink/70 mb-md">{doc.description}</p>
              )}

              <div className="flex gap-sm mt-auto">
                <a
                  href={doc.fichier_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs flex-1 text-center"
                >
                  Lire
                </a>
                <a
                  href={doc.fichier_url}
                  download
                  className="btn-primary text-xs flex-1 text-center"
                >
                  Télécharger
                </a>
              </div>

              {isAdmin && (
                <div className="flex gap-md mt-sm">
                  <button
                    onClick={() => toggleArchive(doc)}
                    className="text-xs text-brand-petrol hover:underline font-semibold"
                  >
                    {doc.archive ? 'Désarchiver' : 'Archiver'}
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    className="text-xs text-brand-brick hover:underline font-semibold"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {!documents.length && (
          <div className="text-center py-xxl text-brand-ink/50">
            {showArchive ? 'Aucun document archivé.' : 'Aucun document disponible pour le moment.'}
          </div>
        )}

        <div className="mt-xxl">
          {showArchive ? (
            <a href="/documents" className="text-brand-petrol hover:underline text-sm uppercase tracking-[0.1em] font-semibold">
              ← Retour aux documents actifs
            </a>
          ) : (
            <a href="/documents?archive=1" className="text-brand-petrol hover:underline text-sm uppercase tracking-[0.1em] font-semibold">
              Voir les archives →
            </a>
          )}
        </div>
      </main>

      {showAddForm && (
        <div className="fixed inset-0 bg-brand-ink/70 flex items-center justify-center p-xl z-50" onClick={() => setShowAddForm(false)}>
          <div className="signature-card max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-bold uppercase text-xl mb-lg">Ajouter un document</h2>
            <form onSubmit={handleUpload}>
              {uploadError && (
                <div className="border border-brand-brick text-brand-brick p-md mb-md text-sm">{uploadError}</div>
              )}

              <div className="mb-md">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Titre</label>
                <input
                  required
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                />
              </div>

              <div className="mb-md">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Description (optionnel)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                />
              </div>

              <div className="mb-md">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                >
                  {TYPES.map((t) => <option key={t} value={t}>{getTypeLabel(t)}</option>)}
                </select>
              </div>

              <div className="mb-lg">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Fichier (PDF, JPG, PNG)</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                />
              </div>

              <div className="flex gap-sm">
                <button type="submit" disabled={uploading} className="btn-primary flex-1">
                  {uploading ? 'Envoi…' : 'Ajouter'}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowAddForm(false)}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    statut: 'Statuts',
    reglement: 'Règlement intérieur',
    proces_verbal: 'Procès-verbal',
    compte_rendu: 'Compte rendu',
    autre: 'Document',
  }
  return labels[type] || type
}

const getTypeClass = (type: string) => {
  const classes: Record<string, string> = {
    statut: 'border-brand-petrol text-brand-petrol',
    reglement: 'border-brand-brick text-brand-brick',
    proces_verbal: 'border-brand-sky text-brand-petrol',
    compte_rendu: 'border-brand-hairline text-brand-ink/70',
    autre: 'border-brand-hairline text-brand-ink/50',
  }
  return classes[type] || ''
}
