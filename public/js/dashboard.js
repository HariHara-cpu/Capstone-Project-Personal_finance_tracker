document.addEventListener("DOMContentLoaded", () => {
  const ctx = document.getElementById('expenseChart').getContext('2d');

  const expenseCategories = categoriesData.filter(c => c.type === 'expense');

  const labels = expenseCategories.map(c => c.name);
  const dataValues = expenseCategories.map(c => Number(c.amount));
  const bgColors = expenseCategories.map(c => c.color);

  const data = {
    labels: labels,
    datasets: [{
      data: dataValues,
      backgroundColor: bgColors,
    }]
  };

  new Chart(ctx, {
    type: 'doughnut',
    data: data,
    options: {
      cutout: '70%',
      plugins: { legend: { display: false } }
    }
  });

  // Update total
  const total = dataValues.reduce((a, b) => a + b, 0);
  document.getElementById('totalExpense').textContent = totalExpenseValue.toFixed(2);
  document.getElementById('totalIncome').textContent = totalIncomeValue.toFixed(2);
  document.getElementById('totalBalance').textContent=balanceValue.toFixed(2);

  // Set background color from data attribute
  document.querySelectorAll('.category-item').forEach(item => {
    const color = item.getAttribute('data-color');
    item.style.backgroundColor = color;
  });

  // Filter click (if you add later)
  document.querySelectorAll("#filterTabs .nav-link").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelector("#filterTabs .active").classList.remove("active");
      tab.classList.add("active");
      const period = tab.dataset.period;
      console.log("Selected period:", period);
    });
  });
});
