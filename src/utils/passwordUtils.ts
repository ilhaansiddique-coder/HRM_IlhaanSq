const LOWERCASE = "abcdefghjkmnpqrstuvwxyz";
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,./?";

export type PasswordStrengthLabel = "Weak" | "Fair" | "Strong" | "Very Strong";

export interface PasswordStrengthResult {
  score: number;
  label: PasswordStrengthLabel;
  percent: number;
  colorClassName: string;
  feedback: string[];
}

const COMMON_PATTERNS = [
  "password",
  "admin",
  "tenant",
  "qwerty",
  "abc123",
  "welcome",
  "letmein",
  "123456",
  "111111",
];

const getCrypto = () => {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    return globalThis.crypto;
  }

  throw new Error("Secure password generation is unavailable in this environment.");
};

const getRandomInt = (max: number) => {
  const cryptoApi = getCrypto();
  const values = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / max) * max;

  while (true) {
    cryptoApi.getRandomValues(values);
    const candidate = values[0];
    if (candidate < limit) {
      return candidate % max;
    }
  }
};

const pickRandomChar = (charset: string) => charset[getRandomInt(charset.length)];

const shuffle = (value: string) => {
  const characters = value.split("");
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = getRandomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
};

export const generateSecurePassword = (length = 18) => {
  const targetLength = Math.max(length, 16);
  const allCharacters = `${LOWERCASE}${UPPERCASE}${DIGITS}${SYMBOLS}`;
  const requiredCharacters = [
    pickRandomChar(LOWERCASE),
    pickRandomChar(UPPERCASE),
    pickRandomChar(DIGITS),
    pickRandomChar(SYMBOLS),
  ];

  while (requiredCharacters.length < targetLength) {
    requiredCharacters.push(pickRandomChar(allCharacters));
  }

  return shuffle(requiredCharacters.join(""));
};

const containsSequence = (value: string) => {
  const normalized = value.toLowerCase();
  const sequences = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiopasdfghjklzxcvbnm"];

  return sequences.some((sequence) => {
    for (let index = 0; index <= sequence.length - 4; index += 1) {
      const fragment = sequence.slice(index, index + 4);
      const reversed = fragment.split("").reverse().join("");
      if (normalized.includes(fragment) || normalized.includes(reversed)) {
        return true;
      }
    }

    return false;
  });
};

export const getPasswordStrength = (password: string): PasswordStrengthResult => {
  const feedback: string[] = [];
  const trimmed = password.trim();

  if (!trimmed) {
    return {
      score: 0,
      label: "Weak",
      percent: 10,
      colorClassName: "bg-destructive",
      feedback: ["Enter a password to see its strength."],
    };
  }

  let score = 0;
  const hasLowercase = /[a-z]/.test(trimmed);
  const hasUppercase = /[A-Z]/.test(trimmed);
  const hasDigits = /\d/.test(trimmed);
  const hasSymbols = /[^A-Za-z0-9]/.test(trimmed);
  const categories = [hasLowercase, hasUppercase, hasDigits, hasSymbols].filter(Boolean).length;
  const repeatedCharacters = /(.)\1{2,}/.test(trimmed);
  const containsCommonPattern = COMMON_PATTERNS.some((pattern) => trimmed.toLowerCase().includes(pattern));
  const sequentialPattern = containsSequence(trimmed);

  if (trimmed.length >= 8) score += 1;
  if (trimmed.length >= 12) score += 1;
  if (trimmed.length >= 16) score += 1;
  if (categories >= 3) score += 1;
  if (categories === 4) score += 1;
  if (trimmed.length >= 20 && categories >= 3) score += 1;

  if (!hasLowercase) feedback.push("Add lowercase letters.");
  if (!hasUppercase) feedback.push("Add uppercase letters.");
  if (!hasDigits) feedback.push("Add numbers.");
  if (!hasSymbols) feedback.push("Add symbols.");
  if (trimmed.length < 12) feedback.push("Use at least 12 characters.");
  if (repeatedCharacters) {
    feedback.push("Avoid repeated characters.");
    score -= 1;
  }
  if (containsCommonPattern) {
    feedback.push("Avoid common words or phrases.");
    score -= 2;
  }
  if (sequentialPattern) {
    feedback.push("Avoid easy sequences like 1234 or abcd.");
    score -= 1;
  }

  const normalizedScore = Math.max(0, Math.min(3, score <= 1 ? 0 : score <= 3 ? 1 : score <= 5 ? 2 : 3));

  if (feedback.length === 0) {
    feedback.push("Strong password structure.");
  }

  if (normalizedScore === 0) {
    return {
      score: 0,
      label: "Weak",
      percent: 25,
      colorClassName: "bg-destructive",
      feedback,
    };
  }

  if (normalizedScore === 1) {
    return {
      score: 1,
      label: "Fair",
      percent: 50,
      colorClassName: "bg-orange-500",
      feedback,
    };
  }

  if (normalizedScore === 2) {
    return {
      score: 2,
      label: "Strong",
      percent: 75,
      colorClassName: "bg-yellow-500",
      feedback,
    };
  }

  return {
    score: 3,
    label: "Very Strong",
    percent: 100,
    colorClassName: "bg-emerald-500",
    feedback,
  };
};
