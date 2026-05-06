//   : src/utils/validators.js

/**
 *     .
 * @param {string} email -    .
 * @returns {boolean} - `true`   .
 */
export const validateEmail = (email) => {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

/**
 *      HTML   XSS .
 * @param {string} input -   .
 * @returns {string} -  .
 */
export const sanitizeInput = (input) => {
  if (!input) return '';
  return input.replace(/[<>]/g, '');
};

/**
 *     .
 * @param {string} password -    .
 * @returns {{score: number, text: string, color: string}} -       .
 */
export const checkPasswordStrength = (password) => {
  if (!password) return { score: 0, text: '', color: 'text-danger' };

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  let score = 0;
  if (hasUpperCase) score++;
  if (hasLowerCase) score++;
  if (hasNumbers) score++;
  if (hasSpecial) score++;
  if (password.length >= 8) score++;

  if (score <= 2) return { score, text: 'ضعيفة', color: 'text-danger' };
  if (score <= 3) return { score, text: 'متوسطة', color: 'text-warning' };
  if (score <= 4) return { score, text: 'قوية', color: 'text-success' };
  return { score, text: 'قوية جداً', color: 'text-success' };
};