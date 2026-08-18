/**
 * Quy tắc định danh và sắp xếp Mã Nhân Viên chuẩn toàn hệ thống:
 * 
 * - Ký tự 1: Loại hình nhân sự
 *   + Số 1: Mã nhân viên văn phòng / quản lý (Staff, Senior Staff, Manager, S. Manager...)
 *   + Số 2: Mã OP (Công nhân / Leader / OP...)
 *   => Toàn bộ nhân viên (đầu 1) xếp trước, toàn bộ OP (đầu 2) xếp sau.
 * 
 * - Ký tự 2 và 3: Năm vào làm
 *   + VD: 17 = 2017, 20 = 2020, 21 = 2021...
 *   => Xếp theo năm tăng dần (vào làm trước xếp trước).
 * 
 * - Ký tự 4 và 5: Tháng vào làm
 *   + VD: 01, 04, 09, 10, 11, 12...
 *   => Xếp theo tháng tăng dần trong cùng năm.
 * 
 * - 3 số cuối (hoặc các số còn lại): Số thứ tự tuyển dụng (STT) của nhân viên hoặc OP
 *   + VD: 029, 079, 081, 196, 220, 3409, 3678, 3679, 4873, 4874...
 *   => Xếp theo số thứ tự tăng dần.
 */

export function compareEmployeeCode(idA?: string | null, idB?: string | null): number {
  if (!idA && !idB) return 0;
  if (!idA) return 1;
  if (!idB) return -1;

  const a = String(idA).trim();
  const b = String(idB).trim();

  // 1. So sánh chữ số đầu tiên: 1 (Nhân viên) đứng trước 2 (OP)
  const typeA = a.charAt(0);
  const typeB = b.charAt(0);
  if (typeA !== typeB) {
    return typeA.localeCompare(typeB);
  }

  // 2. So sánh Năm vào làm (2 chữ số tiếp theo: index 1-3)
  const yearA = parseInt(a.substring(1, 3), 10) || 0;
  const yearB = parseInt(b.substring(1, 3), 10) || 0;
  if (yearA !== yearB) {
    return yearA - yearB;
  }

  // 3. So sánh Tháng vào làm (2 chữ số tiếp theo: index 3-5)
  const monthA = parseInt(a.substring(3, 5), 10) || 0;
  const monthB = parseInt(b.substring(3, 5), 10) || 0;
  if (monthA !== monthB) {
    return monthA - monthB;
  }

  // 4. So sánh Số thứ tự tuyển dụng (các chữ số còn lại từ index 5 trở đi)
  const seqA = parseInt(a.substring(5), 10) || 0;
  const seqB = parseInt(b.substring(5), 10) || 0;
  if (seqA !== seqB) {
    return seqA - seqB;
  }

  // Fallback so sánh chuỗi số tự nhiên
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortEmployeesByCode<T extends { id: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => compareEmployeeCode(a.id, b.id));
}
