import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: '/api/',
  timeout: 30000,
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  }
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('staff_access_token');

  if (token) {
    const tokenPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    if (tokenPattern.test(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      localStorage.removeItem('staff_access_token');
      localStorage.removeItem('staff_refresh_token');
    }
  }

  config.headers['Accept-Language'] = 'ar';

  if (!(config.data instanceof FormData) &&
      (config.method === 'post' || config.method === 'put' || config.method === 'patch')) {
    config.headers['Content-Type'] = 'application/json';
  }

  if (config.data && config.headers['Content-Type'] === 'application/json') {
    config.data = JSON.stringify(config.data);
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

axiosInstance.interceptors.response.use(
  (response) => {
    const contentType = response.headers['content-type'];
    if (contentType && !contentType.includes('application/json') &&
        !contentType.includes('multipart/form-data') &&
        !contentType.includes('text/')) {
      const error = new Error('Invalid response format');
      error.response = response;
      return Promise.reject(error);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 403 && originalRequest.url?.includes('/dashboard/')) {
      return Promise.reject(error);
    }

    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        error.message = 'Connection timeout';
      } else if (error.code === 'ERR_NETWORK') {
        error.message = 'Server connection failed';
      }
      return Promise.reject(error);
    }

    if (error.response.status === 401) {
      if (originalRequest.url.includes('/token/refresh/') || originalRequest.url.includes('/auth/login')) {
        localStorage.clear();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = 'Bearer ' + token;
              resolve(axiosInstance(originalRequest));
            },
            reject: (err) => {
              reject(err);
            }
          });
        });
      }

      if (!originalRequest._retry) {
        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = localStorage.getItem('staff_refresh_token');

        if (!refreshToken) {
          localStorage.clear();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          isRefreshing = false;
          return Promise.reject(error);
        }

        try {
          const response = await axios.post('/api/token/refresh/',
            { refresh: refreshToken },
            {
              timeout: 10000,
              headers: {
                'Content-Type': 'application/json',
                'Accept-Language': 'ar'
              }
            }
          );

          const { access, refresh } = response.data;

          if (typeof access !== 'string' || access.trim().length === 0) {
            throw new Error('Invalid access token received');
          }

          localStorage.setItem('staff_access_token', access);

          if (refresh) {
            localStorage.setItem('staff_refresh_token', refresh);
          }

          axiosInstance.defaults.headers.common.Authorization = `Bearer ${access}`;
          originalRequest.headers.Authorization = `Bearer ${access}`;

          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('auth-token-refreshed', {
              detail: access
            }));
          }

          processQueue(null, access);

          const retryResponse = await axiosInstance(originalRequest);
          isRefreshing = false;
          return retryResponse;

        } catch (refreshError) {
          processQueue(refreshError, null);

          localStorage.clear();

          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('auth-logout'));
          }

          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }

          isRefreshing = false;
          return Promise.reject(refreshError);
        }
      }
    }

    switch (error.response.status) {
      case 400:
        error.message = 'Invalid request data';
        break;
      case 403:
        error.message = 'Access denied';
        break;
      case 404:
        error.message = 'Resource not found';
        break;
      case 405:
        error.message = 'Method not allowed';
        break;
      case 408:
        error.message = 'Request timeout';
        break;
      case 409:
        error.message = 'Conflict occurred';
        break;
      case 413:
        error.message = 'Request too large';
        break;
      case 415:
        error.message = 'Unsupported media type';
        break;
      case 422:
        error.message = 'Validation error';
        break;
      case 429:
        error.message = 'Too many requests';
        break;
      case 500:
        error.message = 'Internal server error';
        break;
      case 502:
        error.message = 'Bad gateway';
        break;
      case 503:
        error.message = 'Service unavailable';
        break;
      case 504:
        error.message = 'Gateway timeout';
        break;
      default:
        if (error.response.status >= 500) {
          error.message = 'Server error occurred';
        }
    }

    if (error.response.data) {
      if (typeof error.response.data === 'object') {
        const errorData = error.response.data;

        if (errorData.detail && typeof errorData.detail === 'string') {
          error.message = errorData.detail;
        } else if (Array.isArray(errorData.non_field_errors) && errorData.non_field_errors[0]) {
          error.message = errorData.non_field_errors[0];
        } else {
          for (const [key, value] of Object.entries(errorData)) {
            if (Array.isArray(value) && value[0]) {
              error.message = `${key}: ${value[0]}`;
              break;
            } else if (typeof value === 'string') {
              error.message = value;
              break;
            }
          }
        }
      } else if (typeof error.response.data === 'string') {
        try {
          const parsed = JSON.parse(error.response.data);
          if (parsed.detail && typeof parsed.detail === 'string') {
            error.message = parsed.detail;
          }
        } catch {
          if (error.response.data.length < 500) {
            error.message = error.response.data;
          }
        }
      }
    }

    if (!originalRequest._suppressErrorLog) {
      console.error('API Error:', {
        url: originalRequest.url,
        method: originalRequest.method,
        status: error.response?.status,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
