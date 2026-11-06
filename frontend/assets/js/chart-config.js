function renderCharts(stats = {}) {
  const overtimeCanvas = document.getElementById('overtime-chart');
  const locationCanvas = document.getElementById('work-location-chart');
  if (overtimeCanvas) {
    const employees = stats.byEmployee?.length ? stats.byEmployee : technicians.map((t, i) => ({ name: t.shortName, otHours: [24.5, 18, 16.5, 14, 13.5][i] }));
    new Chart(overtimeCanvas, { type: 'bar', data: { labels: employees.map(t => t.name.replace(/^.* /, '')), datasets: [{ label: 'Số giờ OT', data: employees.map(t => t.otHours), backgroundColor: '#0f766e', borderRadius: 8, barThickness: 26 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#edf2f2' }, ticks: { color: '#94a3b8', callback: value => value + 'h' } }, x: { grid: { display: false }, ticks: { color: '#64748b' } } } } });
  }
  if (locationCanvas) {
    const locations = stats.workLocation?.length ? stats.workLocation.map(item => item.value) : [96, 32];
    new Chart(locationCanvas, { type: 'doughnut', data: { labels: ['Văn phòng', 'Đi công tác'], datasets: [{ data: locations, backgroundColor: ['#0f766e', '#f59e0b'], borderWidth: 0, spacing: 4 }] }, options: { cutout: '76%', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: item => ` ${item.label}: ${item.raw} ngày` } } } } });
  }
}
