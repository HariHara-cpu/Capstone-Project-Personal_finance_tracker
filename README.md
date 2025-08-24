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

nodemon app.js


6.Open http://localhost:3000

->ScreenShorts:
<img width="1900" height="870" alt="image" src="https://github.com/user-attachments/assets/6bdf4df3-5ad3-4580-bb38-cb0df5864e88" />
<img width="1895" height="866" alt="image" src="https://github.com/user-attachments/assets/c6fc28b0-b3f8-4664-b5f6-c1f5ef7d5ca8" />
<img width="1916" height="868" alt="image" src="https://github.com/user-attachments/assets/f353cbcf-c3a1-4664-b498-664aa329352e" />
<img width="1899" height="868" alt="image" src="https://github.com/user-attachments/assets/6e3d4279-1d8b-412d-ae7e-a15da44919b1" />
<img width="1917" height="869" alt="image" src="https://github.com/user-attachments/assets/ade93f36-6363-4a22-8b17-88de1dc6759b" />
<img width="1898" height="867" alt="image" src="https://github.com/user-attachments/assets/d4d75793-dfd4-421c-8bbf-84109209e617" />
<img width="1915" height="870" alt="image" src="https://github.com/user-attachments/assets/66580bf5-e975-444b-81fc-b51f9ba5103e" />





