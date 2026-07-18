import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'

export default function MonCompte() {
  const { user, membre, loading: authLoading, refreshMembre } = useAuth()

  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [profilError, setProfilError] = useState('')
  const [profilSuccess, setProfilSuccess] = useState(false)
  const [savingProfil, setSavingProfil] = useState(false)

  useEffect(() => {
    if (membre) {
      setPrenom(membre.prenom)
      setNom(membre.nom)
    }
  }, [membre])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (nouveauMdp.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.')
      return
    }
    if (nouveauMdp !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: nouveauMdp })

    if (updateError) {
      setSaving(false)
      setError(updateError.message)
      return
    }

    if (membre?.doit_changer_mdp) {
      // Lève le flag côté serveur (verrouillé pour l'écriture directe, voir
      // 20240121000000_membres_doit_changer_mdp.sql) une fois le mot de passe
      // effectivement changé, pour ne plus être redirigé de force ici.
      await supabase.rpc('clear_doit_changer_mdp')
      await refreshMembre()
    }

    setSaving(false)
    setSuccess(true)
    setNouveauMdp('')
    setConfirmation('')
  }

  const handleProfilSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!membre) return
    setProfilError('')
    setProfilSuccess(false)
    setSavingProfil(true)

    const { error: updateError } = await supabase
      .from('membres')
      .update({ prenom: prenom.trim(), nom: nom.trim() })
      .eq('id', membre.id)

    setSavingProfil(false)

    if (updateError) {
      setProfilError(updateError.message)
    } else {
      setProfilSuccess(true)
      await refreshMembre()
    }
  }

  if (authLoading) {
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
        eyebrowCode="§06"
        eyebrowLabel="Mon compte"
        title="Mon compte"
        subtitle={membre ? `${membre.prenom} ${membre.nom} — ${user.email}` : user.email ?? undefined}
      />
      <div className="chevron-band" />

      <main className="max-w-md mx-auto p-xl space-y-xl">
        {membre?.doit_changer_mdp && (
          <div className="border border-brand-brick text-brand-brick p-md text-sm">
            Un mot de passe temporaire t'a été attribué par le bureau. Choisis un nouveau mot de passe ci-dessous pour continuer.
          </div>
        )}

        {membre && (
          <div className="signature-card">
            <h2 className="font-display font-bold uppercase text-xl mb-lg">Mes informations</h2>

            {profilSuccess && (
              <div className="border border-brand-petrol text-brand-petrol p-md mb-md text-sm">
                Informations mises à jour.
              </div>
            )}
            {profilError && (
              <div className="border border-brand-brick text-brand-brick p-md mb-md text-sm">{profilError}</div>
            )}

            <form onSubmit={handleProfilSubmit}>
              <div className="mb-md">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">
                  Prénom
                </label>
                <input
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                  required
                />
              </div>
              <div className="mb-lg">
                <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">
                  Nom
                </label>
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                  required
                />
              </div>
              <button type="submit" disabled={savingProfil} className="btn-primary w-full">
                {savingProfil ? 'Enregistrement…' : 'Mettre à jour mes informations'}
              </button>
            </form>
          </div>
        )}

        <div className="signature-card">
          <h2 className="font-display font-bold uppercase text-xl mb-lg">Changer mon mot de passe</h2>

          {success && (
            <div className="border border-brand-petrol text-brand-petrol p-md mb-md text-sm">
              Mot de passe mis à jour.
            </div>
          )}
          {error && (
            <div className="border border-brand-brick text-brand-brick p-md mb-md text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-md">
              <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={nouveauMdp}
                onChange={(e) => setNouveauMdp(e.target.value)}
                className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                required
                minLength={8}
              />
            </div>
            <div className="mb-lg">
              <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol"
                required
                minLength={8}
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? 'Enregistrement…' : 'Mettre à jour le mot de passe'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
