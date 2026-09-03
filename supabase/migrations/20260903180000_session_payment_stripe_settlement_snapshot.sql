alter type public.session_transfer_status add value if not exists 'waiting_settlement' after 'waiting_safety_period';
