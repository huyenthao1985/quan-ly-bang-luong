import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Filter, Search, Calendar } from 'lucide-react';
import { usePayroll } from '../../context/PayrollContext';
import { formatVND } from '../../utils/payrollCalculations';

const pad2 = (n: number) => (n < 10 ? '0' + n : '' + n);

export const ReportsTab: React.FC = () => {
  const {
    employees,
    attendanceRecords,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
  } = usePayroll();

  const [searchTerm, setSearchTerm] = useState('');

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // ── Ma trận ngày (HC vs OT) — chỉ hiển thị các ngày của tháng đang chọn, freeze panes 3 cột đầu ──
  const matrixScrollRef = useRef<HTMLDivElement>(null);

  const monthDays = useMemo(() => {
    return dayColumns.map((d) => ({
      day: d,
      dateStr: `${selectedYear}-${pad2(selectedMonth)}-${pad2(d)}`,
      isSunday: new Date(selectedYear, selectedMonth - 1, d).getDay() === 0,
    }));
  }, [selectedYear, selectedMonth]);

  /** Lấy giờ HC hoặc OT (gộp OT150/Đêm/CN/Lễ) của 1 nhân viên trong 1 ngày cụ thể của tháng đang chọn */
  const getDayVal = (empId: string, dateStr: string, type: 'hc' | 'ot'): number => {
    const rec = attendanceRecords[`${empId}_${selectedYear}_${selectedMonth}`];
    const d = rec?.dailyRecords?.[dateStr];
    if (!d) return 0;
    if (type === 'hc') return d.hcHours || 0;
    return (d.otHours || 0) + (d.sundayHours || 0) + (d.holidayHours || 0);
  };

  // Về đầu bảng mỗi khi đổi tháng, để luôn thấy ngày 01 trước tiên
  useEffect(() => {
    matrixScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [selectedMonth, selectedYear]);

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id.includes(searchTerm)
  );

  // Export report to CSV helper
  const handleExportCSV = () => {
    let csv = 'Mã NV,Họ Tên,Tổng HC (h),Tổng OT (h),Tổng Đêm (h),Vắng (ngày)\n';

    filteredEmployees.forEach((emp) => {
      const key = `${emp.id}_${selectedYear}_${selectedMonth}`;
      const rec = attendanceRecords[key];

      let hc = 0,
        ot = 0,
        night = 0,
        absent = 0;
      if (rec && rec.dailyRecords) {
        Object.values(rec.dailyRecords as Record<string, import('../../types/payroll').DailyAttendance>).forEach((d) => {
          hc += d.hcHours || 0;
          ot += (d.otHours || 0) + (d.sundayHours || 0) + (d.holidayHours || 0);
          night += d.nightHours || 0;
          absent += (d.leaveUnpaidDays || 0) + (d.leaveAnnualDays || 0);
        });
      }

      csv += `"${emp.id}","${emp.fullName}",${hc.toFixed(1)},${ot.toFixed(1)},${night.toFixed(1)},${absent}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_Cao_HC_OT_Thang_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    // EPCC (tighten-card-gaps) - FIX theo yêu cầu người dùng: khoảng cách giữa
    // card "Tổng hợp HC/OT theo nhân viên" và card "Ma trận ngày (HC vs OT)"
    // đang quá rộng (space-y-6 = 24px) khiến layout có khoảng trắng thừa như
    // đánh dấu trong ảnh. Thu hẹp về mức tối thiểu (space-y-2 = 8px) để 2 card
    // sát nhau hơn mà vẫn còn khoảng phân tách rõ ràng.
    <div className="space-y-2">
      {/* FIX (remove-action-header): xoá hẳn Card tiêu đề "Báo Cáo Bảng
          Lương..." + dropdown "Tháng:" + nút "Xuất Excel/CSV" theo yêu cầu
          người dùng — bảng "Tổng hợp HC/OT theo nhân viên" bên dưới giờ nằm
          sát top của tab. Lưu ý: nút Xuất Excel/CSV (handleExportCSV) đã bị
          gỡ khỏi giao diện cùng với card này — nếu vẫn cần chức năng xuất
          file, cho mình biết để đặt lại ở vị trí khác (vd cạnh dropdown
          Tháng trong card "Ma trận ngày" bên dưới). */}

      {/* 1. TABLE 1: Tổng hợp HC/OT theo nhân viên MATCHING SCREENSHOT 4 TOP */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* EPCC (tighten-card-header-height) - FIX theo yêu cầu người dùng:
            thanh tiêu đề card đang dùng p-3 (12px mọi phía) khiến chiều cao
            card header dư thừa. Giảm xuống py-1.5 px-3 (6px trên/dưới) — mức
            padding nhỏ nhất còn giữ được vùng chạm/đọc dễ chịu cho text. */}
        <div className="py-1.5 px-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Tổng hợp HC/OT theo nhân viên
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#122842] text-white uppercase text-[11px] font-bold">
              <tr>
                <th className="py-2.5 px-4 border-r border-slate-700/60 w-32">Mã NV</th>
                <th className="py-2.5 px-4 border-r border-slate-700/60 min-w-[180px]">Họ Tên</th>
                <th className="py-2.5 px-4 border-r border-slate-700/60 text-center w-28 bg-[#1e3a5f]">HC (h)</th>
                <th className="py-2.5 px-4 border-r border-slate-700/60 text-center w-28 bg-[#1e3a5f]">OT (h)</th>
                <th className="py-2.5 px-4 border-r border-slate-700/60 text-center w-28 bg-[#1e3a5f]">Đêm (h)</th>
                <th className="py-2.5 px-4 text-center w-28">Vắng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-medium text-slate-800 dark:text-slate-200">
              {filteredEmployees.map((emp, index) => {
                const key = `${emp.id}_${selectedYear}_${selectedMonth}`;
                const rec = attendanceRecords[key];

                let hc = 0,
                  ot = 0,
                  night = 0,
                  absent = 0;

                if (rec && rec.dailyRecords) {
                  Object.values(rec.dailyRecords as Record<string, import('../../types/payroll').DailyAttendance>).forEach((d) => {
                    hc += d.hcHours || 0;
                    ot += (d.otHours || 0) + (d.sundayHours || 0) + (d.holidayHours || 0);
                    night += d.nightHours || 0;
                    if ((d.leaveUnpaidDays || 0) > 0 || (d.leaveAnnualDays || 0) > 0) {
                      absent += (d.leaveUnpaidDays || 0) + (d.leaveAnnualDays || 0);
                    }
                  });
                }

                return (
                  <tr
                    key={emp.id}
                    className={`hover:bg-blue-50/50 dark:hover:bg-slate-700/50 ${
                      index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/60 dark:bg-slate-800/60'
                    }`}
                  >
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 font-semibold">{emp.id}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">{emp.fullName}</td>
                    <td className="py-2.5 px-4 text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/20">{hc.toFixed(1)}</td>
                    <td className="py-2.5 px-4 text-center font-bold text-amber-700 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/20">{ot.toFixed(1)}</td>
                    <td className="py-2.5 px-4 text-center font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20">{night.toFixed(1)}</td>
                    <td className="py-2.5 px-4 text-center font-bold text-rose-600 dark:text-rose-400">{absent}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. TABLE 2: Ma trận ngày (HC vs OT) — hiển thị theo từng tháng, freeze panes 3 cột đầu */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* FIX (matrix-header-inline): gộp tiêu đề + chip chọn tháng vào
            CÙNG 1 hàng (chip đẩy sang phải bằng ml-auto), bỏ hẳn dòng mô tả
            nhỏ phía dưới tiêu đề theo yêu cầu người dùng — trước đây là 2
            hàng riêng (tiêu đề+mô tả, rồi chip tháng bên dưới). */}
        {/* EPCC (tighten-card-header-height) - xem giải thích ở card phía
            trên: giảm p-3 -> py-1.5 px-3 để thanh tiêu đề thấp nhất có thể. */}
        <div className="py-1.5 px-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
            Ma trận ngày (HC vs OT)
          </h3>
          {/* FIX (month-picker-dropdown): thay 12 nút chip Th.1→Th.12 (chiếm
              nhiều chỗ, dễ vỡ layout trên màn hình nhỏ) bằng 1 dropdown chọn
              tháng gọn — đồng bộ kiểu dáng với ô "Tháng:" đã có sẵn ở đầu
              trang, theo yêu cầu người dùng. */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full px-3 py-1.5 ml-auto">
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          </div>
        </div>

        <div ref={matrixScrollRef} className="overflow-x-auto max-h-[70vh] overflow-y-auto scroll-smooth">
          <table className="border-collapse text-left text-xs w-max">
            <thead className="bg-[#122842] text-white uppercase text-[10px] font-bold sticky top-0 z-20">
              <tr>
                <th rowSpan={2} className="py-2 px-3 border-r border-slate-700/60 sticky left-0 bg-[#122842] z-30 w-24 align-middle">Mã NV</th>
                <th rowSpan={2} className="py-2 px-3 border-r border-slate-700/60 sticky left-24 bg-[#122842] z-30 min-w-[150px] align-middle">Họ Tên</th>
                {/* Freeze pane boundary — đường kẻ phân cách rõ giữa vùng cố định và vùng cuộn */}
                <th rowSpan={2} className="py-2 px-2 border-r-2 border-slate-500 sticky left-[246px] bg-[#1e3a5f] z-30 w-16 align-middle shadow-[4px_0_8px_-3px_rgba(0,0,0,0.45)]">Loại giờ</th>

                <th colSpan={monthDays.length} className="py-1.5 text-center border-l border-slate-700/60 font-bold">
                  Tháng {selectedMonth}/{selectedYear}
                </th>
                <th rowSpan={2} className="py-2 px-2 text-center w-16 bg-amber-600 text-white sticky right-0 z-30 align-middle">Tổng</th>
              </tr>
              <tr className="bg-[#1a3552] text-slate-200 text-[10px] font-semibold">
                {monthDays.map((d) => (
                  <th key={d.dateStr} className={`w-9 py-1 text-center border-l border-slate-700/40 font-normal ${d.isSunday ? 'text-red-300' : ''}`}>
                    {pad2(d.day)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-700 text-slate-800 dark:text-slate-200 font-medium">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                    Không tìm thấy nhân viên phù hợp.
                  </td>
                </tr>
              ) : filteredEmployees.map((emp) => {
                let hcSum = 0;
                let otSum = 0;
                monthDays.forEach((d) => {
                  hcSum += getDayVal(emp.id, d.dateStr, 'hc');
                  otSum += getDayVal(emp.id, d.dateStr, 'ot');
                });

                return (
                  <React.Fragment key={emp.id}>
                    {/* HC Row */}
                    <tr className="hover:bg-blue-50/30 dark:hover:bg-slate-700/30">
                      <td rowSpan={2} className="py-2 px-3 font-semibold text-blue-900 dark:text-blue-300 sticky left-0 bg-white dark:bg-slate-800 z-10 border-r border-b border-slate-300 dark:border-slate-700 align-middle">
                        {emp.id}
                      </td>
                      <td rowSpan={2} className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100 sticky left-24 bg-white dark:bg-slate-800 z-10 border-r border-b border-slate-300 dark:border-slate-700 align-middle">
                        {emp.fullName}
                      </td>
                      <td className="py-1 px-2 font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 sticky left-[246px] z-10 border-r-2 border-slate-300 dark:border-slate-600 text-center shadow-[4px_0_8px_-3px_rgba(0,0,0,0.15)] dark:shadow-[4px_0_8px_-3px_rgba(0,0,0,0.5)]">
                        HC
                      </td>

                      {monthDays.map((d) => {
                        const val = getDayVal(emp.id, d.dateStr, 'hc');
                        return (
                          <td key={d.dateStr} className={`py-1 px-1 text-center border-r border-slate-200 dark:border-slate-700 text-[11px] ${d.isSunday ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
                            {val > 0 ? val.toFixed(1) : '-'}
                          </td>
                        );
                      })}

                      <td rowSpan={2} className="py-1 px-2 text-center font-bold text-slate-900 dark:text-white bg-amber-100 dark:bg-amber-900/60 sticky right-0 z-10 align-middle">
                        <div className="text-blue-700 dark:text-blue-300">{hcSum.toFixed(1)}</div>
                        <div className="text-amber-700 dark:text-amber-300">{otSum.toFixed(1)}</div>
                      </td>
                    </tr>

                    {/* OT Row */}
                    <tr className="border-b-2 border-slate-400 dark:border-slate-700 hover:bg-amber-50/30 dark:hover:bg-slate-700/30">
                      <td className="py-1 px-2 font-bold text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 sticky left-[246px] z-10 border-r-2 border-slate-300 dark:border-slate-600 text-center shadow-[4px_0_8px_-3px_rgba(0,0,0,0.15)] dark:shadow-[4px_0_8px_-3px_rgba(0,0,0,0.5)]">
                        OT
                      </td>

                      {monthDays.map((d) => {
                        const val = getDayVal(emp.id, d.dateStr, 'ot');
                        return (
                          <td key={d.dateStr} className={`py-1 px-1 text-center border-r border-slate-200 dark:border-slate-700 text-[11px] ${d.isSunday ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
                            {val > 0 ? val.toFixed(1) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
