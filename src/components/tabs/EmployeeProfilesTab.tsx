import React, { useState } from 'react';
import { Database, Plus, Search, Edit, Trash2, X, Filter } from 'lucide-react';
import { usePayroll } from '../../context/PayrollContext';
import { Employee, Position } from '../../types/payroll';
import { formatVND } from '../../utils/payrollCalculations';

export const EmployeeProfilesTab: React.FC = () => {
  const {
    employees,
    seedSampleData,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    activeRole,
    showToast,
  } = usePayroll();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<Employee, 'id'> & { id?: string }>({
    id: '',
    fullName: '',
    birthDate: '1995-01-01',
    department: 'PPC',
    position: 'Staff',
    startDate: '2021-01-01',
    phone: '',
    isFemale: false,
    baseSalary: 10000000,
    dependentsCount: 0,
    contractType: 'Official',
    email: '',
    unionMember: true,
  });

  const departments = ['ALL', ...Array.from(new Set(employees.map((e) => e.department)))];

  // EPCC (employee-list-sort-by-position) — sắp xếp danh sách theo VỊ TRÍ từ cao đến thấp
  // (S. Manager > Manager > Senior Staff > Leader > Staff > OP), theo yêu cầu người dùng.
  // Vị trí không nằm trong danh sách (dữ liệu cũ/lỗi) rơi xuống cuối thay vì gây lỗi sort.
  const POSITION_RANK: Record<Position, number> = {
    'S. Manager': 0,
    'Manager': 1,
    'Senior Staff': 2,
    'Leader': 3,
    'Staff': 4,
    'OP': 5,
  };

  const filteredEmployees = employees
    .filter((emp) => {
      const matchesSearch =
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.id.includes(searchTerm) ||
        emp.phone.includes(searchTerm);
      const matchesDept = selectedDept === 'ALL' || emp.department === selectedDept;
      return matchesSearch && matchesDept;
    })
    .sort((a, b) => (POSITION_RANK[a.position] ?? 99) - (POSITION_RANK[b.position] ?? 99));

  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      id: '',
      fullName: '',
      birthDate: '1995-01-01',
      department: 'PPC',
      position: 'Staff',
      startDate: '2021-01-01',
      phone: '',
      isFemale: false,
      baseSalary: 10000000,
      dependentsCount: 0,
      contractType: 'Official',
      email: '',
      unionMember: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({ ...emp });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      showToast('Vui lòng nhập họ tên nhân viên!', 'error');
      return;
    }

    if (editingEmployee) {
      updateEmployee({ ...(formData as Employee), id: editingEmployee.id });
    } else {
      addEmployee(formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (emp: Employee) => {
    if (activeRole === 'User') {
      showToast('Quyền User không được xóa nhân viên!', 'error');
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn xóa nhân viên ${emp.fullName} (${emp.id})?`)) {
      deleteEmployee(emp.id);
    }
  };

  // ── Sửa trực tiếp trên bảng & tự lưu ─────────────────────────────────────
  // Dùng cho Ngày sinh / Ngày bắt đầu / Vị trí / Nữ: các control này chọn rời
  // rạc (date picker, select, checkbox) nên lưu ngay khi onChange bắn ra.
  const handleInlineChange = (
    emp: Employee,
    field: 'birthDate' | 'startDate' | 'position' | 'isFemale',
    value: string | boolean
  ) => {
    if (activeRole === 'User') {
      showToast('Quyền User không được sửa thông tin nhân viên!', 'error');
      return;
    }
    updateEmployee({ ...emp, [field]: value } as Employee);
    showToast('Đã lưu thay đổi!');
  };

  // Dùng cho Mã NV / Họ tên / SĐT: gõ tự do nên chỉ lưu khi rời ô (blur)
  // hoặc nhấn Enter, tránh lưu dồn dập theo từng ký tự gõ.
  const handleInlineTextBlur = (emp: Employee, field: 'id' | 'fullName' | 'phone', raw: string) => {
    if (activeRole === 'User') return;
    const value = raw.trim();
    if (value === (emp[field] as string)) return;

    if (field === 'id') {
      if (!value) {
        showToast('Mã NV không được để trống!', 'error');
        return;
      }
      if (employees.some((e) => e.id === value && e.id !== emp.id)) {
        showToast('Mã NV đã tồn tại, vui lòng chọn mã khác!', 'error');
        return;
      }
    }
    if (field === 'fullName' && !value) {
      showToast('Họ tên không được để trống!', 'error');
      return;
    }

    updateEmployee({ ...emp, [field]: value } as Employee);
    showToast('Đã lưu thay đổi!');
  };

  return (
    <div className="space-y-4">
      {/* Sub-header & Action Buttons matching screenshot layout */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Danh sách nhân viên công ty
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={seedSampleData}
            className="flex items-center gap-2 bg-[#d97706] hover:bg-[#b45309] text-white text-sm font-medium px-4 py-2 rounded shadow-sm transition-all cursor-pointer"
          >
            <Database className="w-4 h-4" />
            <span>Nạp dữ liệu mẫu</span>
          </button>

          {activeRole !== 'User' && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium px-4 py-2 rounded shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm NV</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-xs border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo Mã NV, Họ tên, SĐT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-600 dark:text-slate-400">Phòng ban:</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-1.5 text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'Tất cả phòng ban' : d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Employee List Table matching Screenshot 1 & 2 */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          {/* Exact dark navy header matching screenshot */}
          <thead className="bg-[#122842] text-white uppercase text-[11px] font-bold tracking-wider">
            <tr>
              <th className="py-3 px-4 border-r border-slate-700/60">Mã NV</th>
              <th className="py-3 px-4 border-r border-slate-700/60">Họ tên</th>
              <th className="py-3 px-4 border-r border-slate-700/60">Ngày sinh</th>
              <th className="py-3 px-4 border-r border-slate-700/60">Phòng ban</th>
              <th className="py-3 px-4 border-r border-slate-700/60">Vị trí</th>
              <th className="py-3 px-4 border-r border-slate-700/60">Ngày bắt đầu</th>
              <th className="py-3 px-4 border-r border-slate-700/60">SĐT</th>
              <th className="py-3 px-4 border-r border-slate-700/60 text-center">Nữ</th>
              <th className="py-3 px-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60 text-slate-800 dark:text-slate-200 font-medium">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500 italic">
                  Không tìm thấy nhân viên nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp, index) => (
                <tr
                  key={emp.id}
                  className={`hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors ${
                    index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/60 dark:bg-slate-800/60'
                  }`}
                >
                  <td className="py-1 px-2">
                    <input
                      type="text"
                      defaultValue={emp.id}
                      disabled={activeRole === 'User'}
                      onBlur={(e) => handleInlineTextBlur(emp, 'id', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      className="w-24 px-1.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 rounded outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-1 px-2">
                    <input
                      type="text"
                      defaultValue={emp.fullName}
                      disabled={activeRole === 'User'}
                      onBlur={(e) => handleInlineTextBlur(emp, 'fullName', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      className="w-36 px-1.5 py-1 text-xs font-bold text-slate-900 dark:text-slate-100 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 rounded outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-1 px-2">
                    <input
                      type="date"
                      value={emp.birthDate}
                      disabled={activeRole === 'User'}
                      onChange={(e) => handleInlineChange(emp, 'birthDate', e.target.value)}
                      className="px-1.5 py-1 text-xs text-slate-600 dark:text-slate-400 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 rounded outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                    {emp.department}
                  </td>
                  <td className="py-1 px-2">
                    <select
                      value={emp.position}
                      disabled={activeRole === 'User'}
                      onChange={(e) => handleInlineChange(emp, 'position', e.target.value as Position)}
                      className="px-1.5 py-1 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="S. Manager">S. Manager</option>
                      <option value="Manager">Manager</option>
                      <option value="Senior Staff">Senior Staff</option>
                      <option value="Leader">Leader</option>
                      <option value="Staff">Staff</option>
                      <option value="OP">OP</option>
                    </select>
                  </td>
                  <td className="py-1 px-2">
                    <input
                      type="date"
                      value={emp.startDate}
                      disabled={activeRole === 'User'}
                      onChange={(e) => handleInlineChange(emp, 'startDate', e.target.value)}
                      className="px-1.5 py-1 text-xs text-slate-600 dark:text-slate-400 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 rounded outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-1 px-2">
                    <input
                      type="text"
                      defaultValue={emp.phone}
                      disabled={activeRole === 'User'}
                      onBlur={(e) => handleInlineTextBlur(emp, 'phone', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      className="w-28 px-1.5 py-1 text-xs text-slate-700 dark:text-slate-300 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 rounded outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={emp.isFemale}
                      disabled={activeRole === 'User'}
                      onChange={(e) => handleInlineChange(emp, 'isFemale', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenEditModal(emp)}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-xs cursor-pointer"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(emp)}
                        className="text-rose-600 dark:text-rose-400 hover:underline font-medium text-xs cursor-pointer"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl p-6 relative my-8 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
              {editingEmployee ? `Chỉnh sửa thông tin nhân viên (${editingEmployee.id})` : 'Thêm nhân viên mới'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Mã NV */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã NV {editingEmployee && '(Không đổi)'}
                  </label>
                  <input
                    type="text"
                    required={!editingEmployee}
                    disabled={!!editingEmployee}
                    placeholder="VD: 11704029"
                    value={formData.id || ''}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                </div>

                {/* Họ tên */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Họ và tên *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Lê Xuân Thảo"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Ngày sinh */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ngày sinh (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Phòng ban */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phòng ban
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: PPC, QA/QC, HR..."
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Vị trí */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vị trí / Chức danh
                  </label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value as Position })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="S. Manager">S. Manager</option>
                    <option value="Manager">Manager</option>
                    <option value="Senior Staff">Senior Staff</option>
                    <option value="Leader">Leader</option>
                    <option value="Staff">Staff</option>
                    <option value="OP">OP</option>
                  </select>
                </div>

                {/* Ngày bắt đầu */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ngày bắt đầu làm việc
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* SĐT */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 0352386556"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Lương cơ bản */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lương cơ bản (Lương CB)
                  </label>
                  <input
                    type="number"
                    step="100000"
                    value={formData.baseSalary}
                    onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-slate-500">
                    = {formatVND(formData.baseSalary || 0)}
                  </span>
                </div>

                {/* Giới tính Nữ Checkbox */}
                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="isFemaleCheck"
                    checked={formData.isFemale}
                    onChange={(e) => setFormData({ ...formData, isFemale: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="isFemaleCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Giới tính Nữ (Hưởng trợ cấp phụ nữ)
                  </label>
                </div>

                {/* Đoàn viên công đoàn */}
                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="unionCheck"
                    checked={formData.unionMember}
                    onChange={(e) => setFormData({ ...formData, unionMember: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="unionCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Đoàn viên công đoàn (Khấu trừ đoàn phí CĐ)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm cursor-pointer"
                >
                  {editingEmployee ? 'Lưu thay đổi' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
