Personal Finance Tracker 💰

A full-stack web application to track income, expenses, budgets, and categories.
Built using Node.js, Express, PostgreSQL, EJS, and Bootstrap for UI.

->Features

1.User Authentication (Local + Google OAuth)

2.Categories (default + custom, income & expense types)

3.Transactions (add, edit, delete, view history)

4.Budgets (set limits per category with frequency)

5.Sorting & Filtering by date, type, or category

6.Data Visualization with charts (planned/implemented)

7.Secure Passwords using bcrypt

->Tech Stack

1.Backend: Node.js, Express

2.Database: PostgreSQL

3.Authentication: Passport.js (Local + Google OAuth)

4.Templating Engine: EJS

5.Styling: Bootstrap

6.Security: bcrypt password hashing

->Setup Instructions

1.Clone the repo

git clone https://github.com/your-username/finance-tracker.git
cd finance-tracker


2.Install dependencies

npm install


3.Database setup

Create a PostgreSQL database named finance

then run the code (in pgadmin4) given in schema.sql in db folder 

then run the code given in seed.sql to insert default categories


4.Configure environment variables (.env file)

DATABASE_URL=postgres://username:password@localhost:5432/yourdbname
SESSION_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret


5.Run the app

npm start


6.Open http://localhost:3000
