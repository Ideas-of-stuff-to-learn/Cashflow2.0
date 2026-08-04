export const local = import.meta.env.VITE_LOCAL_DEV === 'true';


export const url = local
    ? "http://192.168.0.101:5000"
    : "https://cashflow2-0.onrender.com";