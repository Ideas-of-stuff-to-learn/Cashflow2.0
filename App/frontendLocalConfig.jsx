export const local = import.meta.env.VITE_LOCAL_DEV === 'true';

export const url = local
    ? `http://${import.meta.env.VITE_LOCAL_IP}:5000`
    : "https://cashflow2-0.onrender.com";
