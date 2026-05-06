//   : src/utils/auditLogger.js

/**
 *       .
 *        endpoint    .
 * @param {string} action -   (: 'PASSWORD_CHANGE').
 * @param {object} details -    .
 */
const logAction = async (action, details) => {
  //        .
  if (import.meta.env.DEV) {
    console.log('[AUDIT LOG]', {
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  //             endpoint.
  /*
  try {
    await axios.post('/audit/log/', { action, details });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
  */
};

export default logAction;