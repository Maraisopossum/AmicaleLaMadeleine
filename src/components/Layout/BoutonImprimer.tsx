type BoutonImprimerProps = {
  targetId: string
  titre: string
  orientation?: 'portrait' | 'landscape'
}

export default function BoutonImprimer({ targetId, titre, orientation = 'portrait' }: BoutonImprimerProps) {
  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #${targetId}, #${targetId} * { visibility: visible; }
          #${targetId} { position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: A4 ${orientation}; margin: 15mm; }
        }
      `}</style>
      <button onClick={() => window.print()} className="btn-secondary text-xs print:hidden" title={`Imprimer ${titre}`}>
        Imprimer / PDF
      </button>
    </>
  )
}

export function EnteteImpression({ titre }: { titre: string }) {
  return (
    <div className="hidden print:flex items-center justify-between border-b border-black pb-sm mb-lg">
      <div className="flex items-center gap-sm">
        <img src="/Logo.png" alt="" className="h-10 w-auto" />
        <div>
          <p className="font-bold text-sm leading-tight">Amicale des Sapeurs-Pompiers de La Madeleine</p>
          <p className="text-xs leading-tight">{titre}</p>
        </div>
      </div>
      <p className="text-xs">{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>
  )
}
