import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import ModuleHeader from '../../components/Layout/ModuleHeader'
import {
  supabase,
  Membre,
  BarProduit,
  BarConsommation,
  BarPaiement,
  BarSolde,
} from '../../lib/supabase'

type MembreOption = Pick<Membre, 'id' | 'prenom' | 'nom'>

type SousOnglet = 'tableau' | 'caisse' | 'stock' | 'ardoises' | 'mon-ardoise'

export default function Bar() {
  const { membre, isBarManager, loading: authLoading } = useAuth()
  const [sousOnglet, setSousOnglet] = useState<SousOnglet>('mon-ardoise')

  useEffect(() => {
    if (isBarManager) setSousOnglet('tableau')
  }, [isBarManager])

  if (authLoading || !membre) {
    return <p className="eyebrow p-xl">Chargement…</p>
  }

  return (
    <div className="min-h-screen bg-brand-parchment font-body text-brand-ink">
      <ModuleHeader eyebrowCode="§09" eyebrowLabel="Amicale" title="Bar" />
      <div className="chevron-band" />

      <main className="max-w-6xl mx-auto p-xl">
        {isBarManager && (
          <div className="flex gap-sm mb-lg border-b border-brand-hairline overflow-x-auto">
            {([
              { id: 'tableau', label: 'Tableau de bord' },
              { id: 'caisse', label: 'Caisse' },
              { id: 'stock', label: 'Stock' },
              { id: 'ardoises', label: 'Ardoises' },
              { id: 'mon-ardoise', label: 'Mon ardoise' },
            ] as { id: SousOnglet; label: string }[]).map((onglet) => (
              <button
                key={onglet.id}
                onClick={() => setSousOnglet(onglet.id)}
                className={`px-md py-sm text-xs uppercase tracking-[0.1em] font-semibold border-b-2 -mb-px whitespace-nowrap ${
                  sousOnglet === onglet.id ? 'border-brand-petrol text-brand-petrol' : 'border-transparent text-brand-ink/50'
                }`}
              >
                {onglet.label}
              </button>
            ))}
          </div>
        )}

        {sousOnglet === 'tableau' && isBarManager && <TableauDeBordPanel />}
        {sousOnglet === 'caisse' && isBarManager && <CaissePanel barman={membre} />}
        {sousOnglet === 'stock' && isBarManager && <StockPanel />}
        {sousOnglet === 'ardoises' && isBarManager && <ArdoisesPanel barman={membre} />}
        {sousOnglet === 'mon-ardoise' && <MonArdoisePanel membre={membre} />}
      </main>
    </div>
  )
}

// --- Utils -------------------------------------------------------------------

function formatMontant(n: number): string {
  return `${n.toFixed(2)} €`
}

function SoldeBadge({ solde }: { solde: number }) {
  if (solde > 0) {
    return <span className="tag bg-success/15 text-success">Crédit : {formatMontant(solde)}</span>
  }
  if (solde < 0) {
    return <span className="tag bg-brand-brick/15 text-brand-brick">Dû : {formatMontant(-solde)}</span>
  }
  return <span className="tag bg-brand-hairline text-brand-ink/50">Solde nul</span>
}

