// D:/frontend/src/services/axiosConfig.js
import axios from 'axios';
import i18n from '../i18n';
import { safeLocalStorage } from '../utils/storageHelper';

const instance = axios.create({
  baseURL: '/api/',
  timeout: 10000,
});

instance.interceptors.request.use(
  (config) => {
    const accessToken = safeLocalStorage.getItem('access');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    const currentLanguage = i18n.language || 'ar';
    if (!config.headers) {
      config.headers = {};
    }
    config.headers['Accept-Language'] = currentLanguage;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

instance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    if (!error.response) {
      const errorMessage = error.code === 'ECONNABORTED'
        ? 'انتهى وقت الانتظار، يرجى التحقق من اتصال الإنترنت'
        : 'فشل الاتصال بالخادم، يرجى المحاولة لاحقاً';

      console.error('Network Error:', error);
      return Promise.reject({
        response: { data: { detail: errorMessage } }
      });
    }

    const originalRequest = error.config;

    if (originalRequest && originalRequest.url) {
      const excludedPathsFor401Handling = [
        '/accounts/login/',
        '/management/auth/login/',
        '/token/refresh/'
      ];

      const fullBaseURL = '/api';
      const excludedPathsFull = excludedPathsFor401Handling.map(path => fullBaseURL + path);

      const isExcludedPath = excludedPathsFor401Handling.some(path =>
        originalRequest.url.includes(path)
      ) || excludedPathsFull.some(fullPath =>
        originalRequest.url === fullPath
      );

      if (error.response.status === 401 && isExcludedPath) {
        return Promise.reject(error);
      }
    }

    if (error.response.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = safeLocalStorage.getItem('refresh');

      if (refreshToken) {
        try {
          const response = await axios.post(
            '/api/token/refresh/',
            { refresh: refreshToken },
            {
              timeout: 5000,
              headers: {
                'Accept-Language': i18n.language || 'ar'
              }
            }
          );

          const { access } = response.data;
          safeLocalStorage.setItem('access', access);

          instance.defaults.headers.common['Authorization'] = `Bearer ${access}`;
          originalRequest.headers['Authorization'] = `Bearer ${access}`;

          return instance(originalRequest);
        } catch (refreshError) {
          console.error('Token Refresh Failed:', refreshError);
          safeLocalStorage.removeItem('access');
          safeLocalStorage.removeItem('refresh');
          safeLocalStorage.removeItem('user_info');
          window.location.href = '/account/login-check';
          return Promise.reject(refreshError);
        }
      } else {
        safeLocalStorage.removeItem('access');
        safeLocalStorage.removeItem('refresh');
        safeLocalStorage.removeItem('user_info');
        window.location.href = '/account/login-check';
        return Promise.reject(error);
      }
    }

    const statusCode = error.response.status;
    let customError = { ...error };

    if (typeof customError.response.data === 'object' && customError.response.data !== null) {
      if (statusCode >= 500) {
        customError.response.data.detail = 'خطأ في الخادم الداخلي، يرجى المحاولة لاحقاً';
      }
    } else {
      console.error("Backend returned a non-JSON error response:", customError.response.data);
      customError.response.data = {
        detail: `خطأ في الخادم (كود ${statusCode}).`
      };
    }

    return Promise.reject(customError);
  }
);

export default instance;
