
export const safeLocalStorage = {
  getItem: (key) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`Error getting ${key} from localStorage:`, e);
      return null;
    }
    return null;
  },

  setItem: (key, value) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`Error setting ${key} in localStorage:`, e);
    }
  },

  removeItem: (key) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`Error removing ${key} from localStorage:`, e);
    }
  }
};

export const safeSessionStorage = {
  getItem: (key) => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
    } catch  {
      return null;
    }
    return null;
  },

  setItem: (key, value) => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
      }
    } catch  {
      // Ignore
    }
  },

  removeItem: (key) => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch  {
      // Ignore
    }
  }
};