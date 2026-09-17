-- Le verrou sur stock_minimum ne couvrait que les UPDATE : un barman pouvait
-- encore choisir un stock_minimum arbitraire à la création d'un produit.
-- Étend le trigger à l'INSERT (pas d'OLD dans ce cas, on force simplement la
-- valeur par défaut plutôt que de la recopier).
DROP TRIGGER trg_lock_bar_produits_bureau_fields ON bar_produits;

CREATE OR REPLACE FUNCTION lock_bar_produits_bureau_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' AND NOT is_bureau(auth.jwt()->>'email') THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.stock_minimum := OLD.stock_minimum;
    ELSE
      NEW.stock_minimum := 5;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_bar_produits_bureau_fields
  BEFORE INSERT OR UPDATE ON bar_produits
  FOR EACH ROW EXECUTE FUNCTION lock_bar_produits_bureau_fields();
