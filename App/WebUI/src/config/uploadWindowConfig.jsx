// config/uploadWindowConfig.jsx
//
// Controls how "files uploaded this session" vs "past files uploaded"
// gets split - sent to the backend as query params on every
// /uploads/breakdown call, so changing this file changes the behavior
// for everyone without a backend redeploy.
//
//   'logout'      - a file stays "this session" until you log out (or
//                    are forced back to login after refresh-token
//                    expiry) - no time limit at all.
//   'time_gated'  - a file becomes "past" once DURATION_VALUE
//                    DURATION_UNIT have elapsed since ITS OWN upload
//                    time, independent of login/logout.
//
// DURATION_UNIT must be one of: 'minutes', 'hours', 'days', 'months',
// 'years' - anything else is silently ignored server-side, falling
// back to the backend's own default.

export const UPLOAD_WINDOW_MODE = 'logout'; // 'logout' | 'time_gated'
export const UPLOAD_WINDOW_DURATION_VALUE = 7;
export const UPLOAD_WINDOW_DURATION_UNIT = 'days';