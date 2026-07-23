import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useIsMobile } from '../customHooks/useIsMobile';

const MOBILE_SCREENS = ['/home', '/charts', '/contents'];
const DESKTOP_SCREEN = '/dashboard';

export default function OrientationGuard({ children }) {
    const isMobile = useIsMobile();
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const onMobileScreen = MOBILE_SCREENS.includes(location.pathname);
        const onDesktopScreen = location.pathname === DESKTOP_SCREEN;

        if (isMobile && onDesktopScreen) {
            navigate('/home', { replace: true });
        } else if (!isMobile && onMobileScreen) {
            navigate('/dashboard', { replace: true });
        }
    }, [isMobile]);

    return children;
}