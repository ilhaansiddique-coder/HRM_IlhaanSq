export type SkuCategory = { code: string; label: string };
export type SkuColor = { code: string; label: string };
export type SkuSize = { code: string; label: string };

export const SKU_CATEGORIES: SkuCategory[] = [
  { code: "TS", label: "T-Shirt" },
  { code: "SH", label: "Shirt" },
  { code: "PL", label: "Polo" },
  { code: "SW", label: "Sweater" },
  { code: "HD", label: "Hoodie" },
  { code: "JK", label: "Jacket" },
  { code: "CT", label: "Coat" },
  { code: "BL", label: "Blazer" },
  { code: "PT", label: "Pants" },
  { code: "JN", label: "Jeans" },
  { code: "SR", label: "Shorts" },
  { code: "SK", label: "Skirt" },
  { code: "DR", label: "Dress" },
  { code: "JP", label: "Jumpsuit" },
  { code: "TP", label: "Top" },
  { code: "UW", label: "Underwear" },
  { code: "SW2", label: "Swimwear" },
  { code: "SC", label: "Scarf" },
  { code: "CP", label: "Cap" },
  { code: "AC", label: "Accessory" },
];

export const SKU_COLORS: SkuColor[] = [
  { code: "BLK", label: "Black" },
  { code: "WHI", label: "White" },
  { code: "GRY", label: "Grey" },
  { code: "NVY", label: "Navy" },
  { code: "BLU", label: "Blue" },
  { code: "RED", label: "Red" },
  { code: "GRN", label: "Green" },
  { code: "YLW", label: "Yellow" },
  { code: "ORG", label: "Orange" },
  { code: "PNK", label: "Pink" },
  { code: "PUR", label: "Purple" },
  { code: "BRN", label: "Brown" },
  { code: "BEI", label: "Beige" },
  { code: "KHA", label: "Khaki" },
  { code: "MRN", label: "Maroon" },
  { code: "MLT", label: "Multi" },
];

export const SKU_SIZES: SkuSize[] = [
  { code: "XS", label: "XS" },
  { code: "S", label: "S" },
  { code: "M", label: "M" },
  { code: "L", label: "L" },
  { code: "XL", label: "XL" },
  { code: "XXL", label: "XXL" },
  { code: "3XL", label: "3XL" },
  { code: "28", label: "28" },
  { code: "30", label: "30" },
  { code: "32", label: "32" },
  { code: "34", label: "34" },
  { code: "36", label: "36" },
  { code: "38", label: "38" },
  { code: "40", label: "40" },
  { code: "42", label: "42" },
  { code: "FREE", label: "Free Size" },
];

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

function lettersOnly(word: string): string {
  return word.toUpperCase().replace(/[^A-Z]/g, "");
}

function beforeFirstVowel(word: string): string {
  const letters = lettersOnly(word);
  if (!letters) return "";
  let out = "";
  for (const ch of letters) {
    if (VOWELS.has(ch)) break;
    out += ch;
  }
  return out || letters[0];
}

export function deriveCategoryCode(label: string): string {
  const words = (label || "")
    .split(/[\s\-_/]+/)
    .map(lettersOnly)
    .filter(Boolean);

  if (words.length === 0) return "CAT";

  if (words.length === 1) {
    const code = beforeFirstVowel(words[0]);
    return code.length >= 2 ? code : words[0].slice(0, 2);
  }

  const leadingInitials = words
    .slice(0, -1)
    .map((w) => w[0])
    .join("");
  const lastCode = beforeFirstVowel(words[words.length - 1]);
  return (leadingInitials + lastCode).slice(0, 6);
}

export function normalizeSkuPart(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export function padStyleNumber(n: number): string {
  const clamped = Math.max(1, Math.min(9999, Math.floor(n)));
  return clamped.toString().padStart(4, "0");
}

export function buildSku(opts: {
  category: string;
  style: string | number;
  color?: string | null;
  size?: string | null;
}): string {
  const cat = normalizeSkuPart(opts.category);
  if (!cat) return "";
  const style =
    typeof opts.style === "number"
      ? padStyleNumber(opts.style)
      : normalizeSkuPart(opts.style) || padStyleNumber(1);
  const parts = [cat, style];
  const color = normalizeSkuPart(opts.color);
  const size = normalizeSkuPart(opts.size);
  if (color) parts.push(color);
  if (size) parts.push(size);
  return parts.join("-");
}

export function parseStyleFromSku(sku: string | null | undefined, category: string): number | null {
  if (!sku || !category) return null;
  const prefix = normalizeSkuPart(category) + "-";
  if (!sku.startsWith(prefix)) return null;
  const rest = sku.slice(prefix.length);
  const match = rest.match(/^(\d+)/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}
