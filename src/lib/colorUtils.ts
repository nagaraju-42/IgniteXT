export const getUnitColor = (unitNumber: number | string | null | undefined) => {
  if (!unitNumber) return 'bg-[var(--hl)] text-[var(--ink)]'; // Default yellow/highlight

  const num = typeof unitNumber === 'string' ? parseInt(unitNumber.replace(/\D/g, ''), 10) : unitNumber;
  
  if (isNaN(num)) return 'bg-[var(--hl)] text-[var(--ink)]';

  const colors = [
    'bg-[#DBEAFE] text-[#1E3A8A]', // 1: Blue
    'bg-[#D1FAE5] text-[#065F46]', // 2: Green
    'bg-[#F3E8FF] text-[#581C87]', // 3: Purple
    'bg-[#FFEDD5] text-[#9A3412]', // 4: Orange
    'bg-[#FCE7F3] text-[#9D174D]', // 5: Pink
    'bg-[#CCFBF1] text-[#115E59]', // 6: Teal
  ];

  return colors[(num - 1) % colors.length];
};
