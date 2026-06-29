-- Correction ponctuelle : les 22 membres importés via CSV ont prénom/nom
-- inversés (colonnes échangées dans le fichier d'origine). À exécuter une
-- seule fois dans Supabase Dashboard → SQL Editor.
-- Ne touche pas la ligne "Benoit Degove" (président), qui n'a pas été
-- importée via ce CSV et est déjà correcte.

UPDATE membres
SET nom = prenom, prenom = nom
WHERE email IN (
  'alexandre.cassagnaud@sdis59.fr',
  'sylvain.coch@sdis59.fr',
  'stephanie.delhaye@sdis59.fr',
  'tom.devynck@sdis59.fr',
  'thomas.drapier@sdis59.fr',
  'bernard.duhot@sdis59.fr',
  'serge.duee@sdis59.fr',
  'cecilia.enger@sdis59.fr',
  'david.fauvel@sdis59.fr',
  'olden.haegeman@sdis59.fr',
  'clarisse.ivanovitch@sdis59.fr',
  'annelyse.lecas@sdis59.fr',
  'marine.lefevre@sdis59.fr',
  'solene.manable@sdis59.fr',
  'charles.michelesi@sdis59.fr',
  'christian.nativite@sdis59.fr',
  'jeremy.noe@sdis59.fr',
  'fabien.passion@sdis59.fr',
  'bastien.pedroli@sdis59.fr',
  'corentin.quintelier@sdis59.fr',
  'valentin.timmerman@sdis59.fr',
  'thomas.truffier@sdis59.fr'
);
