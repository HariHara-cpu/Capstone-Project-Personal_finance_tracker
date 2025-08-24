import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

app.get("/",(req,res)=>{
    res.render("pages/home",{ user: req.user });
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

app.get("/add",ensureAuthenticated,(req,res)=>{
  res.render("pages/add");
});

app.get("/login", (req, res) => {
  res.render("pages/login");
});

app.get("/register", (req, res) => {
  res.render("pages/register");
});


app.get("/dashboard", ensureAuthenticated, async (req, res) => {
  const userId=req.user.id;
  const period = req.query.period || 'month';
  let periodCondition = "";
  let queryParams = [userId]; // build params dynamically

  if (period === 'day') {
    periodCondition = "AND date::date = CURRENT_DATE";
  } else if (period === 'week') {
    periodCondition = "AND date >= CURRENT_DATE - INTERVAL '7 days'";
  } else if (period === 'month') {
    periodCondition = "AND date >= date_trunc('month', CURRENT_DATE)";
  } else if (period === 'year') {
    periodCondition = "AND date >= date_trunc('year', CURRENT_DATE)";
  } else if (period === 'period' && req.query.from && req.query.to) {
    queryParams.push(req.query.from, req.query.to);
    periodCondition = "AND date::date BETWEEN $2 AND $3";
  } else {
    periodCondition = ""; // default: show all
  }

  try {
    const incomeResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_income 
       FROM transactions 
       WHERE user_id = $1 AND type = 'income' ${periodCondition}`,
      queryParams
    );

    const expenseResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_expense 
       FROM transactions 
       WHERE user_id = $1 AND type = 'expense' ${periodCondition}`,
      queryParams
    );

    const transactionsResult = await db.query(
      `SELECT * 
       FROM transactions 
       WHERE user_id = $1 ${periodCondition} 
       ORDER BY date DESC LIMIT 5`,
      queryParams
    );

    const categoryResult = await db.query(
      `SELECT categories.name, categories.type, categories.color, SUM(amount) AS amount 
       FROM categories 
       JOIN transactions ON categories.id = transactions.category_id 
       WHERE transactions.user_id = $1 ${periodCondition}
       GROUP BY categories.id`,
      queryParams
    );

    const totalIncome = incomeResult.rows[0].total_income;
    const totalExpense = expenseResult.rows[0].total_expense;

    const categories = categoryResult.rows;

    // compute total expenses only
    const totalExpenseAmount = categories
      .filter(c => c.type === 'expense')
      .reduce((acc, c) => acc + Number(c.amount), 0);

    // add percentage
    categories.forEach(c => {
      if (c.type === 'expense') {
        c.percentage = totalExpenseAmount
          ? ((Number(c.amount) / totalExpenseAmount) * 100).toFixed(0)
          : 0;
      } else {
        c.percentage = 0;
      }
    });

    res.render("pages/dashboard", {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    user: req.user,
    transactions: transactionsResult.rows,
    categories,
    period,
    from: req.query.from,
    to: req.query.to
  });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});


function isTransactionInRange(transactionDate, frequency) {
  const today = new Date();
  const txDate = new Date(transactionDate);

  switch (frequency) {
    case 'day':
      return txDate.toDateString() === today.toDateString();

    case 'week': {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return txDate >= startOfWeek && txDate <= endOfWeek;
    }

    case 'month':
      return (
        txDate.getFullYear() === today.getFullYear() &&
        txDate.getMonth() === today.getMonth()
      );

    case 'year':
      return txDate.getFullYear() === today.getFullYear();

    default:
      return true; // fallback
  }
}

app.get("/history", ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const sort = req.query.sort;
  let orderBy = "date DESC"; // default

  if (sort === "date-asc") orderBy = "date ASC";
  else if (sort === "amount-desc") orderBy = "amount DESC";
  else if (sort === "amount-asc") orderBy = "amount ASC";

  try {
    // ✅ Fetch budgets with category names
    const budgetResult = await db.query(
      `SELECT b.id, b.category_id, c.name, b.limit_amount, b.frequency 
       FROM budgets b 
       JOIN categories c ON b.category_id = c.id 
       WHERE b.user_id = $1`, 
      [userId]
    );

    // ✅ Fetch transactions using parameterized query
    const transactionsResult = await db.query(
      `SELECT t.id, t.user_id, t.amount, t.type, t.category_id, t.description, t.date, c.name 
       FROM transactions t 
       JOIN categories c ON t.category_id = c.id 
       WHERE t.user_id = $1 
       ORDER BY ${orderBy}`, 
      [userId]
    );

    // ✅ Map budgets with spent & percent
    const budgetsWithUsage = budgetResult.rows.map(budget => {
      const matchingTx = transactionsResult.rows.filter(t => {
        // Parse t.date to Date object & check category/type/frequency
        return (
          Number(t.category_id) === Number(budget.category_id) &&
          t.type === 'expense' &&
          isTransactionInRange(t.date, budget.frequency)
        );
      });

      //console.log('Budget:', budget.name, 'Matching transactions count:', matchingTx.length);

      const spent = matchingTx.reduce((sum, t) => sum + Number(t.amount), 0);
      const percent = budget.limit_amount > 0
        ? Math.min(100, (spent / Number(budget.limit_amount)) * 100)
        : 0;

      return {
        ...budget,
        spent,
        percent: Math.round(percent) // optional: round to integer
      };
    });

    // console.log('Budgets with usage:', budgetsWithUsage);
    //console.log(transactionsResult.rows);

    // ✅ Render
    res.render("pages/history", {
      user: req.user,
      transactions: transactionsResult.rows,
      budgets: budgetsWithUsage
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get('/budgets', ensureAuthenticated, async (req, res) => {
  try {
    const customCategoriesResult = await db.query(
      'SELECT id, name FROM categories WHERE user_id = $1', 
      [req.user.id]
    );
    const categoriesResult = await db.query(
      'SELECT id, name FROM categories WHERE user_id IS NULL'
    );
    res.render('pages/budgets', {
      user: req.user,
      customCategories: customCategoriesResult.rows,
      categories:categoriesResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/personal_finance_tracker",
  passport.authenticate("google", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  })
);

app.get("/editbudgets/:id",ensureAuthenticated, async(req,res)=>{
  const budgetId=req.params.id;

  try{
    const result=await db.query("SELECT * FROM budgets WHERE id=$1",[budgetId]);
    const customCategoriesResult = await db.query(
      'SELECT id, name FROM categories WHERE user_id = $1', 
      [req.user.id]
    );
    const categoriesResult = await db.query(
      'SELECT id, name FROM categories WHERE user_id IS NULL'
    );
    res.render(
      "pages/editBudgets",{
        budget:result.rows[0],
        user: req.user,
        customCategories: customCategoriesResult.rows,
        categories:categoriesResult.rows
      }
    );
  }catch(err){
    console.log(err);
    res.send("Failed to fetch budget for editing.");
  }
})

app.get("/edit/:id",ensureAuthenticated, async (req, res) => {
  const transactionId = req.params.id;

  try {
    const result1 = await db.query("SELECT * FROM transactions WHERE id = $1", [transactionId]);
    const transaction = result1.rows[0];
    const result2= await db.query("SELECT name FROM categories WHERE id = $1", [transaction.category_id])
    const categoryName=result2.rows[0].name;
    // console.log(transaction);
    // console.log(categoryName);

    const utcDate = new Date(transaction.date);
    // Add 5 hours 30 minutes for IST
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(utcDate.getTime() + istOffsetMs);
    // Format to 'YYYY-MM-DD'
    const formattedDate = istDate.toISOString().split('T')[0];

    const predefinedCategories = [
    "Food", "Shopping", "Rent", "Transportation", "Entertainment",
    "Utilities", "Healthcare", "Education", "Salary",
    "Freelance", "Investments", "Gifts"
    ];

    const isCustom = !predefinedCategories.includes(categoryName);

    res.render("pages/edit", { transaction,categoryName,formattedDate,isCustom });
  } catch (err) {
    console.error(err);
    res.send("Failed to fetch transaction for editing.");
  }
});

function getRandomHexColor() {
  return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
}

app.post("/add", async (req, res) => {
  // console.log(req);
  try {
    const user_id = req.user.id;
    const { amount, category, customCategory, description, date } = req.body;

    let categoryId;
    let type;

    if (category && category !== "custom") {
      // Predefined category selected — get id and type from DB
      const result = await db.query(
        "SELECT id, type FROM categories WHERE name = $1 AND user_id IS NULL",
        [category]
      );

      if (result.rows.length > 0) {
        categoryId = result.rows[0].id;
        type = result.rows[0].type;
      } else {
        return res.status(400).send("Invalid predefined category selected.");
      }
    } else {
      // Custom category entered by user
      const { type: customType } = req.body;
      if (!customCategory || !customType) {
        return res.status(400).send("Custom category and type are required.");
      }
      const color=getRandomHexColor();
      const insertCat = await db.query(
        "INSERT INTO categories (user_id, name, type, color) VALUES ($1, $2, $3, $4) RETURNING id",
        [user_id, customCategory, customType, color]
      );

      categoryId = insertCat.rows[0].id;
      type = customType;
    }

    // Now insert the transaction
    await db.query(
      "INSERT INTO transactions (user_id, amount, type, category_id, description, date) VALUES ($1, $2, $3, $4, $5, $6)",
      [user_id, amount, type, categoryId, description, date]
    );

    res.redirect("/history");
  } catch (err) {
    console.error("Error adding transaction:", err);
    res.status(500).send("Something went wrong.");
  }
});

app.post("/edit/:id", ensureAuthenticated, async (req, res) => {
  try {
    const user_id = req.user.id;
    const transactionId = req.params.id;
    const { amount, category, customCategory, type, description, date } = req.body;

    let categoryId;
    let finalCategoryName;
    let finalType;

    if (category && category !== "custom") {
      // Predefined category — get type from DB
      finalCategoryName = category;
      const result = await db.query("SELECT id, type FROM categories WHERE name = $1", [finalCategoryName]);

      if (result.rowCount === 0) throw new Error("Predefined category not found!");

      categoryId = result.rows[0].id;
      finalType = result.rows[0].type;

    } else {
      // Custom category
      finalCategoryName = customCategory;
      finalType = type; // User manually chose it

      const result = await db.query(
        "SELECT id FROM categories WHERE name = $1 AND user_id = $2",
        [finalCategoryName, user_id]
      );

      if (result.rowCount > 0) {
        categoryId = result.rows[0].id;
      } else {
        const insertResult = await db.query(
          "INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3) RETURNING id",
          [user_id, finalCategoryName, finalType]
        );
        categoryId = insertResult.rows[0].id;
      }
    }

    await db.query(
      "UPDATE transactions SET amount = $1, type = $2, category_id = $3, description = $4, date = $5 WHERE id = $6 AND user_id = $7",
      [amount, finalType, categoryId, description, date, transactionId, user_id]
    );

    res.redirect("/history");
  } catch (err) {
    console.error(err);
    res.send("Failed to update the transaction.");
  }
});

app.post("/editbudget/:id",ensureAuthenticated, async(req,res)=>{
  const budgetId=req.params.id;
  const { amount, category, frequency}=req.body;

  try{
    await db.query("UPDATE budgets SET category_id=$1, limit_amount=$2, frequency=$3 WHERE id=$4",[category,amount,frequency,budgetId]);
    res.redirect("/history");
  }catch(err){
    console.log(err);
    res.send("Failed to update the budget");
  }
});

app.post("/delete/:id",ensureAuthenticated,async(req,res)=>{
  const transactionId = req.params.id;
  try{
    await db.query("DELETE FROM transactions WHERE id=$1",[transactionId]);
    res.redirect("/history");
  }catch(err){
    console.error(err);
    res.send("Failed to delete the transaction.");
  }
});

app.post("/deletebudgets/:id",ensureAuthenticated,async(req,res)=>{
  const budgetId=req.params.id;
  try{
    await db.query("DELETE FROM budgets WHERE id=$1",[budgetId]);
    res.redirect("/history");
  }catch(err){
    console.log(err);
    res.send("Failed to delete the budget");
  }
})

app.post("/budget", ensureAuthenticated, async (req, res) => {
  const user_id = req.user.id;
  const { amount, category, frequency } = req.body;

  try {
    await db.query(
      'INSERT INTO budgets (user_id, category_id, limit_amount, frequency) VALUES ($1, $2, $3, $4)',
      [user_id, category, amount, frequency]
    );
    res.redirect('/history'); 
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to add the budget.");
  }
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  })
);

app.post("/register", async (req, res) => {
  const name=req.body.name;
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      res.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
            [name, email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/dashboard");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        if (user.password === null) {
          return cb(null, false); // force them to use Google login
        }
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb(null, false);
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/personal_finance_tracker",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        // console.log(profile);
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (name, email, password, google_id) VALUES ($1, $2, $3, $4)",
            [profile.displayName, profile.email, null, profile.id]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);
passport.serializeUser((user, cb) => {
  cb(null, user.id);
});

passport.deserializeUser(async(id, cb) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    cb(null, result.rows[0]);
  } catch (err) {
    cb(err);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});