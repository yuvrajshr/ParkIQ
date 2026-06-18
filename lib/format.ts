export const comma = (n: number) => Math.round(n).toLocaleString("en-IN");

export const rupees = (n: number) => `₹${comma(n)}`;
