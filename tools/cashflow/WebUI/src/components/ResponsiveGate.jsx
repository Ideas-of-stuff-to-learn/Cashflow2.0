// components/ResponsiveGate.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useIsMobile } from '../customHooks/useIsMobile';

const MOBILE_SCREENS = ['/home', '/charts'];
const DESKTOP_SCREEN = '/dashboard';

// Replaces OrientationGuard + RootRedirect's split logic with a single
// live decision, re-evaluated on every render (not just on width
// change, and not just once at "/") - this is what makes back/forward
// navigation, browser history, and resizing all consistently land on
// the correct screen for the CURRENT width, every time, rather than
// only reacting to specific trigger events.
export default function ResponsiveGate() {
    const isMobile = useIsMobile();
    const location = useLocation();

    const onMobileScreen = MOBILE_SCREENS.includes(location.pathname);
    const onDesktopScreen = location.pathname === DESKTOP_SCREEN;

    if (isMobile && onDesktopScreen) {
        return <Navigate to="/home" replace />;
    }
    if (!isMobile && onMobileScreen) {
        return <Navigate to="/dashboard" replace />;
    }
    if (location.pathname === '/') {
        return <Navigate to={isMobile ? '/home' : '/dashboard'} replace />;
    }

    return <Outlet />;
}