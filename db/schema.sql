-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,              -- for local auth (hashed password)
    google_id TEXT              -- for Google OAuth
);

-- Categories Table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type VARCHAR(10) CHECK (type IN ('income', 'expense')),
    color VARCHAR(10)           -- hex color code for charts
);

-- Transactions Table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('income', 'expense')),
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    date DATE NOT NULL
);

-- Budgets Table
CREATE TABLE budgets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    limit_amount NUMERIC(10,2) NOT NULL,
    frequency TEXT              -- e.g. 'monthly', 'weekly', 'yearly'
);