BEGIN;

SELECT plan(27);

INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'profiles-a@example.invalid', '{"plan":"pro","pro_expires_at":"2099-01-01T00:00:00Z"}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'profiles-b@example.invalid', '{}'::jsonb, now(), now());

SELECT has_table('public', 'profiles', 'profiles table exists');
SELECT has_table('public', 'payments', 'payments table exists');
SELECT has_column('public', 'profiles', 'plan', 'profiles stores plan');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass), 'RLS enabled on profiles');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.payments'::regclass), 'RLS enabled on payments');
SELECT is((SELECT plan FROM public.profiles WHERE user_id = '10000000-0000-4000-8000-000000000001'), 'free', 'signup creates Free profile despite untrusted metadata');
SELECT is((SELECT pro_expires_at FROM public.profiles WHERE user_id = '10000000-0000-4000-8000-000000000001'), NULL::timestamptz, 'signup profile has no Pro expiry');
SELECT is((SELECT count(*)::integer FROM public.profiles WHERE user_id = '10000000-0000-4000-8000-000000000002'), 1, 'signup creates one profile for second user');

-- Model a pre-existing profile and a legacy Auth user without a profile.
UPDATE public.profiles
SET plan = 'pro', pro_expires_at = '2099-01-01T00:00:00Z'
WHERE user_id = '10000000-0000-4000-8000-000000000001';
DELETE FROM public.profiles WHERE user_id = '10000000-0000-4000-8000-000000000002';
INSERT INTO public.profiles (user_id)
SELECT u.id
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.profiles (user_id)
SELECT u.id
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

SELECT is((SELECT plan FROM public.profiles WHERE user_id = '10000000-0000-4000-8000-000000000001'), 'pro', 'backfill preserves existing profile values');
SELECT is((SELECT count(*)::integer FROM public.profiles WHERE user_id = '10000000-0000-4000-8000-000000000002'), 1, 'repeated backfill keeps one profile');

INSERT INTO public.payments (user_id, provider, provider_payment_id, amount, status)
VALUES ('10000000-0000-4000-8000-000000000001', 'mercado_pago', 'test-payment-001', 10.00, 'approved');
INSERT INTO public.payments (user_id, provider, provider_payment_id, amount, status)
VALUES ('10000000-0000-4000-8000-000000000002', 'mercado_pago', 'test-payment-002', 10.00, 'pending');
SELECT is((SELECT currency FROM public.payments WHERE provider_payment_id = 'test-payment-001'), 'BRL', 'payment currency defaults to BRL');
SELECT is((SELECT access_days FROM public.payments WHERE provider_payment_id = 'test-payment-001'), 30, 'payment access duration defaults to 30 days');
SELECT throws_ok(
  $$INSERT INTO public.payments (user_id, provider, provider_payment_id, amount, status)
    VALUES ('10000000-0000-4000-8000-000000000001', 'mercado_pago', 'test-payment-001', 10.00, 'approved')$$,
  '23505', NULL, 'duplicate provider payment id is rejected'
);

SELECT ok(NOT has_table_privilege('authenticated', 'public.profiles', 'INSERT'), 'authenticated cannot insert profiles');
SELECT ok(NOT has_table_privilege('authenticated', 'public.profiles', 'UPDATE'), 'authenticated cannot update profiles');
SELECT ok(NOT has_table_privilege('authenticated', 'public.profiles', 'DELETE'), 'authenticated cannot delete profiles');
SELECT ok(NOT has_table_privilege('authenticated', 'public.payments', 'INSERT'), 'authenticated cannot insert payments');
SELECT ok(NOT has_table_privilege('authenticated', 'public.payments', 'UPDATE'), 'authenticated cannot update payments');
SELECT ok(NOT has_table_privilege('authenticated', 'public.payments', 'DELETE'), 'authenticated cannot delete payments');
SELECT ok(NOT has_table_privilege('anon', 'public.profiles', 'SELECT'), 'anon cannot read profiles');
SELECT ok(NOT has_table_privilege('anon', 'public.payments', 'SELECT'), 'anon cannot read payments');
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd <> 'SELECT'), 0, 'profiles has no write policies');
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND cmd <> 'SELECT'), 0, 'payments has no write policies');

SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::integer FROM public.profiles), 1, 'authenticated user sees only own profile');
SELECT is((SELECT count(*)::integer FROM public.profiles WHERE user_id = '10000000-0000-4000-8000-000000000002'), 0, 'authenticated user cannot read another profile');
SELECT is((SELECT count(*)::integer FROM public.payments), 1, 'authenticated user sees only own payment');
SELECT is((SELECT count(*)::integer FROM public.payments WHERE user_id = '10000000-0000-4000-8000-000000000002'), 0, 'authenticated user cannot read another payment');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
