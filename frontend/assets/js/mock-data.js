const technicians = [
  { id: 'nv01', name: 'Nguyễn Minh Anh', shortName: 'Minh Anh', initials: 'MA', role: 'Kỹ thuật viên' },
  { id: 'nv02', name: 'Trần Quốc Bảo', shortName: 'Quốc Bảo', initials: 'QB', role: 'Kỹ thuật viên' },
  { id: 'nv03', name: 'Lê Hoàng Nam', shortName: 'Hoàng Nam', initials: 'HN', role: 'Kỹ thuật viên' },
  { id: 'nv04', name: 'Phạm Gia Huy', shortName: 'Gia Huy', initials: 'GH', role: 'Kỹ thuật viên' },
  { id: 'nv05', name: 'Võ Thanh Tùng', shortName: 'Thanh Tùng', initials: 'TT', role: 'Kỹ thuật viên' }
];
const sites = ['Công ty TNHH ABC · Quận 7', 'Nhà phố chị Lan · Thủ Đức', 'Văn phòng GreenTech · Bình Thạnh', 'Kho vận Sài Gòn · Quận 9'];
const statuses = ['approved', 'approved', 'pending', 'approved', 'pending', 'rejected'];
const attendanceRecords = Array.from({ length: 25 }, (_, index) => {
  const day = String(12 - (index % 12)).padStart(2, '0');
  const tech = technicians[index % technicians.length];
  return {
    id: `cc-${index + 1}`, employeeId: tech.id, employee: tech.name, initials: tech.initials,
    date: `2024-06-${day}`, checkIn: index % 7 === 0 ? '08:42' : '08:2' + (index % 9),
    checkOut: index % 4 === 0 ? '18:30' : '17:3' + (index % 9), leaveDays: index === 8 ? 0.5 : 0,
    earlyLeave: index === 10 ? -1 : 0, overtime: [0, 1, 1.5, 2.5, 0.5][index % 5],
    sundayWork: index % 9 === 0, travelDays: index % 4 === 0 ? 1 : 0, site: sites[index % sites.length],
    status: statuses[index % statuses.length], notes: 'Hoàn thành hạng mục lắp đặt và bàn giao.'
  };
});
