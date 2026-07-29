CREATE OR REPLACE FUNCTION public.prevent_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) <> 'service_role'
     AND coalesce(current_setting('request.jwt.claim.role', true), current_setting('request.jwt.claims', true), '') <> ''
     AND NOT public.has_role(auth.uid(),'admin') THEN
    NEW.status := OLD.status;
    NEW.review_reason := OLD.review_reason;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.email_verified := OLD.email_verified;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $function$;