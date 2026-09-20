import { useState } from 'react';
import { toggleTheme, getTheme } from '../theme';

export default function ThemeToggle() {
    const [dark, setDark] = useState(() => getTheme() === 'dark');

    const handle = () => {
        const next = toggleTheme();
        setDark(next === 'dark');
    };

    return (
        <button
            onClick={handle}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                padding: '4px 6px',
                lineHeight: 1,
                flexShrink: 0,
            }}
        >
            {dark ? '☀️' : '🌙'}
        </button>
    );
}
