const COULEURS = ['bg-brand-petrol', 'bg-brand-brick', 'bg-brand-sky']

type AvatarProps = {
  prenom: string
  nom: string
  photoUrl: string | null
  size?: 'sm' | 'md'
}

export default function Avatar({ prenom, nom, photoUrl, size = 'md' }: AvatarProps) {
  const dimension = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-12 h-12 text-base'

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${prenom} ${nom}`}
        className={`${dimension} rounded-full object-cover border border-brand-hairline flex-shrink-0`}
      />
    )
  }

  const initiales = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase()
  const couleur = COULEURS[(prenom.charCodeAt(0) + nom.charCodeAt(0)) % COULEURS.length]

  return (
    <span
      className={`${dimension} ${couleur} rounded-full flex items-center justify-center font-display font-bold text-brand-parchment flex-shrink-0`}
      aria-hidden="true"
    >
      {initiales}
    </span>
  )
}
