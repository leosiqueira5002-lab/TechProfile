BEGIN;

SELECT plan(24);

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'checkout-free@example.invalid', '{}', now(), now()),
  ('20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'checkout-active@example.invalid', '{}', now(), now()),
  ('20000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'checkout-expired@example.invalid', '{}', now(), now());

SELECT is(
  public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001', 'fake-free-001', 19.90, 'BRL', 'pending', 30),
  'not-approved', 'pending payment is recorded without granting Pro'
);
SELECT is((SELECT plan FROM public.profiles WHERE user_id = '20000000-0000-4000-8000-000000000001'), 'free', 'pending payment keeps the profile Free');
SELECT is(
  public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001', 'fake-free-001', 19.90, 'BRL', 'approved', 30),
  'granted', 'approved transition grants Pro'
);
SELECT is((SELECT plan FROM public.profiles WHERE user_id = '20000000-0000-4000-8000-000000000001'), 'pro', 'approved payment sets plan Pro');
SELECT is((SELECT pro_expires_at FROM public.profiles WHERE user_id = '20000000-0000-4000-8000-000000000001'), now() + interval '30 days', 'Free profile receives 30 days from now');
SELECT is((SELECT count(*)::integer FROM public.payments WHERE provider_payment_id = 'fake-free-001'), 1, 'pending-to-approved transition keeps one payment row');

SELECT is(
  public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001', 'fake-free-001', 19.90, 'BRL', 'approved', 30),
  'duplicate', 'duplicate approved payment does not grant again'
);
SELECT is((SELECT pro_expires_at FROM public.profiles WHERE user_id = '20000000-0000-4000-8000-000000000001'), now() + interval '30 days', 'duplicate does not extend expiry');
SELECT is(
  public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001', 'fake-free-001', 19.90, 'BRL', 'pending', 30),
  'duplicate', 'late pending notification cannot downgrade approved payment'
);
SELECT is((SELECT status FROM public.payments WHERE provider_payment_id = 'fake-free-001'), 'approved', 'approved payment status is not regressed by late event');

UPDATE public.profiles
SET plan = 'pro', pro_expires_at = now() + interval '20 days'
WHERE user_id = '20000000-0000-4000-8000-000000000002';
SELECT is(
  public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000002', 'fake-active-001', 19.90, 'BRL', 'approved', 30),
  'granted', 'new payment for active Pro grants additional days'
);
SELECT is((SELECT pro_expires_at FROM public.profiles WHERE user_id = '20000000-0000-4000-8000-000000000002'), now() + interval '50 days', 'active Pro receives 30 days after current expiry');

UPDATE public.profiles
SET plan = 'pro', pro_expires_at = now() - interval '5 days'
WHERE user_id = '20000000-0000-4000-8000-000000000003';
SELECT is(
  public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000003', 'fake-expired-001', 19.90, 'BRL', 'approved', 30),
  'granted', 'new payment for expired Pro grants a new period'
);
SELECT is((SELECT pro_expires_at FROM public.profiles WHERE user_id = '20000000-0000-4000-8000-000000000003'), now() + interval '30 days', 'expired Pro receives 30 days from now');

SELECT throws_ok(
  $$SELECT public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001', 'fake-amount-001', 1.00, 'BRL', 'approved', 30)$$,
  '22023', NULL, 'wrong amount is rejected'
);
SELECT throws_ok(
  $$SELECT public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001', 'fake-currency-001', 19.90, 'USD', 'approved', 30)$$,
  '22023', NULL, 'wrong currency is rejected'
);
SELECT throws_ok(
  $$SELECT public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001', 'fake-days-001', 19.90, 'BRL', 'approved', 60)$$,
  '22023', NULL, 'wrong access duration is rejected'
);
SELECT throws_ok(
  $$SELECT public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000001', 'fake-status-001', 19.90, 'BRL', 'unknown', 30)$$,
  '22023', NULL, 'unknown payment status is rejected'
);
SELECT throws_ok(
  $$SELECT public.apply_mercado_pago_payment('20000000-0000-4000-8000-000000000002', 'fake-free-001', 19.90, 'BRL', 'approved', 30)$$,
  '23505', NULL, 'payment id cannot be rebound to another user'
);

SELECT ok(has_function_privilege('service_role', 'public.apply_mercado_pago_payment(uuid,text,numeric,text,text,integer)', 'EXECUTE'), 'service_role can call payment RPC');
SELECT ok(NOT has_function_privilege('authenticated', 'public.apply_mercado_pago_payment(uuid,text,numeric,text,text,integer)', 'EXECUTE'), 'authenticated cannot call payment RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.apply_mercado_pago_payment(uuid,text,numeric,text,text,integer)', 'EXECUTE'), 'anon cannot call payment RPC');
SELECT is((SELECT count(*)::integer FROM public.payments WHERE provider_payment_id LIKE 'fake-%'), 3, 'only the three validated payment IDs are recorded');

SELECT * FROM finish();
ROLLBACK;
