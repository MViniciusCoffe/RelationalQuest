export const pad = (number, size = 2) => String(number).padStart(size, '0');
export const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
