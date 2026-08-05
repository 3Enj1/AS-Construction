-- ============================================================
-- Stock alert notifications: email + WhatsApp to the admin whenever
-- a material crosses its low-stock threshold, in either direction
-- (drops below = low stock, comes back up = restocked).
--
-- Extends apply_material_transaction() (the existing materials
-- ledger trigger) instead of adding a second trigger, so old/new
-- stock are read from the same atomic update. The in-app
-- `notifications` row (already existed for low stock) is kept as-is;
-- this adds a fire-and-forget HTTP call to a Supabase Edge Function
-- (see supabase/functions/notify-stock-alert) which sends the actual
-- email + WhatsApp message. net.http_post is async (queues the
-- request via pg_net) so a slow/down notification service can never
-- block or fail a stock transaction.
-- ============================================================

create extension if not exists pg_net with schema extensions;

create or replace function public.apply_material_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_stock numeric;
  v_old_stock numeric;
  v_threshold numeric;
  v_name text;
  v_unit text;
  -- Deployed Edge Function URL for this project + a shared secret it
  -- checks on every request (set the same value as the
  -- WEBHOOK_SHARED_SECRET function secret — see deployment notes).
  v_webhook_url text := 'https://iwrwhhglagzsvvgpsuop.supabase.co/functions/v1/notify-stock-alert';
  v_webhook_secret text := '70791d789c72ecdb830a12d89d94a795adf8d3137c8fa2ea';
begin
  update public.materials
     set stock = stock + new.qty_delta
   where id = new.material_id
     and stock + new.qty_delta >= 0
  returning stock, threshold, name, unit into v_new_stock, v_threshold, v_name, v_unit;

  if not found then
    raise exception 'Insufficient stock for material % (requested delta %)', new.material_id, new.qty_delta
      using errcode = '23514';
  end if;

  v_old_stock := v_new_stock - new.qty_delta;

  if v_old_stock >= v_threshold and v_new_stock < v_threshold then
    insert into public.notifications (for_role, title, body, kind, link_url)
    values (
      'admin',
      'Low stock: ' || v_name,
      v_name || ' dropped to ' || v_new_stock || ' (threshold ' || v_threshold || ').',
      'warning',
      '/materials'
    );

    perform net.http_post(
      url := v_webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_webhook_secret),
      body := jsonb_build_object(
        'event', 'low_stock',
        'material', v_name,
        'stock', v_new_stock,
        'threshold', v_threshold,
        'unit', v_unit
      )
    );
  elsif v_old_stock < v_threshold and v_new_stock >= v_threshold then
    insert into public.notifications (for_role, title, body, kind, link_url)
    values (
      'admin',
      'Restocked: ' || v_name,
      v_name || ' is back up to ' || v_new_stock || ' (threshold ' || v_threshold || ').',
      'success',
      '/materials'
    );

    perform net.http_post(
      url := v_webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_webhook_secret),
      body := jsonb_build_object(
        'event', 'restocked',
        'material', v_name,
        'stock', v_new_stock,
        'threshold', v_threshold,
        'unit', v_unit
      )
    );
  end if;

  return new;
end;
$$;
