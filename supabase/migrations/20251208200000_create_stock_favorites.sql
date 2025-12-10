-- Create favorites table
create table if not exists public.stock_favorites (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    ticker text not null,
    stock_name text,
    added_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, ticker)
);

-- Enable RLS
alter table public.stock_favorites enable row level security;

-- Create policies
create policy "Users can view their own favorites"
    on public.stock_favorites for select
    using (auth.uid() = user_id);

create policy "Users can insert their own favorites"
    on public.stock_favorites for insert
    with check (auth.uid() = user_id);

create policy "Users can delete their own favorites"
    on public.stock_favorites for delete
    using (auth.uid() = user_id);

-- Create index for faster queries
create index if not exists stock_favorites_user_id_idx on public.stock_favorites(user_id);
create index if not exists stock_favorites_ticker_idx on public.stock_favorites(ticker);
