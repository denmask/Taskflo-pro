const Charts = (() => {
  let hourChart = null;
  let projectChart = null;

  function renderHours(byDay) {
    const labels = [];
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      labels.push(d.toLocaleDateString('it-IT', { weekday: 'short' }));
      const entry = byDay.find(x => x.day === key);
      data.push(entry ? Math.round(entry.minutes / 60 * 10) / 10 : 0);
    }
    const ctx = document.getElementById('chart-hours');
    if (!ctx) return;
    if (hourChart) hourChart.destroy();
    hourChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Ore',
          data,
          backgroundColor: '#6366f1',
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderProjects(byProject) {
    const ctx = document.getElementById('chart-projects');
    if (!ctx || !byProject.length) return;
    if (projectChart) projectChart.destroy();
    projectChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: byProject.map(p => p.name),
        datasets: [{
          data: byProject.map(p => p.total),
          backgroundColor: byProject.map(p => p.color || '#6366f1'),
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } }
        },
        cutout: '65%'
      }
    });
  }

  return { renderHours, renderProjects };
})();