function formatDateHeure(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function fetchMembresOptions(): Promise<MembreOption[]> {
  const { data } = await supabase.from('membres').select('id, prenom, nom').order('nom')
  return data || []
}

// Appelle l'edge function de paiement Zettle (mockée tant que les identifiants
// développeur ne sont pas configurés, cf. supabase/functions/bar-zettle-payment).
async function declencherPaiementZettle(target: 'consommation' | 'paiement', id: string, montant: number) {
  const { data, error } = await supabase.functions.invoke('bar-zettle-payment', {
    body: { target, id, montant },
  })
  if (error) {
    window.alert(`Erreur paiement CB : ${error.message}`)
    return null
  }
  return data as { statut: string; reference: string }
}

// --- Tableau de bord ----------------------------------------------------------

function TableauDeBordPanel() {
  const [loading, setLoading] = useState(true)
  const [consommations, setConsommations] = useState<BarConsommation[]>([])
  const [produits, setProduits] = useState<BarProduit[]>([])
  const [soldes, setSoldes] = useState<BarSolde[]>([])
  const [membresOptions, setMembresOptions] = useState<MembreOption[]>([])

  useEffect(() => {
    (async () => {
      const [{ data: consoData }, { data: produitsData }, { data: soldesData }, membresData] = await Promise.all([
        supabase.from('bar_consommations').select('*'),
        supabase.from('bar_produits').select('*'),
        supabase.from('bar_soldes').select('*'),
        fetchMembresOptions(),
      ])
      setConsommations(consoData || [])
      setProduits(produitsData || [])
      setSoldes(soldesData || [])
      setMembresOptions(membresData)
      setLoading(false)
    })()
  }, [])

  const ca = useMemo(() => consommations.reduce((sum, c) => sum + Number(c.montant_total), 0), [consommations])

  const topProduits = useMemo(() => {
    const parProduit = new Map<string, number>()
    consommations.forEach((c) => parProduit.set(c.produit_id, (parProduit.get(c.produit_id) || 0) + c.quantite))
    return [...parProduit.entries()]
      .map(([produit_id, quantite]) => ({ produit: produits.find((p) => p.id === produit_id), quantite }))
      .filter((x) => x.produit)
      .sort((a, b) => b.quantite - a.quantite)
      .slice(0, 5)
  }, [consommations, produits])

  const plusGrossesArdoises = useMemo(() => {
    return soldes
      .filter((s) => s.solde < 0)
      .sort((a, b) => a.solde - b.solde)
      .slice(0, 5)
      .map((s) => ({ solde: s.solde, membre: membresOptions.find((m) => m.id === s.membre_id) }))
  }, [soldes, membresOptions])

  if (loading) return <p className="eyebrow">Chargement…</p>

  return (
    <div className="space-y-xl">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
        <div className="border border-brand-hairline p-md text-center">
          <p className="font-display font-bold text-2xl text-brand-petrol">{formatMontant(ca)}</p>
          <p className="text-[10px] uppercase tracking-[0.1em] text-brand-ink/50">Chiffre d'affaires total</p>
        </div>
        <div className="border border-brand-hairline p-md text-center">
          <p className="font-display font-bold text-2xl text-brand-petrol">{consommations.length}</p>
          <p className="text-[10px] uppercase tracking-[0.1em] text-brand-ink/50">Ventes enregistrées</p>
        </div>
        <div className="border border-brand-hairline p-md text-center">
          <p className="font-display font-bold text-2xl text-brand-petrol">{plusGrossesArdoises.length}</p>
          <p className="text-[10px] uppercase tracking-[0.1em] text-brand-ink/50">Ardoises en cours</p>
        </div>
      </div>

      <div>
        <p className="eyebrow mb-sm">Produits les plus vendus</p>
        <div className="space-y-xs">
          {topProduits.map(({ produit, quantite }) => (
            <div key={produit!.id} className="flex items-center justify-between border border-brand-hairline px-md py-sm">
              <span>{produit!.icone} {produit!.titre}</span>
              <span className="font-display font-bold text-brand-petrol">{quantite}</span>
            </div>
          ))}
          {!topProduits.length && <p className="text-sm text-brand-ink/50">Aucune vente pour le moment.</p>}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-sm">Plus grosses ardoises</p>
        <div className="space-y-xs">
          {plusGrossesArdoises.map(({ solde, membre }) => (
            <div key={membre?.id} className="flex items-center justify-between border border-brand-hairline px-md py-sm">
              <span>{membre ? `${membre.prenom} ${membre.nom}` : '—'}</span>
              <SoldeBadge solde={solde} />
            </div>
          ))}
          {!plusGrossesArdoises.length && <p className="text-sm text-brand-ink/50">Aucune ardoise en cours.</p>}
        </div>
      </div>
    </div>
  )
}

// --- Caisse --------------------------------------------------------------------

function CaissePanel({ barman }: { barman: Membre }) {
  const [produits, setProduits] = useState<BarProduit[]>([])
  const [membresOptions, setMembresOptions] = useState<MembreOption[]>([])
  const [membreId, setMembreId] = useState('')
  const [invite, setInvite] = useState(false)
  const [nomLibre, setNomLibre] = useState('')
  const [mode, setMode] = useState<'ardoise' | 'cb'>('ardoise')
  const [quantites, setQuantites] = useState<Record<string, number>>({})
  const [vendingId, setVendingId] = useState<string | null>(null)
  const [dernierResultat, setDernierResultat] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const [{ data: produitsData }, membresData] = await Promise.all([
        supabase.from('bar_produits').select('*').eq('actif', true).order('categorie').order('titre'),
        fetchMembresOptions(),
      ])
      setProduits(produitsData || [])
      setMembresOptions(membresData)
    })()
  }, [])

  useEffect(() => {
    if (invite && mode === 'ardoise') setMode('cb')
  }, [invite, mode])

  const categories = useMemo(() => [...new Set(produits.map((p) => p.categorie))], [produits])

  const qte = (produitId: string) => quantites[produitId] ?? 1
  const setQte = (produitId: string, q: number) => setQuantites((prev) => ({ ...prev, [produitId]: Math.max(1, q) }))

  const vendre = async (produit: BarProduit) => {
    if (mode === 'ardoise' && !membreId) {
      window.alert('Sélectionnez un membre pour vendre à l\'ardoise.')
      return
    }
    if (invite && !nomLibre.trim() && mode === 'cb' && !membreId) {
      // Vente CB totalement anonyme autorisée : rien à valider de plus.
    }

    const quantite = qte(produit.id)
    const montant_total = Number((produit.prix * quantite).toFixed(2))
    setVendingId(produit.id)

    const { data: inserted, error } = await supabase
      .from('bar_consommations')
      .insert({
        produit_id: produit.id,
        membre_id: invite ? (membreId || null) : membreId,
        nom_libre: invite && nomLibre.trim() ? nomLibre.trim() : null,
        quantite,
        prix_unitaire: produit.prix,
        montant_total,
        mode_paiement: mode,
        zettle_statut: mode === 'cb' ? 'en_attente' : 'non_applicable',
        enregistre_par: barman.id,
      })
      .select()
      .single()

    if (error) {
      window.alert(`Erreur : ${error.message}`)
      setVendingId(null)
      return
    }

    await supabase.from('bar_produits').update({ stock: produit.stock - quantite }).eq('id', produit.id)
    setProduits((prev) => prev.map((p) => (p.id === produit.id ? { ...p, stock: p.stock - quantite } : p)))

    if (mode === 'cb' && inserted) {
      const resultat = await declencherPaiementZettle('consommation', inserted.id, montant_total)
      setDernierResultat(resultat ? `${produit.titre} × ${quantite} — CB ${resultat.statut} (${resultat.reference})` : null)
    } else {
      setDernierResultat(`${produit.titre} × ${quantite} — ajouté à l'ardoise`)
    }

    setQuantites((prev) => ({ ...prev, [produit.id]: 1 }))
    setVendingId(null)
  }

  return (
    <div className="space-y-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-md items-start border border-brand-hairline p-md">
        <div>
          <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Pour qui ?</label>
          <label className="flex items-center gap-xs text-sm mb-xs">
            <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} />
            Invité / non-membre
          </label>
          {invite ? (
            <input
              value={nomLibre}
              onChange={(e) => setNomLibre(e.target.value)}
              placeholder="Nom (optionnel, ex: invité de Marine)"
              className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm text-sm"
            />
          ) : (
            <select
              value={membreId}
              onChange={(e) => setMembreId(e.target.value)}
              className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm text-sm"
            >
              <option value="">— Choisir un membre —</option>
              {membresOptions.map((m) => <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[0.1em] font-semibold mb-xs text-brand-petrol">Mode de paiement</label>
          <div className="flex gap-sm">
            <button
              onClick={() => setMode('ardoise')}
              disabled={invite}
              className={`flex-1 px-md py-sm text-xs uppercase tracking-[0.1em] font-semibold border disabled:opacity-30 ${mode === 'ardoise' ? 'bg-brand-petrol text-brand-parchment border-brand-petrol' : 'border-brand-hairline'}`}
            >
              Ardoise
            </button>
            <button
              onClick={() => setMode('cb')}
              className={`flex-1 px-md py-sm text-xs uppercase tracking-[0.1em] font-semibold border ${mode === 'cb' ? 'bg-brand-petrol text-brand-parchment border-brand-petrol' : 'border-brand-hairline'}`}
            >
              CB (Zettle)
            </button>
          </div>
        </div>
      </div>

      {dernierResultat && (
        <p className="text-sm text-success">{dernierResultat}</p>
      )}

      {categories.map((cat) => (
        <div key={cat}>
          <p className="eyebrow mb-sm">{cat}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-md">
            {produits.filter((p) => p.categorie === cat).map((produit) => (
              <div key={produit.id} className="border border-brand-hairline p-md text-center space-y-xs">
                <p className="text-2xl">{produit.icone}</p>
                <p className="font-display font-bold uppercase text-sm">{produit.titre}</p>
                <p className="text-xs text-brand-ink/50">{formatMontant(produit.prix)} · stock {produit.stock}</p>
                <div className="flex items-center justify-center gap-xs">
                  <button onClick={() => setQte(produit.id, qte(produit.id) - 1)} className="w-6 h-6 border border-brand-hairline">−</button>
                  <span className="w-6 text-center">{qte(produit.id)}</span>
                  <button onClick={() => setQte(produit.id, qte(produit.id) + 1)} className="w-6 h-6 border border-brand-hairline">+</button>
                </div>
                <button
                  onClick={() => vendre(produit)}
                  disabled={vendingId === produit.id}
                  className="btn-primary text-xs w-full disabled:opacity-50"
                >
                  Vendre
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!produits.length && <p className="text-sm text-brand-ink/50">Aucun produit actif — ajoutez-en dans l'onglet Stock.</p>}
    </div>
  )
}

// --- Stock ---------------------------------------------------------------------

function StockPanel() {
  const [produits, setProduits] = useState<BarProduit[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProduits = async () => {
    const { data } = await supabase.from('bar_produits').select('*').order('categorie').order('titre')
    setProduits(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchProduits() }, [])

  if (loading) return <p className="eyebrow">Chargement…</p>

  return (
    <div className="space-y-md">
      {produits.map((produit) => (
        <ProduitCard key={produit.id} produit={produit} onSaved={fetchProduits} />
      ))}
      {!produits.length && <p className="text-sm text-brand-ink/50">Aucun produit pour le moment.</p>}
      <NouveauProduitForm onSaved={fetchProduits} />
    </div>
  )
}

function ProduitCard({ produit, onSaved }: { produit: BarProduit; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [titre, setTitre] = useState(produit.titre)
  const [icone, setIcone] = useState(produit.icone)
  const [categorie, setCategorie] = useState(produit.categorie)
  const [prix, setPrix] = useState(String(produit.prix))
  const [ajoutStock, setAjoutStock] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await supabase
      .from('bar_produits')
      .update({ titre: titre.trim(), icone: icone.trim() || '🍺', categorie: categorie.trim() || 'Divers', prix: Number(prix) || 0 })
      .eq('id', produit.id)
    setSaving(false)
    setEditing(false)
    onSaved()
  }

  const toggleActif = async () => {
    await supabase.from('bar_produits').update({ actif: !produit.actif }).eq('id', produit.id)
    onSaved()
  }

  const reapprovisionner = async () => {
    const quantite = Number(ajoutStock)
    if (!quantite) return
    await supabase.from('bar_produits').update({ stock: produit.stock + quantite }).eq('id', produit.id)
    setAjoutStock('')
    onSaved()
  }

  const supprimer = async () => {
    if (!window.confirm(`Supprimer "${produit.titre}" ? Son historique de ventes sera conservé mais le produit ne pourra plus être vendu.`)) return
    const { error } = await supabase.from('bar_produits').delete().eq('id', produit.id)
    if (error) {
      // Des consommations référencent ce produit (ON DELETE RESTRICT) : on
      // le désactive à la place, ce qui le retire de la caisse sans perdre
      // l'historique.
      await supabase.from('bar_produits').update({ actif: false }).eq('id', produit.id)
    }
    onSaved()
  }

  if (editing) {
    return (
      <div className="border border-brand-hairline p-md space-y-sm">
        <div className="flex gap-sm">
          <input value={icone} onChange={(e) => setIcone(e.target.value)} maxLength={2} className="w-16 text-center border border-brand-hairline bg-brand-parchment px-md py-sm text-sm" />
          <input value={titre} onChange={(e) => setTitre(e.target.value)} className="flex-1 border border-brand-hairline bg-brand-parchment px-md py-sm text-sm" />
        </div>
        <div className="flex gap-sm">
          <input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Catégorie" className="flex-1 border border-brand-hairline bg-brand-parchment px-md py-sm text-sm" />
          <input value={prix} onChange={(e) => setPrix(e.target.value)} type="number" step="0.10" min="0" placeholder="Prix" className="w-28 border border-brand-hairline bg-brand-parchment px-md py-sm text-sm" />
        </div>
        <div className="flex gap-sm">
          <button onClick={save} disabled={saving} className="btn-primary text-xs flex-1">Enregistrer</button>
          <button onClick={() => setEditing(false)} className="btn-secondary text-xs flex-1">Annuler</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`border border-brand-hairline p-md flex flex-wrap items-center gap-md ${!produit.actif ? 'opacity-50' : ''}`}>
      <span className="text-2xl">{produit.icone}</span>
      <div className="flex-1 min-w-[140px]">
        <p className="font-display font-bold uppercase">{produit.titre}</p>
        <p className="text-xs text-brand-ink/50">{produit.categorie} · {formatMontant(produit.prix)} · stock {produit.stock}</p>
      </div>
      <div className="flex items-center gap-xs">
        <input
          value={ajoutStock}
          onChange={(e) => setAjoutStock(e.target.value)}
          type="number"
          placeholder="+ stock"
          className="w-20 border border-brand-hairline bg-brand-parchment px-sm py-xs text-xs"
        />
        <button onClick={reapprovisionner} className="btn-secondary text-xs px-sm py-xs">Ajouter</button>
      </div>
      <div className="flex gap-md whitespace-nowrap">
        <button onClick={toggleActif} className="text-xs text-brand-petrol hover:underline font-semibold">
          {produit.actif ? 'Désactiver' : 'Réactiver'}
        </button>
        <button onClick={() => setEditing(true)} className="text-xs text-brand-petrol hover:underline font-semibold">Modifier</button>
        <button onClick={supprimer} className="text-xs text-brand-brick hover:underline font-semibold">Supprimer</button>
      </div>
    </div>
  )
}

function NouveauProduitForm({ onSaved }: { onSaved: () => void }) {
  const [titre, setTitre] = useState('')
  const [icone, setIcone] = useState('🍺')
  const [categorie, setCategorie] = useState('')
  const [prix, setPrix] = useState('')
  const [stock, setStock] = useState('0')
  const [creating, setCreating] = useState(false)

  const creer = async () => {
    if (!titre.trim() || !categorie.trim() || !prix) return
    setCreating(true)
    await supabase.from('bar_produits').insert({
      titre: titre.trim(),
      icone: icone.trim() || '🍺',
      categorie: categorie.trim(),
      prix: Number(prix),
      stock: Number(stock) || 0,
    })
    setTitre('')
    setCategorie('')
    setPrix('')
    setStock('0')
    setCreating(false)
    onSaved()
  }

  return (
    <div className="border-t border-brand-hairline pt-md">
      <p className="eyebrow mb-sm">Nouveau produit</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-sm items-start">
        <input value={icone} onChange={(e) => setIcone(e.target.value)} maxLength={2} placeholder="🍺" className="text-center border border-brand-hairline bg-brand-parchment px-md py-sm text-sm" />
        <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Nom" className="border border-brand-hairline bg-brand-parchment px-md py-sm text-sm" />
        <input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Catégorie" className="border border-brand-hairline bg-brand-parchment px-md py-sm text-sm" />
        <input value={prix} onChange={(e) => setPrix(e.target.value)} type="number" step="0.10" min="0" placeholder="Prix (€)" className="border border-brand-hairline bg-brand-parchment px-md py-sm text-sm" />
        <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" placeholder="Stock initial" className="border border-brand-hairline bg-brand-parchment px-md py-sm text-sm" />
      </div>
      <button onClick={creer} disabled={creating} className="btn-primary text-xs mt-sm">+ Ajouter le produit</button>
    </div>
  )
}

// --- Ardoises (vue bureau/barman) -----------------------------------------------

function ArdoisesPanel({ barman }: { barman: Membre }) {
  const [soldes, setSoldes] = useState<BarSolde[]>([])
  const [membresOptions, setMembresOptions] = useState<MembreOption[]>([])
  const [loading, setLoading] = useState(true)
  const [membreOuvert, setMembreOuvert] = useState<MembreOption | null>(null)

  const fetchAll = async () => {
    const [{ data: soldesData }, membresData] = await Promise.all([
      supabase.from('bar_soldes').select('*'),
      fetchMembresOptions(),
    ])
    setSoldes(soldesData || [])
    setMembresOptions(membresData)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const lignes = useMemo(() => {
    return membresOptions
      .map((m) => ({ membre: m, solde: soldes.find((s) => s.membre_id === m.id)?.solde ?? 0 }))
      .filter((l) => l.solde !== 0)
      .sort((a, b) => a.solde - b.solde)
  }, [membresOptions, soldes])

  if (loading) return <p className="eyebrow">Chargement…</p>

  return (
    <div className="space-y-md">
      {lignes.map(({ membre, solde }) => (
        <div key={membre.id} className="flex items-center justify-between border border-brand-hairline p-md">
          <span className="font-medium">{membre.prenom} {membre.nom}</span>
          <div className="flex items-center gap-md">
            <SoldeBadge solde={solde} />
            <button onClick={() => setMembreOuvert(membre)} className="text-xs text-brand-petrol hover:underline font-semibold">
              Régler
            </button>
          </div>
        </div>
      ))}
      {!lignes.length && <p className="text-sm text-brand-ink/50">Aucune ardoise en cours — tous les soldes sont à zéro.</p>}

      {membreOuvert && (
        <ReglementEditor
          membre={membreOuvert}
          barman={barman}
          onClose={() => setMembreOuvert(null)}
          onSaved={() => { fetchAll(); setMembreOuvert(null) }}
        />
      )}
    </div>
  )
}

function ReglementEditor({ membre, barman, onClose, onSaved }: { membre: MembreOption; barman: Membre; onClose: () => void; onSaved: () => void }) {
  const [montant, setMontant] = useState('')
  const [mode, setMode] = useState<'cb' | 'especes'>('especes')
  const [saving, setSaving] = useState(false)

  const enregistrer = async () => {
    const valeur = Number(montant)
    if (!valeur || valeur <= 0) return
    setSaving(true)
    const { data: inserted, error } = await supabase
      .from('bar_paiements')
      .insert({ membre_id: membre.id, montant: valeur, mode, zettle_statut: mode === 'cb' ? 'en_attente' : 'non_applicable', enregistre_par: barman.id })
      .select()
      .single()

    if (error) {
      window.alert(`Erreur : ${error.message}`)
      setSaving(false)
      return
    }

    if (mode === 'cb' && inserted) {
      await declencherPaiementZettle('paiement', inserted.id, valeur)
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-brand-ink/70 flex items-center justify-center p-xl z-50" onClick={onClose}>
      <div className="signature-card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-bold uppercase mb-sm">Règlement — {membre.prenom} {membre.nom}</h3>
        <div className="space-y-sm mb-md">
          <input
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            type="number"
            step="0.10"
            min="0"
            placeholder="Montant (€)"
            className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm text-sm"
          />
          <div className="flex gap-sm">
            <button onClick={() => setMode('especes')} className={`flex-1 px-md py-sm text-xs uppercase tracking-[0.1em] font-semibold border ${mode === 'especes' ? 'bg-brand-petrol text-brand-parchment border-brand-petrol' : 'border-brand-hairline'}`}>Espèces</button>
            <button onClick={() => setMode('cb')} className={`flex-1 px-md py-sm text-xs uppercase tracking-[0.1em] font-semibold border ${mode === 'cb' ? 'bg-brand-petrol text-brand-parchment border-brand-petrol' : 'border-brand-hairline'}`}>CB (Zettle)</button>
          </div>
        </div>
        <div className="flex gap-sm">
          <button onClick={enregistrer} disabled={saving} className="btn-primary text-xs flex-1">Enregistrer</button>
          <button onClick={onClose} className="btn-secondary text-xs flex-1">Fermer</button>
        </div>
      </div>
    </div>
  )
}

// --- Mon ardoise (tout membre) ---------------------------------------------------

type LigneHistorique = {
  id: string
  date: string
  libelle: string
  montant: number // positif = crédit (paiement), négatif = débit (conso ardoise)
}

function MonArdoisePanel({ membre }: { membre: Membre }) {
  const [produits, setProduits] = useState<BarProduit[]>([])
  const [solde, setSolde] = useState(0)
  const [historique, setHistorique] = useState<LigneHistorique[]>([])
  const [quantites, setQuantites] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [ajoutEnCours, setAjoutEnCours] = useState<string | null>(null)

  const fetchAll = async () => {
    const [{ data: produitsData }, { data: soldeData }, { data: consoData }, { data: paiementsData }] = await Promise.all([
      supabase.from('bar_produits').select('*').eq('actif', true).order('categorie').order('titre'),
      supabase.from('bar_soldes').select('*').eq('membre_id', membre.id).maybeSingle(),
      supabase.from('bar_consommations').select('*, bar_produits(titre, icone)').eq('membre_id', membre.id).eq('mode_paiement', 'ardoise').order('created_at', { ascending: false }),
      supabase.from('bar_paiements').select('*').eq('membre_id', membre.id).order('created_at', { ascending: false }),
    ])

    setProduits(produitsData || [])
    setSolde(soldeData?.solde ?? 0)

    const lignesConso: LigneHistorique[] = (consoData || []).map((c: BarConsommation & { bar_produits?: { titre: string; icone: string } }) => ({
      id: c.id,
      date: c.created_at,
      libelle: `${c.bar_produits?.icone ?? ''} ${c.bar_produits?.titre ?? 'Produit'} × ${c.quantite}`.trim(),
      montant: -Number(c.montant_total),
    }))
    const lignesPaiement: LigneHistorique[] = (paiementsData || []).map((p: BarPaiement) => ({
      id: p.id,
      date: p.created_at,
      libelle: `Règlement (${p.mode === 'cb' ? 'CB' : 'espèces'})`,
      montant: Number(p.montant),
    }))

    setHistorique([...lignesConso, ...lignesPaiement].sort((a, b) => b.date.localeCompare(a.date)))
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membre.id])

  const categories = useMemo(() => [...new Set(produits.map((p) => p.categorie))], [produits])
  const qte = (produitId: string) => quantites[produitId] ?? 1
  const setQte = (produitId: string, q: number) => setQuantites((prev) => ({ ...prev, [produitId]: Math.max(1, q) }))

  const ajouterAMonArdoise = async (produit: BarProduit) => {
    const quantite = qte(produit.id)
    setAjoutEnCours(produit.id)
    await supabase.from('bar_consommations').insert({
      produit_id: produit.id,
      membre_id: membre.id,
      quantite,
      prix_unitaire: produit.prix,
      montant_total: Number((produit.prix * quantite).toFixed(2)),
      mode_paiement: 'ardoise',
      enregistre_par: null,
    })
    await supabase.from('bar_produits').update({ stock: produit.stock - quantite }).eq('id', produit.id)
    setQuantites((prev) => ({ ...prev, [produit.id]: 1 }))
    setAjoutEnCours(null)
    fetchAll()
  }

  if (loading) return <p className="eyebrow">Chargement…</p>

  return (
    <div className="space-y-xl">
      <div className="flex items-center justify-between border border-brand-hairline p-md">
        <p className="font-display font-bold uppercase">Mon ardoise</p>
        <SoldeBadge solde={solde} />
      </div>

      <div>
        <p className="eyebrow mb-sm">Self-service — je me sers</p>
        {categories.map((cat) => (
          <div key={cat} className="mb-md">
            <p className="text-xs uppercase tracking-[0.1em] text-brand-ink/50 mb-xs">{cat}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-md">
              {produits.filter((p) => p.categorie === cat).map((produit) => (
                <div key={produit.id} className="border border-brand-hairline p-md text-center space-y-xs">
                  <p className="text-2xl">{produit.icone}</p>
                  <p className="font-display font-bold uppercase text-sm">{produit.titre}</p>
                  <p className="text-xs text-brand-ink/50">{formatMontant(produit.prix)}</p>
                  <div className="flex items-center justify-center gap-xs">
                    <button onClick={() => setQte(produit.id, qte(produit.id) - 1)} className="w-6 h-6 border border-brand-hairline">−</button>
                    <span className="w-6 text-center">{qte(produit.id)}</span>
                    <button onClick={() => setQte(produit.id, qte(produit.id) + 1)} className="w-6 h-6 border border-brand-hairline">+</button>
                  </div>
                  <button
                    onClick={() => ajouterAMonArdoise(produit)}
                    disabled={ajoutEnCours === produit.id}
                    className="btn-primary text-xs w-full disabled:opacity-50"
                  >
                    Ajouter à mon ardoise
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!produits.length && <p className="text-sm text-brand-ink/50">Aucun produit disponible pour le moment.</p>}
      </div>

      <div>
        <p className="eyebrow mb-sm">Historique</p>
        <div className="space-y-xs">
          {historique.map((ligne) => (
            <div key={ligne.id} className="flex items-center justify-between border border-brand-hairline px-md py-sm text-sm">
              <div>
                <p>{ligne.libelle}</p>
                <p className="text-xs text-brand-ink/50">{formatDateHeure(ligne.date)}</p>
              </div>
              <span className={ligne.montant >= 0 ? 'text-success font-semibold' : 'text-brand-brick font-semibold'}>
                {ligne.montant >= 0 ? '+' : ''}{formatMontant(ligne.montant)}
              </span>
            </div>
          ))}
          {!historique.length && <p className="text-sm text-brand-ink/50">Aucun mouvement pour le moment.</p>}
        </div>
      </div>
    </div>
  )
}
